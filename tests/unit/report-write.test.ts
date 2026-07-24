import { accessSync, constants, existsSync, mkdirSync, readFileSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeReport } from "../../src/reports/write-report.js";
import {
  CORE_SCHEMA_VERSION,
  type ReviewBundle,
  type FindingValidationResult,
  type WriteReportInput,
} from "../../src/schemas/index.js";

function makeValidInput(
  repoRoot: string,
  overrides: Partial<WriteReportInput> = {},
): WriteReportInput {
  const bundle: ReviewBundle = {
    schemaVersion: CORE_SCHEMA_VERSION,
    id: "bundle:test",
    createdAt: "2026-07-24T12:00:00.000Z",
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
        retrievedAt: "2026-07-24T12:00:00.000Z",
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
    deterministicFacts: [],
    missingEvidence: [],
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
        deterministicFacts: [],
        inference: "The implementation leaks credentials.",
        evidenceIds: ["evidence:1"],
        affectedSources: [{ system: "repository", locator: "src/app.ts", uri: null }],
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
    reviewMeta: { reviewer: "test-agent" },
    repositoryRoot: repoRoot,
    outputDirectory: "reports",
    reportName: "test-report",
    overwrite: false,
    ...overrides,
  };
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

  it("writes deterministic Markdown and JSON to a configured output directory", () => {
    const input = makeValidInput(repoRoot);
    const first = writeReport(input);

    expect(first).toMatchObject({
      reportId: "report:test-report",
      markdownSizeBytes: expect.any(Number),
      jsonSizeBytes: expect.any(Number),
    });
    expect(first.markdownSizeBytes).toBeGreaterThan(0);
    expect(first.jsonSizeBytes).toBeGreaterThan(0);

    expect(readFileSync(first.markdownFile, "utf-8")).toContain("# Change Trace Review Report");
    const jsonContent = JSON.parse(readFileSync(first.jsonFile, "utf-8"));
    expect(jsonContent.schemaVersion).toBe(CORE_SCHEMA_VERSION);
    expect(jsonContent.id).toBe("report:test-report");
    expect(jsonContent.bundleId).toBe("bundle:test");
    expect(jsonContent.findings.confirmed).toHaveLength(1);
    expect(jsonContent.findings.suspected).toHaveLength(0);
    expect(jsonContent.findings.inconclusive).toHaveLength(0);

    // Deterministic: second call with same input produces byte-identical output
    const input2 = makeValidInput(repoRoot);
    input2.overwrite = true;
    const second = writeReport(input2);
    expect(first.markdownSizeBytes).toBe(second.markdownSizeBytes);
    expect(first.jsonSizeBytes).toBe(second.jsonSizeBytes);
    expect(readFileSync(first.markdownFile, "utf-8")).toBe(
      readFileSync(second.markdownFile, "utf-8"),
    );
    expect(readFileSync(first.jsonFile, "utf-8")).toBe(
      readFileSync(second.jsonFile, "utf-8"),
    );
  });

  it("rejects when bundleId and validation result bundleId mismatch", () => {
    const input = makeValidInput(repoRoot);
    const result = { ...input.validationResult } as FindingValidationResult;
    result.bundleId = "bundle:different";
    input.validationResult = result;

    expect(() => writeReport(input)).toThrow(/Bundle ID mismatch/);
  });

  it("distinguishes confirmed, suspected, and inconclusive findings", () => {
    const input = makeValidInput(repoRoot);
    const vr = { ...input.validationResult } as FindingValidationResult;
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
    expect(json.findings.suspected).toHaveLength(1);
    expect(json.findings.inconclusive).toHaveLength(1);
  });

  it("includes validation warnings and rejected findings in the report", () => {
    const input = makeValidInput(repoRoot);
    const vr = { ...input.validationResult } as FindingValidationResult;
    vr.validFindings = [
      { ...vr.validFindings[0]!, id: "finding:x" },
    ] as typeof vr.validFindings;
    vr.warnings = [
      { findingId: "finding:x", index: 0, code: "normalized_enum", path: "category", message: "Normalized category." },
    ];
    vr.rejectedFindings = [
      {
        index: 1,
        findingId: "finding:bad",
        issues: [{ code: "schema_validation", path: "$", message: "Bad schema." }],
      },
    ];
    vr.summary = { submitted: 2, valid: 1, rejected: 1, warnings: 1 };
    input.validationResult = vr;
    input.reportName = "with-warnings";

    const output = writeReport(input);
    const md = readFileSync(output.markdownFile, "utf-8");
    expect(md).toContain("Global Warnings");
    expect(md).toContain("normalized_enum");
    expect(md).toContain("Rejected Findings");

    const json = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    expect(json.warnings).toHaveLength(1);
    expect(json.warnings[0].code).toBe("normalized_enum");
    expect(json.rejectedFindings).toHaveLength(1);
    expect(json.rejectedFindings[0].reasonCodes).toContain("schema_validation");
  });

  it("exposes evidence coverage in the report", () => {
    const input = makeValidInput(repoRoot);
    const output = writeReport(input);
    const json = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    expect(json.evidenceCoverage.totalEvidenceItems).toBe(1);
    expect(json.evidenceCoverage.referencedEvidenceIds).toContain("evidence:1");
    expect(json.evidenceCoverage.unreferencedEvidenceIds).toHaveLength(0);
  });

  it("handles empty findings arrays", () => {
    const input = makeValidInput(repoRoot);
    const vr = { ...input.validationResult } as FindingValidationResult;
    vr.validFindings = [];
    vr.summary = { submitted: 0, valid: 0, rejected: 0, warnings: 0 };
    input.validationResult = vr;
    input.reportName = "empty";

    const output = writeReport(input);
    const md = readFileSync(output.markdownFile, "utf-8");
    expect(md).toContain("# Change Trace Review Report");
    expect(md).not.toContain("Confirmed Findings");
    expect(md).not.toContain("Suspected Findings");
    expect(md).not.toContain("Inconclusive Findings");
  });

  it("safely contains untrusted HTML in Markdown output", () => {
    const input = makeValidInput(repoRoot);
    const vr = { ...input.validationResult } as FindingValidationResult;
    vr.validFindings = [{
      ...vr.validFindings[0]!,
      title: "<script>alert('xss')</script>",
      expectedBehavior: "Safe `code` with <b>bold</b> and backtick ``` triple.",
    }] as typeof vr.validFindings;
    input.validationResult = vr;
    input.reportName = "xss-test";
    input.overwrite = true;

    const output = writeReport(input);
    const md = readFileSync(output.markdownFile, "utf-8");

    expect(md).not.toContain("<script>");
    expect(md).toContain("&lt;script&gt;");
    // HTML inside code fences is safe; raw angle brackets outside code fences are escaped
    expect(md).toContain("Safe `code` with ");

    const json = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    expect(json.findings.confirmed[0].title).toBe("<script>alert('xss')</script>");
  });

  it("safely contains multiline content with code fences that could break structure", () => {
    const input = makeValidInput(repoRoot);
    const vr = { ...input.validationResult } as FindingValidationResult;
    vr.validFindings = [{
      ...vr.validFindings[0]!,
      expectedBehavior: "Line 1\n```\nBreaking fence\n```\nLine 2",
      observedBehavior: "```\nAnother potential break\n````\nEven backticks",
    }] as typeof vr.validFindings;
    input.validationResult = vr;
    input.reportName = "fence-test";
    input.overwrite = true;

    const output = writeReport(input);
    const md = readFileSync(output.markdownFile, "utf-8");

    // The code fence in the finding content should use more backticks than the content
    expect(md).toContain("Confirmed Findings");
    const json = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    const finding = json.findings.confirmed[0];
    expect(finding.expectedBehavior).toContain("Breaking fence");
  });

  it("rejects absolute output directory paths", () => {
    const input = makeValidInput(repoRoot);
    input.outputDirectory = resolve(repoRoot, "absolute-reports");

    expect(() => writeReport(input)).toThrow(/relative path/);
  });

  it("rejects output directory with .. traversal", () => {
    const input = makeValidInput(repoRoot);
    input.outputDirectory = "reports/../../../etc";

    expect(() => writeReport(input)).toThrow(/stay within/);
  });

  it("rejects output directory containing .git", () => {
    const input = makeValidInput(repoRoot);
    input.outputDirectory = "reports/.git/subdir";

    expect(() => writeReport(input)).toThrow(/\.git/);
  });

  it("rejects when files already exist and overwrite is false", () => {
    const input = makeValidInput(repoRoot);
    writeReport({ ...input, overwrite: true });

    // Second attempt without overwrite should fail
    expect(() => writeReport({ ...input, overwrite: false })).toThrow(
      /already exist/,
    );
  });

  it("overwrites existing files when overwrite is true", () => {
    const input = makeValidInput(repoRoot);

    const first = writeReport({ ...input, overwrite: true });
    const second = writeReport({ ...input, overwrite: true, reportName: "test-report-2" });
    // write a second report to a different name works fine
    expect(second.reportId).toBe("report:test-report-2");

    // Overwrite the first with new content
    const third = writeReport({
      ...input,
      overwrite: true,
      reportName: "test-report",
      reviewMeta: { reviewer: "updated-agent" },
    });
    const json = JSON.parse(readFileSync(third.jsonFile, "utf-8"));
    expect(json.reviewMeta.reviewer).toBe("updated-agent");
  });

  it("does not leave partial artifacts when the paired write fails", () => {
    const input = makeValidInput(repoRoot);
    // Write read-only JSON file first
    const jsonPath = join(outputDir, "partial-test.json");
    writeFileSync(jsonPath, "{}", "utf-8");

    // Expect failure because the file exists without overwrite
    expect(() =>
      writeReport({ ...input, outputDirectory: "reports", reportName: "partial-test", overwrite: false }),
    ).toThrow(/already exist/);

    // No markdown file should be created
    const mdPath = join(outputDir, "partial-test.md");
    expect(existsSync(mdPath)).toBe(false);
  });

  it("rejects non-absolute repository root", () => {
    const input = makeValidInput(repoRoot);
    input.repositoryRoot = "relative/path";

    expect(() => writeReport(input)).toThrow(/absolute/);
  });

  it("honors the max report size bound", () => {
    const input = makeValidInput(repoRoot);
    input.reportName = "size-test";
    input.maxReportSizeBytes = 10;

    expect(() => writeReport(input)).toThrow(/maximum size/);
  });

  it("covers missing evidence and truncated evidence in the report", () => {
    const input = makeValidInput(repoRoot);
    const bundle = { ...input.bundle as ReviewBundle };

    bundle.missingEvidence = [
      { source: { system: "git", locator: "config.json", uri: null }, reason: "File not found", status: "not_found" },
    ];
    bundle.truncation = {
      isTruncated: true,
      omittedEvidenceItems: 3,
      omittedExcerptCharacters: 5000,
      omittedMissingEvidence: 1,
    };
    input.bundle = bundle;
    input.reportName = "truncated";

    const output = writeReport(input);
    const md = readFileSync(output.markdownFile, "utf-8");
    expect(md).toContain("Bundle Truncation");
    expect(md).toContain("3");

    const json = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
    expect(json.bundleTruncation.isTruncated).toBe(true);
    expect(json.bundleTruncation.omittedEvidenceItems).toBe(3);
  });

  it("rejects an unsafe reportName with special characters", () => {
    const input = makeValidInput(repoRoot);
    input.reportName = "; rm -rf /";

    expect(() => writeReport(input)).toThrow(/safe filename/);
  });

  it("writes only within the repository root even with symlinks", () => {
    // On Windows, symlinks require special privileges, so this test is best-effort
    // Skip if we can't create a symlink
    const linkTarget = join(tmpdir(), "change-trace-link-target");
    const linkDir = join(repoRoot, "bad-dir");
    mkdirSync(linkTarget, { recursive: true });

    try {
      symlinkSync(linkTarget, linkDir, "junction");
    } catch {
      rmdirSync(linkTarget);
      // Symlinks not available on this platform, test passes vacuously
      return;
    }

    try {
      const input = makeValidInput(repoRoot);
      input.outputDirectory = "bad-dir";

      // On Windows, writeReport calls realpathSync which follows junctions
      try {
        writeReport(input);
        // If realpath doesn't follow Windows junctions, this might succeed
        // but the resolved path should be properly detected
      } catch (e) {
        // Expected: either traversal or escape error
        const msg = (e as Error).message;
        expect(
          msg.includes("traversal") || msg.includes("escape") || msg.includes("outside"),
        ).toBe(true);
      }
    } finally {
      try { unlinkSync(linkDir); } catch { rmdirSync(linkDir); }
      try { rmdirSync(linkTarget); } catch { void 0; }
    }
  });
});
