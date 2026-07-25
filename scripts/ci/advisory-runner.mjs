#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { isAbsolute, join, relative, resolve } from "node:path";

const ARTIFACT_NAMES = Object.freeze({
  markdown: "release-review.md",
  json: "release-review.json",
  status: "release-review-status.json",
});
const MAX_COMMAND_BYTES = 8 * 1024;
const MAX_COMMAND_PARTS = 64;
const MAX_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_CAPTURE_BYTES = 64 * 1024;
const MAX_REPORT_BYTES = 10 * 1024 * 1024;
const MAX_FAILURE_ARTIFACT_BYTES = 8 * 1024;
const MAX_EVIDENCE_SOURCES = 10_000;
const MAX_RELATED_CHANGE_IDS = 1_000;
const MAX_REDACTIONS = 100;
const TERMINATION_GRACE_MS = 250;
const SAFE_HOST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;
const SAFE_REVISION = /^(?:HEAD|[a-f0-9]{7,64}|refs\/(?:heads|tags|remotes)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,127})$/;
const SAFE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SAFE_SHA256 = /^sha256:[a-f0-9]{64}$/;
const EVIDENCE_TYPES = new Set([
  "git_diff",
  "commit",
  "document",
  "test_result",
  "runtime_observation",
  "configuration",
  "other",
]);
const TRUST_LEVELS = new Set([
  "trusted_repository",
  "trusted_configured_source",
  "untrusted_external",
  "observed_runtime",
]);
const REDACTION_KINDS = new Set(["secret", "personal_data", "policy", "other"]);
const EXTERNAL_SOURCE_TYPES = new Set(["document", "project_item", "comment", "linked_page", "other"]);

class RunnerError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function isStrictDescendant(parent, child) {
  const rel = relative(parent, child);
  return rel !== "" && !isAbsolute(rel) && !rel.split(/[\\/]/).includes("..");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function safeNumber(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255 ? value : undefined;
}

function boundedAppend(current, chunk) {
  if (current.length >= MAX_CAPTURE_BYTES) return current;
  return Buffer.concat([current, chunk]).subarray(0, MAX_CAPTURE_BYTES);
}

function parseCommand(value) {
  if (typeof value !== "string" || value.length === 0 || Buffer.byteLength(value, "utf8") > MAX_COMMAND_BYTES) {
    throw new RunnerError("invalid_host_command");
  }
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new RunnerError("invalid_host_command"); }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_COMMAND_PARTS || parsed.some((part) => typeof part !== "string" || part.length === 0 || part.includes("\0"))) {
    throw new RunnerError("invalid_host_command");
  }
  return parsed;
}

function parsePositiveInteger(value, fallback, maximum, code) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new RunnerError(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new RunnerError(code);
  return parsed;
}

function parseRevision(value) {
  if (value === undefined || value === "") return null;
  if (value.length > 160 || !SAFE_REVISION.test(value) || value.includes("..")) throw new RunnerError("invalid_revision");
  return value;
}

async function validateOutput(repositoryRoot, outputDirectory) {
  if (typeof repositoryRoot !== "string" || !isAbsolute(repositoryRoot)) throw new RunnerError("invalid_repository_root");
  if (typeof outputDirectory !== "string" || outputDirectory.length === 0 || isAbsolute(outputDirectory)) throw new RunnerError("invalid_output_directory");
  const resolvedRoot = await realpath(repositoryRoot).catch(() => { throw new RunnerError("invalid_repository_root"); });
  const target = resolve(resolvedRoot, outputDirectory);
  if (!isStrictDescendant(resolvedRoot, target)) throw new RunnerError("output_path_escape");
  const segments = relative(resolvedRoot, target).split(/[\\/]/);
  if (segments.some((segment) => segment.toLowerCase() === ".git")) throw new RunnerError("output_path_git");

  let current = resolvedRoot;
  for (const segment of segments) {
    current = join(current, segment);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new RunnerError("output_path_symlink");
      if (current !== target && !stat.isDirectory()) throw new RunnerError("output_path_not_directory");
    } catch (error) {
      if (error instanceof RunnerError) throw error;
      if (error && error.code === "ENOENT") break;
      throw new RunnerError("output_path_unreadable");
    }
  }
  await mkdir(target, { recursive: true }).catch(() => { throw new RunnerError("output_directory_create_failed"); });
  const resolvedTarget = await realpath(target).catch(() => { throw new RunnerError("output_path_unreadable"); });
  if (!isStrictDescendant(resolvedRoot, resolvedTarget)) throw new RunnerError("output_path_escape");
  const targetStat = await lstat(resolvedTarget).catch(() => { throw new RunnerError("output_path_unreadable"); });
  if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) throw new RunnerError("output_path_not_directory");
  return { resolvedRoot, output: resolvedTarget };
}

async function assertManagedFilesSafe(output) {
  for (const name of Object.values(ARTIFACT_NAMES)) {
    const file = join(output, name);
    try {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new RunnerError("unsafe_managed_artifact");
    } catch (error) {
      if (error instanceof RunnerError) throw error;
      if (error && error.code === "ENOENT") continue;
      throw new RunnerError("managed_artifact_unreadable");
    }
  }
}

async function invalidateManagedArtifacts(output) {
  // Publishers and readers must never mistake a prior status sidecar for this
  // run. Remove it first, then invalidate the only two Host-owned report
  // files. This function never scans or deletes any other directory entry.
  for (const name of [ARTIFACT_NAMES.status, ARTIFACT_NAMES.markdown, ARTIFACT_NAMES.json]) {
    const file = join(output, name);
    try {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new RunnerError("unsafe_managed_artifact");
      await unlink(file);
    } catch (error) {
      if (error instanceof RunnerError) throw error;
      if (error && error.code === "ENOENT") continue;
      throw new RunnerError("managed_artifact_invalidation_failed");
    }
  }
}

async function runHost(command, environment, timeoutMs) {
  return new Promise((resolveRun) => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    let settled = false;
    let child;
    let timeoutTimer;
    let forceTimer;
    let settleTimer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(forceTimer);
      clearTimeout(settleTimer);
      resolveRun(result);
    };
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch { /* direct-child termination is best effort */ }
      forceTimer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* direct-child termination is best effort */ }
        // A misbehaving platform must not keep the wrapper waiting forever.
        // The only process targeted is the configured direct child.
        settleTimer = setTimeout(() => finish({ code: "host_timeout" }), TERMINATION_GRACE_MS);
      }, TERMINATION_GRACE_MS);
    }, timeoutMs);
    try {
      child = spawn(command[0], command.slice(1), {
        cwd: environment.CHANGE_TRACE_CI_REPOSITORY_ROOT,
        env: environment,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      finish({ code: "host_spawn_failed" });
      return;
    }
    child.stdout.on("data", (chunk) => { stdout = boundedAppend(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = boundedAppend(stderr, chunk); });
    child.once("error", () => finish({ code: "host_spawn_failed" }));
    child.once("close", (exitCode) => {
      // Both buffers are intentionally discarded here. They are drained only
      // to prevent child backpressure and are never logged or persisted.
      void stdout; void stderr;
      if (timedOut) finish({ code: "host_timeout" });
      else if (exitCode !== 0) finish({ code: "host_nonzero_exit", exitCode: safeNumber(exitCode) });
      else finish({ code: undefined });
    });
  });
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isBoundedString(value, maximum) {
  return typeof value === "string" && value.length >= 1 && value.length <= maximum;
}

function isStableId(value) {
  return typeof value === "string" && SAFE_ID.test(value);
}

function isTimestamp(value) {
  return typeof value === "string" && SAFE_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

function hasExactKeys(value, required, optional = []) {
  if (!isObject(value) || !required.every((key) => Object.hasOwn(value, key))) return false;
  const allowed = new Set([...required, ...optional]);
  return Object.keys(value).every((key) => allowed.has(key));
}

function validSourceReference(source) {
  return hasExactKeys(source, ["system", "locator", "uri"])
    && isBoundedString(source.system, 80)
    && isBoundedString(source.locator, 4_096)
    && (source.uri === null || isBoundedString(source.uri, 8_192));
}

function validRedaction(redaction) {
  return hasExactKeys(redaction, ["kind", "count", "note"])
    && REDACTION_KINDS.has(redaction.kind)
    && Number.isInteger(redaction.count)
    && redaction.count > 0
    && (redaction.note === null || isBoundedString(redaction.note, 500));
}

function validExternalAdapter(adapter) {
  return hasExactKeys(adapter, ["id", "name", "version"])
    && isStableId(adapter.id)
    && isBoundedString(adapter.name, 160)
    && isBoundedString(adapter.version, 160);
}

function validExternalProvenance(provenance) {
  return hasExactKeys(provenance, ["adapter", "sourceType", "title", "sourceUpdatedAt"])
    && validExternalAdapter(provenance.adapter)
    && EXTERNAL_SOURCE_TYPES.has(provenance.sourceType)
    && isBoundedString(provenance.title, 1_000)
    && (provenance.sourceUpdatedAt === null || isTimestamp(provenance.sourceUpdatedAt));
}

function validEvidenceSource(evidence) {
  if (!hasExactKeys(
    evidence,
    [
      "evidenceId",
      "type",
      "source",
      "retrievedAt",
      "contentHash",
      "relatedChangeIds",
      "trustLevel",
      "redactions",
    ],
    ["externalProvenance"],
  )) return false;
  if (!isStableId(evidence.evidenceId)
    || !EVIDENCE_TYPES.has(evidence.type)
    || !validSourceReference(evidence.source)
    || !isTimestamp(evidence.retrievedAt)
    || (evidence.contentHash !== null && (typeof evidence.contentHash !== "string" || !SAFE_SHA256.test(evidence.contentHash)))
    || !Array.isArray(evidence.relatedChangeIds)
    || evidence.relatedChangeIds.length > MAX_RELATED_CHANGE_IDS
    || !evidence.relatedChangeIds.every(isStableId)
    || !TRUST_LEVELS.has(evidence.trustLevel)
    || !Array.isArray(evidence.redactions)
    || evidence.redactions.length > MAX_REDACTIONS
    || !evidence.redactions.every(validRedaction)) return false;
  return !Object.hasOwn(evidence, "externalProvenance")
    || validExternalProvenance(evidence.externalProvenance);
}

function validEvidenceSources(evidenceSources) {
  return Array.isArray(evidenceSources)
    && evidenceSources.length <= MAX_EVIDENCE_SOURCES
    && evidenceSources.every(validEvidenceSource);
}

function validFindingArray(value, status) {
  return Array.isArray(value) && value.every((finding) => isObject(finding) && typeof finding.id === "string" && SAFE_ID.test(finding.id) && finding.status === status);
}

function validateReport(report) {
  if (!isObject(report) || report.schemaVersion !== "1.0.0" || typeof report.id !== "string" || !SAFE_ID.test(report.id) || typeof report.bundleId !== "string" || !SAFE_ID.test(report.bundleId) || typeof report.createdAt !== "string" || !SAFE_TIMESTAMP.test(report.createdAt) || Number.isNaN(Date.parse(report.createdAt))) return false;
  if (!isObject(report.reviewMeta) || !isNonEmptyString(report.reviewMeta.reviewer)) return false;
  if (!isObject(report.findings) || !validFindingArray(report.findings.confirmed, "confirmed") || !validFindingArray(report.findings.suspected, "suspected") || !validFindingArray(report.findings.inconclusive, "inconclusive")) return false;
  if (!Array.isArray(report.rejectedFindings) || !report.rejectedFindings.every((finding) => isObject(finding) && isCount(finding.index) && (finding.findingId === null || (typeof finding.findingId === "string" && SAFE_ID.test(finding.findingId))) && Array.isArray(finding.issues) && finding.issues.length > 0 && finding.issues.every((issue) => isObject(issue) && isNonEmptyString(issue.code) && isNonEmptyString(issue.path) && isNonEmptyString(issue.message)))) return false;
  if (!Array.isArray(report.missingEvidence) || !report.missingEvidence.every((evidence) => isObject(evidence) && isObject(evidence.source) && isNonEmptyString(evidence.source.system) && isNonEmptyString(evidence.source.locator) && (evidence.source.uri === null || typeof evidence.source.uri === "string") && isNonEmptyString(evidence.reason) && ["not_found", "inaccessible", "unsupported", "truncated"].includes(evidence.status))) return false;
  if (!validEvidenceSources(report.evidenceSources)) return false;
  if (!isObject(report.evidenceCoverage) || !isCount(report.evidenceCoverage.totalEvidenceItems) || !Array.isArray(report.evidenceCoverage.referencedEvidenceIds) || !Array.isArray(report.evidenceCoverage.unreferencedEvidenceIds)) return false;
  if (report.evidenceCoverage.totalEvidenceItems !== report.evidenceSources.length) return false;
  if (!isObject(report.validationSummary) || !["submitted", "valid", "rejected", "warnings"].every((key) => isCount(report.validationSummary[key]))) return false;
  if (!isObject(report.bundleLimits) || !Number.isInteger(report.bundleLimits.maxEvidenceItems) || report.bundleLimits.maxEvidenceItems < 1 || !Number.isInteger(report.bundleLimits.maxTotalExcerptCharacters) || report.bundleLimits.maxTotalExcerptCharacters < 1) return false;
  if (!isObject(report.bundleTruncation) || typeof report.bundleTruncation.isTruncated !== "boolean" || !["omittedEvidenceItems", "omittedExcerptCharacters", "omittedMissingEvidence"].every((key) => isCount(report.bundleTruncation[key]))) return false;
  if (!Array.isArray(report.warnings)) return false;
  const valid = report.findings.confirmed.length + report.findings.suspected.length + report.findings.inconclusive.length;
  const rejected = report.rejectedFindings.length;
  return report.validationSummary.valid === valid && report.validationSummary.rejected === rejected && report.validationSummary.submitted === valid + rejected;
}

async function inspectSuccessfulReport(output) {
  const markdownPath = join(output, ARTIFACT_NAMES.markdown);
  const jsonPath = join(output, ARTIFACT_NAMES.json);
  let markdownStat;
  let jsonStat;
  try {
    markdownStat = await lstat(markdownPath);
    jsonStat = await lstat(jsonPath);
  } catch { return { error: "report_missing" }; }
  if (!markdownStat.isFile() || markdownStat.isSymbolicLink() || !jsonStat.isFile() || jsonStat.isSymbolicLink()) return { error: "report_unsafe_path" };
  if (markdownStat.size === 0 || markdownStat.size > MAX_REPORT_BYTES || jsonStat.size === 0 || jsonStat.size > MAX_REPORT_BYTES) return { error: "report_size_invalid" };
  let json;
  try { json = await readFile(jsonPath); } catch { return { error: "report_read_failed" }; }
  let report;
  try { report = JSON.parse(json.toString("utf8")); } catch { return { error: "report_malformed" }; }
  if (!validateReport(report)) return { error: "report_inconsistent" };
  const counts = {
    confirmed: report.findings.confirmed.length,
    suspected: report.findings.suspected.length,
    inconclusive: report.findings.inconclusive.length,
    rejected: report.rejectedFindings.length,
    missingEvidence: report.missingEvidence.length,
    bundleTruncated: report.bundleTruncation.isTruncated,
  };
  return {
    report,
    counts,
    artifacts: {
      markdown: { name: ARTIFACT_NAMES.markdown, sizeBytes: markdownStat.size, sha256: sha256(await readFile(markdownPath)) },
      json: { name: ARTIFACT_NAMES.json, sizeBytes: jsonStat.size, sha256: sha256(json) },
    },
  };
}

async function snapshotReportPair(output) {
  const snapshots = {};
  for (const [key, name] of [["markdown", ARTIFACT_NAMES.markdown], ["json", ARTIFACT_NAMES.json]]) {
    const path = join(output, name);
    let stat;
    let content;
    try {
      stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new RunnerError("report_changed_during_status_write");
      content = await readFile(path);
    } catch (error) {
      if (error instanceof RunnerError) throw error;
      throw new RunnerError("report_changed_during_status_write");
    }
    snapshots[key] = { sizeBytes: stat.size, sha256: sha256(content) };
  }
  return snapshots;
}

function sameReportArtifacts(left, right) {
  return ["markdown", "json"].every((key) => left[key].sizeBytes === right[key].sizeBytes && left[key].sha256 === right[key].sha256);
}

function outcomeFromReport(counts) {
  if (counts.inconclusive > 0 || counts.rejected > 0 || counts.missingEvidence > 0 || counts.bundleTruncated) return "inconclusive";
  if (counts.confirmed > 0 || counts.suspected > 0) return "completed_with_findings";
  return "completed_no_findings";
}

function failureArtifact(code, exitCode) {
  const error = { code };
  if (exitCode !== undefined) error.exitCode = exitCode;
  const json = stableJson({
    schemaVersion: "1.0.0",
    artifactType: "change-trace-advisory-infrastructure-failure",
    outcome: "infrastructure_failure",
    error,
  });
  const markdown = `# Change Trace advisory CI infrastructure failure\n\nOutcome: infrastructure_failure\nCode: ${code}\n`;
  if (Buffer.byteLength(json) > MAX_FAILURE_ARTIFACT_BYTES || Buffer.byteLength(markdown) > MAX_FAILURE_ARTIFACT_BYTES) throw new RunnerError("failure_artifact_too_large");
  return { json, markdown, error };
}

async function writeArtifactSet(output, markdown, json, status) {
  await assertManagedFilesSafe(output);
  try {
    await writeFile(join(output, ARTIFACT_NAMES.markdown), markdown, "utf8");
    await writeFile(join(output, ARTIFACT_NAMES.json), json, "utf8");
    await writeFile(join(output, ARTIFACT_NAMES.status), stableJson(status), "utf8");
  } catch {
    throw new RunnerError("artifact_write_failed");
  }
}

async function writeSuccessfulStatusSidecar(output, status, expectedArtifacts) {
  await assertManagedFilesSafe(output);
  const before = await snapshotReportPair(output);
  if (!sameReportArtifacts(before, expectedArtifacts)) throw new RunnerError("report_changed_during_status_write");
  try {
    // Successful Host reports are never rewritten by the runner. The sidecar
    // is the sole published runner output on this path.
    await writeFile(join(output, ARTIFACT_NAMES.status), stableJson(status), "utf8");
  } catch {
    throw new RunnerError("artifact_write_failed");
  }
  const after = await snapshotReportPair(output);
  if (!sameReportArtifacts(after, expectedArtifacts)) throw new RunnerError("report_changed_during_status_write");
}

function summary(outcome, code) {
  process.stdout.write(`change-trace-advisory outcome=${outcome} code=${code}\n`);
}

async function main() {
  let config;
  try {
    const command = parseCommand(process.env.CHANGE_TRACE_CI_COMMAND);
    const timeoutMs = parsePositiveInteger(process.env.CHANGE_TRACE_CI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, "invalid_timeout");
    const runAttempt = parsePositiveInteger(process.env.CHANGE_TRACE_CI_RUN_ATTEMPT, 1, 1_000_000, "invalid_run_attempt");
    const baseRevision = parseRevision(process.env.CHANGE_TRACE_CI_BASE_REVISION);
    const headRevision = parseRevision(process.env.CHANGE_TRACE_CI_HEAD_REVISION);
    const hostId = process.env.CHANGE_TRACE_CI_HOST_ID ?? "configured-host";
    if (!SAFE_HOST_ID.test(hostId)) throw new RunnerError("invalid_host_id");
    const paths = await validateOutput(process.env.CHANGE_TRACE_CI_REPOSITORY_ROOT, process.env.CHANGE_TRACE_CI_OUTPUT_DIRECTORY);
    await assertManagedFilesSafe(paths.output);
    await invalidateManagedArtifacts(paths.output);
    config = { command, timeoutMs, runAttempt, baseRevision, headRevision, hostId, ...paths };
  } catch (error) {
    summary("infrastructure_failure", error instanceof RunnerError ? error.code : "configuration_failed");
    process.exitCode = 1;
    return;
  }

  const startedAt = new Date().toISOString();
  const hostResult = await runHost(config.command, {
    ...process.env,
    CHANGE_TRACE_CI_REPOSITORY_ROOT: config.resolvedRoot,
    CHANGE_TRACE_CI_OUTPUT_DIRECTORY: config.output,
    CHANGE_TRACE_CI_BASE_REVISION: config.baseRevision ?? "",
    CHANGE_TRACE_CI_HEAD_REVISION: config.headRevision ?? "",
    CHANGE_TRACE_CI_RUN_ATTEMPT: String(config.runAttempt),
  }, config.timeoutMs);
  const completedAt = new Date().toISOString();
  const inspected = hostResult.code === undefined ? await inspectSuccessfulReport(config.output) : { error: hostResult.code, exitCode: hostResult.exitCode };
  const failureCode = inspected.error;
  const run = {
    runId: randomUUID(),
    runAttempt: config.runAttempt,
    startedAt,
    completedAt,
    baseRevision: config.baseRevision,
    headRevision: config.headRevision,
  };

  try {
    if (failureCode !== undefined) {
      const failure = failureArtifact(failureCode, inspected.exitCode);
      const status = {
        schemaVersion: "1.0.0",
        artifactType: "change-trace-advisory-infrastructure-failure",
        outcome: "infrastructure_failure",
        run,
        host: { id: config.hostId },
        error: failure.error,
        counts: { confirmed: 0, suspected: 0, inconclusive: 0, rejected: 0, missingEvidence: 0, bundleTruncated: false },
        artifacts: {
          markdown: { name: ARTIFACT_NAMES.markdown, sizeBytes: Buffer.byteLength(failure.markdown), sha256: sha256(failure.markdown) },
          json: { name: ARTIFACT_NAMES.json, sizeBytes: Buffer.byteLength(failure.json), sha256: sha256(failure.json) },
          status: { name: ARTIFACT_NAMES.status },
        },
      };
      await writeArtifactSet(config.output, failure.markdown, failure.json, status);
      summary("infrastructure_failure", failureCode);
      return;
    }

    const outcome = outcomeFromReport(inspected.counts);
    const status = {
      schemaVersion: "1.0.0",
      artifactType: "change-trace-advisory-status",
      outcome,
      run,
      host: { id: config.hostId },
      counts: inspected.counts,
      artifacts: { ...inspected.artifacts, status: { name: ARTIFACT_NAMES.status } },
    };
    await writeSuccessfulStatusSidecar(config.output, status, inspected.artifacts);
    summary(outcome, "ok");
  } catch (error) {
    summary("infrastructure_failure", error instanceof RunnerError ? error.code : "artifact_write_failed");
    process.exitCode = 1;
  }
}

await main();
