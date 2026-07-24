import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync as fsRenameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync as fsWriteFileSync,
} from "node:fs";
import {
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import {
  CORE_SCHEMA_VERSION,
  DEFAULT_MAX_REPORT_SIZE_BYTES,
  reportSchema,
  writeReportInputSchema,
  writeReportOutputSchema,
  type Report,
  type ReportFinding,
  type ReportRejectedFinding,
  type ReportWarning,
  type ReviewBundle,
  type WriteReportInput,
  type WriteReportOutput,
} from "../schemas/index.js";

const SAFE_REPORT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface WriteReportFs {
  mkdtempSync(prefix: string): string;
  writeFileSync(path: string, data: string, options?: { flag?: string }): void;
  linkSync(existingPath: string, newPath: string): void;
  renameSync(oldPath: string, newPath: string): void;
  unlinkSync(path: string): void;
  rmdirSync(path: string): void;
}

const realFs: WriteReportFs = {
  mkdtempSync, writeFileSync: (p, d, o) => fsWriteFileSync(p, d, o ?? {}),
  linkSync, renameSync: fsRenameSync, unlinkSync, rmdirSync,
};

function isStrictDescendant(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== "" && !isAbsolute(rel) && !rel.split(/[\\/]/).some((segment) => segment === "..");
}

function validatePathSafety(repoRoot: string, outputDir: string): string {
  if (!isAbsolute(repoRoot)) throw Object.assign(new Error("repositoryRoot must be an absolute path"), { code: "invalid_repo_root" });
  if (isAbsolute(outputDir)) throw Object.assign(new Error("outputDirectory must be a relative path relative to repositoryRoot"), { code: "absolute_output_directory" });
  let resolvedRoot: string;
  try { resolvedRoot = realpathSync(repoRoot); } catch (err) { throw Object.assign(new Error(`Cannot resolve repositoryRoot: ${err instanceof Error ? err.message : String(err)}`), { code: "invalid_repo_root" }); }
  const normalized = resolve(repoRoot, outputDir);
  const relPath = relative(repoRoot, normalized);
  if (!isStrictDescendant(repoRoot, normalized)) throw Object.assign(new Error("Output directory must stay within the repository root"), { code: "output_directory_traversal" });
  const segs = relPath.replace(/\\/g, "/").split("/");
  if (segs.some((s) => s.toLowerCase() === ".git")) throw Object.assign(new Error("Output directory must not include .git paths"), { code: "output_directory_git_path" });
  let cur = resolvedRoot;
  for (const seg of segs) {
    if (seg.length === 0) continue;
    const cand = join(cur, seg);
    try {
      if (existsSync(cand)) {
        const res = realpathSync(cand);
        const rel = relative(resolvedRoot, res);
        if (!isStrictDescendant(resolvedRoot, res)) throw Object.assign(new Error("Ancestor path resolves outside the repository root"), { code: "ancestor_escape" });
        cur = res;
      } else cur = cand;
    } catch (err) { if ((err as { code?: string }).code === "ancestor_escape") throw err; throw Object.assign(new Error(`Cannot validate ancestor path: ${err instanceof Error ? err.message : String(err)}`), { code: "ancestor_resolution_failed" }); }
  }
  return cur;
}

function validateOutputFile(target: string): void {
  try { const s = lstatSync(target); if (s.isSymbolicLink()) throw Object.assign(new Error("Output file path is a symbolic link"), { code: "output_file_symlink" }); if (!s.isFile()) throw Object.assign(new Error("Output file path is not a regular file"), { code: "output_file_not_regular" }); } catch (err) { if ((err as { code?: string }).code) throw err; }
}

function buildReport(input: WriteReportInput): Report {
  const b = input.bundle, v = input.validationResult;
  if (v.bundleId !== b.id) throw Object.assign(new Error(`Bundle ID mismatch: validation result references ${v.bundleId} but bundle has ${b.id}`), { code: "bundle_id_mismatch" });
  if (!SAFE_REPORT_NAME_RE.test(input.reportName)) throw Object.assign(new Error("reportName must contain only safe filename characters"), { code: "invalid_report_name" });
  const eIds = new Set(b.evidenceItems.map((i) => i.id));
  const ref = new Set<string>();
  for (const f of v.validFindings) { for (const id of f.evidenceIds) { if (eIds.has(id)) ref.add(id); } for (const fact of f.deterministicFacts) { for (const id of fact.evidenceIds) { if (eIds.has(id)) ref.add(id); } } }
  const unref = [...eIds].filter((id) => !ref.has(id));
  const warns: ReportWarning[] = v.warnings.map((w) => ({ code: w.code, message: w.message.slice(0, 2_000), findingId: w.findingId }));
  const toF = (f: (typeof v.validFindings)[number]) => { const fw = warns.filter((w) => w.findingId === f.id).map((w) => ({ code: w.code, message: w.message })); return { id: f.id, category: f.category, severity: f.severity, confidence: f.confidence, title: f.title, expectedBehavior: f.expectedBehavior, observedBehavior: f.observedBehavior, deterministicFacts: f.deterministicFacts.map((d) => ({ statement: d.statement, evidenceIds: d.evidenceIds })), inference: f.inference, evidenceIds: f.evidenceIds, affectedSources: f.affectedSources, recommendation: f.recommendation, status: f.status, warnings: fw }; };
  const rep: Report = {
    schemaVersion: CORE_SCHEMA_VERSION, id: `report:${input.reportName}`, createdAt: input.reviewMeta.createdAt, bundleId: b.id,
    reviewMeta: { reviewer: input.reviewMeta.reviewer, toolVersion: input.reviewMeta.toolVersion, notes: input.reviewMeta.notes, declaredLimitations: input.reviewMeta.declaredLimitations },
    findings: { confirmed: v.validFindings.filter((f) => f.status === "confirmed").map(toF) as Report["findings"]["confirmed"], suspected: v.validFindings.filter((f) => f.status === "suspected").map(toF) as Report["findings"]["suspected"], inconclusive: v.validFindings.filter((f) => f.status === "inconclusive").map(toF) as Report["findings"]["inconclusive"] },
    rejectedFindings: v.rejectedFindings.map((rf) => ({ index: rf.index, findingId: rf.findingId, issues: rf.issues.map((i) => ({ code: i.code, path: i.path, message: i.message.slice(0, 2_000) })) })),
    missingEvidence: b.missingEvidence.map((me) => ({ source: me.source, reason: me.reason, status: me.status })),
    evidenceCoverage: { totalEvidenceItems: b.evidenceItems.length, referencedEvidenceIds: [...ref].sort(), unreferencedEvidenceIds: unref.sort() },
    validationSummary: { submitted: v.summary.submitted, valid: v.summary.valid, rejected: v.summary.rejected, warnings: v.summary.warnings },
    bundleLimits: { maxEvidenceItems: b.limits.maxEvidenceItems, maxTotalExcerptCharacters: b.limits.maxTotalExcerptCharacters },
    bundleTruncation: { isTruncated: b.truncation.isTruncated, omittedEvidenceItems: b.truncation.omittedEvidenceItems, omittedExcerptCharacters: b.truncation.omittedExcerptCharacters, omittedMissingEvidence: b.truncation.omittedMissingEvidence }, warnings: warns,
  };
  return reportSchema.parse(rep) as Report;
}

// --- Markdown rendering ---

function dynamicFence(text: string, language = ""): string {
  const runs = text.match(/`{3,}/g) ?? []; const maxRun = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const fence = "`".repeat(Math.max(3, maxRun + 1)); return `${fence}${language}\n${text.replace(/^ {0,3}#/gm, "\\#")}\n${fence}`;
}
function dynamicCodeSpan(text: string): string {
  const runs = text.match(/`+/g) ?? []; const maxRun = runs.reduce((m, r) => Math.max(m, r.length), 0);
  return `${"`".repeat(Math.max(1, maxRun + 1))}${text}${"`".repeat(Math.max(1, maxRun + 1))}`;
}
function safeInline(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/~/g, "\\~")
    .replace(/\*/g, "\\*").replace(/_/g, "\\_")
    .replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/!/g, "\\!")
    .replace(/^ {0,3}#/gm, "\\#").replace(/^ {0,3}>/gm, "\\>")
    .replace(/^ {0,3}([-*+])\s/gm, "\\$1 ").replace(/^ {0,3}(\d+)([.)])\s/gm, "$1\\$2 ")
    .replace(/^ {0,3}(=+|-+)[ \t]*$/gm, "\\$1").replace(/\|/g, "\\|")
    // Up to three leading spaces followed by a tab also form an indented
    // CommonMark code block. Preserve the input whitespace after an escape.
    .replace(/^ {0,3}\t/gm, (m) => "   \\" + m)
    .replace(/^ {4,}/gm, (m) => "   \\" + m.slice(3))
    .replace(/^\t/gm, "   \\t");
}
function inlineNoNewlines(text: string): string { return safeInline(text.replace(/\r\n|\n|\r/g, " / ")); }
function safeLit(v: string): string { return dynamicCodeSpan(v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")); }

function renderMarkdown(report: Report, bundle: ReviewBundle): string {
  const L: string[] = [];
  L.push(`# Change Trace Review Report`, "");
  L.push(`**Report ID:** ${safeLit(report.id)}`);
  L.push(`**Created:** ${safeLit(report.createdAt)}`);
  L.push(`**Bundle ID:** ${safeLit(report.bundleId)}`);
  L.push(`**Reviewer:** ${inlineNoNewlines(report.reviewMeta.reviewer)}`);
  if (report.reviewMeta.toolVersion) L.push(`**Tool Version:** ${safeLit(report.reviewMeta.toolVersion)}`);
  L.push("");
  if (report.reviewMeta.notes) { L.push("## Review Notes", ""); L.push(safeInline(report.reviewMeta.notes)); L.push(""); }
  if (report.reviewMeta.declaredLimitations?.length) { L.push("## Declared Limitations", ""); for (const lim of report.reviewMeta.declaredLimitations) L.push(`- ${safeInline(lim)}`); L.push(""); }
  L.push("## Validation Summary", "", "| Metric | Count |", "|---|---|");
  L.push(`| Submitted findings | ${report.validationSummary.submitted} |`);
  L.push(`| Valid findings | ${report.validationSummary.valid} |`);
  L.push(`| Rejected findings | ${report.validationSummary.rejected} |`);
  L.push(`| Warnings | ${report.validationSummary.warnings} |`, "");
  L.push("## Evidence Coverage", "", `- **Total evidence items:** ${report.evidenceCoverage.totalEvidenceItems}`, `- **Referenced by findings:** ${report.evidenceCoverage.referencedEvidenceIds.length}`, `- **Not referenced:** ${report.evidenceCoverage.unreferencedEvidenceIds.length}`, "");
  L.push("## Bundle Information", "", `- **Change scope:** ${safeLit(bundle.changeScope.resolvedBase.slice(0, 8) + "...")} -> ${safeLit(bundle.changeScope.resolvedHead.slice(0, 8) + "...")}`, `- **Evidence items:** ${bundle.evidenceItems.length}`, `- **Deterministic facts:** ${bundle.deterministicFacts.length}`, `- **Missing evidence:** ${bundle.missingEvidence.length}`, "");
  L.push("### Bundle Limits", "", `- Max evidence items: ${report.bundleLimits.maxEvidenceItems}`, `- Max excerpt characters: ${report.bundleLimits.maxTotalExcerptCharacters}`, "");
  if (report.bundleTruncation.isTruncated) { L.push("### Bundle Truncation", "", `- **Omitted evidence items:** ${report.bundleTruncation.omittedEvidenceItems}`, `- **Omitted excerpt characters:** ${report.bundleTruncation.omittedExcerptCharacters}`, `- **Omitted missing evidence:** ${report.bundleTruncation.omittedMissingEvidence}`, ""); }
  if (report.missingEvidence.length > 0) { L.push("## Missing Evidence", ""); for (const me of report.missingEvidence) L.push(`- **${safeLit(me.status)}** ${safeLit(me.source.system + ":" + me.source.locator)}: ${safeInline(me.reason)}`); L.push(""); }
  if (report.warnings.length > 0) { L.push("## Global Warnings", ""); for (const w of report.warnings) L.push(`- **${safeLit(w.code)}** ${w.findingId ? safeLit(w.findingId) + ": " : ""}${safeInline(w.message)}`); L.push(""); }
  const section = (title: string, findings: ReportFinding[]) => {
    if (findings.length === 0) return;
    L.push(`## ${title} (${findings.length})`, "");
    for (const f of findings) {
      L.push(`### ${safeLit(f.id)} -- ${inlineNoNewlines(f.title)}`, "");
      L.push(`**Category:** ${safeLit(f.category)} | **Severity:** ${safeLit(f.severity)} | **Confidence:** ${f.confidence} | **Status:** ${safeLit(f.status)} | **Recommendation:** ${safeLit(f.recommendation)}`, "");
      L.push("**Expected behavior:**", "", dynamicFence(f.expectedBehavior), "");
      L.push("**Observed behavior:**", "", dynamicFence(f.observedBehavior), "");
      if (f.deterministicFacts.length > 0) { L.push("**Deterministic facts:**", ""); for (const fact of f.deterministicFacts) L.push(`- ${safeInline(fact.statement)} (evidence: ${fact.evidenceIds.map((id) => safeLit(id)).join(", ")})`); L.push(""); }
      L.push("**Inference:**", "", dynamicFence(f.inference), "");
      if (f.evidenceIds.length > 0) { L.push(`**Evidence IDs:** ${f.evidenceIds.map((id) => safeLit(id)).join(", ")}`, ""); }
      if (f.affectedSources.length > 0) { L.push("**Affected sources:**", ""); for (const src of f.affectedSources) L.push(`- ${safeLit(src.system)}: ${safeInline(src.locator)}`); L.push(""); }
      if (f.warnings.length > 0) { L.push("**Finding warnings:**", ""); for (const w of f.warnings) L.push(`- ${safeLit(w.code)}: ${safeInline(w.message)}`); L.push(""); }
    }
  };
  section("Confirmed Findings", report.findings.confirmed);
  section("Suspected Findings", report.findings.suspected);
  section("Inconclusive Findings", report.findings.inconclusive);
  if (report.rejectedFindings.length > 0) { L.push(`## Rejected Findings (${report.rejectedFindings.length})`, ""); for (const rf of report.rejectedFindings) { L.push(`### Index ${rf.index}: ${rf.findingId ? safeLit(rf.findingId) : "(no valid ID)"}`, ""); for (const issue of rf.issues) L.push(`- **${safeLit(issue.code)}** at ${safeLit(issue.path)}: ${safeInline(issue.message)}`); L.push(""); } L.push(""); }
  if (report.evidenceCoverage.unreferencedEvidenceIds.length > 0) { L.push("## Unreferenced Evidence", "", `${report.evidenceCoverage.unreferencedEvidenceIds.length} evidence item(s) were not referenced by any validated finding.`, ""); }
  return L.join("\n") + "\n";
}

function renderJson(report: Report): string { return JSON.stringify(report, null, 2) + "\n"; }
function checkSizeBound(md: string, js: string, max: number): void {
  const mb = Buffer.byteLength(md, "utf-8"), jb = Buffer.byteLength(js, "utf-8");
  if (mb > max || jb > max) throw Object.assign(new Error(`Report exceeds maximum size of ${max} bytes (markdown: ${mb}, json: ${jb})`), { code: "report_too_large" });
}

// --- Internal write with fs adapter ---

function writeReportWith(input: WriteReportInput, fs: WriteReportFs): WriteReportOutput {
  const maxBytes = input.maxReportSizeBytes ?? DEFAULT_MAX_REPORT_SIZE_BYTES;
  const overwrite = input.overwrite === true;

  let resolvedRepoRoot: string;
  try { resolvedRepoRoot = realpathSync(input.repositoryRoot); } catch (err) { throw Object.assign(new Error(`Cannot resolve repositoryRoot: ${err instanceof Error ? err.message : String(err)}`), { code: "invalid_repo_root" }); }
  try {
    if (realpathSync(input.bundle.changeScope.repositoryRoot) !== resolvedRepoRoot) {
      throw Object.assign(new Error("repositoryRoot and bundle.changeScope.repositoryRoot must identify the same directory"), { code: "repo_root_mismatch" });
    }
  } catch (err) {
    if ((err as { code?: string }).code === "repo_root_mismatch") throw err;
    throw Object.assign(new Error(`Cannot resolve bundle.changeScope.repositoryRoot: ${err instanceof Error ? err.message : String(err)}`), { code: "bundle_root_unresolvable" });
  }

  const targetDir = validatePathSafety(input.repositoryRoot, input.outputDirectory);
  const report = buildReport(input);
  const markdown = renderMarkdown(report, input.bundle);
  const json = renderJson(report);
  checkSizeBound(markdown, json, maxBytes);

  const jsonFinal = join(targetDir, `${input.reportName}.json`);
  const mdFinal = join(targetDir, `${input.reportName}.md`);
  const mdExists = existsSync(mdFinal), jsonExists = existsSync(jsonFinal);

  if (!overwrite && (mdExists || jsonExists)) throw Object.assign(new Error(`Report files already exist in ${targetDir}. Use overwrite: true to replace them.`), { code: "report_files_exist" });
  if (overwrite) { if (mdExists) validateOutputFile(mdFinal); if (jsonExists) validateOutputFile(jsonFinal); }

  try { mkdirSync(targetDir, { recursive: true }); } catch (err) { throw Object.assign(new Error(`Cannot create output directory: ${err instanceof Error ? err.message : String(err)}`), { code: "output_directory_create_failed" }); }
  let resolvedDir: string;
  try { resolvedDir = realpathSync(targetDir); } catch (err) { throw Object.assign(new Error(`Cannot resolve output path: ${err instanceof Error ? err.message : String(err)}`), { code: "path_resolution_failed" }); }
  if (!isStrictDescendant(resolvedRepoRoot, resolvedDir)) throw Object.assign(new Error("Output directory resolved outside the repository root"), { code: "output_directory_escape" });

  let txDir: string | null = null;
  let txDirVerified = false;
  let jsonStagingPresent = false, mdStagingPresent = false;
  let jsonBackupMoved = false, mdBackupMoved = false;
  let jsonPublished = false, mdPublished = false;
  let jsonRestored = false, mdRestored = false;
  let rollbackFatal = false;
  let jsonStaging = "", mdStaging = "", jsonBackup = "", mdBackup = "";

  function exclusivePublish(stagingPath: string, finalPath: string): void {
    try { fs.linkSync(stagingPath, finalPath); }
    catch (err) {
      if ((err as { code?: string }).code === "EEXIST") {
        throw Object.assign(new Error(`Report files already exist in ${targetDir}. Use overwrite: true to replace them.`), { code: "report_files_exist" });
      }
      throw err;
    }
  }

  try {
    txDir = fs.mkdtempSync(join(targetDir, `.report-`));
    if (!isStrictDescendant(resolvedDir, realpathSync(txDir))) {
      throw Object.assign(new Error("Transaction directory resolves outside the target directory"), { code: "txdir_escape" });
    }
    txDirVerified = true;

    jsonStaging = join(txDir, "new.json"); mdStaging = join(txDir, "new.md");
    fs.writeFileSync(jsonStaging, json, { flag: "wx" }); jsonStagingPresent = true;
    fs.writeFileSync(mdStaging, markdown, { flag: "wx" }); mdStagingPresent = true;
    validateOutputFile(jsonStaging); validateOutputFile(mdStaging);

    if (overwrite) {
      if (jsonExists) { jsonBackup = join(txDir, "bak.json"); fs.renameSync(jsonFinal, jsonBackup); jsonBackupMoved = true; }
      if (mdExists) { mdBackup = join(txDir, "bak.md"); fs.renameSync(mdFinal, mdBackup); mdBackupMoved = true; }
      exclusivePublish(jsonStaging, jsonFinal); jsonPublished = true;
      exclusivePublish(mdStaging, mdFinal); mdPublished = true;
    } else {
      // The initial exists check is only an early failure. Each final write is
      // exclusive hard-link publication so a competing writer cannot be
      // overwritten after staging, and a failed publish cannot partly write.
      exclusivePublish(jsonStaging, jsonFinal); jsonPublished = true;
      exclusivePublish(mdStaging, mdFinal); mdPublished = true;
    }
  } catch (originalErr) {
    const rb: string[] = [];
    function safeUnlink(p: string): boolean {
      try {
        if (p && existsSync(p)) fs.unlinkSync(p);
        return true;
      } catch (e) {
        rb.push(`unlink ${p}: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    }
    function safeRestore(from: string, to: string, label: string, restored: () => void): void {
      if (!from || !existsSync(from)) return;
      try {
        // Restore with an exclusive hard link as well. If another writer has
        // occupied the final path, preserve both its file and this backup.
        fs.linkSync(from, to);
        restored();
        fs.unlinkSync(from);
      } catch (e) { rb.push(`${label}: ${e instanceof Error ? e.message : String(e)}`); rollbackFatal = true; }
    }

    if (jsonPublished && safeUnlink(jsonFinal)) jsonPublished = false;
    if (mdPublished && safeUnlink(mdFinal)) mdPublished = false;
    if (jsonBackupMoved) safeRestore(jsonBackup, jsonFinal, `restore-json ${jsonBackup} -> ${jsonFinal}`, () => { jsonRestored = true; });
    if (mdBackupMoved) safeRestore(mdBackup, mdFinal, `restore-md ${mdBackup} -> ${mdFinal}`, () => { mdRestored = true; });

    if (jsonStagingPresent) safeUnlink(jsonStaging);
    if (mdStagingPresent) safeUnlink(mdStaging);

    if (!rollbackFatal && txDirVerified && txDir && existsSync(txDir)) {
      try { fs.rmdirSync(txDir); } catch (e) { rb.push(`rmdir txDir: ${e instanceof Error ? e.message : String(e)}`); }
    } else if (rollbackFatal && txDirVerified && txDir) {
      rb.push(`txDir preserved for manual recovery: ${txDir}`);
    }

    // A restored pre-existing file is the intended recovered state, not a
    // rollback residual. Only report finals this invocation still owns.
    if (jsonPublished && !jsonRestored && existsSync(jsonFinal)) rb.push(`residual json final: ${jsonFinal}`);
    if (mdPublished && !mdRestored && existsSync(mdFinal)) rb.push(`residual md final: ${mdFinal}`);

    if (rb.length > 0) throw Object.assign(new Error(`writeReport failed; rollback errors: ${rb.join("; ")}`), { code: "write_report_rollback_failed" });
    throw originalErr;
  }

  // Cleanup (no rollback on failure)
  const ce: string[] = [];
  function cUnlink(p: string) { try { if (existsSync(p)) fs.unlinkSync(p); } catch (e) { ce.push(`unlink ${p}: ${e instanceof Error ? e.message : String(e)}`); } }
  cUnlink(jsonBackup); cUnlink(mdBackup);
  if (jsonStagingPresent) cUnlink(jsonStaging);
  if (mdStagingPresent) cUnlink(mdStaging);
  try { if (txDirVerified && txDir && existsSync(txDir)) fs.rmdirSync(txDir); } catch (e) { ce.push(`rmdir txDir: ${e instanceof Error ? e.message : String(e)}`); }
  if (ce.length > 0) throw Object.assign(new Error(`writeReport committed but cleanup failed: ${ce.join("; ")}; txDir: ${txDir}`), { code: "tx_cleanup_failed" });

  if (txDir && existsSync(txDir)) throw Object.assign(new Error(`Transaction directory still present after cleanup: ${txDir}`), { code: "tx_not_cleaned" });

  const mdSz = Buffer.byteLength(markdown, "utf-8"), jsSz = Buffer.byteLength(json, "utf-8");
  return writeReportOutputSchema.parse({ reportId: report.id, reportPath: targetDir, markdownFile: mdFinal, jsonFile: jsonFinal, markdownSizeBytes: mdSz, jsonSizeBytes: jsSz } satisfies WriteReportOutput);
}

export function writeReport(input: WriteReportInput): WriteReportOutput {
  return writeReportWith(writeReportInputSchema.parse(input), realFs);
}

export function _writeReportForTest(input: WriteReportInput, fs: WriteReportFs): WriteReportOutput {
  return writeReportWith(writeReportInputSchema.parse(input), fs);
}
