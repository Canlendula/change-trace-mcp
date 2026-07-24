import {
  existsSync,
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

const SAFE_REPORT_NAME_RE =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const enum TxPhase {
  Init,
  TxDirReady,
  Staged,
  JsonBackedUp,
  MdBackedUp,
  JsonLive,
  MdLive,
  Committed,
}

export interface WriteReportFs {
  mkdtempSync(prefix: string): string;
  writeFileSync(path: string, data: string, options?: { flag?: string }): void;
  renameSync(oldPath: string, newPath: string): void;
  unlinkSync(path: string): void;
  rmdirSync(path: string): void;
}

const realFs: WriteReportFs = {
  mkdtempSync,
  writeFileSync(path, data, options) {
    fsWriteFileSync(path, data, options ?? {});
  },
  renameSync: fsRenameSync,
  unlinkSync,
  rmdirSync,
};

function validatePathSafety(repoRoot: string, outputDir: string): string {
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
  try { resolvedRoot = realpathSync(repoRoot); } catch (err) {
    throw Object.assign(
      new Error(`Cannot resolve repositoryRoot: ${err instanceof Error ? err.message : String(err)}`),
      { code: "invalid_repo_root" },
    );
  }
  const normalized = resolve(repoRoot, outputDir);
  const relPath = relative(repoRoot, normalized);
  if (relPath === "" || isAbsolute(relPath) || relPath.startsWith("..")) {
    throw Object.assign(new Error("Output directory must stay within the repository root"), { code: "output_directory_traversal" });
  }
  const segments = relPath.replace(/\\/g, "/").split("/");
  if (segments.some((s) => s.toLowerCase() === ".git")) {
    throw Object.assign(new Error("Output directory must not include .git paths"), { code: "output_directory_git_path" });
  }
  let current = resolvedRoot;
  for (const segment of segments) {
    if (segment.length === 0) continue;
    const candidate = join(current, segment);
    try {
      if (existsSync(candidate)) {
        const resolved = realpathSync(candidate);
        const rel = relative(resolvedRoot, resolved);
        if (rel === "" || isAbsolute(rel) || rel.split(/[\\/]/).some((s) => s === "..")) {
          throw Object.assign(new Error("Ancestor path resolves outside the repository root"), { code: "ancestor_escape" });
        }
        current = resolved;
      } else { current = candidate; }
    } catch (err) {
      if ((err as { code?: string }).code === "ancestor_escape") throw err;
      throw Object.assign(
        new Error(`Cannot validate ancestor path: ${err instanceof Error ? err.message : String(err)}`),
        { code: "ancestor_resolution_failed" },
      );
    }
  }
  return current;
}

function validateOutputFile(target: string): void {
  try {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) throw Object.assign(new Error("Output file path is a symbolic link"), { code: "output_file_symlink" });
    if (!stat.isFile()) throw Object.assign(new Error("Output file path is not a regular file"), { code: "output_file_not_regular" });
  } catch (err) { if ((err as { code?: string }).code) throw err; }
}

function buildReport(input: WriteReportInput): Report {
  const bundle = input.bundle;
  const validationResult = input.validationResult;
  if (validationResult.bundleId !== bundle.id) {
    throw Object.assign(new Error(`Bundle ID mismatch: validation result references ${validationResult.bundleId} but bundle has ${bundle.id}`), { code: "bundle_id_mismatch" });
  }
  if (!SAFE_REPORT_NAME_RE.test(input.reportName)) {
    throw Object.assign(new Error("reportName must contain only safe filename characters"), { code: "invalid_report_name" });
  }
  const reportId = `report:${input.reportName}`;
  const createdAt = input.reviewMeta.createdAt;
  const evidenceIdsInBundle = new Set(bundle.evidenceItems.map((item) => item.id));
  const referencedIds = new Set<string>();
  for (const finding of validationResult.validFindings) {
    for (const evidenceId of finding.evidenceIds) { if (evidenceIdsInBundle.has(evidenceId)) referencedIds.add(evidenceId); }
    for (const fact of finding.deterministicFacts) { for (const evidenceId of fact.evidenceIds) { if (evidenceIdsInBundle.has(evidenceId)) referencedIds.add(evidenceId); } }
  }
  const unreferencedIds = [...evidenceIdsInBundle].filter((id) => !referencedIds.has(id));
  const warnings: ReportWarning[] = validationResult.warnings.map((w) => ({ code: w.code, message: w.message.slice(0, 2_000), findingId: w.findingId }));
  function toReportFinding(f: (typeof validationResult.validFindings)[number]) {
    const fw = warnings.filter((w) => w.findingId === f.id).map((w) => ({ code: w.code, message: w.message }));
    return { id: f.id, category: f.category, severity: f.severity, confidence: f.confidence, title: f.title, expectedBehavior: f.expectedBehavior, observedBehavior: f.observedBehavior, deterministicFacts: f.deterministicFacts.map((fact) => ({ statement: fact.statement, evidenceIds: fact.evidenceIds })), inference: f.inference, evidenceIds: f.evidenceIds, affectedSources: f.affectedSources, recommendation: f.recommendation, status: f.status, warnings: fw };
  }
  const reportFindings: Report["findings"] = {
    confirmed: validationResult.validFindings.filter((f) => f.status === "confirmed").map(toReportFinding) as Report["findings"]["confirmed"],
    suspected: validationResult.validFindings.filter((f) => f.status === "suspected").map(toReportFinding) as Report["findings"]["suspected"],
    inconclusive: validationResult.validFindings.filter((f) => f.status === "inconclusive").map(toReportFinding) as Report["findings"]["inconclusive"],
  };
  const rejectedFindings: ReportRejectedFinding[] = validationResult.rejectedFindings.map((rf) => ({ index: rf.index, findingId: rf.findingId, issues: rf.issues.map((issue) => ({ code: issue.code, path: issue.path, message: issue.message.slice(0, 2_000) })) }));
  const missingEvidence = bundle.missingEvidence.map((me) => ({ source: me.source, reason: me.reason, status: me.status }));
  const report: Report = {
    schemaVersion: CORE_SCHEMA_VERSION, id: reportId, createdAt, bundleId: bundle.id,
    reviewMeta: { reviewer: input.reviewMeta.reviewer, toolVersion: input.reviewMeta.toolVersion, notes: input.reviewMeta.notes, declaredLimitations: input.reviewMeta.declaredLimitations },
    findings: reportFindings, rejectedFindings, missingEvidence,
    evidenceCoverage: { totalEvidenceItems: bundle.evidenceItems.length, referencedEvidenceIds: [...referencedIds].sort(), unreferencedEvidenceIds: unreferencedIds.sort() },
    validationSummary: { submitted: validationResult.summary.submitted, valid: validationResult.summary.valid, rejected: validationResult.summary.rejected, warnings: validationResult.summary.warnings },
    bundleLimits: { maxEvidenceItems: bundle.limits.maxEvidenceItems, maxTotalExcerptCharacters: bundle.limits.maxTotalExcerptCharacters },
    bundleTruncation: { isTruncated: bundle.truncation.isTruncated, omittedEvidenceItems: bundle.truncation.omittedEvidenceItems, omittedExcerptCharacters: bundle.truncation.omittedExcerptCharacters, omittedMissingEvidence: bundle.truncation.omittedMissingEvidence },
    warnings,
  };
  return reportSchema.parse(report) as Report;
}

// --- Markdown rendering ---

function dynamicFence(text: string, language: string = ""): string {
  const runs = text.match(/`{3,}/g) ?? [];
  const maxRun = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const fence = "`".repeat(Math.max(3, maxRun + 1));
  const safeText = text.replace(/^ {0,3}#/gm, "\\#");
  return `${fence}${language}\n${safeText}\n${fence}`;
}

function dynamicCodeSpan(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const maxRun = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const ticks = "`".repeat(Math.max(1, maxRun + 1));
  return `${ticks}${text}${ticks}`;
}

function safeInline(text: string): string {
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
    .replace(/!/g, "\\!")
    .replace(/^ {0,3}#/gm, "\\#")
    .replace(/^ {0,3}>/gm, "\\>")
    .replace(/^ {0,3}([-*+])\s/gm, "\\$1 ")
    .replace(/^ {0,3}(\d+)\.\s/gm, "$1\\. ")
    .replace(/^ {0,3}(={3,}|-{3,})$/gm, "\\$1")
    .replace(/^ {4}/gm, "    \\")
    .replace(/^\t/gm, "\t\\")
    .replace(/^\|/gm, "\\|");
}

function inlineNoNewlines(text: string): string {
  return safeInline(text.replace(/\n/g, " / "));
}

function safeLiteral(value: string): string {
  return dynamicCodeSpan(value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
}

function renderMarkdown(report: Report, bundle: ReviewBundle): string {
  const L: string[] = [];
  const h = (t: string) => { L.push(t); };
  h(`# Change Trace Review Report`); h("");
  h(`**Report ID:** ${safeLiteral(report.id)}`);
  h(`**Created:** ${safeLiteral(report.createdAt)}`);
  h(`**Bundle ID:** ${safeLiteral(report.bundleId)}`);
  h(`**Reviewer:** ${inlineNoNewlines(report.reviewMeta.reviewer)}`);
  if (report.reviewMeta.toolVersion) h(`**Tool Version:** ${safeLiteral(report.reviewMeta.toolVersion)}`);
  h("");
  if (report.reviewMeta.notes) { h("## Review Notes"); h(""); h(safeInline(report.reviewMeta.notes)); h(""); }
  if (report.reviewMeta.declaredLimitations?.length) {
    h("## Declared Limitations"); h("");
    for (const lim of report.reviewMeta.declaredLimitations) h(`- ${safeInline(lim)}`);
    h("");
  }
  h("## Validation Summary"); h("");
  h(`| Metric | Count |`); h(`|---|---|`);
  h(`| Submitted findings | ${report.validationSummary.submitted} |`);
  h(`| Valid findings | ${report.validationSummary.valid} |`);
  h(`| Rejected findings | ${report.validationSummary.rejected} |`);
  h(`| Warnings | ${report.validationSummary.warnings} |`); h("");
  h("## Evidence Coverage"); h("");
  h(`- **Total evidence items:** ${report.evidenceCoverage.totalEvidenceItems}`);
  h(`- **Referenced by findings:** ${report.evidenceCoverage.referencedEvidenceIds.length}`);
  h(`- **Not referenced:** ${report.evidenceCoverage.unreferencedEvidenceIds.length}`); h("");
  h("## Bundle Information"); h("");
  h(`- **Change scope:** ${safeLiteral(bundle.changeScope.resolvedBase.slice(0, 8) + "...")} -> ${safeLiteral(bundle.changeScope.resolvedHead.slice(0, 8) + "...")}`);
  h(`- **Evidence items:** ${bundle.evidenceItems.length}`);
  h(`- **Deterministic facts:** ${bundle.deterministicFacts.length}`);
  h(`- **Missing evidence:** ${bundle.missingEvidence.length}`); h("");
  h("### Bundle Limits"); h("");
  h(`- Max evidence items: ${report.bundleLimits.maxEvidenceItems}`);
  h(`- Max excerpt characters: ${report.bundleLimits.maxTotalExcerptCharacters}`); h("");
  if (report.bundleTruncation.isTruncated) {
    h("### Bundle Truncation"); h("");
    h(`- **Omitted evidence items:** ${report.bundleTruncation.omittedEvidenceItems}`);
    h(`- **Omitted excerpt characters:** ${report.bundleTruncation.omittedExcerptCharacters}`);
    h(`- **Omitted missing evidence:** ${report.bundleTruncation.omittedMissingEvidence}`); h("");
  }
  if (report.missingEvidence.length > 0) {
    h("## Missing Evidence"); h("");
    for (const me of report.missingEvidence) h(`- **${safeLiteral(me.status)}** ${safeLiteral(me.source.system + ":" + me.source.locator)}: ${safeInline(me.reason)}`);
    h("");
  }
  if (report.warnings.length > 0) {
    h("## Global Warnings"); h("");
    for (const w of report.warnings) {
      const p = w.findingId ? `${safeLiteral(w.findingId)}: ` : "";
      h(`- **${safeLiteral(w.code)}** ${p}${safeInline(w.message)}`);
    }
    h("");
  }
  const section = (title: string, findings: ReportFinding[]) => {
    if (findings.length === 0) return;
    h(`## ${title} (${findings.length})`); h("");
    for (const f of findings) {
      h(`### ${safeLiteral(f.id)} -- ${inlineNoNewlines(f.title)}`);
      h("");
      h(`**Category:** ${safeLiteral(f.category)} | **Severity:** ${safeLiteral(f.severity)} | **Confidence:** ${f.confidence} | **Status:** ${safeLiteral(f.status)} | **Recommendation:** ${safeLiteral(f.recommendation)}`);
      h("");
      h("**Expected behavior:**"); h(""); h(dynamicFence(f.expectedBehavior)); h("");
      h("**Observed behavior:**"); h(""); h(dynamicFence(f.observedBehavior)); h("");
      if (f.deterministicFacts.length > 0) {
        h("**Deterministic facts:**"); h("");
        for (const fact of f.deterministicFacts) h(`- ${safeInline(fact.statement)} (evidence: ${fact.evidenceIds.map((id) => safeLiteral(id)).join(", ")})`);
        h("");
      }
      h("**Inference:**"); h(""); h(dynamicFence(f.inference)); h("");
      if (f.evidenceIds.length > 0) { h(`**Evidence IDs:** ${f.evidenceIds.map((id) => safeLiteral(id)).join(", ")}`); h(""); }
      if (f.affectedSources.length > 0) {
        h("**Affected sources:**"); h("");
        for (const src of f.affectedSources) h(`- ${safeLiteral(src.system)}: ${safeInline(src.locator)}`);
        h("");
      }
      if (f.warnings.length > 0) {
        h("**Finding warnings:**"); h("");
        for (const w of f.warnings) h(`- ${safeLiteral(w.code)}: ${safeInline(w.message)}`);
        h("");
      }
    }
  };
  section("Confirmed Findings", report.findings.confirmed);
  section("Suspected Findings", report.findings.suspected);
  section("Inconclusive Findings", report.findings.inconclusive);
  if (report.rejectedFindings.length > 0) {
    h(`## Rejected Findings (${report.rejectedFindings.length})`); h("");
    for (const rf of report.rejectedFindings) {
      const idD = rf.findingId ? safeLiteral(rf.findingId) : "(no valid ID)";
      h(`### Index ${rf.index}: ${idD}`); h("");
      for (const issue of rf.issues) h(`- **${safeLiteral(issue.code)}** at ${safeLiteral(issue.path)}: ${safeInline(issue.message)}`);
      h("");
    }
    h("");
  }
  if (report.evidenceCoverage.unreferencedEvidenceIds.length > 0) {
    h("## Unreferenced Evidence"); h("");
    h(`${report.evidenceCoverage.unreferencedEvidenceIds.length} evidence item(s) were not referenced by any validated finding.`); h("");
  }
  return L.join("\n") + "\n";
}

function renderJson(report: Report): string { return JSON.stringify(report, null, 2) + "\n"; }
function checkSizeBound(md: string, json: string, maxBytes: number): void {
  const mb = Buffer.byteLength(md, "utf-8"), jb = Buffer.byteLength(json, "utf-8");
  if (mb > maxBytes || jb > maxBytes) throw Object.assign(new Error(`Report exceeds maximum size of ${maxBytes} bytes (markdown: ${mb}, json: ${jb})`), { code: "report_too_large" });
}

// --- Core write function ---

export function writeReport(rawInput: WriteReportInput, fs: WriteReportFs = realFs): WriteReportOutput {
  const input = writeReportInputSchema.parse(rawInput);
  const maxBytes = input.maxReportSizeBytes ?? DEFAULT_MAX_REPORT_SIZE_BYTES;
  const overwrite = input.overwrite === true;

  // Resolve repository roots
  let resolvedRepoRoot: string;
  try { resolvedRepoRoot = realpathSync(input.repositoryRoot); } catch (err) {
    throw Object.assign(new Error(`Cannot resolve repositoryRoot: ${err instanceof Error ? err.message : String(err)}`), { code: "invalid_repo_root" });
  }
  try {
    const resolvedBundleRoot = realpathSync(input.bundle.changeScope.repositoryRoot);
    if (resolvedRepoRoot !== resolvedBundleRoot) throw Object.assign(new Error("repositoryRoot and bundle.changeScope.repositoryRoot must identify the same directory"), { code: "repo_root_mismatch" });
  } catch (err) { if ((err as { code?: string }).code) throw err;
    throw Object.assign(new Error(`Cannot resolve bundle.changeScope.repositoryRoot: ${err instanceof Error ? err.message : String(err)}`), { code: "bundle_root_unresolvable" });
  }

  const targetDir = validatePathSafety(input.repositoryRoot, input.outputDirectory);
  const report = buildReport(input);
  const bundle = input.bundle;
  const markdown = renderMarkdown(report, bundle);
  const json = renderJson(report);
  checkSizeBound(markdown, json, maxBytes);

  const jsonFinal = join(targetDir, `${input.reportName}.json`);
  const mdFinal = join(targetDir, `${input.reportName}.md`);
  const mdExists = existsSync(mdFinal);
  const jsonExists = existsSync(jsonFinal);

  if (!overwrite && (mdExists || jsonExists)) {
    throw Object.assign(new Error(`Report files already exist in ${targetDir}. Use overwrite: true to replace them.`), { code: "report_files_exist" });
  }
  if (overwrite) {
    if (mdExists) validateOutputFile(mdFinal);
    if (jsonExists) validateOutputFile(jsonFinal);
  }

  try { mkdirSync(targetDir, { recursive: true }); } catch (err) {
    throw Object.assign(new Error(`Cannot create output directory: ${err instanceof Error ? err.message : String(err)}`), { code: "output_directory_create_failed" });
  }

  let resolvedDir: string;
  try { resolvedDir = realpathSync(targetDir); } catch (err) {
    throw Object.assign(new Error(`Cannot resolve output path: ${err instanceof Error ? err.message : String(err)}`), { code: "path_resolution_failed" });
  }
  const relResolved = relative(resolvedRepoRoot, resolvedDir);
  if (relResolved === "" || isAbsolute(relResolved) || relResolved.split(/[\\/]/).some((s) => s === "..")) {
    throw Object.assign(new Error("Output directory resolved outside the repository root"), { code: "output_directory_escape" });
  }

  let txDir: string | null = null;
  let phase: TxPhase = TxPhase.Init;

  const jsonStaging: string[] = [];
  const mdStaging: string[] = [];
  const jsonBak: string[] = [];
  const mdBak: string[] = [];
  const unresolved: string[] = [];

  function errDetail(): string {
    const paths = unresolved.filter((p) => existsSync(p));
    return paths.length > 0 ? `; unresolved: ${paths.join(", ")}` : "";
  }
  function fail(msg: string, code: string): never {
    throw Object.assign(new Error(`${msg}${errDetail()}`), { code });
  }
  function tryOp(fn: () => void, label: string): void {
    try { fn(); } catch (e) { unresolved.push(label); throw e; }
  }

  try {
    // Phase 1: create transaction directory
    tryOp(() => { txDir = fs.mkdtempSync(join(targetDir, `.report-`)); }, `<txDir>`);
    if (txDir) unresolved.push(txDir);
    phase = TxPhase.TxDirReady;

    // Verify txDir realpath stays inside targetDir
    tryOp(() => {
      const txReal = realpathSync(txDir!);
      const txRel = relative(resolvedDir, txReal);
      if (txRel === "" || isAbsolute(txRel) || txRel.split(/[\\/]/).some((s) => s === "..")) {
        throw Object.assign(new Error("Transaction directory resolves outside the target directory"), { code: "txdir_escape" });
      }
    }, `<txDir-verify>`);

    const jStg = join(txDir!, "new.json");
    const mStg = join(txDir!, "new.md");
    jsonStaging.push(jStg);
    mdStaging.push(mStg);

    // Phase 2: write staging files with wx (exclusive creation)
    tryOp(() => { fs.writeFileSync(jStg, json, { flag: "wx" }); }, jStg);
    tryOp(() => { fs.writeFileSync(mStg, markdown, { flag: "wx" }); }, mStg);
    validateOutputFile(jStg);
    validateOutputFile(mStg);
    phase = TxPhase.Staged;

    // Phase 3: if overwriting, backup existing files into txDir
    if (overwrite) {
      if (jsonExists) {
        const bak = join(txDir!, "bak.json");
        jsonBak.push(bak);
        tryOp(() => { fs.renameSync(jsonFinal, bak); }, `<json-backup>`);
        phase = TxPhase.JsonBackedUp;
      }
      if (mdExists) {
        const bak = join(txDir!, "bak.md");
        mdBak.push(bak);
        tryOp(() => { fs.renameSync(mdFinal, bak); }, `<md-backup>`);
        phase = TxPhase.MdBackedUp;
      }
    }

    // Phase 4: promote JSON staging to final
    tryOp(() => { fs.renameSync(jStg, jsonFinal); }, `<json-promote>`);
    jsonStaging.length = 0;
    phase = TxPhase.JsonLive;

    // Phase 5: promote Markdown staging to final
    tryOp(() => { fs.renameSync(mStg, mdFinal); }, `<md-promote>`);
    mdStaging.length = 0;
    phase = TxPhase.MdLive;

  } catch (originalErr) {
    // --- Rollback (only for promotion/backup phase failures) ---
    const rollbackErrors: string[] = [];

    function safeUnlink(p: string) { try { fs.unlinkSync(p); } catch (e) { rollbackErrors.push(`unlink ${p}: ${e instanceof Error ? e.message : String(e)}`); } }
    function safeRename(from: string, to: string) { try { fs.renameSync(from, to); } catch (e) { rollbackErrors.push(`rename ${from}: ${e instanceof Error ? e.message : String(e)}`); } }

    // If JSON was promoted, remove it before restoring backup
    if (phase >= TxPhase.JsonLive) {
      try { if (existsSync(jsonFinal)) fs.unlinkSync(jsonFinal); } catch { /* best effort */ }
    }
    // If Markdown was promoted, remove it before restoring backup
    if (phase >= TxPhase.MdLive) {
      try { if (existsSync(mdFinal)) fs.unlinkSync(mdFinal); } catch { /* best effort */ }
    }

    // Restore JSON backup if it exists
    if (jsonBak.length > 0 && existsSync(jsonBak[0]!)) {
      safeRename(jsonBak[0]!, jsonFinal);
    }
    // Restore Markdown backup if it exists
    if (mdBak.length > 0 && existsSync(mdBak[0]!)) {
      safeRename(mdBak[0]!, mdFinal);
    }

    // Clean up staging files
    for (const s of jsonStaging) { if (existsSync(s)) safeUnlink(s); }
    for (const s of mdStaging) { if (existsSync(s)) safeUnlink(s); }
    // Clean up backup files (only if not already restored)
    for (const b of jsonBak) { if (existsSync(b)) safeUnlink(b); }
    for (const b of mdBak) { if (existsSync(b)) safeUnlink(b); }

    // Clean up transaction directory
    if (txDir && existsSync(txDir)) {
      try { fs.rmdirSync(txDir); } catch (e) {
        rollbackErrors.push(`rmdir txDir: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const remaining = unresolved.filter((p) => existsSync(p));
    if (remaining.length > 0) rollbackErrors.push(`unresolved artifacts: ${remaining.join(", ")}`);

    if (rollbackErrors.length > 0) {
      throw Object.assign(
        new Error(`writeReport failed; rollback errors: ${rollbackErrors.join("; ")}`),
        { code: "write_report_rollback_failed" },
      );
    }
    // Clean rollback: re-throw the original error
    throw originalErr;
  }

  // Phase 6: clean up transaction directory (no rollback on failure)
  const cleanupErrors: string[] = [];
  function cleanupUnlink(p: string) { try { if (existsSync(p)) fs.unlinkSync(p); } catch (e) { cleanupErrors.push(`unlink ${p}: ${e instanceof Error ? e.message : String(e)}`); } }
  cleanupUnlink(jsonBak[0] ?? "");
  cleanupUnlink(mdBak[0] ?? "");
  for (const s of jsonStaging) { if (existsSync(s)) cleanupUnlink(s); }
  for (const s of mdStaging) { if (existsSync(s)) cleanupUnlink(s); }

  try { fs.rmdirSync(txDir!); } catch (e) {
    cleanupErrors.push(`rmdir txDir: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (cleanupErrors.length > 0) {
    throw Object.assign(
      new Error(`writeReport committed but cleanup failed: ${cleanupErrors.join("; ")}; txDir: ${txDir}`),
      { code: "tx_cleanup_failed" },
    );
  }

  unresolved.length = 0;
  phase = TxPhase.Committed;

  // Post-commit: ensure no artifacts remain
  if (phase !== TxPhase.Committed) {
    fail("Report transaction did not reach committed state", "tx_not_committed");
  }
  const remainingTx = unresolved.filter((p) => existsSync(p));
  if (remainingTx.length > 0) {
    throw Object.assign(
      new Error(`writeReport committed but unresolved artifacts remain: ${remainingTx.join(", ")}`),
      { code: "tx_cleanup_failed" },
    );
  }

  const markdownSizeBytes = Buffer.byteLength(markdown, "utf-8");
  const jsonSizeBytes = Buffer.byteLength(json, "utf-8");
  return writeReportOutputSchema.parse({
    reportId: report.id, reportPath: targetDir, markdownFile: mdFinal,
    jsonFile: jsonFinal, markdownSizeBytes, jsonSizeBytes,
  } satisfies WriteReportOutput);
}
