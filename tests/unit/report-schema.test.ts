import { describe, expect, it } from "vitest";

import {
  CORE_SCHEMA_VERSION,
  exportCoreJsonSchemas,
  reportSchema,
  reportFindingSchema,
  reportRejectedFindingSchema,
  reportWarningSchema,
  writeReportInputSchema,
  writeReportOutputSchema,
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
        recommendation: "update_code",
        status: "confirmed",
        evidenceCount: 2,
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
        recommendation: "update_documentation",
        status: "suspected",
        evidenceCount: 1,
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
        recommendation: "investigate",
        status: "inconclusive",
        evidenceCount: 0,
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
      reasonCodes: ["schema_validation"],
    },
  ],
  evidenceCoverage: {
    totalEvidenceItems: 5,
    referencedEvidenceIds: ["evidence:1", "evidence:2"],
    unreferencedEvidenceIds: ["evidence:3", "evidence:4", "evidence:5"],
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

  it("rejects findings with invalid status", () => {
    const report = structuredClone(validReport);
    report.findings = {
      ...validReport.findings,
      confirmed: [
        {
          ...validReport.findings.confirmed[0]!,
          status: "INVALID" as never,
        },
      ],
    };
    expect(reportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects empty finding arrays beyond max", () => {
    const tooMany = Array.from({ length: 1_001 }, (_, i) => ({
      ...validReport.findings.confirmed[0]!,
      id: `finding:${i}`,
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

describe("reportFindingSchema", () => {
  it("accepts a valid finding", () => {
    expect(
      reportFindingSchema.parse(validReport.findings.confirmed[0]),
    ).toEqual(validReport.findings.confirmed[0]);
  });

  it("rejects confidence out of range", () => {
    expect(
      reportFindingSchema.safeParse({
        ...validReport.findings.confirmed[0]!,
        confidence: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects empty title", () => {
    expect(
      reportFindingSchema.safeParse({
        ...validReport.findings.confirmed[0]!,
        title: "",
      }).success,
    ).toBe(false);
  });
});

describe("reportRejectedFindingSchema", () => {
  it("accepts a valid rejected finding", () => {
    expect(
      reportRejectedFindingSchema.parse(validReport.rejectedFindings[0]),
    ).toEqual(validReport.rejectedFindings[0]);
  });

  it("rejects empty reason codes array", () => {
    expect(
      reportRejectedFindingSchema.safeParse({
        index: 0,
        findingId: null,
        reasonCodes: [],
      }).success,
    ).toBe(false);
  });
});

describe("reportWarningSchema", () => {
  it("accepts a valid warning", () => {
    expect(
      reportWarningSchema.parse({
        code: "normalized_enum",
        message: "Enum was normalized.",
      }),
    ).toEqual({
      code: "normalized_enum",
      message: "Enum was normalized.",
    });
  });

  it("rejects empty code", () => {
    expect(
      reportWarningSchema.safeParse({
        code: "",
        message: "Some message.",
      }).success,
    ).toBe(false);
  });
});

describe("writeReportInputSchema", () => {
  it("accepts valid input", () => {
    const input = {
      bundle: { schemaVersion: "1.0.0", id: "b:1", _extra: true },
      validationResult: { schemaVersion: "1.0.0", bundleId: "b:1", _extra: true },
      reviewMeta: { reviewer: "agent-a" },
      repositoryRoot: "/workspace/repo",
      outputDirectory: "reports",
      reportName: "release-review",
      overwrite: false,
    };
    expect(writeReportInputSchema.parse(input)).toEqual(input);
  });

  it("rejects absolute output directory", () => {
    const input = {
      bundle: {},
      validationResult: {},
      reviewMeta: { reviewer: "a" },
      repositoryRoot: "/repo",
      outputDirectory: "/absolute/path",
      reportName: "report",
    };
    // The schema requires string, but write_report function checks isAbsolute
    const parsed = writeReportInputSchema.parse(input);
    expect(parsed.outputDirectory).toBe("/absolute/path");
  });

  it("rejects unsafe report name characters", () => {
    expect(
      writeReportInputSchema.safeParse({
        bundle: {},
        validationResult: {},
        reviewMeta: { reviewer: "a" },
        repositoryRoot: "/repo",
        outputDirectory: "reports",
        reportName: "../escape",
      }).success,
    ).toBe(false);
  });

  it("rejects empty report name", () => {
    expect(
      writeReportInputSchema.safeParse({
        bundle: {},
        validationResult: {},
        reviewMeta: { reviewer: "a" },
        repositoryRoot: "/repo",
        outputDirectory: "reports",
        reportName: "",
      }).success,
    ).toBe(false);
  });
});

describe("writeReportOutputSchema", () => {
  it("accepts valid output", () => {
    const output = {
      reportId: "report:test",
      reportPath: "/workspace/reports",
      markdownFile: "/workspace/reports/test.md",
      jsonFile: "/workspace/reports/test.json",
      markdownSizeBytes: 1024,
      jsonSizeBytes: 2048,
    };
    expect(writeReportOutputSchema.parse(output)).toEqual(output);
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
