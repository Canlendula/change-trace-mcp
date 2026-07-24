import { existsSync, mkdirSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { rename } from "node:fs/promises";
import {
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import {
  CORE_SCHEMA_VERSION,
  findingValidationResultSchema,
  reportSchema,
  reviewBundleSchema,
  writeReportInputSchema,
  writeReportOutputSchema,
  type FindingValidationResult,
  type Report,
  type ReportFinding,
  type ReportRejectedFinding,
  type ReportWarning,
  type ReviewBundle,
  type WriteReportInput,
  type WriteReportOutput,
} from "../schemas/index.js";

const DEFAULT_MAX_REPORT_SIZE_BYTES = 10 * 1024 * 1024;
const SAFE_REPORT_NAME_RE =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function validateAndCreateOutputDir(
  repoRoot: string,
  outputDir: string,
): string {
  if (!isAbsolute(repoRoot)) {
    throw Object.assign(
      new Error("repositoryRoot must be an absolute path"),
      { code: "invalid_repo_root" },
    );
  }

  if (isAbsolute(outputDir)) {
    throw Object.assign(
      new Error("outputDirectory must be a relative path relative to repositoryRoot"),
      { code: "absolute_output_directory" },
    );
  }

  const normalized = resolve(repoRoot, outputDir);
  const relPath = relative(repoRoot, normalized);

  if (relPath === "" || isAbsolute(relPath) || relPath.startsWith("..")) {
    throw Object.assign(
      new Error("Output directory must stay within the repository root"),
      { code: "output_directory_traversal" },
    );
  }

  const segments = relPath.split(/[\\/]/);
  if (segments.some((s) => s === ".git")) {
    throw Object.assign(
      new Error("Output directory must not include .git paths"),
      { code: "output_directory_git_path" },
    );
  }

  mkdirSync(normalized, { recursive: true });

  let resolvedDir: string;
  let resolvedRoot: string;
  try {
    resolvedDir = realpathSync(normalized);
    resolvedRoot = realpathSync(repoRoot);
      } catch (_error) {
    throw Object.assign(
      new Error(
        `Cannot resolve output path: ${_error instanceof Error ? _error.message : String(_error)}`,
      ),
      { code: "path_resolution_failed" },
    );
  }

  const relativeResolved = relative(resolvedRoot, resolvedDir);
  if (
    relativeResolved === "" ||
    isAbsolute(relativeResolved) ||
    relativeResolved.split(/[\\/]/).some((s) => s === "..")
  ) {
    throw Object.assign(
      new Error("Output directory resolved outside the repository root"),
      { code: "output_directory_escape" },
    );
  }

  return resolvedDir;
}

function buildReport(
  input: WriteReportInput,
): Report {
  const bundle = reviewBundleSchema.parse(input.bundle) as ReviewBundle;
  const validationResult = findingValidationResultSchema.parse(
    input.validationResult,
  ) as FindingValidationResult;

  if (validationResult.bundleId !== bundle.id) {
    throw Object.assign(
      new Error(
        `Bundle ID mismatch: validation result references ${validationResult.bundleId} but bundle has ${bundle.id}`,
      ),
      { code: "bundle_id_mismatch" },
    );
  }

  if (!SAFE_REPORT_NAME_RE.test(input.reportName)) {
    throw Object.assign(
      new Error("reportName must contain only safe filename characters"),
      { code: "invalid_report_name" },
    );
  }

  const reportId = `report:${input.reportName}`;
  const createdAt = new Date().toISOString();

  const evidenceIdsInBundle = new Set(
    bundle.evidenceItems.map((item) => item.id),
  );

  const referencedIds = new Set<string>();
  for (const finding of validationResult.validFindings) {
    for (const evidenceId of finding.evidenceIds) {
      if (evidenceIdsInBundle.has(evidenceId)) {
        referencedIds.add(evidenceId);
      }
    }
    for (const fact of finding.deterministicFacts) {
      for (const evidenceId of fact.evidenceIds) {
        if (evidenceIdsInBundle.has(evidenceId)) {
          referencedIds.add(evidenceId);
        }
      }
    }
  }

  const unreferencedIds = [...evidenceIdsInBundle].filter(
    (id) => !referencedIds.has(id),
  );

  const warnings: ReportWarning[] = validationResult.warnings.map((w) => ({
    code: w.code,
    message: w.message.slice(0, 2_000),
    findingId: w.findingId,
  }));

  function toReportFinding(f: (typeof validationResult.validFindings)[number]): ReportFinding {
    const findingWarnings = warnings
      .filter((w) => w.findingId === f.id)
      .map((w) => ({ code: w.code, message: w.message }));
    return {
      id: f.id,
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      title: f.title,
      expectedBehavior: f.expectedBehavior,
      observedBehavior: f.observedBehavior,
      recommendation: f.recommendation,
      status: f.status,
      evidenceCount: f.evidenceIds.length,
      warnings: findingWarnings,
    };
  }

  const reportFindings = {
    confirmed: validationResult.validFindings
      .filter((f) => f.status === "confirmed")
      .map(toReportFinding),
    suspected: validationResult.validFindings
      .filter((f) => f.status === "suspected")
      .map(toReportFinding),
    inconclusive: validationResult.validFindings
      .filter((f) => f.status === "inconclusive")
      .map(toReportFinding),
  };

  const rejectedFindings: ReportRejectedFinding[] =
    validationResult.rejectedFindings.map((rf) => ({
      index: rf.index,
      findingId: rf.findingId,
      reasonCodes: rf.issues.map((issue) => issue.code),
    }));

  const report: Report = {
    schemaVersion: CORE_SCHEMA_VERSION,
    id: reportId,
    createdAt,
    bundleId: bundle.id,
    reviewMeta: {
      reviewer: input.reviewMeta.reviewer,
      toolVersion: input.reviewMeta.toolVersion,
      notes: input.reviewMeta.notes,
      declaredLimitations: input.reviewMeta.declaredLimitations,
    },
    findings: reportFindings,
    rejectedFindings,
    evidenceCoverage: {
      totalEvidenceItems: bundle.evidenceItems.length,
      referencedEvidenceIds: [...referencedIds].sort(),
      unreferencedEvidenceIds: unreferencedIds.sort(),
    },
    validationSummary: {
      submitted: validationResult.summary.submitted,
      valid: validationResult.summary.valid,
      rejected: validationResult.summary.rejected,
      warnings: validationResult.summary.warnings,
    },
    bundleLimits: {
      maxEvidenceItems: bundle.limits.maxEvidenceItems,
      maxTotalExcerptCharacters: bundle.limits.maxTotalExcerptCharacters,
    },
    bundleTruncation: {
      isTruncated: bundle.truncation.isTruncated,
      omittedEvidenceItems: bundle.truncation.omittedEvidenceItems,
      omittedExcerptCharacters: bundle.truncation.omittedExcerptCharacters,
      omittedMissingEvidence: bundle.truncation.omittedMissingEvidence,
    },
    warnings,
  };

  return reportSchema.parse(report) as Report;
}

function escapeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeCodeFence(text: string, language: string = ""): string {
  const runs = text.match(/`{3,}/g) ?? [];
  const maxRun = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const fence = "`".repeat(Math.max(3, maxRun + 1));
  return `${fence}${language}\n${text}\n${fence}`;
}

function escapeMarkdownHeadingInline(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function renderMarkdown(report: Report, bundle: ReviewBundle): string {
  const lines: string[] = [];

  lines.push(`# Change Trace Review Report`);
  lines.push("");
  lines.push(`**Report ID:** \`${escapeHtmlEntities(report.id)}\``);
  lines.push(`**Created:** ${escapeHtmlEntities(report.createdAt)}`);
  lines.push(`**Bundle ID:** \`${escapeHtmlEntities(report.bundleId)}\``);
  lines.push(`**Reviewer:** ${escapeHtmlEntities(report.reviewMeta.reviewer)}`);
  if (report.reviewMeta.toolVersion) {
    lines.push(`**Tool Version:** ${escapeHtmlEntities(report.reviewMeta.toolVersion)}`);
  }
  lines.push("");

  if (report.reviewMeta.notes) {
    lines.push("## Review Notes");
    lines.push("");
    lines.push(report.reviewMeta.notes);
    lines.push("");
  }

  if (
    report.reviewMeta.declaredLimitations &&
    report.reviewMeta.declaredLimitations.length > 0
  ) {
    lines.push("## Declared Limitations");
    lines.push("");
    for (const limitation of report.reviewMeta.declaredLimitations) {
      lines.push(`- ${escapeHtmlEntities(limitation)}`);
    }
    lines.push("");
  }

  lines.push("## Validation Summary");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Submitted findings | ${report.validationSummary.submitted} |`);
  lines.push(`| Valid findings | ${report.validationSummary.valid} |`);
  lines.push(`| Rejected findings | ${report.validationSummary.rejected} |`);
  lines.push(`| Warnings | ${report.validationSummary.warnings} |`);
  lines.push("");

  lines.push("## Evidence Coverage");
  lines.push("");
  lines.push(`- **Total evidence items:** ${report.evidenceCoverage.totalEvidenceItems}`);
  lines.push(`- **Referenced by findings:** ${report.evidenceCoverage.referencedEvidenceIds.length}`);
  lines.push(`- **Not referenced:** ${report.evidenceCoverage.unreferencedEvidenceIds.length}`);
  lines.push("");

  lines.push("## Bundle Information");
  lines.push("");
  lines.push(`- **Change scope:** \`${escapeHtmlEntities(bundle.changeScope.resolvedBase.slice(0, 8))}...\` \u2192 \`${escapeHtmlEntities(bundle.changeScope.resolvedHead.slice(0, 8))}...\``);
  lines.push(`- **Evidence items:** ${bundle.evidenceItems.length}`);
  lines.push(`- **Deterministic facts:** ${bundle.deterministicFacts.length}`);
  lines.push(`- **Missing evidence:** ${bundle.missingEvidence.length}`);
  lines.push("");

  lines.push("### Bundle Limits");
  lines.push("");
  lines.push(`- Max evidence items: ${report.bundleLimits.maxEvidenceItems}`);
  lines.push(`- Max excerpt characters: ${report.bundleLimits.maxTotalExcerptCharacters}`);
  lines.push("");

  if (report.bundleTruncation.isTruncated) {
    lines.push("### Bundle Truncation");
    lines.push("");
    lines.push(`- **Omitted evidence items:** ${report.bundleTruncation.omittedEvidenceItems}`);
    lines.push(`- **Omitted excerpt characters:** ${report.bundleTruncation.omittedExcerptCharacters}`);
    lines.push(`- **Omitted missing evidence:** ${report.bundleTruncation.omittedMissingEvidence}`);
    lines.push("");
  }

  if (report.warnings.length > 0) {
    lines.push("## Global Warnings");
    lines.push("");
    for (const warning of report.warnings) {
      const prefix = warning.findingId
        ? `\`${escapeHtmlEntities(warning.findingId)}\`: `
        : "";
      lines.push(
        `- **\`${escapeHtmlEntities(warning.code)}\`:** ${prefix}${escapeHtmlEntities(warning.message)}`,
      );
    }
    lines.push("");
  }

  const renderFindingSection = (
    title: string,
    findings: ReportFinding[],
  ) => {
    if (findings.length === 0) return;
    lines.push(`## ${title} (${findings.length})`);
    lines.push("");
    for (const finding of findings) {
      lines.push(
        `### \`${escapeHtmlEntities(finding.id)}\` \u2014 ${escapeMarkdownHeadingInline(finding.title)}`,
      );
      lines.push("");
      lines.push(
        `**Category:** \`${escapeHtmlEntities(finding.category)}\` | **Severity:** \`${escapeHtmlEntities(finding.severity)}\` | **Confidence:** ${finding.confidence} | **Status:** \`${escapeHtmlEntities(finding.status)}\` | **Recommendation:** \`${escapeHtmlEntities(finding.recommendation)}\``,
      );
      lines.push("");

      lines.push("**Expected behavior:**");
      lines.push("");
      lines.push(safeCodeFence(finding.expectedBehavior));
      lines.push("");

      lines.push("**Observed behavior:**");
      lines.push("");
      lines.push(safeCodeFence(finding.observedBehavior));
      lines.push("");

      if (finding.evidenceCount > 0) {
        lines.push(`**Evidence references:** ${finding.evidenceCount}`);
        lines.push("");
      }

      if (finding.warnings.length > 0) {
        lines.push("**Warnings:**");
        lines.push("");
        for (const w of finding.warnings) {
          lines.push(
            `- \`${escapeHtmlEntities(w.code)}\`: ${escapeHtmlEntities(w.message)}`,
          );
        }
        lines.push("");
      }
    }
  };

  renderFindingSection("Confirmed Findings", report.findings.confirmed);
  renderFindingSection("Suspected Findings", report.findings.suspected);
  renderFindingSection("Inconclusive Findings", report.findings.inconclusive);

  if (report.rejectedFindings.length > 0) {
    lines.push(`## Rejected Findings (${report.rejectedFindings.length})`);
    lines.push("");
    for (const rf of report.rejectedFindings) {
      const idDisplay = rf.findingId
        ? `\`${escapeHtmlEntities(rf.findingId)}\``
        : "(no valid ID)";
      lines.push(
        `- **Index ${rf.index}:** ${idDisplay} \u2014 ${rf.reasonCodes.map((c) => `\`${escapeHtmlEntities(c)}\``).join(", ")}`,
      );
    }
    lines.push("");
  }

  if (report.evidenceCoverage.unreferencedEvidenceIds.length > 0) {
    lines.push("## Unreferenced Evidence");
    lines.push("");
    lines.push(
      `${report.evidenceCoverage.unreferencedEvidenceIds.length} evidence item(s) were not referenced by any validated finding.`,
    );
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function renderJson(report: Report): string {
  return JSON.stringify(report, null, 2) + "\n";
}

function checkSizeBound(
  markdown: string,
  json: string,
  maxBytes: number,
): void {
  const mdBytes = Buffer.byteLength(markdown, "utf-8");
  const jsonBytes = Buffer.byteLength(json, "utf-8");
  if (mdBytes > maxBytes || jsonBytes > maxBytes) {
    throw Object.assign(
      new Error(
        `Report exceeds maximum size of ${maxBytes} bytes (markdown: ${mdBytes}, json: ${jsonBytes})`,
      ),
      { code: "report_too_large" },
    );
  }
}

export function writeReport(
  rawInput: WriteReportInput,
): WriteReportOutput {
  const input = writeReportInputSchema.parse(rawInput);
  const maxBytes = input.maxReportSizeBytes ?? DEFAULT_MAX_REPORT_SIZE_BYTES;

  const bundle = reviewBundleSchema.parse(input.bundle) as ReviewBundle;
  const validationResult = findingValidationResultSchema.parse(
    input.validationResult,
  ) as FindingValidationResult;

  if (validationResult.bundleId !== bundle.id) {
    throw Object.assign(
      new Error(
        `Bundle ID mismatch: validation result references ${validationResult.bundleId} but bundle has ${bundle.id}`,
      ),
      { code: "bundle_id_mismatch" },
    );
  }

  const targetDir = validateAndCreateOutputDir(
    input.repositoryRoot,
    input.outputDirectory,
  );

  const report = buildReport(input);

  const markdown = renderMarkdown(report, bundle);
  const json = renderJson(report);

  checkSizeBound(markdown, json, maxBytes);

  const markdownFile = join(targetDir, `${input.reportName}.md`);
  const jsonFile = join(targetDir, `${input.reportName}.json`);
  const overwrite = input.overwrite === true;

  if (!overwrite && (existsSync(markdownFile) || existsSync(jsonFile))) {
    throw Object.assign(
      new Error(
        `Report files already exist in ${targetDir}. Use overwrite: true to replace them.`,
      ),
      { code: "report_files_exist" },
    );
  }

  writeFileSync(jsonFile, json, "utf-8");
  try {
    writeFileSync(markdownFile, markdown, "utf-8");
  } catch (_markdownError) {
    try { unlinkSync(jsonFile); } catch (_cleanupError) { void 0; }
    throw _markdownError;
  }

  const markdownSizeBytes = Buffer.byteLength(markdown, "utf-8");
  const jsonSizeBytes = Buffer.byteLength(json, "utf-8");

  return writeReportOutputSchema.parse({
    reportId: report.id,
    reportPath: targetDir,
    markdownFile,
    jsonFile,
    markdownSizeBytes,
    jsonSizeBytes,
  } satisfies WriteReportOutput);
}
