import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync as fsWriteFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeReport, _writeReportForTest } from "../../src/reports/write-report.js";
import type { WriteReportFs } from "../../src/reports/write-report.js";
import * as realFs from "node:fs";
import { CORE_SCHEMA_VERSION, HARD_MAX_REPORT_SIZE_BYTES, type ReviewBundle, type FindingValidationResult, type WriteReportInput } from "../../src/schemas/index.js";

const FIXED_TIME = "2026-07-24T12:00:00.000Z";

function makeValidInput(repoRoot: string, overrides: Partial<WriteReportInput> = {}): WriteReportInput {
  const b: ReviewBundle = {
    schemaVersion: CORE_SCHEMA_VERSION, id: "bundle:test", createdAt: FIXED_TIME,
    changeScope: { schemaVersion: CORE_SCHEMA_VERSION, repositoryRoot: repoRoot, baseRef: "main", headRef: "feature/test", resolvedBase: "a".repeat(40), resolvedHead: "b".repeat(40), commits: [], files: [], detectedLanguages: [], detectedComponents: [], limits: { maxCommits: 500, maxFiles: 500, maxDiffBytes: 1_000_000, maxPatchBytesPerFile: 64_000 }, truncation: { isTruncated: false, reasons: [], omittedCommits: 0, omittedFiles: 0 }, errors: [] },
    evidenceItems: [{ schemaVersion: CORE_SCHEMA_VERSION, id: "evidence:1", type: "document", source: { system: "repository", locator: "README.md", uri: null }, retrievedAt: FIXED_TIME, contentHash: null, relatedChangeIds: [], excerpt: "Test evidence content.", selectionReason: "Related to change.", trustLevel: "trusted_repository", truncation: { isTruncated: false, originalCharacters: null, retainedCharacters: 22 }, redactions: [] }],
    evidenceIndex: [{ evidenceId: "evidence:1", relatedChangeIds: [] }],
    deterministicFacts: [{ id: "fact:1", statement: "The changed file exists.", evidenceIds: ["evidence:1"] }],
    missingEvidence: [{ source: { system: "git", locator: "secrets.env", uri: null }, reason: "File is gitignored", status: "inaccessible" }],
    limits: { maxEvidenceItems: 100, maxTotalExcerptCharacters: 100_000 },
    truncation: { isTruncated: false, omittedEvidenceItems: 0, omittedExcerptCharacters: 0, omittedMissingEvidence: 0 },
  };
  const v: FindingValidationResult = {
    schemaVersion: CORE_SCHEMA_VERSION, bundleId: "bundle:test", ok: true,
    validFindings: [{ schemaVersion: CORE_SCHEMA_VERSION, id: "finding:1", category: "security", severity: "high", confidence: 0.9, title: "Hardcoded secret", expectedBehavior: "Secrets must use environment variables.", observedBehavior: "A secret string is hardcoded in the source.", deterministicFacts: [{ statement: "The config file has a plaintext password.", evidenceIds: ["evidence:1"] }], inference: "The implementation leaks credentials into version control.", evidenceIds: ["evidence:1"], affectedSources: [{ system: "repository", locator: "src/config.ts", uri: null }], recommendation: "update_code", status: "confirmed" }],
    rejectedFindings: [], warnings: [], summary: { submitted: 1, valid: 1, rejected: 0, warnings: 0 },
  };
  return { bundle: b, validationResult: v, reviewMeta: { reviewer: "test-agent", createdAt: FIXED_TIME }, repositoryRoot: repoRoot, outputDirectory: "reports", reportName: "test-report", overwrite: false, ...overrides } as WriteReportInput;
}

function proxyFs(): WriteReportFs {
  return { mkdtempSync: (p) => realFs.mkdtempSync(p), writeFileSync: (p, d, o) => realFs.writeFileSync(p, d, o ?? {}), linkSync: (o, n) => realFs.linkSync(o, n), renameSync: (o, n) => realFs.renameSync(o, n), unlinkSync: (p) => realFs.unlinkSync(p), rmdirSync: (p) => realFs.rmdirSync(p) };
}

describe("writeReport", () => {
  let repoRoot: string, outputDir: string;
  beforeEach(async () => { repoRoot = await mkdtemp(join(tmpdir(), "ct-")); outputDir = resolve(repoRoot, "reports"); mkdirSync(outputDir, { recursive: true }); });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }).catch(() => {}); });

  // -- correctness --
  it("byte-identical with explicit createdAt", () => {
    const i = makeValidInput(repoRoot);
    const r1 = writeReport(i); const md1 = readFileSync(r1.markdownFile, "utf-8"); const j1 = readFileSync(r1.jsonFile, "utf-8");
    unlinkSync(r1.markdownFile); unlinkSync(r1.jsonFile);
    const r2 = writeReport(i);
    expect(readFileSync(r2.markdownFile, "utf-8")).toBe(md1);
    expect(readFileSync(r2.jsonFile, "utf-8")).toBe(j1);
  });

  it("bundleId mismatch", () => {
    const i = makeValidInput(repoRoot);
    (i.validationResult as FindingValidationResult).bundleId = "bundle:other";
    expect(() => writeReport(i)).toThrow(/Bundle ID mismatch/);
  });

  it("rejects absolute output directory", () => {
    const i = makeValidInput(repoRoot);
    (i as Record<string, unknown>).outputDirectory = resolve(repoRoot, "abs");
    expect(() => writeReport(i as WriteReportInput)).toThrow();
  });

  it("rejects .. traversal", () => {
    const i = makeValidInput(repoRoot);
    (i as Record<string, unknown>).outputDirectory = "reports/../../../etc";
    expect(() => writeReport(i as WriteReportInput)).toThrow(/stay within/);
  });

  it("rejects unsafe reportName", () => {
    const i = makeValidInput(repoRoot);
    (i as Record<string, unknown>).reportName = ";bad";
    expect(() => writeReport(i as WriteReportInput)).toThrow();
  });

  it("handles empty findings", () => {
    const i = makeValidInput(repoRoot);
    const vr = { ...i.validationResult as FindingValidationResult };
    vr.validFindings = []; vr.summary = { submitted: 0, valid: 0, rejected: 0, warnings: 0 };
    i.validationResult = vr; i.reportName = "empty";
    const md = readFileSync(writeReport(i).markdownFile, "utf-8");
    expect(md).not.toContain("Confirmed Findings");
    expect(md).not.toContain("Suspected Findings");
    expect(md).not.toContain("Inconclusive Findings");
  });

  it("warnings and rejections", () => {
    const i = makeValidInput(repoRoot);
    const vr = { ...i.validationResult as FindingValidationResult };
    vr.warnings = [{ findingId: "finding:1", index: 0, code: "w1", path: "x", message: "msg" }];
    vr.rejectedFindings = [{ index: 1, findingId: "finding:bad", issues: [{ code: "schema", path: "$", message: "Bad." }] }];
    vr.summary = { submitted: 2, valid: 1, rejected: 1, warnings: 1 };
    i.validationResult = vr; i.reportName = "warnrej";
    const md = readFileSync(writeReport(i).markdownFile, "utf-8");
    expect(md).toContain("Global Warnings");
    expect(md).toContain("Rejected Findings");
  });

  it("truncated evidence", () => {
    const i = makeValidInput(repoRoot);
    (i.bundle as ReviewBundle).truncation = { isTruncated: true, omittedEvidenceItems: 3, omittedExcerptCharacters: 5000, omittedMissingEvidence: 1 };
    i.reportName = "trunc";
    const md = readFileSync(writeReport(i).markdownFile, "utf-8");
    expect(md).toContain("Bundle Truncation");
  });

  it("literal status per finding group", () => {
    const i = makeValidInput(repoRoot);
    const vr = { ...i.validationResult as FindingValidationResult };
    vr.validFindings = [
      { ...vr.validFindings[0]!, id: "f:a", status: "confirmed" },
      { ...vr.validFindings[0]!, id: "f:b", status: "suspected", confidence: 0.5 },
      { ...vr.validFindings[0]!, id: "f:c", status: "inconclusive", confidence: 0.2, evidenceIds: [] },
    ] as typeof vr.validFindings;
    vr.summary = { submitted: 3, valid: 3, rejected: 0, warnings: 0 };
    i.validationResult = vr; i.reportName = "mix";
    const j = JSON.parse(readFileSync(writeReport(i).jsonFile, "utf-8"));
    expect(j.findings.confirmed[0].status).toBe("confirmed");
    expect(j.findings.suspected[0].status).toBe("suspected");
    expect(j.findings.inconclusive[0].status).toBe("inconclusive");
  });

  it("overwrite with mkdtemp staging, no residues", () => {
    const r = writeReport(makeValidInput(repoRoot, { overwrite: true }));
    const old = readFileSync(r.jsonFile, "utf-8");
    writeReport(makeValidInput(repoRoot, { overwrite: true, reviewMeta: { reviewer: "u", createdAt: FIXED_TIME } }));
    expect(readFileSync(r.jsonFile, "utf-8")).not.toBe(old);
    const entries = readdirSync(outputDir).filter((e) => e !== "test-report.json" && e !== "test-report.md");
    expect(entries.filter((e) => e.startsWith(".report-"))).toHaveLength(0);
  });

  it("repo root realpath mismatch", () => {
    const i = makeValidInput(repoRoot);
    const o = join(tmpdir(), "ct-o-" + Date.now()); mkdirSync(o, { recursive: true });
    try { (i.bundle as ReviewBundle).changeScope.repositoryRoot = o; expect(() => writeReport(i)).toThrow(/same directory/); } finally { try { rmdirSync(o); } catch { /* ignore */ } }
  });

  it("case-insensitive .git", () => {
    const i = makeValidInput(repoRoot);
    (i as Record<string, unknown>).outputDirectory = ".GIT/x";
    expect(() => writeReport(i as WriteReportInput)).toThrow();
  });

  it("size limits", () => {
    const i = makeValidInput(repoRoot);
    i.maxReportSizeBytes = 10; expect(() => writeReport(i)).toThrow(/maximum size/);
    (i as Record<string, unknown>).maxReportSizeBytes = HARD_MAX_REPORT_SIZE_BYTES + 1;
    expect(() => writeReport(i as WriteReportInput)).toThrow();
  });

  // -- Markdown containment --
  it("prevents 4-space and tab indented code blocks", () => {
    const i = makeValidInput(repoRoot);
    i.reviewMeta = { reviewer: "test", createdAt: FIXED_TIME, notes: "safe\n    indented code\n\tindented code\n   # heading" };
    i.reportName = "indent"; i.overwrite = true;
    const md = readFileSync(writeReport(i).markdownFile, "utf-8");
    const lines = md.split("\n");
    for (const line of lines) {
      // No line should start with 4 spaces or tab (would create indented code block)
      expect(line).not.toMatch(/^ {4}/);
      expect(line).not.toMatch(/^\t/);
    }
    // Content should still be present in escaped form
    expect(md).toContain("indented code");
  });

  it("escapes CommonMark injection patterns", () => {
    const i = makeValidInput(repoRoot);
    i.reviewMeta = { reviewer: "safe\n   # heading\n   - list", createdAt: FIXED_TIME, notes: "safe\n   1. ordered\n    indented code\n\tindented code" };
    const vr = { ...i.validationResult as FindingValidationResult };
    vr.validFindings = [{ ...vr.validFindings[0]!, title: "# title\n   # heading indent", expectedBehavior: "safe\n   # heading\n   - list\n   1. ordered", observedBehavior: "safe\n\tindented\n    four spaces" }] as typeof vr.validFindings;
    vr.warnings = [{ findingId: "finding:1", index: 0, code: "warn-x", path: "ok", message: "safe\n   # injected heading" }];
    vr.summary = { submitted: 1, valid: 1, rejected: 0, warnings: 1 };
    i.validationResult = vr; i.reportName = "cm"; i.overwrite = true;
    const md = readFileSync(writeReport(i).markdownFile, "utf-8");
    // No raw heading injection from user text
    expect(md).not.toMatch(/\n   #/);
    expect(md).toContain("safe /");
  });

  it("escapes tab indentation, ordered-list variants, setext headings, and pipe tables", () => {
    const i = makeValidInput(repoRoot, { reportName: "cm-boundaries", overwrite: true });
    i.reviewMeta = {
      reviewer: "crlf\r\nlf\ncr\rend",
      createdAt: FIXED_TIME,
      notes: "\tzero-tab\n \tone-tab\n  \ttwo-tab\n   \tthree-tab\n1) close-list\n1. dot-list\nsetext equals\n=  \nsetext dash\n-\t\na | b\n--- | ---\n~~~js\nfenced text\n~~~",
      declaredLimitations: ["~~~limit"],
    };
    const validationResult = { ...i.validationResult as FindingValidationResult };
    validationResult.warnings = [{
      findingId: "finding:1",
      index: 0,
      code: "tilde-fence",
      path: "notes",
      message: "~~~warning",
    }];
    validationResult.summary = { ...validationResult.summary, warnings: 1 };
    i.validationResult = validationResult;
    const md = readFileSync(writeReport(i).markdownFile, "utf-8");
    expect(md).toContain("1\\) close-list");
    expect(md).toContain("1\\. dot-list");
    expect(md).toContain("\\=");
    expect(md).toContain("\\-");
    expect(md).toContain("a \\| b");
    expect(md).toContain("--- \\| ---");
    expect(md).toContain("\\~\\~\\~js");
    expect(md).toContain("\\~\\~\\~limit");
    expect(md).toContain("\\~\\~\\~warning");
    expect(md).not.toMatch(/^ {0,3}~~~/m);
    expect(md).toContain("**Reviewer:** crlf / lf / cr / end");
    for (const line of md.split("\n")) expect(line).not.toMatch(/^ {0,3}\t/);
  });

  it("preserves report substance in both JSON and Markdown", () => {
    const i = makeValidInput(repoRoot, { reportName: "substance", overwrite: true });
    i.reviewMeta = { reviewer: "test", createdAt: FIXED_TIME, declaredLimitations: ["No live runtime access"] };
    (i.bundle as ReviewBundle).evidenceItems.push({ ...i.bundle.evidenceItems[0]!, id: "evidence:unreferenced" });
    const result = writeReport(i);
    const json = JSON.parse(readFileSync(result.jsonFile, "utf-8"));
    const finding = json.findings.confirmed[0];
    expect(finding.deterministicFacts[0].evidenceIds).toEqual(["evidence:1"]);
    expect(finding.inference).toContain("leaks credentials");
    expect(finding.evidenceIds).toEqual(["evidence:1"]);
    expect(finding.affectedSources[0].locator).toBe("src/config.ts");
    expect(json.missingEvidence[0].status).toBe("inaccessible");
    expect(json.evidenceCoverage.unreferencedEvidenceIds).toEqual(["evidence:unreferenced"]);
    expect(json.reviewMeta.declaredLimitations).toEqual(["No live runtime access"]);
    const md = readFileSync(result.markdownFile, "utf-8");
    for (const text of ["Deterministic facts", "Inference", "Evidence IDs", "Affected sources", "Missing Evidence", "inaccessible", "Unreferenced Evidence", "Declared Limitations", "No live runtime access"]) expect(md).toContain(text);
  });

  it("wraps an unresolvable bundle root without masking a root mismatch", () => {
    const i = makeValidInput(repoRoot);
    (i.bundle as ReviewBundle).changeScope.repositoryRoot = join(repoRoot, "missing-bundle-root");
    try { writeReport(i); expect.fail("should throw"); } catch (err) {
      expect((err as { code?: string }).code).toBe("bundle_root_unresolvable");
    }
  });

  // -- Failure injection --
  it("overwrite false never overwrites a pair created during promotion", () => {
    const i = makeValidInput(repoRoot, { reportName: "race", overwrite: false });
    const jf = join(outputDir, "race.json"), mf = join(outputDir, "race.md");
    const competitorJson = '{"writer":"competitor"}\n', competitorMd = "# Competitor\n";
    let raced = false;
    const racingFs: WriteReportFs = {
      ...proxyFs(),
      linkSync(existingPath, newPath) {
        if (!raced && newPath === jf) {
          raced = true;
          realFs.writeFileSync(jf, competitorJson, { flag: "wx" });
          realFs.writeFileSync(mf, competitorMd, { flag: "wx" });
        }
        realFs.linkSync(existingPath, newPath);
      },
    };
    try { _writeReportForTest(i, racingFs); expect.fail("should throw"); } catch (err) {
      expect((err as { code?: string }).code).toBe("report_files_exist");
    }
    expect(readFileSync(jf, "utf-8")).toBe(competitorJson);
    expect(readFileSync(mf, "utf-8")).toBe(competitorMd);
    expect(readdirSync(outputDir).filter((entry) => entry.startsWith(".report-"))).toHaveLength(0);
  });

  it("rejects an escaped transaction directory before any staging write", async () => {
    const escapedTxDir = await mkdtemp(join(tmpdir(), "ct-escaped-tx-"));
    let wroteStaging = false;
    const escapingFs: WriteReportFs = {
      ...proxyFs(),
      mkdtempSync: () => escapedTxDir,
      writeFileSync(path, data, options) {
        if (path.includes("new.json") || path.includes("new.md")) wroteStaging = true;
        realFs.writeFileSync(path, data, options ?? {});
      },
    };
    try {
      const i = makeValidInput(repoRoot, { reportName: "tx-escape" });
      try { _writeReportForTest(i, escapingFs); expect.fail("should throw"); } catch (err) {
        expect((err as { code?: string }).code).toBe("txdir_escape");
      }
      expect(wroteStaging).toBe(false);
      expect(existsSync(join(escapedTxDir, "new.json"))).toBe(false);
      expect(existsSync(join(escapedTxDir, "new.md"))).toBe(false);
    } finally { await rm(escapedTxDir, { recursive: true, force: true }); }
  });

  it("no old reports: md promotion fail + json final unlink fail", () => {
    const i = makeValidInput(repoRoot, { reportName: "nf1" });
    const jf = join(outputDir, "nf1.json"), mf = join(outputDir, "nf1.md");
    const badFs: WriteReportFs = {
      ...proxyFs(),
      linkSync(oldPath, newPath) { if (newPath === mf) throw new Error("sim-md-promote"); realFs.linkSync(oldPath, newPath); },
      unlinkSync(path) { if (path === jf) throw new Error("sim-json-unlink"); realFs.unlinkSync(path); },
    };
    try { _writeReportForTest(i, badFs); expect.fail("should throw"); } catch (e) {
      expect((e as Error).message).toMatch(/rollback errors/);
      expect((e as Error).message).toContain("sim-json-unlink");
      expect((e as Error).message).toContain("residual json final");
    }
  });

  it("with old reports: json backup restore failure", () => {
    writeReport(makeValidInput(repoRoot, { overwrite: true, reportName: "jbr" }));
    const jf = join(outputDir, "jbr.json"), mf = join(outputDir, "jbr.md");
    const oldJ = readFileSync(jf, "utf-8"), oldM = readFileSync(mf, "utf-8");
    const badFs: WriteReportFs = {
      ...proxyFs(),
      renameSync(o, n) { realFs.renameSync(o, n); },
      linkSync(o, n) {
        if (o.includes("bak.json")) throw new Error("sim-json-bak-restore");
        if (n.endsWith("jbr.json")) throw new Error("sim-json-promote");
        realFs.linkSync(o, n);
      },
    };
    const i = makeValidInput(repoRoot, { overwrite: true, reportName: "jbr", reviewMeta: { reviewer: "new", createdAt: FIXED_TIME } });
    try { _writeReportForTest(i, badFs); expect.fail("should throw"); } catch (e) {
      expect((e as Error).message).toMatch(/rollback errors/);
      expect((e as Error).message).toContain("sim-json-bak-restore");
      expect((e as Error).message).toContain("txDir preserved");
    }
    // Old md restored from backup
    expect(readFileSync(mf, "utf-8")).toBe(oldM);
    // Old json is in the preserved txDir bak file, not at the final path
    const txDirs = readdirSync(outputDir).filter((e) => e.startsWith(".report-"));
    expect(txDirs.length).toBeGreaterThan(0);
    const bakJson = join(outputDir, txDirs[0]!, "bak.json");
    expect(existsSync(bakJson)).toBe(true);
    expect(readFileSync(bakJson, "utf-8")).toBe(oldJ);
  });

  it("with old reports: md backup restore failure", () => {
    writeReport(makeValidInput(repoRoot, { overwrite: true, reportName: "mbr" }));
    const jf = join(outputDir, "mbr.json"), mf = join(outputDir, "mbr.md");
    const oldJ = readFileSync(jf, "utf-8"), oldM = readFileSync(mf, "utf-8");
    const badFs: WriteReportFs = {
      ...proxyFs(),
      renameSync(o, n) { realFs.renameSync(o, n); },
      linkSync(o, n) {
        if (o.includes("bak.md")) throw new Error("sim-md-bak-restore");
        if (n.endsWith("mbr.md")) throw new Error("sim-md-promote");
        realFs.linkSync(o, n);
      },
    };
    const i = makeValidInput(repoRoot, { overwrite: true, reportName: "mbr", reviewMeta: { reviewer: "new", createdAt: FIXED_TIME } });
    try { _writeReportForTest(i, badFs); expect.fail("should throw"); } catch (e) {
      expect((e as Error).message).toMatch(/rollback errors/);
      expect((e as Error).message).toContain("sim-md-bak-restore");
      expect((e as Error).message).toContain("txDir preserved");
    }
    // Old json restored from backup
    expect(readFileSync(jf, "utf-8")).toBe(oldJ);
    // Old md is in the preserved txDir bak file
    const txDirs = readdirSync(outputDir).filter((e) => e.startsWith(".report-"));
    expect(txDirs.length).toBeGreaterThan(0);
    const bakMd = join(outputDir, txDirs[0]!, "bak.md");
    expect(existsSync(bakMd)).toBe(true);
    expect(readFileSync(bakMd, "utf-8")).toBe(oldM);
  });

  it("rollback restore does not overwrite a competing final file", () => {
    writeReport(makeValidInput(repoRoot, { overwrite: true, reportName: "restore-race" }));
    const jf = join(outputDir, "restore-race.json"), mf = join(outputDir, "restore-race.md");
    const oldJson = readFileSync(jf, "utf-8"), oldMd = readFileSync(mf, "utf-8");
    const competitorMd = "# Competing writer\n";
    const badFs: WriteReportFs = {
      ...proxyFs(),
      linkSync(oldPath, newPath) {
        if (oldPath.endsWith("new.md")) throw new Error("sim-md-publish");
        if (oldPath.endsWith("bak.md")) realFs.writeFileSync(mf, competitorMd, { flag: "wx" });
        realFs.linkSync(oldPath, newPath);
      },
    };
    const i = makeValidInput(repoRoot, { overwrite: true, reportName: "restore-race", reviewMeta: { reviewer: "new", createdAt: FIXED_TIME } });
    try { _writeReportForTest(i, badFs); expect.fail("should throw"); } catch (err) {
      expect((err as { code?: string }).code).toBe("write_report_rollback_failed");
      expect((err as Error).message).toContain("restore-md");
      expect((err as Error).message).not.toContain("residual json final");
      expect((err as Error).message).not.toContain("residual md final");
    }
    expect(readFileSync(jf, "utf-8")).toBe(oldJson);
    expect(readFileSync(mf, "utf-8")).toBe(competitorMd);
    const txDir = readdirSync(outputDir).find((entry) => entry.startsWith(".report-"));
    expect(txDir).toBeDefined();
    expect(readFileSync(join(outputDir, txDir!, "bak.md"), "utf-8")).toBe(oldMd);
  });

  it("does not report a competitor after deleting its published JSON", () => {
    writeReport(makeValidInput(repoRoot, { overwrite: true, reportName: "restore-json-race" }));
    const jf = join(outputDir, "restore-json-race.json"), mf = join(outputDir, "restore-json-race.md");
    const oldJson = readFileSync(jf, "utf-8"), oldMd = readFileSync(mf, "utf-8");
    const competitorJson = '{"writer":"competitor"}\n';
    const badFs: WriteReportFs = {
      ...proxyFs(),
      linkSync(oldPath, newPath) {
        if (oldPath.endsWith("new.md")) throw new Error("sim-md-publish");
        realFs.linkSync(oldPath, newPath);
      },
      unlinkSync(path) {
        if (path === jf) {
          realFs.unlinkSync(path);
          realFs.writeFileSync(jf, competitorJson, { flag: "wx" });
          return;
        }
        realFs.unlinkSync(path);
      },
    };
    const i = makeValidInput(repoRoot, { overwrite: true, reportName: "restore-json-race", reviewMeta: { reviewer: "new", createdAt: FIXED_TIME } });
    try { _writeReportForTest(i, badFs); expect.fail("should throw"); } catch (err) {
      expect((err as { code?: string }).code).toBe("write_report_rollback_failed");
      expect((err as Error).message).toContain("restore-json");
      expect((err as Error).message).not.toContain("residual json final");
    }
    expect(readFileSync(jf, "utf-8")).toBe(competitorJson);
    expect(readFileSync(mf, "utf-8")).toBe(oldMd);
    const txDir = readdirSync(outputDir).find((entry) => entry.startsWith(".report-"));
    expect(txDir).toBeDefined();
    expect(readFileSync(join(outputDir, txDir!, "bak.json"), "utf-8")).toBe(oldJson);
  });

  // -- symlink + wx --
  it("symlink junction escape no outside artifacts", async () => {
    const outside = join(tmpdir(), "ct-o-" + Date.now()); mkdirSync(outside, { recursive: true });
    const link = join(repoRoot, "esc");
    try { symlinkSync(outside, link, "junction"); } catch { await rm(outside, { recursive: true, force: true }).catch(() => {}); return; }
    try {
      const before = readdirSync(outside);
      const i = makeValidInput(repoRoot); (i as Record<string, unknown>).outputDirectory = "esc";
      try { writeReport(i as WriteReportInput); expect.fail("should throw"); } catch { /* expected */ }
      expect(readdirSync(outside)).toEqual(before);
    } finally { try { unlinkSync(link); } catch { rmdirSync(link); } await rm(outside, { recursive: true, force: true }).catch(() => {}); }
  });

  it("pre-created staging symlink victim untouched", () => {
    const victim = join(tmpdir(), "ct-v-" + Date.now()); fsWriteFileSync(victim, "victim");
    try {
      const fs = join(outputDir, ".report-fake");
      try { symlinkSync(victim, fs, "file"); } catch { try { unlinkSync(victim); } catch { /* ignore */ } return; }
      try {
        const bef = readFileSync(victim, "utf-8");
        const r = writeReport(makeValidInput(repoRoot, { overwrite: true }));
        expect(readFileSync(victim, "utf-8")).toBe(bef);
        expect(existsSync(r.jsonFile)).toBe(true);
      } finally { try { unlinkSync(fs); } catch { /* ignore */ } }
    } finally { try { unlinkSync(victim); } catch { /* ignore */ } }
  });
});
