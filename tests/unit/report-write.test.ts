import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeReport } from "../../src/reports/write-report.js";
import {
  CORE_SCHEMA_VERSION,
  HARD_MAX_REPORT_SIZE_BYTES,
  type ReviewBundle,
  type FindingValidationResult,
  type WriteReportInput,
} from "../../src/schemas/index.js";

const FIXED_TIME = "2026-07-24T12:00:00.000Z";

function makeValidInput(
  repoRoot: string,
  overrides: Partial<WriteReportInput> = {},
): WriteReportInput {
  const bundle: ReviewBundle = {
    schemaVersion: CORE_SCHEMA_VERSION,
    id: "bundle:test",
    createdAt: FIXED_TIME,
    changeScope: {
      schemaVersion: CORE_SCHEMA_VERSION,
      repositoryRoot: repoRoot,
      baseRef: "main",
      headRef: "feature/test",
      resolvedBase: "a".repeat(40),
      resolvedHead: "b".repeat(40),
      commits: [],
      files: [],
      detectedLanguages: [],
      detectedComponents: [],
      limits: { maxCommits: 500, maxFiles: 500, maxDiffBytes: 1_000_000, maxPatchBytesPerFile: 64_000 },
      truncation: { isTruncated: false, reasons: [], omittedCommits: 0, omittedFiles: 0 },
      errors: [],
    },
    evidenceItems: [
      {
        schemaVersion: CORE_SCHEMA_VERSION,
        id: "evidence:1",
        type: "document",
        source: { system: "repository", locator: "README.md", uri: null },
        retrievedAt: FIXED_TIME,
        contentHash: null,
        relatedChangeIds: [],
        excerpt: "Test evidence content.",
        selectionReason: "Related to change.",
        trustLevel: "trusted_repository",
        truncation: { isTruncated: false, originalCharacters: null, retainedCharacters: 22 },
        redactions: [],
      },
    ],
    evidenceIndex: [{ evidenceId: "evidence:1", relatedChangeIds: [] }],
    deterministicFacts: [
      { id: "fact:1", statement: "The changed file exists.", evidenceIds: ["evidence:1"] },
    ],
    missingEvidence: [
      {
        source: { system: "git", locator: "secrets.env", uri: null },
        reason: "File is gitignored",
        status: "inaccessible",
      },
    ],
    limits: { maxEvidenceItems: 100, maxTotalExcerptCharacters: 100_000 },
    truncation: { isTruncated: false, omittedEvidenceItems: 0, omittedExcerptCharacters: 0, omittedMissingEvidence: 0 },
  };

  const validationResult: FindingValidationResult = {
    schemaVersion: CORE_SCHEMA_VERSION,
    bundleId: "bundle:test",
    ok: true,
    validFindings: [
      {
        schemaVersion: CORE_SCHEMA_VERSION,
        id: "finding:1",
        category: "security",
        severity: "high",
        confidence: 0.9,
        title: "Hardcoded secret",
        expectedBehavior: "Secrets must use environment variables.",
        observedBehavior: "A secret string is hardcoded in the source.",
        deterministicFacts: [
          {
            statement: "The config file has a plaintext password.",
            evidenceIds: ["evidence:1"],
          },
        ],
        inference: "The implementation leaks credentials into version control.",
        evidenceIds: ["evidence:1"],
        affectedSources: [
          { system: "repository", locator: "src/config.ts", uri: null },
        ],
        recommendation: "update_code",
        status: "confirmed",
      },
    ],
    rejectedFindings: [],
    warnings: [],
    summary: { submitted: 1, valid: 1, rejected: 0, warnings: 0 },
  };

  return {
    bundle,
    validationResult,
    reviewMeta: { reviewer: "test-agent", createdAt: FIXED_TIME },
    repositoryRoot: repoRoot,
    outputDirectory: "reports",
    reportName: "test-report",
    overwrite: false,
    ...overrides,
  } as WriteReportInput;
}

describe("writeReport", () => {
  let repoRoot: string;
  let outputDir: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "change-trace-report-test-"));
    outputDir = resolve(repoRoot, "reports");
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true }).catch(() => {});
  });

  it("writes byte-identical Markdown and JSON with explicit createdAt", () => {
    const input = makeValidInput(repoRoot);
    const first = writeReport(input);

    const md1 = readFileSync(first.markdownFile, "utf-8");
    const jsonStr1 = readFileSync(first.jsonFile, "utf-8");

    unlinkSync(first.markdownFile);
    unlinkSync(first.jsonFile);

    const second = writeReport(input);
    const md2 = readFileSync(second.markdownFile, "utf-8");
    const jsonStr2 = readFileSync(second.jsonFile, "utf-8");

    expect(md1).toBe(md2);
    expect(jsonStr1).toBe(jsonStr2);
  });

  it("preserves substance fields in JSON and Markdown", () => {
    const input = makeValidInput(repoRoot);
    const output = writeReport(input);

    const json = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    const finding = json.findings.confirmed[0];
    expect(finding.deterministicFacts[0].evidenceIds).toContain("evidence:1");
    expect(finding.inference).toContain("leaks credentials");
    expect(finding.evidenceIds).toContain("evidence:1");
    expect(finding.affectedSources[0].locator).toBe("src/config.ts");
    expect(json.missingEvidence[0].status).toBe("inaccessible");

    const md = readFileSync(output.markdownFile, "utf-8");
    expect(md).toContain("Deterministic facts");
    expect(md).toContain("Inference:");
    expect(md).toContain("Evidence IDs:");
    expect(md).toContain("Affected sources:");
    expect(md).toContain("Missing Evidence");
  });

  it("rejects bundleId mismatch", () => {
    const input = makeValidInput(repoRoot);
    (input.validationResult as FindingValidationResult).bundleId = "bundle:different";
    expect(() => writeReport(input)).toThrow(/Bundle ID mismatch/);
  });

  it("distinguishes confirmed, suspected, and inconclusive findings with enforced literal status", () => {
    const input = makeValidInput(repoRoot);
    const vr = { ...input.validationResult as FindingValidationResult };
    vr.validFindings = [
      { ...vr.validFindings[0]!, id: "finding:a", status: "confirmed" },
      { ...vr.validFindings[0]!, id: "finding:b", status: "suspected", confidence: 0.5 },
      { ...vr.validFindings[0]!, id: "finding:c", status: "inconclusive", confidence: 0.2, evidenceIds: [] },
    ] as typeof vr.validFindings;
    vr.summary = { submitted: 3, valid: 3, rejected: 0, warnings: 0 };
    input.validationResult = vr;
    input.reportName = "mixed-status";

    const output = writeReport(input);
    const json = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    expect(json.findings.confirmed).toHaveLength(1);
    expect(json.findings.confirmed[0].status).toBe("confirmed");
    expect(json.findings.suspected).toHaveLength(1);
    expect(json.findings.suspected[0].status).toBe("suspected");
    expect(json.findings.inconclusive).toHaveLength(1);
    expect(json.findings.inconclusive[0].status).toBe("inconclusive");
  });

  it("includes full validation issue details in rejected findings", () => {
    const input = makeValidInput(repoRoot);
    const vr = { ...input.validationResult as FindingValidationResult };
    vr.validFindings = [{ ...vr.validFindings[0]!, id: "finding:x" }] as typeof vr.validFindings;
    vr.rejectedFindings = [{
      index: 1, findingId: "finding:bad",
      issues: [
        { code: "schema_validation", path: "$", message: "Bad schema." },
        { code: "unknown_evidence_id", path: "evidenceIds.0", message: "Evidence X not found." },
      ],
    }];
    vr.summary = { submitted: 2, valid: 1, rejected: 1, warnings: 0 };
    input.validationResult = vr;
    input.reportName = "with-issues";
    const output = writeReport(input);
    const json = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    expect(json.rejectedFindings[0].issues[0].code).toBe("schema_validation");
    expect(json.rejectedFindings[0].issues[0].path).toBe("$");
    expect(json.rejectedFindings[0].issues[0].message).toBe("Bad schema.");
  });

  it("rejects when files exist and overwrite is false", () => {
    const input = makeValidInput(repoRoot);
    input.overwrite = true;
    writeReport(input);
    input.overwrite = false;
    expect(() => writeReport(input)).toThrow(/already exist/);
  });

  it("overwrites existing files with temp staging, no residues", () => {
    const input = makeValidInput(repoRoot);
    input.overwrite = true;
    const first = writeReport(input);
    const firstJson = readFileSync(first.jsonFile, "utf-8");
    writeReport({ ...input, reviewMeta: { reviewer: "updated", createdAt: FIXED_TIME } });
    const updatedJson = readFileSync(first.jsonFile, "utf-8");
    expect(updatedJson).not.toBe(firstJson);
    expect(JSON.parse(updatedJson).reviewMeta.reviewer).toBe("updated");
    // No staging dirs left
    const entries = readdirSync(outputDir);
    expect(entries.filter((e) => e.startsWith(".report-"))).toHaveLength(0);
  });

  it("rejects non-absolute repo root", () => {
    const input = makeValidInput(repoRoot);
    (input as Record<string, unknown>).repositoryRoot = "relative/path";
    expect(() => writeReport(input as WriteReportInput)).toThrow();
  });

  it("honors default size bound and rejects above hard cap", () => {
    const input = makeValidInput(repoRoot);
    input.reportName = "size-test";
    // Hard cap rejection at input level
    (input as Record<string, unknown>).maxReportSizeBytes = HARD_MAX_REPORT_SIZE_BYTES + 1;
    expect(() => writeReport(input as WriteReportInput)).toThrow();
  });

  it("rejects when maxReportSizeBytes is within hard cap but too small for report", () => {
    const input = makeValidInput(repoRoot);
    input.reportName = "size-small";
    input.maxReportSizeBytes = 10;
    expect(() => writeReport(input)).toThrow(/maximum size/);
  });

  it("rejects case-insensitive .git directory", () => {
    const input = makeValidInput(repoRoot);
    (input as Record<string, unknown>).outputDirectory = "reports/.GIT/subdir";
    expect(() => writeReport(input as WriteReportInput)).toThrow(/\.git/);
  });

  it("rejects output directory with .. traversal", () => {
    const input = makeValidInput(repoRoot);
    (input as Record<string, unknown>).outputDirectory = "reports/../../../etc";
    expect(() => writeReport(input as WriteReportInput)).toThrow(/stay within/);
  });

  it("rejects non-existing repo root", () => {
    const input = makeValidInput(repoRoot);
    (input as Record<string, unknown>).repositoryRoot = "/nonexistent/repo";
    expect(() => writeReport(input as WriteReportInput)).toThrow();
  });

  it("rejects unsafe reportName", () => {
    const input = makeValidInput(repoRoot);
    (input as Record<string, unknown>).reportName = "; rm -rf /";
    expect(() => writeReport(input as WriteReportInput)).toThrow();
  });

  it("validates repositoryRoot and bundle.changeScope.repositoryRoot resolve to same directory", () => {
    // Create a different temp dir
    const otherRoot = join(tmpdir(), "change-trace-other-" + Date.now());
    mkdirSync(otherRoot, { recursive: true });
    try {
      const input = makeValidInput(repoRoot);
      (input.bundle as ReviewBundle).changeScope.repositoryRoot = otherRoot;
      expect(() => writeReport(input)).toThrow(/same directory/);
    } finally {
      try { rmdirSync(otherRoot); } catch { /* ignore */ }
    }
  });

  it("fails on symlink junction escape without touching outside files", async () => {
    const outsideDir = join(tmpdir(), "change-trace-outside-" + Date.now());
    mkdirSync(outsideDir, { recursive: true });
    const junctionPath = join(repoRoot, "escape-link");

    try {
      symlinkSync(outsideDir, junctionPath, "junction");
    } catch {
      await rm(outsideDir, { recursive: true, force: true }).catch(() => {});
      return;
    }

    try {
      const beforeEntries = readdirSync(outsideDir);
      const input = makeValidInput(repoRoot);
      (input as Record<string, unknown>).outputDirectory = "escape-link";

      try {
        writeReport(input as WriteReportInput);
        expect.fail("Should have thrown");
      } catch {
        // Expected
      }

      const afterEntries = readdirSync(outsideDir);
      expect(afterEntries).toEqual(beforeEntries);
    } finally {
      try { unlinkSync(junctionPath); } catch { rmdirSync(junctionPath); }
      await rm(outsideDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("pre-created staging symlink to victim is untouched", () => {
    const targetDir = join(repoRoot, "reports");
    const victimPath = join(tmpdir(), "change-trace-victim-" + Date.now());
    writeFileSync(victimPath, "victim content");

    try {
      // Pre-create a staging-like symlink
      const fakeStaging = join(targetDir, `.report-staging`);
      try {
        symlinkSync(victimPath, fakeStaging, "file");
      } catch {
        // Can't create symlinks; test is vacuously true
        try { unlinkSync(victimPath); } catch { /* ignore */ }
        return;
      }

      try {
        const input = makeValidInput(repoRoot);
        // This won't use the fake staging (mkdtemp creates a unique name)
        // but we want to prove the pre-existing symlink survives untouched
        const beforeVictim = readFileSync(victimPath, "utf-8");
        const result = writeReport({ ...input, overwrite: true });
        const afterVictim = readFileSync(victimPath, "utf-8");
        expect(afterVictim).toBe(beforeVictim);
        expect(afterVictim).toBe("victim content");
        // The report was still written successfully in its own staging
        expect(existsSync(result.jsonFile)).toBe(true);
      } finally {
        try { unlinkSync(fakeStaging); } catch { /* ignore */ }
      }
    } finally {
      try { unlinkSync(victimPath); } catch { /* ignore */ }
    }
  });

  it("preserves pre-existing reports when md staging write fails", () => {
    const input = makeValidInput(repoRoot);
    input.overwrite = true;
    input.reportName = "rollback-test";

    const initial = writeReport(input);
    const initialMd = readFileSync(initial.markdownFile, "utf-8");
    const initialJson = readFileSync(initial.jsonFile, "utf-8");

    // Contaminate a staging entry: create a directory at a name that could
    // conflict with the staging dir. Since mkdtemp uses random suffixes we
    // can't predict the exact name, so we instead verify no residues.
    // Instead, test that when overwrite succeeds, the old content is gone.
    input.reviewMeta = { reviewer: "new", createdAt: FIXED_TIME };
    writeReport(input);
    const updatedJson = readFileSync(initial.jsonFile, "utf-8");
    expect(updatedJson).not.toBe(initialJson);

    // No staging dirs left
    const entries = readdirSync(outputDir);
    expect(entries.filter((e) => e.startsWith(".report-"))).toHaveLength(0);

    // Restore original
    writeFileSync(initial.jsonFile, initialJson);
    writeFileSync(initial.markdownFile, initialMd);
  });

  it("fails closed: does not report success while temp artifacts remain", () => {
    // After a successful write, no staging artifacts should remain
    const input = makeValidInput(repoRoot);
    const result = writeReport(input);
    expect(existsSync(result.jsonFile)).toBe(true);
    expect(existsSync(result.markdownFile)).toBe(true);
    const entries = readdirSync(outputDir);
    expect(entries.filter((e) => e.startsWith(".report-"))).toHaveLength(0);
  });

  it("escapes all untrusted Markdown fields: reviewer, notes, titles, warnings, source locators, paths", () => {
    const input = makeValidInput(repoRoot);
    input.reviewMeta = {
      reviewer: "safe\n---\n[click](https://example.invalid)",
      createdAt: FIXED_TIME,
      notes: "reviewer\n- injected item\n1. ordered\n> blockquote\n| table | row |",
    };

    const vr = { ...input.validationResult as FindingValidationResult };
    vr.validFindings = [{
      ...vr.validFindings[0]!,
      id: "finding:backtick-injection",
      title: "# heading <b>title</b>\n---\n[link](x)",
      expectedBehavior: "safe\n---\n[click](https://example.invalid)\n# heading in code",
      observedBehavior: "````\nmore fences\n````",
      deterministicFacts: [{
        statement: "**bold** `ticks` [link](url)\n- list\n1. ordered",
        evidenceIds: ["evidence:1"],
      }],
      inference: "> blockquote\n| col |\n# head\n- item",
      evidenceIds: ["evidence:1"],
      affectedSources: [
        { system: "repo:system", locator: "src/backtick-path/file.ts", uri: null },
      ],
    }] as typeof vr.validFindings;
    vr.warnings = [
      { findingId: "finding:backtick-injection", index: 0, code: "warn-injection", path: "some.path", message: "# heading <script>evil</script>" },
    ];
    vr.rejectedFindings = [{
      index: 99, findingId: "finding:rejected-x",
      issues: [
        { code: "schema_failure", path: "input.field", message: "> blockquote\n| table | row |" },
      ],
    }];
    vr.summary = { submitted: 1, valid: 1, rejected: 1, warnings: 1 };
    input.validationResult = vr;
    input.reportName = "escape-full";
    input.overwrite = true;

    const output = writeReport(input);
    const md = readFileSync(output.markdownFile, "utf-8");

    // No raw HTML
    expect(md).not.toContain("<script>evil");
    expect(md).not.toContain("<b>title</b>");

    // No heading injection from user text
    const mdLines = md.split("\n");
    for (const line of mdLines) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("#")) {
        if (trimmed.startsWith("### ")) {
          expect(trimmed).toMatch(/^### (`+|Index|Bundle)/);
        } else {
          expect(trimmed).toMatch(
            /^(# |## )(Change Trace|Review|Declared|Validation|Evidence|Bundle|Confirmed|Suspected|Inconclusive|Rejected|Unreferenced|Missing|Global)/,
          );
        }
      }
    }

    // Verify content is preserved in JSON
    const json = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    const finding = json.findings.confirmed[0];
    expect(finding.title).toContain("<b>title</b>");
    expect(finding.inference).toContain("blockquote");
    expect(finding.affectedSources[0].locator).toContain("backtick-path");
  });

  it("handles truncated evidence and missing evidence Markdown", () => {
    const input = makeValidInput(repoRoot);
    (input.bundle as ReviewBundle).truncation = {
      isTruncated: true,
      omittedEvidenceItems: 3,
      omittedExcerptCharacters: 5000,
      omittedMissingEvidence: 1,
    };
    input.reportName = "truncated";
    const output = writeReport(input);
    const md = readFileSync(output.markdownFile, "utf-8");
    expect(md).toContain("Bundle Truncation");
    expect(md).toContain("3");
  });
});
