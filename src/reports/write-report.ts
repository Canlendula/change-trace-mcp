import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import {
  CORE_SCHEMA_VERSION,
  HARD_MAX_REPORT_SIZE_BYTES,
  reportSchema,
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

const SAFE_REPORT_NAME_RE =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function validatePathSafety(
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

  let resolvedRoot: string;
  try {
    resolvedRoot = realpathSync(repoRoot);
  } catch (err) {
    throw Object.assign(
      new Error(
        `Cannot resolve repositoryRoot: ${err instanceof Error ? err.message : String(err)}`,
      ),
      { code: "invalid_repo_root" },
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

  const segments = relPath.replace(/\\/g, "/").split("/");
  if (segments.some((s) => s.toLowerCase() === ".git")) {
    throw Object.assign(
      new Error("Output directory must not include .git paths"),
      { code: "output_directory_git_path" },
    );
  }

  let current = resolvedRoot;
  for (const segment of segments) {
    if (segment.length === 0) continue;
    const candidate = join(current, segment);
    try {
      if (existsSync(candidate)) {
        const resolved = realpathSync(candidate);
        const rel = relative(resolvedRoot, resolved);
        if (
          rel === "" ||
          isAbsolute(rel) ||
          rel.split(/[\\/]/).some((s) => s === "..")
        ) {
          throw Object.assign(
            new Error("Ancestor path resolves outside the repository root"),
            { code: "ancestor_escape" },
          );
        }
        current = resolved;
      } else {
        current = candidate;
      }
    } catch (err) {
      if ((err as { code?: string }).code === "ancestor_escape") throw err;
      throw Object.assign(
        new Error(
          `Cannot validate ancestor path: ${err instanceof Error ? err.message : String(err)}`,
        ),
        { code: "ancestor_resolution_failed" },
      );
    }
  }

  return current;
}

function validateOutputFiles(reportFile: string): void {
  try {
    const stat = lstatSync(reportFile);
    if (stat.isSymbolicLink()) {
      throw Object.assign(
        new Error("Output file path is a symbolic link"),
        { code: "output_file_symlink" },
      );
    }
    if (!stat.isFile()) {
      throw Object.assign(
        new Error("Output file path is not a regular file"),
        { code: "output_file_not_regular" },
      );
    }
  } catch (err) {
    if ((err as { code?: string }).code) throw err;
    // ENOENT is fine �?file doesn't exist yet
  }
}

function buildReport(
  input: WriteReportInput,
): Report {
  const bundle = input.bundle;
  const validationResult = input.validationResult;

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
  const createdAt = input.reviewMeta.createdAt;

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
      deterministicFacts: f.deterministicFacts.map((fact) => ({
        statement: fact.statement,
        evidenceIds: fact.evidenceIds,
      })),
      inference: f.inference,
      evidenceIds: f.evidenceIds,
      affectedSources: f.affectedSources,
      recommendation: f.recommendation,
      status: f.status,
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
      issues: rf.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message.slice(0, 2_000),
      })),
    }));

  const missingEvidence = bundle.missingEvidence.map((me) => ({
    source: me.source,
    reason: me.reason,
    status: me.status,
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
    missingEvidence,
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
  const safeText = text.replace(/^#/gm, "\\#");
  return `${fence}${language}\n${safeText}\n${fence}`;
}

function escapeInlineMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/^#/gm, "\\#");
}

function safeBulletText(text: string): string {
  return escapeInlineMarkdown(text)
    .replace(/^[-*+]\s/gm, "\\$&");
}

function safeLineText(text: string): string {
  const escaped = escapeHtmlEntities(text);
  return escaped.replace(/^#/gm, "\\#");
}

function escapeCodeSpan(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`/g, "\\`");
}

function code(value: string): string {
  return `\`${escapeCodeSpan(value)}\``;
}

function renderMarkdown(report: Report, bundle: ReviewBundle): string {
  const lines: string[] = [];

  lines.push(`# Change Trace Review Report`);
  lines.push("");
  lines.push(`**Report ID:** ${code(report.id)}`);
  lines.push(`**Created:** ${escapeHtmlEntities(report.createdAt)}`);
  lines.push(`**Bundle ID:** ${code(report.bundleId)}`);
  lines.push(`**Reviewer:** ${safeLineText(report.reviewMeta.reviewer)}`);
  if (report.reviewMeta.toolVersion) {
    lines.push(`**Tool Version:** ${safeLineText(report.reviewMeta.toolVersion)}`);
  }
  lines.push("");

  if (report.reviewMeta.notes) {
    lines.push("## Review Notes");
    lines.push("");
    lines.push(safeLineText(report.reviewMeta.notes));
    lines.push("");
  }

  if (
    report.reviewMeta.declaredLimitations &&
    report.reviewMeta.declaredLimitations.length > 0
  ) {
    lines.push("## Declared Limitations");
    lines.push("");
    for (const limitation of report.reviewMeta.declaredLimitations) {
      lines.push(`- ${safeBulletText(limitation)}`);
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
  lines.push(`- **Change scope:** ${code(bundle.changeScope.resolvedBase.slice(0, 8) + "...")} \u2192 ${code(bundle.changeScope.resolvedHead.slice(0, 8) + "...")}`);
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

  if (report.missingEvidence.length > 0) {
    lines.push("## Missing Evidence");
    lines.push("");
    for (const me of report.missingEvidence) {
      const locator = me.source.locator;
      lines.push(`- **${code(me.status)}** ${code(me.source.system + ":" + locator)}: ${safeLineText(me.reason)}`);
    }
    lines.push("");
  }

  if (report.warnings.length > 0) {
    lines.push("## Global Warnings");
    lines.push("");
    for (const warning of report.warnings) {
      const prefix = warning.findingId
        ? `${code(warning.findingId)}: `
        : "";
      lines.push(
        `- **${code(warning.code)}** ${prefix}${safeLineText(warning.message)}`,
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
        `### ${code(finding.id)} \u2014 ${escapeInlineMarkdown(finding.title)}`,
      );
      lines.push("");
      lines.push(
        `**Category:** ${code(finding.category)} | **Severity:** ${code(finding.severity)} | **Confidence:** ${finding.confidence} | **Status:** ${code(finding.status)} | **Recommendation:** ${code(finding.recommendation)}`,
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

      if (finding.deterministicFacts.length > 0) {
        lines.push("**Deterministic facts:**");
        lines.push("");
        for (const fact of finding.deterministicFacts) {
          const evidenceList = fact.evidenceIds
            .map((id) => code(id))
            .join(", ");
          lines.push(`- ${safeBulletText(fact.statement)} (evidence: ${evidenceList})`);
        }
        lines.push("");
      }

      lines.push("**Inference:**");
      lines.push("");
      lines.push(safeCodeFence(finding.inference));
      lines.push("");

      if (finding.evidenceIds.length > 0) {
        lines.push(
          `**Evidence IDs:** ${finding.evidenceIds.map((id) => code(id)).join(", ")}`,
        );
        lines.push("");
      }

      if (finding.affectedSources.length > 0) {
        lines.push("**Affected sources:**");
        lines.push("");
        for (const src of finding.affectedSources) {
          lines.push(
            `- ${code(src.system + ":" + src.locator)}`,
          );
        }
        lines.push("");
      }

      if (finding.warnings.length > 0) {
        lines.push("**Finding warnings:**");
        lines.push("");
        for (const w of finding.warnings) {
          lines.push(
            `- ${code(w.code)}: ${safeLineText(w.message)}`,
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
        ? code(rf.findingId)
        : "(no valid ID)";
      lines.push(
        `### Index ${rf.index}: ${idDisplay}`,
      );
      lines.push("");
      for (const issue of rf.issues) {
        lines.push(
          `- **${code(issue.code)}** at ${code(issue.path)}: ${safeLineText(issue.message)}`,
        );
      }
      lines.push("");
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
  const maxBytes = input.maxReportSizeBytes ?? HARD_MAX_REPORT_SIZE_BYTES;

  const targetDir = validatePathSafety(
    input.repositoryRoot,
    input.outputDirectory,
  );

  const report = buildReport(input);
  const bundle = input.bundle;

  const markdown = renderMarkdown(report, bundle);
  const json = renderJson(report);

  checkSizeBound(markdown, json, maxBytes);

  const markdownFile = join(targetDir, `${input.reportName}.md`);
  const jsonFile = join(targetDir, `${input.reportName}.json`);
  const markdownTmp = join(targetDir, `${input.reportName}.md.tmp`);
  const jsonTmp = join(targetDir, `${input.reportName}.json.tmp`);
  const markdownBak = join(targetDir, `${input.reportName}.md.bak`);
  const jsonBak = join(targetDir, `${input.reportName}.json.bak`);
  const overwrite = input.overwrite === true;

  const mdExists = existsSync(markdownFile);
  const jsonExists = existsSync(jsonFile);

  if (!overwrite && (mdExists || jsonExists)) {
    throw Object.assign(
      new Error(
        `Report files already exist in ${targetDir}. Use overwrite: true to replace them.`,
      ),
      { code: "report_files_exist" },
    );
  }

  if (overwrite) {
    if (mdExists) validateOutputFiles(markdownFile);
    if (jsonExists) validateOutputFiles(jsonFile);
  }

  try {
    mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    throw Object.assign(
      new Error(
        `Cannot create output directory: ${err instanceof Error ? err.message : String(err)}`,
      ),
      { code: "output_directory_create_failed" },
    );
  }

  let resolvedDir: string;
  let resolvedRoot: string;
  try {
    resolvedDir = realpathSync(targetDir);
    resolvedRoot = realpathSync(input.repositoryRoot);
  } catch (err) {
    throw Object.assign(
      new Error(
        `Cannot resolve output path: ${err instanceof Error ? err.message : String(err)}`,
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

  // Clean any stale backup files from a prior crash
  try { unlinkSync(jsonBak); } catch (_bk) { void _bk; }
  try { unlinkSync(markdownBak); } catch (_bk) { void _bk; }

  // Stage both temp files first
  writeFileSync(jsonTmp, json, "utf-8");
  try {
    writeFileSync(markdownTmp, markdown, "utf-8");
  } catch (_err: unknown) {
    try { unlinkSync(jsonTmp); } catch (_bk) { void _bk; }
    throw _err;
  }

  // Back up existing originals during overwrite (after temps are safely on disk)
  if (overwrite) {
    try { if (jsonExists) renameSync(jsonFile, jsonBak); } catch (_bk) { void _bk; }
    try { if (mdExists) renameSync(markdownFile, markdownBak); } catch (_bk) { void _bk; }
  }

  // Promote json temp to final
  try {
    renameSync(jsonTmp, jsonFile);
  } catch (_err: unknown) {
    try { unlinkSync(jsonTmp); } catch (_bk) { void _bk; }
    try { unlinkSync(markdownTmp); } catch (_bk) { void _bk; }
    if (overwrite) {
      try { if (existsSync(jsonBak)) renameSync(jsonBak, jsonFile); } catch (_bk) { void _bk; }
      try { if (existsSync(markdownBak)) renameSync(markdownBak, markdownFile); } catch (_bk) { void _bk; }
    }
    throw _err;
  }

  // Promote markdown temp to final
  try {
    renameSync(markdownTmp, markdownFile);
  } catch (_err: unknown) {
    try { unlinkSync(jsonFile); } catch (_bk) { void _bk; }
    try { unlinkSync(markdownTmp); } catch (_bk) { void _bk; }
    if (overwrite) {
      try { if (existsSync(jsonBak)) renameSync(jsonBak, jsonFile); } catch (_bk) { void _bk; }
      try { if (existsSync(markdownBak)) renameSync(markdownBak, markdownFile); } catch (_bk) { void _bk; }
    }
    throw _err;
  }

  // Success �?remove backups
  try { unlinkSync(jsonBak); } catch (_bk) { void _bk; }
  try { unlinkSync(markdownBak); } catch (_bk) { void _bk; }

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
