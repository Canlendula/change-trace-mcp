import { existsSync, lstatSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { reportSchema } from "../../src/schemas/index.js";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const runner = join(root, "scripts", "ci", "advisory-runner.mjs");
const fixtureHost = join(root, "tests", "fixtures", "ci", "fixture-host.mjs");

async function tempRepository(): Promise<string> {
  return mkdtemp(join(tmpdir(), "change-trace-advisory-ci-"));
}

function managed(output: string): string[] {
  return ["release-review.md", "release-review.json", "release-review-status.json"].map((name) => join(output, name));
}

async function run(
  repositoryRoot: string,
  outputDirectory: string,
  behavior = "clean",
  extra: Record<string, string | undefined> = {},
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(process.execPath, [runner], {
    cwd: root,
    env: {
      ...process.env,
      CHANGE_TRACE_CI_COMMAND: JSON.stringify([process.execPath, fixtureHost, behavior]),
      CHANGE_TRACE_CI_REPOSITORY_ROOT: repositoryRoot,
      CHANGE_TRACE_CI_OUTPUT_DIRECTORY: outputDirectory,
      CHANGE_TRACE_CI_BASE_REVISION: "a".repeat(40),
      CHANGE_TRACE_CI_HEAD_REVISION: "b".repeat(40),
      CHANGE_TRACE_CI_HOST_ID: "fixture-host",
      CHANGE_TRACE_CI_TIMEOUT_MS: "2000",
      ...extra,
    },
    maxBuffer: 1024 * 1024,
  });
}

function readStatus(output: string): Record<string, any> {
  return JSON.parse(readFileSync(join(output, "release-review-status.json"), "utf8"));
}

function readReport(output: string): Record<string, any> {
  return JSON.parse(readFileSync(join(output, "release-review.json"), "utf8"));
}

const runAttemptForwardingHost = `
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const output = process.env.CHANGE_TRACE_CI_OUTPUT_DIRECTORY;
const report = {
  schemaVersion: "1.0.0",
  id: "report:run-attempt-forwarding",
  createdAt: "2026-01-02T03:04:05.000Z",
  bundleId: "bundle:run-attempt-forwarding",
  reviewMeta: { reviewer: "run-attempt-forwarding-host", notes: process.env.CHANGE_TRACE_CI_RUN_ATTEMPT },
  findings: { confirmed: [], suspected: [], inconclusive: [] },
  rejectedFindings: [],
  missingEvidence: [],
  evidenceSources: [],
  evidenceCoverage: { totalEvidenceItems: 0, referencedEvidenceIds: [], unreferencedEvidenceIds: [] },
  validationSummary: { submitted: 0, valid: 0, rejected: 0, warnings: 0 },
  bundleLimits: { maxEvidenceItems: 1, maxTotalExcerptCharacters: 1 },
  bundleTruncation: { isTruncated: false, omittedEvidenceItems: 0, omittedExcerptCharacters: 0, omittedMissingEvidence: 0 },
  warnings: [],
};
writeFileSync(join(output, "release-review.md"), "# Run attempt forwarding\\n");
writeFileSync(join(output, "release-review.json"), JSON.stringify(report));
`;

describe("advisory CI runner", () => {
  it("emits a clean fixture report accepted by the public Report schema", async () => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      await run(repositoryRoot, "artifacts/review", "clean");
      const report = readReport(output);
      expect(reportSchema.parse(report)).toEqual(report);
      expect(report.evidenceSources).toEqual([]);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it.each([
    ["evidence-source-core", false, "trusted_repository"],
    ["evidence-source-external", true, "untrusted_external"],
  ])(
    "accepts a schema-valid %s catalog entry",
    async (behavior, hasExternalProvenance, trustLevel) => {
      const repositoryRoot = await tempRepository();
      try {
        const output = join(repositoryRoot, "artifacts/review");
        await run(repositoryRoot, "artifacts/review", behavior);
        const report = readReport(output);
        expect(readStatus(output).outcome).toBe("completed_no_findings");
        expect(reportSchema.parse(report)).toEqual(report);
        expect(report.evidenceSources).toHaveLength(1);
        expect("externalProvenance" in report.evidenceSources[0]).toBe(hasExternalProvenance);
        expect(report.evidenceSources[0].trustLevel).toBe(trustLevel);
      } finally {
        await rm(repositoryRoot, { recursive: true, force: true });
      }
    },
  );

  it.each([
    "missing-evidence-sources",
    "malformed-evidence-source",
    "invalid-evidence-id",
    "invalid-retrieved-at",
    "invalid-content-hash",
    "invalid-related-change-id",
    "invalid-trust-level",
    "invalid-source-reference",
    "invalid-redaction",
    "invalid-external-provenance",
    "unknown-evidence-source-field",
    "unknown-evidence-source-source-field",
    "unknown-redaction-field",
    "unknown-adapter-field",
    "unknown-provenance-field",
    "too-many-evidence-sources",
    "too-many-related-change-ids",
    "too-many-redactions",
    "evidence-coverage-count-mismatch",
  ])("rejects an invalid evidence source catalog for %s", async (behavior) => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      await run(repositoryRoot, "artifacts/review", behavior);
      const status = readStatus(output);
      expect(status.outcome).toBe("infrastructure_failure");
      expect(status.error.code).toBe("report_inconsistent");
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it.each([
    ["clean", "completed_no_findings"],
    ["findings", "completed_with_findings"],
    ["inconclusive", "inconclusive"],
    ["rejected", "inconclusive"],
    ["missing", "inconclusive"],
    ["truncated", "inconclusive"],
    ["mixed", "inconclusive"],
  ])("classifies %s with declared precedence", async (behavior, outcome) => {
    const repositoryRoot = await tempRepository();
    try {
      const output = "artifacts/review";
      const result = await run(repositoryRoot, output, behavior);
      const fullOutput = join(repositoryRoot, output);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(/^change-trace-advisory /);
      expect(readStatus(fullOutput).outcome).toBe(outcome);
      for (const artifact of managed(fullOutput)) expect(lstatSync(artifact).isFile()).toBe(true);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("preserves a successful report byte-for-byte and records exact hashes", async () => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      await run(repositoryRoot, "artifacts/review", "findings");
      const json = readFileSync(join(output, "release-review.json"));
      const markdown = readFileSync(join(output, "release-review.md"));
      const status = readStatus(output);
      expect(status.artifacts.json.sizeBytes).toBe(json.byteLength);
      expect(status.artifacts.markdown.sizeBytes).toBe(markdown.byteLength);
      expect(status.artifacts.json.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(JSON.parse(json.toString()).schemaVersion).toBe("1.0.0");
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("publishes only the status sidecar after a successful Host report", async () => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      await run(repositoryRoot, "artifacts/review", "fixed-timestamps");
      expect(statSync(join(output, "release-review.md")).mtime.toISOString()).toBe("2001-02-03T04:05:06.000Z");
      expect(statSync(join(output, "release-review.json")).mtime.toISOString()).toBe("2001-02-03T04:05:06.000Z");
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it.each(["timeout", "nonzero", "missing-files", "malformed", "inconsistent"])("writes zero-exit infrastructure artifacts for %s", async (behavior) => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      const result = await run(repositoryRoot, "artifacts/review", behavior);
      expect(result.stdout).toContain("infrastructure_failure");
      const status = readStatus(output);
      expect(status.outcome).toBe("infrastructure_failure");
      expect(status.artifactType).toBe("change-trace-advisory-infrastructure-failure");
      expect(JSON.parse(readFileSync(join(output, "release-review.json"), "utf8")).artifactType).toBe("change-trace-advisory-infrastructure-failure");
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("force-terminates only an uncooperative direct child within a bounded timeout", async () => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      const started = Date.now();
      const result = await run(repositoryRoot, "artifacts/review", "ignore-term", { CHANGE_TRACE_CI_TIMEOUT_MS: "100" });
      expect(Date.now() - started).toBeLessThan(2_000);
      expect(result.stdout).toContain("host_timeout");
      expect(readStatus(output).outcome).toBe("infrastructure_failure");
      expect(managed(output).every((path) => existsSync(path))).toBe(true);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("rejects unsafe command and output configuration without creating artifacts", async () => {
    const repositoryRoot = await tempRepository();
    try {
      await expect(run(repositoryRoot, "../escape", "clean")).rejects.toMatchObject({ code: 1 });
      await expect(run(repositoryRoot, resolve(repositoryRoot, "absolute"), "clean")).rejects.toMatchObject({ code: 1 });
      await expect(run(repositoryRoot, ".git/review", "clean")).rejects.toMatchObject({ code: 1 });
      await expect(run(repositoryRoot, "safe", "clean", { CHANGE_TRACE_CI_COMMAND: "not-json" })).rejects.toMatchObject({ code: 1 });
      await expect(run(repositoryRoot, "safe", "clean", { CHANGE_TRACE_CI_COMMAND: "[\"\"]" })).rejects.toMatchObject({ code: 1 });
      await expect(run(repositoryRoot, "safe", "clean", { CHANGE_TRACE_CI_COMMAND: "[1]" })).rejects.toMatchObject({ code: 1 });
      await expect(run(repositoryRoot, "safe", "clean", { CHANGE_TRACE_CI_COMMAND: "[]" })).rejects.toMatchObject({ code: 1 });
      await expect(run(repositoryRoot, "safe", "clean", { CHANGE_TRACE_CI_COMMAND: JSON.stringify(["bad\u0000command"]) })).rejects.toMatchObject({ code: 1 });
      await expect(run(repositoryRoot, "safe", "clean", { CHANGE_TRACE_CI_COMMAND: JSON.stringify(["x".repeat(9 * 1024)]) })).rejects.toMatchObject({ code: 1 });
      expect(existsSync(join(repositoryRoot, "escape"))).toBe(false);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("rejects path, credential-like, and oversized revisions before they can reach artifacts", async () => {
    const repositoryRoot = await tempRepository();
    try {
      for (const extra of [
        { CHANGE_TRACE_CI_BASE_REVISION: "C:\\private\\TOP_SECRET" },
        { CHANGE_TRACE_CI_HEAD_REVISION: "Bearer TOP_SECRET" },
        { CHANGE_TRACE_CI_HEAD_REVISION: "a".repeat(161) },
      ]) {
        try {
          await run(repositoryRoot, "safe", "clean", extra);
          expect.fail("invalid revision must fail before starting the Host");
        } catch (error) {
          const result = error as { stdout?: string; stderr?: string; code?: number };
          expect(result.code).toBe(1);
          expect(`${result.stdout ?? ""}${result.stderr ?? ""}`).not.toContain("TOP_SECRET");
        }
      }
      expect(existsSync(join(repositoryRoot, "safe", "release-review-status.json"))).toBe(false);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("records only accepted bounded revision identifiers", async () => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "safe");
      await run(repositoryRoot, "safe", "clean", {
        CHANGE_TRACE_CI_BASE_REVISION: "refs/heads/main",
        CHANGE_TRACE_CI_HEAD_REVISION: "HEAD",
      });
      expect(readStatus(output).run).toMatchObject({
        baseRevision: "refs/heads/main",
        headRevision: "HEAD",
      });
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("forwards a real GitLab job ID to the Host and status sidecar unchanged", async () => {
    const repositoryRoot = await tempRepository();
    const runAttempt = "15697682696";
    try {
      const output = join(repositoryRoot, "artifacts/review");
      await run(repositoryRoot, "artifacts/review", "clean", {
        CHANGE_TRACE_CI_COMMAND: JSON.stringify([process.execPath, "-e", runAttemptForwardingHost]),
        CHANGE_TRACE_CI_RUN_ATTEMPT: runAttempt,
      });
      expect(readReport(output).reviewMeta.notes).toBe(runAttempt);
      expect(readStatus(output).run.runAttempt).toBe(Number(runAttempt));
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it.each([
    [undefined, 1],
    ["", 1],
    ["1", 1],
    ["15697682696", 15_697_682_696],
    ["9007199254740991", Number.MAX_SAFE_INTEGER],
  ])("accepts decimal run attempt %s", async (runAttempt, expected) => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      await run(repositoryRoot, "artifacts/review", "clean", { CHANGE_TRACE_CI_RUN_ATTEMPT: runAttempt });
      expect(readStatus(output).run.runAttempt).toBe(expected);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it.each(["0", "-1", "+1", "1.5", "1e3", " 1", "1 ", "one", "9007199254740992"])(
    "rejects invalid run attempt %s before the Host runs",
    async (runAttempt) => {
      const repositoryRoot = await tempRepository();
      try {
        const output = join(repositoryRoot, "artifacts/review");
        await expect(run(repositoryRoot, "artifacts/review", "clean", { CHANGE_TRACE_CI_RUN_ATTEMPT: runAttempt })).rejects.toMatchObject({
          code: 1,
          stdout: "change-trace-advisory outcome=infrastructure_failure code=invalid_run_attempt\n",
        });
        expect(existsSync(output)).toBe(false);
      } finally {
        await rm(repositoryRoot, { recursive: true, force: true });
      }
    },
  );

  it("rejects symlink escapes and unsafe managed artifact types where supported", async () => {
    const repositoryRoot = await tempRepository();
    const outside = await tempRepository();
    try {
      const link = join(repositoryRoot, "link");
      try { symlinkSync(outside, link, "junction"); } catch { return; }
      await expect(run(repositoryRoot, "link/review")).rejects.toMatchObject({ code: 1 });
      const output = join(repositoryRoot, "safe/review");
      await run(repositoryRoot, "safe/review");
      const victim = join(output, "release-review-status.json");
      await rm(victim);
      mkdirSync(victim);
      await expect(run(repositoryRoot, "safe/review")).rejects.toMatchObject({ code: 1 });
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("does not disclose Host streams, exception text, paths, or credentials", async () => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      const result = await run(repositoryRoot, "artifacts/review", "secret-output");
      const combined = [result.stdout, result.stderr, ...managed(output).map((path) => readFileSync(path, "utf8"))].join("\n");
      for (const value of ["HOST_SECRET", "top-secret", "prompt=evidence", "/private/path", "credentials=token", repositoryRoot]) {
        expect(combined).not.toContain(value);
      }
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("bounds discarded Host output and replaces only managed artifacts on rerun", async () => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      await run(repositoryRoot, "artifacts/review", "large-output");
      writeFileSync(join(output, "unmanaged.txt"), "keep");
      const first = readStatus(output);
      const second = await run(repositoryRoot, "artifacts/review", "clean", { CHANGE_TRACE_CI_RUN_ATTEMPT: "2" });
      expect(second.stdout.length).toBeLessThan(1_000);
      const rerun = readStatus(output);
      expect(rerun.run.runId).not.toBe(first.run.runId);
      expect(rerun.run.runAttempt).toBe(2);
      expect(readFileSync(join(output, "unmanaged.txt"), "utf8")).toBe("keep");
      expect(managed(output).every((path) => existsSync(path))).toBe(true);
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("invalidates prior managed artifacts before a no-output rerun", async () => {
    const repositoryRoot = await tempRepository();
    try {
      const output = join(repositoryRoot, "artifacts/review");
      await run(repositoryRoot, "artifacts/review", "clean");
      const firstStatus = readStatus(output);
      const firstReport = JSON.parse(readFileSync(join(output, "release-review.json"), "utf8"));
      writeFileSync(join(output, "unmanaged.txt"), "keep");

      await run(repositoryRoot, "artifacts/review", "missing-files", {
        CHANGE_TRACE_CI_RUN_ATTEMPT: "2",
      });

      const secondStatus = readStatus(output);
      const secondReport = JSON.parse(readFileSync(join(output, "release-review.json"), "utf8"));
      expect(firstReport.artifactType).toBeUndefined();
      expect(secondReport.artifactType).toBe("change-trace-advisory-infrastructure-failure");
      expect(secondStatus.outcome).toBe("infrastructure_failure");
      expect(secondStatus.run.runId).not.toBe(firstStatus.run.runId);
      expect(secondStatus.run.runAttempt).toBe(2);
      expect(readFileSync(join(output, "unmanaged.txt"), "utf8")).toBe("keep");
    } finally {
      await rm(repositoryRoot, { recursive: true, force: true });
    }
  });
});
