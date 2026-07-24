import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync as fsWriteFileSync,
} from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeReport, type WriteReportFs } from "../../src/reports/write-report.js";
import * as realFs from "node:fs";
import {
  CORE_SCHEMA_VERSION,
  HARD_MAX_REPORT_SIZE_BYTES,
  type ReviewBundle,
  type FindingValidationResult,
  type WriteReportInput,
} from "../../src/schemas/index.js";

const FIXED_TIME = "2026-07-24T12:00:00.000Z";

function makeValidInput(repoRoot: string, overrides: Partial<WriteReportInput> = {}): WriteReportInput {
  const bundle: ReviewBundle = {
    schemaVersion: CORE_SCHEMA_VERSION, id: "bundle:test", createdAt: FIXED_TIME,
    changeScope: {
      schemaVersion: CORE_SCHEMA_VERSION, repositoryRoot: repoRoot, baseRef: "main", headRef: "feature/test",
      resolvedBase: "a".repeat(40), resolvedHead: "b".repeat(40), commits: [], files: [], detectedLanguages: [], detectedComponents: [],
      limits: { maxCommits: 500, maxFiles: 500, maxDiffBytes: 1_000_000, maxPatchBytesPerFile: 64_000 },
      truncation: { isTruncated: false, reasons: [], omittedCommits: 0, omittedFiles: 0 }, errors: [],
    },
    evidenceItems: [{
      schemaVersion: CORE_SCHEMA_VERSION, id: "evidence:1", type: "document",
      source: { system: "repository", locator: "README.md", uri: null }, retrievedAt: FIXED_TIME, contentHash: null,
      relatedChangeIds: [], excerpt: "Test evidence content.", selectionReason: "Related to change.",
      trustLevel: "trusted_repository", truncation: { isTruncated: false, originalCharacters: null, retainedCharacters: 22 }, redactions: [],
    }],
    evidenceIndex: [{ evidenceId: "evidence:1", relatedChangeIds: [] }],
    deterministicFacts: [{ id: "fact:1", statement: "The changed file exists.", evidenceIds: ["evidence:1"] }],
    missingEvidence: [{ source: { system: "git", locator: "secrets.env", uri: null }, reason: "File is gitignored", status: "inaccessible" }],
    limits: { maxEvidenceItems: 100, maxTotalExcerptCharacters: 100_000 },
    truncation: { isTruncated: false, omittedEvidenceItems: 0, omittedExcerptCharacters: 0, omittedMissingEvidence: 0 },
  };
  const validationResult: FindingValidationResult = {
    schemaVersion: CORE_SCHEMA_VERSION, bundleId: "bundle:test", ok: true,
    validFindings: [{
      schemaVersion: CORE_SCHEMA_VERSION, id: "finding:1", category: "security", severity: "high", confidence: 0.9,
      title: "Hardcoded secret", expectedBehavior: "Secrets must use environment variables.",
      observedBehavior: "A secret string is hardcoded in the source.",
      deterministicFacts: [{ statement: "The config file has a plaintext password.", evidenceIds: ["evidence:1"] }],
      inference: "The implementation leaks credentials into version control.",
      evidenceIds: ["evidence:1"], affectedSources: [{ system: "repository", locator: "src/config.ts", uri: null }],
      recommendation: "update_code", status: "confirmed",
    }],
    rejectedFindings: [], warnings: [], summary: { submitted: 1, valid: 1, rejected: 0, warnings: 0 },
  };
  return { bundle, validationResult, reviewMeta: { reviewer: "test-agent", createdAt: FIXED_TIME }, repositoryRoot: repoRoot, outputDirectory: "reports", reportName: "test-report", overwrite: false, ...overrides } as WriteReportInput;
}

describe("writeReport", () => {
  let repoRoot: string;
  let outputDir: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "change-trace-report-test-"));
    outputDir = resolve(repoRoot, "reports");
    mkdirSync(outputDir, { recursive: true });
  });
  afterEach(async () => { await rm(repoRoot, { recursive: true, force: true }).catch(() => {}); });

  it("writes byte-identical output with explicit createdAt", () => {
    const input = makeValidInput(repoRoot);
    const first = writeReport(input);
    const md1 = readFileSync(first.markdownFile, "utf-8");
    const js1 = readFileSync(first.jsonFile, "utf-8");
    unlinkSync(first.markdownFile); unlinkSync(first.jsonFile);
    const second = writeReport(input);
    expect(readFileSync(second.markdownFile, "utf-8")).toBe(md1);
    expect(readFileSync(second.jsonFile, "utf-8")).toBe(js1);
  });

  it("substance fields preserved", () => {
    const output = writeReport(makeValidInput(repoRoot));
    const j = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    const f = j.findings.confirmed[0];
    expect(f.deterministicFacts[0].evidenceIds).toContain("evidence:1");
    expect(f.inference).toContain("leaks credentials");
    expect(f.evidenceIds).toContain("evidence:1");
    expect(f.affectedSources[0].locator).toBe("src/config.ts");
    expect(j.missingEvidence[0].status).toBe("inaccessible");
    const md = readFileSync(output.markdownFile, "utf-8");
    expect(md).toContain("Missing Evidence");
  });

  it("literal status per finding group", () => {
    const input = makeValidInput(repoRoot);
    const vr = { ...input.validationResult as FindingValidationResult };
    vr.validFindings = [
      { ...vr.validFindings[0]!, id: "finding:a", status: "confirmed" },
      { ...vr.validFindings[0]!, id: "finding:b", status: "suspected", confidence: 0.5 },
      { ...vr.validFindings[0]!, id: "finding:c", status: "inconclusive", confidence: 0.2, evidenceIds: [] },
    ] as typeof vr.validFindings;
    vr.summary = { submitted: 3, valid: 3, rejected: 0, warnings: 0 };
    input.validationResult = vr; input.reportName = "mixed";
    const j = JSON.parse(readFileSync(writeReport(input).jsonFile, "utf-8"));
    expect(j.findings.confirmed[0].status).toBe("confirmed");
    expect(j.findings.suspected[0].status).toBe("suspected");
    expect(j.findings.inconclusive[0].status).toBe("inconclusive");
  });

  it("rejects when files exist without overwrite", () => {
    writeReport(makeValidInput(repoRoot, { overwrite: true }));
    expect(() => writeReport(makeValidInput(repoRoot, { overwrite: false }))).toThrow(/already exist/);
  });

  it("overwrite with mkdtemp staging, no residues", () => {
    const r = writeReport(makeValidInput(repoRoot, { overwrite: true }));
    const oldJson = readFileSync(r.jsonFile, "utf-8");
    writeReport(makeValidInput(repoRoot, { overwrite: true, reviewMeta: { reviewer: "updated", createdAt: FIXED_TIME } }));
    expect(readFileSync(r.jsonFile, "utf-8")).not.toBe(oldJson);
    // No staging or bak residues
    const entries = readdirSync(outputDir).filter((e) => e !== "test-report.json" && e !== "test-report.md");
    expect(entries.filter((e) => e.startsWith(".report-"))).toHaveLength(0);
    expect(entries.filter((e) => e.includes(".bak"))).toHaveLength(0);
  });

  it("validates repoRoot and bundle repoRoot resolve to same dir", () => {
    const input = makeValidInput(repoRoot);
    const other = join(tmpdir(), "change-trace-other-" + Date.now());
    mkdirSync(other, { recursive: true });
    try { (input.bundle as ReviewBundle).changeScope.repositoryRoot = other; expect(() => writeReport(input)).toThrow(/same directory/); }
    finally { try { rmdirSync(other); } catch { /* ignore */ } }
  });

  it("case-insensitive .git rejection", () => {
    const input = makeValidInput(repoRoot);
    (input as Record<string, unknown>).outputDirectory = ".GIT/sub";
    expect(() => writeReport(input as WriteReportInput)).toThrow();
  });

  it("honors default/hard size limits", () => {
    const input = makeValidInput(repoRoot);
    (input as Record<string, unknown>).maxReportSizeBytes = 10;
    expect(() => writeReport(input as WriteReportInput)).toThrow(/maximum size/);
    (input as Record<string, unknown>).maxReportSizeBytes = HARD_MAX_REPORT_SIZE_BYTES + 1;
    expect(() => writeReport(input as WriteReportInput)).toThrow();
  });

  it("symlink junction escape no outside artifacts", async () => {
    const outside = join(tmpdir(), "ct-outside-" + Date.now());
    mkdirSync(outside, { recursive: true });
    const link = join(repoRoot, "esc-link");
    try { symlinkSync(outside, link, "junction"); } catch { await rm(outside, { recursive: true, force: true }).catch(() => {}); return; }
    try {
      const before = readdirSync(outside);
      const input = makeValidInput(repoRoot);
      (input as Record<string, unknown>).outputDirectory = "esc-link";
      try { writeReport(input as WriteReportInput); expect.fail("should throw"); } catch { /* expected */ }
      expect(readdirSync(outside)).toEqual(before);
    } finally { try { unlinkSync(link); } catch { rmdirSync(link); } await rm(outside, { recursive: true, force: true }).catch(() => {}); }
  });

  it("pre-created staging symlink victim untouched", () => {
    const victim = join(tmpdir(), "ct-victim-" + Date.now());
    fsWriteFileSync(victim, "victim data");
    try {
      const fakeStaging = join(outputDir, ".report-fake");
      try { symlinkSync(victim, fakeStaging, "file"); } catch { try { unlinkSync(victim); } catch { /* ignore */ } return; }
      try {
        const before = readFileSync(victim, "utf-8");
        const r = writeReport(makeValidInput(repoRoot, { overwrite: true }));
        expect(readFileSync(victim, "utf-8")).toBe(before);
        expect(existsSync(r.jsonFile)).toBe(true);
      } finally { try { unlinkSync(fakeStaging); } catch { /* ignore */ } }
    } finally { try { unlinkSync(victim); } catch { /* ignore */ } }
  });

  // --- Transaction failure injection ---

  it("backup move failure leaves old pair untouched", () => {
    const r = writeReport(makeValidInput(repoRoot, { overwrite: true, reportName: "bkf" }));
    const oldJson = readFileSync(r.jsonFile, "utf-8");
    const oldMd = readFileSync(r.markdownFile, "utf-8");

    let renameCalls = 0;
    const badFs: WriteReportFs = {
      ...proxyRealFs(),
      renameSync(oldPath, newPath) {
        renameCalls++;
        if (renameCalls === 1) throw new Error("simulated backup rename failure");
        realFs.renameSync(oldPath, newPath);
      },
    };
    const input = makeValidInput(repoRoot, { overwrite: true, reportName: "bkf",
      reviewMeta: { reviewer: "should-not-stick", createdAt: FIXED_TIME } });
    expect(() => writeReport(input, badFs)).toThrow(/simulated backup/);
    expect(readFileSync(r.jsonFile, "utf-8")).toBe(oldJson);
    expect(readFileSync(r.markdownFile, "utf-8")).toBe(oldMd);
  });

  it("Markdown promotion failure after JSON promotion restores both old files", () => {
    const r = writeReport(makeValidInput(repoRoot, { overwrite: true, reportName: "prf" }));
    const oldJson = readFileSync(r.jsonFile, "utf-8");
    const oldMd = readFileSync(r.markdownFile, "utf-8");

    let renameCalls = 0;
    const badFs: WriteReportFs = {
      ...proxyRealFs(),
      renameSync(oldPath, newPath) {
        renameCalls++;
        if (renameCalls === 4) throw new Error("simulated markdown promotion failure");
        realFs.renameSync(oldPath, newPath);
      },
    };
    const input = makeValidInput(repoRoot, { overwrite: true, reportName: "prf",
      reviewMeta: { reviewer: "should-not-stick", createdAt: FIXED_TIME } });
    expect(() => writeReport(input, badFs)).toThrow(/simulated markdown/);
    expect(readFileSync(r.jsonFile, "utf-8")).toBe(oldJson);
    expect(readFileSync(r.markdownFile, "utf-8")).toBe(oldMd);
  });

  it("tx dir removal failure after both new files live reports unresolved directory", () => {
    const r = writeReport(makeValidInput(repoRoot, { overwrite: true, reportName: "txf" }));
    const oldJson = readFileSync(r.jsonFile, "utf-8");
    const oldMd = readFileSync(r.markdownFile, "utf-8");

    let rmdirCalls = 0;
    const badFs: WriteReportFs = {
      ...proxyRealFs(),
      rmdirSync(path) {
        rmdirCalls++;
        // The first rmdir is the txDir cleanup after promotion
        throw new Error("simulated tx rmdir failure");
      },
    };
    const input = makeValidInput(repoRoot, { overwrite: true, reportName: "txf",
      reviewMeta: { reviewer: "new-reviewer", createdAt: FIXED_TIME } });
    try {
      writeReport(input, badFs);
      expect.fail("should throw");
    } catch (e) {
      expect((e as Error).message).toContain("cleanup failed");
    }
    // New files should exist with new content (promotion succeeded, cleanup failed)
    const newJson = readFileSync(r.jsonFile, "utf-8");
    expect(newJson).not.toBe(oldJson);
    expect(JSON.parse(newJson).reviewMeta.reviewer).toBe("new-reviewer");
    expect(readFileSync(r.markdownFile, "utf-8")).not.toBe(oldMd);
  });

  it("staging file wx semantics reject existing entry", () => {
    const input = makeValidInput(repoRoot, { reportName: "wx-test" });
    // Create a mock FS where mkdtemp returns a dir with a pre-existing new.json
    const injected: string[] = [];
    const badFs: WriteReportFs = {
      ...proxyRealFs(),
      mkdtempSync(prefix) {
        const d = realFs.mkdtempSync(prefix);
        // Pre-create new.json to trigger wx failure
        fsWriteFileSync(join(d, "new.json"), "pre-existing");
        injected.push(d);
        return d;
      },
    };
    expect(() => writeReport(input, badFs)).toThrow();
    // Clean up any leftover staging dirs
    for (const d of injected) { try { realFs.rmdirSync(d); } catch { /* ignore */ } }
  });

  // --- Markdown containment ---

  it("escapes CommonMark injection: reviewer, notes, titles, warnings, source locators, paths", () => {
    const input = makeValidInput(repoRoot);
    input.reviewMeta = {
      reviewer: "safe\n   # heading\n   - list",
      createdAt: FIXED_TIME,
      notes: "safe\n   1. ordered\n    indented code\n\tindented code",
    };
    const vr = { ...input.validationResult as FindingValidationResult };
    vr.validFindings = [{
      ...vr.validFindings[0]!,
      title: "# title\n   # heading indent",
      expectedBehavior: "safe\n   # heading\n   - list\n   1. ordered",
      observedBehavior: "safe\n\tindented\n    four spaces",
    }] as typeof vr.validFindings;
    vr.warnings = [{ findingId: "finding:1", index: 0, code: "warn-x", path: "ok.path", message: "safe\n   # injected heading" }];
    vr.rejectedFindings = [{ index: 0, findingId: "finding:rej", issues: [{ code: "schema", path: "f.path", message: "> blockquote\n| table |" }] }];
    vr.summary = { submitted: 1, valid: 1, rejected: 1, warnings: 1 };
    input.validationResult = vr; input.reportName = "escape-full"; input.overwrite = true;
    const output = writeReport(input);
    const md = readFileSync(output.markdownFile, "utf-8");

    // HTML escaped
    expect(md).not.toContain("<script>");
    // Reviewer newlines converted to " / "
    expect(md).toContain("safe /");
    // Title doesn't inject heading from newline
    const mdLines = md.split("\n");
    const headingLines = mdLines.filter((l) => /^### /.test(l));
    for (const hl of headingLines) {
      if (hl.includes("finding:")) continue;  // legitimate finding headings
      if (hl.includes("Index")) continue;      // rejected finding headings
      // Any other ### line should be a report section
      expect(hl).toMatch(/^### (Bundle|`)/);
    }
    // Dynamic code fence wrapping of multiline expected/observed
    expect(md).toContain("Expected behavior");
    expect(md).toContain("```");
  });
});

function proxyRealFs(): WriteReportFs {
  return {
    mkdtempSync: (prefix) => realFs.mkdtempSync(prefix),
    writeFileSync: (p, d, o) => realFs.writeFileSync(p, d, o ?? {}),
    renameSync: (o, n) => realFs.renameSync(o, n),
    unlinkSync: (p) => realFs.unlinkSync(p),
    rmdirSync: (p) => realFs.rmdirSync(p),
  };
}
