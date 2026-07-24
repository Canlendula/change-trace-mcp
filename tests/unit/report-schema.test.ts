import { describe, expect, it } from "vitest";

import {
  CORE_SCHEMA_VERSION,
  exportCoreJsonSchemas,
  reportSchema,
  reportFindingConfirmedSchema,
  reportFindingSuspectedSchema,
  reportFindingInconclusiveSchema,
  reportRejectedFindingSchema,
  reportWarningSchema,
  writeReportInputSchema,
  writeReportOutputSchema,
  DEFAULT_MAX_REPORT_SIZE_BYTES,
  HARD_MAX_REPORT_SIZE_BYTES,
  type Report,
} from "../../src/schemas/index.js";

const validReport: Report = {
  schemaVersion: CORE_SCHEMA_VERSION,
  id: "report:test-report",
  createdAt: "2026-07-24T12:00:00.000Z",
  bundleId: "bundle:example",
  reviewMeta: {
    reviewer: "test-agent",
    toolVersion: "1.0.0",
    notes: "Automated review of release v1.0",
    declaredLimitations: ["Browser evidence unavailable in CI"],
  },
  findings: {
    confirmed: [
      {
        id: "finding:a",
        category: "security",
        severity: "high",
        confidence: 0.9,
        title: "Secret in source",
        expectedBehavior: "No secrets should be committed.",
        observedBehavior: "An API key was found in the codebase.",
        deterministicFacts: [
          {
            statement: "The file src/config.ts contains a hardcoded API key.",
            evidenceIds: ["evidence:1"],
          },
        ],
        inference: "The implementation leaks credentials into version control.",
        evidenceIds: ["evidence:1", "evidence:2"],
        affectedSources: [
          {
            system: "repository",
            locator: "src/config.ts",
            uri: null,
          },
        ],
        recommendation: "update_code",
        status: "confirmed",
        warnings: [],
      },
    ],
    suspected: [
      {
        id: "finding:b",
        category: "requirement_missing",
        severity: "medium",
        confidence: 0.6,
        title: "Missing requirement coverage",
        expectedBehavior: "Feature X must be documented.",
        observedBehavior: "Feature X has no requirement entry.",
        deterministicFacts: [],
        inference: "The implementation lacks corresponding requirements.",
        evidenceIds: ["evidence:3"],
        affectedSources: [],
        recommendation: "update_documentation",
        status: "suspected",
        warnings: [
          { code: "normalized_enum", message: "Enum normalized." },
        ],
      },
    ],
    inconclusive: [
      {
        id: "finding:c",
        category: "test_gap",
        severity: "low",
        confidence: 0.3,
        title: "Possible test gap",
        expectedBehavior: "Edge case should be tested.",
        observedBehavior: "No test covers the edge case.",
        deterministicFacts: [],
        inference: "The test suite may be incomplete.",
        evidenceIds: [],
        affectedSources: [],
        recommendation: "investigate",
        status: "inconclusive",
        warnings: [
          { code: "inconclusive_without_missing_evidence", message: "No evidence." },
        ],
      },
    ],
  },
  rejectedFindings: [
    {
      index: 3,
      findingId: null,
      issues: [
        {
          code: "schema_validation",
          path: "$",
          message: "Finding must be a JSON object",
        },
      ],
    },
  ],
  missingEvidence: [
    {
      source: { system: "git", locator: "config.json", uri: null },
      reason: "File not found in working tree",
      status: "not_found",
    },
  ],
  evidenceCoverage: {
    totalEvidenceItems: 5,
    referencedEvidenceIds: ["evidence:1", "evidence:2", "evidence:3"],
    unreferencedEvidenceIds: ["evidence:4", "evidence:5"],
  },
  validationSummary: {
    submitted: 4,
    valid: 3,
    rejected: 1,
    warnings: 1,
  },
  bundleLimits: {
    maxEvidenceItems: 100,
    maxTotalExcerptCharacters: 100_000,
  },
  bundleTruncation: {
    isTruncated: false,
    omittedEvidenceItems: 0,
    omittedExcerptCharacters: 0,
    omittedMissingEvidence: 0,
  },
  warnings: [
    { code: "normalized_enum", message: "Some enums were normalized." },
  ],
};

describe("reportSchema", () => {
  it("accepts a complete valid report", () => {
    expect(reportSchema.parse(validReport)).toEqual(validReport);
  });

  it("rejects unknown keys", () => {
    expect(
      reportSchema.safeParse({ ...validReport, unexpected: true }).success,
    ).toBe(false);
  });

  it("rejects a report with mismatched schema version", () => {
    expect(
      reportSchema.safeParse({ ...validReport, schemaVersion: "0.9.0" }).success,
    ).toBe(false);
  });

  it("enforces literal status per finding group", () => {
    expect(
      reportFindingConfirmedSchema.parse({ ...validReport.findings.confirmed[0]!, status: "confirmed" }),
    ).toBeTruthy();
    expect(
      reportFindingSuspectedSchema.parse({ ...validReport.findings.suspected[0]!, status: "suspected" }),
    ).toBeTruthy();
    expect(
      reportFindingInconclusiveSchema.parse({ ...validReport.findings.inconclusive[0]!, status: "inconclusive" }),
    ).toBeTruthy();
  });

  it("rejects confirmed group with wrong status literal", () => {
    expect(
      reportFindingConfirmedSchema.safeParse({
        ...validReport.findings.confirmed[0]!,
        status: "suspected",
      }).success,
    ).toBe(false);
  });

  it("rejects suspected group with wrong status literal", () => {
    expect(
      reportFindingSuspectedSchema.safeParse({
        ...validReport.findings.suspected[0]!,
        status: "confirmed",
      }).success,
    ).toBe(false);
  });

  it("rejects empty finding arrays beyond max", () => {
    const tooMany = Array.from({ length: 1_001 }, (_, i) => ({
      ...validReport.findings.confirmed[0]!,
      id: `finding:${i}`,
      status: "confirmed" as const,
    }));
    expect(
      reportSchema.safeParse({
        ...validReport,
        findings: { ...validReport.findings, confirmed: tooMany },
      }).success,
    ).toBe(false);
  });

  it("rejects reports without bundleId", () => {
    const { bundleId, ...withoutBundleId } = validReport;
    expect(
      reportSchema.safeParse(withoutBundleId as Report).success,
    ).toBe(false);
  });
});

describe("reportRejectedFindingSchema", () => {
  it("accepts a valid rejected finding with full issue details", () => {
    expect(
      reportRejectedFindingSchema.parse(validReport.rejectedFindings[0]),
    ).toEqual(validReport.rejectedFindings[0]);
  });

  it("rejects empty issues array", () => {
    expect(
      reportRejectedFindingSchema.safeParse({
        index: 0,
        findingId: null,
        issues: [],
      }).success,
    ).toBe(false);
  });
});

describe("writeReportInputSchema", () => {
  const minimalBundle = {
    schemaVersion: CORE_SCHEMA_VERSION,
    id: "bundle:test",
    createdAt: "2026-07-24T12:00:00.000Z",
    changeScope: {
      schemaVersion: CORE_SCHEMA_VERSION,
      repositoryRoot: "/repo",
      baseRef: "main",
      headRef: "feature/x",
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
    evidenceItems: [],
    evidenceIndex: [],
    deterministicFacts: [],
    missingEvidence: [],
    limits: { maxEvidenceItems: 100, maxTotalExcerptCharacters: 100_000 },
    truncation: { isTruncated: false, omittedEvidenceItems: 0, omittedExcerptCharacters: 0, omittedMissingEvidence: 0 },
  };

  const minimalValidation = {
    schemaVersion: CORE_SCHEMA_VERSION,
    bundleId: "bundle:test",
    ok: true,
    validFindings: [],
    rejectedFindings: [],
    warnings: [],
    summary: { submitted: 0, valid: 0, rejected: 0, warnings: 0 },
  };

  it("accepts valid input with strict schemas", () => {
    const input = {
      bundle: minimalBundle,
      validationResult: minimalValidation,
      reviewMeta: { reviewer: "agent-a", createdAt: "2026-07-24T12:00:00.000Z" },
      repositoryRoot: "/repo",
      outputDirectory: "reports",
      reportName: "release-review",
      overwrite: false,
    };
    expect(writeReportInputSchema.parse(input)).toEqual(input);
  });

  it("rejects missing createdAt in reviewMeta", () => {
    expect(
      writeReportInputSchema.safeParse({
        bundle: minimalBundle,
        validationResult: minimalValidation,
        reviewMeta: { reviewer: "a" },
        repositoryRoot: "/repo",
        outputDirectory: "reports",
        reportName: "report",
      }).success,
    ).toBe(false);
  });

  it("accepts maxReportSizeBytes up to hard cap", () => {
    expect(
      writeReportInputSchema.safeParse({
        bundle: minimalBundle,
        validationResult: minimalValidation,
        reviewMeta: { reviewer: "a", createdAt: "2026-07-24T12:00:00.000Z" },
        repositoryRoot: "/repo",
        outputDirectory: "reports",
        reportName: "report",
        maxReportSizeBytes: HARD_MAX_REPORT_SIZE_BYTES,
      }).success,
    ).toBe(true);
  });

  it("rejects maxReportSizeBytes above hard cap", () => {
    expect(
      writeReportInputSchema.safeParse({
        bundle: minimalBundle,
        validationResult: minimalValidation,
        reviewMeta: { reviewer: "a", createdAt: "2026-07-24T12:00:00.000Z" },
        repositoryRoot: "/repo",
        outputDirectory: "reports",
        reportName: "report",
        maxReportSizeBytes: HARD_MAX_REPORT_SIZE_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("has separate default and hard max constants", () => {
    expect(DEFAULT_MAX_REPORT_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(HARD_MAX_REPORT_SIZE_BYTES).toBe(100 * 1024 * 1024);
    expect(DEFAULT_MAX_REPORT_SIZE_BYTES).toBeLessThan(HARD_MAX_REPORT_SIZE_BYTES);
  });
});

describe("exportCoreJsonSchemas", () => {
  it("includes report schema in core JSON Schema exports", () => {
    const schemas = exportCoreJsonSchemas();
    expect(schemas.report).toBeDefined();
    expect(schemas.report.$id).toBe(
      `urn:change-trace-mcp:schema:report:${CORE_SCHEMA_VERSION}`,
    );
  });

  it("produces deterministic JSON Schema exports including report", () => {
    const first = JSON.stringify(exportCoreJsonSchemas());
    const second = JSON.stringify(exportCoreJsonSchemas());
    expect(first).toBe(second);
  });
});
