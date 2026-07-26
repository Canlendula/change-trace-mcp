import { describe, expect, it } from "vitest";

import {
  CORE_SCHEMA_VERSION,
  exportCoreJsonSchemas,
  reportSchema,
  reportEvidenceSourceSchema,
  reportMissingEvidenceSchema,
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
  evidenceSources: [
    {
      evidenceId: "evidence:1",
      type: "document",
      source: {
        system: "lark",
        locator: "document:release:block:requirements",
        uri: "https://example.larksuite.com/docx/release?block=requirements",
      },
      retrievedAt: "2026-07-24T11:59:00.000Z",
      contentHash: `sha256:${"a".repeat(64)}`,
      relatedChangeIds: ["file:src/config.ts"],
      trustLevel: "untrusted_external",
      redactions: [
        {
          kind: "secret",
          count: 1,
          note: "A fixture secret was removed.",
        },
      ],
      externalProvenance: {
        adapter: {
          id: "adapter:lark",
          name: "Lark adapter",
          version: "1.0.0",
        },
        sourceType: "document",
        title: "Release requirement",
        sourceUpdatedAt: "2026-07-24T11:00:00.000Z",
      },
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

  it("requires a strict bounded evidence-source catalog without excerpts", () => {
    const { evidenceSources: _evidenceSources, ...withoutEvidenceSources } =
      validReport;
    expect(reportSchema.safeParse(withoutEvidenceSources).success).toBe(false);

    expect(
      reportSchema.safeParse({
        ...validReport,
        evidenceSources: [
          {
            ...validReport.evidenceSources[0],
            excerpt: "External document content must not be copied.",
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      reportSchema.safeParse({
        ...validReport,
        evidenceSources: Array.from({ length: 10_001 }, (_, index) => ({
          ...validReport.evidenceSources[0],
          evidenceId: `evidence:${index}`,
        })),
      }).success,
    ).toBe(false);
  });

  it("accepts strict runtime source and missing variants while rejecting provenance bypasses", () => {
    const runtimeProvenance = {
      producer: {
        id: "producer:report-runtime",
        name: "Report runtime fixture",
        version: "1.0.0",
      },
      sourceFormat: "generic_json" as const,
      manifestRecordId: "record:test:report",
      kind: "test_case" as const,
      environment: {
        kind: "staging" as const,
        name: "review-app",
        source: {
          system: "deployment",
          locator: "review-app",
          uri: "https://staging.example.test",
        },
      },
      outcome: "passed" as const,
      startedAt: null,
      completedAt: null,
      durationMilliseconds: 25,
      artifactReferences: [],
      relatedEvidenceIds: ["evidence:requirement:report"],
    };
    const runtimeSource = {
      evidenceId: "evidence:runtime:report",
      type: "test_result" as const,
      source: {
        system: "ci",
        locator: "runs/42/runtime.json",
        uri: null,
      },
      retrievedAt: "2026-07-26T12:00:00.000Z",
      contentHash: null,
      relatedChangeIds: ["file:src/api.ts"],
      trustLevel: "observed_runtime" as const,
      redactions: [],
      runtimeProvenance,
    };
    expect(reportEvidenceSourceSchema.parse(runtimeSource)).toEqual(
      runtimeSource,
    );
    for (const invalid of [
      { ...runtimeSource, type: "document" },
      { ...runtimeSource, trustLevel: "trusted_repository" },
      {
        ...runtimeSource,
        externalProvenance: {
          adapter: {
            id: "adapter:forbidden",
            name: "Forbidden",
            version: "1.0.0",
          },
          sourceType: "document",
          title: "Forbidden",
          sourceUpdatedAt: null,
        },
      },
      {
        ...runtimeSource,
        runtimeProvenance: {
          ...runtimeProvenance,
          kind: "api_observation",
        },
      },
    ]) {
      expect(reportEvidenceSourceSchema.safeParse(invalid).success).toBe(
        false,
      );
    }

    const runtimeMissing = {
      source: runtimeSource.source,
      reason: "The observation was unavailable.",
      status: "unsupported" as const,
      runtimeUnavailableProvenance: {
        producer: runtimeProvenance.producer,
        sourceFormat: runtimeProvenance.sourceFormat,
        manifestRecordId: "record:missing:report",
        kind: "browser_observation" as const,
        environment: runtimeProvenance.environment,
        accessStatus: "malformed" as const,
        relatedChangeIds: runtimeSource.relatedChangeIds,
        relatedEvidenceIds: runtimeProvenance.relatedEvidenceIds,
      },
    };
    expect(reportMissingEvidenceSchema.parse(runtimeMissing)).toEqual(
      runtimeMissing,
    );
    expect(
      reportMissingEvidenceSchema.safeParse({
        ...runtimeMissing,
        status: "inaccessible",
      }).success,
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
    expect(schemas.report).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["evidenceSources"]),
      properties: {
        evidenceSources: {
          $ref: expect.stringMatching(/^#\/\$defs\//u),
        },
      },
    });
    const reportJsonSchema = schemas.report as unknown as {
      properties: { evidenceSources: { $ref: string } };
      $defs: Record<string, unknown>;
    };
    const definitionKey = reportJsonSchema.properties.evidenceSources.$ref
      .replace("#/$defs/", "");
    expect(reportJsonSchema.$defs[definitionKey]).toMatchObject({
      type: "array",
      maxItems: 10_000,
    });
  });

  it("produces deterministic JSON Schema exports including report", () => {
    const first = JSON.stringify(exportCoreJsonSchemas());
    const second = JSON.stringify(exportCoreJsonSchemas());
    expect(first).toBe(second);
  });
});
