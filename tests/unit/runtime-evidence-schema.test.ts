import { describe, expect, it } from "vitest";

import {
  CORE_SCHEMA_VERSION,
  MAX_EVIDENCE_EXCERPT_CHARACTERS,
  evidenceItemSchema,
  exportCoreJsonSchemas,
  externalEvidenceCollectionSchema,
  runtimeAvailableBehavioralRecordSchema,
  runtimeAvailableEnvironmentRecordSchema,
  runtimeEvidenceCollectionSchema,
  runtimeEvidenceManifestSchema,
  runtimeProvenanceSchema,
  runtimeUnavailableRecordSchema,
  type EvidenceItem,
  type RuntimeEvidenceManifest,
} from "../../src/schemas/index.js";

const hash = `sha256:${"a".repeat(64)}`;
const timestamp = "2026-07-26T12:00:00Z";

const producer = {
  id: "producer:playwright",
  name: "Playwright manifest converter",
  version: "1.2.3",
};

const source = {
  system: "ci",
  locator: "artifacts/runtime.json",
  uri: "https://ci.example.test/artifacts/runtime.json",
};

const environment = {
  kind: "staging" as const,
  name: "review-app-42",
  source: {
    system: "deployment",
    locator: "review-app-42",
    uri: "https://staging.example.test",
  },
};

const truncation = {
  isTruncated: false,
  originalCharacters: 14,
  retainedCharacters: 14,
};

const behavioralRecord = {
  recordId: "record:test-case:1",
  kind: "test_case" as const,
  source,
  environment,
  relatedChangeIds: ["file:src/api.ts"],
  relatedEvidenceIds: ["evidence:requirement:api"],
  accessStatus: "available" as const,
  outcome: "failed" as const,
  startedAt: "2026-07-26T12:00:00Z",
  completedAt: "2026-07-26T12:00:02Z",
  durationMilliseconds: 2_000,
  summary: "failed summary",
  artifactReferences: [
    {
      system: "ci",
      locator: "artifacts/trace.zip",
      uri: "https://ci.example.test/artifacts/trace.zip",
    },
  ],
  truncation,
};

const environmentRecord = {
  recordId: "record:environment:1",
  kind: "environment_metadata" as const,
  source,
  environment,
  relatedChangeIds: [],
  relatedEvidenceIds: ["evidence:requirement:environment"],
  accessStatus: "available" as const,
  summary: "staging ready",
  artifactReferences: [],
  truncation: {
    isTruncated: false,
    originalCharacters: 13,
    retainedCharacters: 13,
  },
};

const unavailableRecord = {
  recordId: "record:missing:1",
  kind: "browser_observation" as const,
  source,
  environment,
  relatedChangeIds: [],
  relatedEvidenceIds: [],
  accessStatus: "inaccessible" as const,
  reason: "The staging artifact requires authorization.",
};

const manifest: RuntimeEvidenceManifest = {
  schemaVersion: CORE_SCHEMA_VERSION,
  producer,
  sourceFormat: "playwright_json",
  records: [behavioralRecord, environmentRecord, unavailableRecord],
};

function runtimeEvidenceItem(
  overrides: Partial<EvidenceItem> = {},
): EvidenceItem {
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    id: "evidence:runtime:test-case:1",
    type: "test_result",
    source,
    retrievedAt: timestamp,
    contentHash: hash,
    relatedChangeIds: ["file:src/api.ts"],
    excerpt: "failed summary",
    selectionReason: "Normalized from an explicit runtime manifest.",
    trustLevel: "observed_runtime",
    truncation,
    redactions: [],
    runtimeProvenance: {
      producer,
      sourceFormat: "playwright_json",
      manifestRecordId: "record:test-case:1",
      kind: "test_case",
      environment,
      outcome: "failed",
      startedAt: "2026-07-26T12:00:00Z",
      completedAt: "2026-07-26T12:00:02Z",
      durationMilliseconds: 2_000,
      artifactReferences: behavioralRecord.artifactReferences,
      relatedEvidenceIds: ["evidence:requirement:api"],
    },
    ...overrides,
  };
}

describe("runtime manifest records", () => {
  it("accepts all three strict record variants", () => {
    expect(runtimeAvailableBehavioralRecordSchema.parse(behavioralRecord)).toEqual(
      behavioralRecord,
    );
    expect(runtimeAvailableEnvironmentRecordSchema.parse(environmentRecord)).toEqual(
      environmentRecord,
    );
    expect(runtimeUnavailableRecordSchema.parse(unavailableRecord)).toEqual(
      unavailableRecord,
    );
    expect(runtimeEvidenceManifestSchema.parse(manifest)).toEqual(manifest);
  });

  it("keeps a parsed failure available and prevents an outage from masquerading as one", () => {
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse(behavioralRecord).success,
    ).toBe(true);
    expect(
      runtimeUnavailableRecordSchema.safeParse({
        ...unavailableRecord,
        accessStatus: "available",
        outcome: "failed",
      }).success,
    ).toBe(false);
    expect(
      runtimeEvidenceManifestSchema.safeParse({
        ...manifest,
        records: [
          {
            ...unavailableRecord,
            outcome: "failed",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects fields belonging to other variants", () => {
    for (const candidate of [
      { ...behavioralRecord, reason: "forbidden" },
      { ...environmentRecord, outcome: "passed" },
      { ...environmentRecord, startedAt: timestamp },
      { ...environmentRecord, durationMilliseconds: 0 },
      { ...unavailableRecord, summary: "" },
      { ...unavailableRecord, artifactReferences: [] },
      { ...unavailableRecord, truncation },
      { ...unavailableRecord, completedAt: timestamp },
    ]) {
      expect(runtimeEvidenceManifestSchema.safeParse({
        ...manifest,
        records: [candidate],
      }).success).toBe(false);
    }
  });

  it("rejects core identity, trust, provenance, execution, credential, and probe injection", () => {
    for (const [field, value] of [
      ["id", "evidence:injected"],
      ["contentHash", hash],
      ["trustLevel", "trusted_repository"],
      ["redactions", []],
      ["externalProvenance", {}],
      ["runtimeProvenance", {}],
      ["executable", "npm"],
      ["argv", ["test"]],
      ["workingDirectory", "/workspace"],
      ["environmentVariables", { TOKEN: "secret" }],
      ["credential", "secret"],
      ["command", "npm test"],
      ["browserAction", "click"],
      ["activeProbe", { url: "https://staging.example.test" }],
    ] as const) {
      expect(
        runtimeEvidenceManifestSchema.safeParse({
          ...manifest,
          records: [{ ...behavioralRecord, [field]: value }],
        }).success,
        field,
      ).toBe(false);
    }
  });

  it("enforces exact enums and rejects production", () => {
    for (const sourceFormat of [
      "junit_xml",
      "playwright_json",
      "playwright_blob",
      "api_smoke",
      "browser_mcp",
      "ci_summary",
      "generic_json",
      "other",
    ]) {
      expect(
        runtimeEvidenceManifestSchema.safeParse({ ...manifest, sourceFormat })
          .success,
      ).toBe(true);
    }
    expect(
      runtimeEvidenceManifestSchema.safeParse({
        ...manifest,
        sourceFormat: "vendor_private",
      }).success,
    ).toBe(false);
    for (const kind of ["local", "ci", "staging", "other"]) {
      expect(
        runtimeAvailableBehavioralRecordSchema.safeParse({
          ...behavioralRecord,
          environment: { ...environment, kind },
        }).success,
      ).toBe(true);
    }
    for (const outcome of [
      "passed",
      "failed",
      "skipped",
      "timed_out",
      "cancelled",
      "errored",
    ]) {
      expect(
        runtimeAvailableBehavioralRecordSchema.safeParse({
          ...behavioralRecord,
          outcome,
        }).success,
      ).toBe(true);
    }
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        outcome: "unavailable",
      }).success,
    ).toBe(false);
    expect(
      runtimeEvidenceManifestSchema.safeParse({
        ...manifest,
        records: [
          {
            ...behavioralRecord,
            environment: { ...environment, kind: "production" },
          },
        ],
      }).success,
    ).toBe(false);
    for (const accessStatus of [
      "not_found",
      "inaccessible",
      "unsupported",
      "malformed",
      "truncated",
    ]) {
      expect(
        runtimeUnavailableRecordSchema.safeParse({
          ...unavailableRecord,
          accessStatus,
        }).success,
      ).toBe(true);
    }
    expect(
      runtimeUnavailableRecordSchema.safeParse({
        ...unavailableRecord,
        accessStatus: "permission_denied",
      }).success,
    ).toBe(false);
  });

  it("enforces record and relationship uniqueness", () => {
    expect(
      runtimeEvidenceManifestSchema.safeParse({
        ...manifest,
        records: [behavioralRecord, behavioralRecord],
      }).success,
    ).toBe(false);
    for (const field of ["relatedChangeIds", "relatedEvidenceIds"] as const) {
      expect(
        runtimeAvailableBehavioralRecordSchema.safeParse({
          ...behavioralRecord,
          [field]: Array.from({ length: 1_000 }, (_, index) => `id:${index}`),
        }).success,
      ).toBe(true);
      expect(
        runtimeEvidenceManifestSchema.safeParse({
          ...manifest,
          records: [
            {
              ...behavioralRecord,
              [field]: ["same:id", "same:id"],
            },
          ],
        }).success,
      ).toBe(false);
    }
    for (const field of ["relatedChangeIds", "relatedEvidenceIds"] as const) {
      expect(
        runtimeAvailableBehavioralRecordSchema.safeParse({
          ...behavioralRecord,
          [field]: Array.from({ length: 1_001 }, (_, index) => `id:${index}`),
        }).success,
      ).toBe(false);
    }
  });

  it("enforces timestamp order, safe duration, summary, artifact, and manifest bounds", () => {
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        artifactReferences: Array.from(
          { length: 100 },
          (_, index) => ({ ...source, locator: `artifact:${index}` }),
        ),
      }).success,
    ).toBe(true);
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        startedAt: "2026-07-26T12:00:03Z",
      }).success,
    ).toBe(false);
    for (const durationMilliseconds of [
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(
        runtimeAvailableBehavioralRecordSchema.safeParse({
          ...behavioralRecord,
          durationMilliseconds,
        }).success,
      ).toBe(false);
    }
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        summary: "x".repeat(MAX_EVIDENCE_EXCERPT_CHARACTERS + 1),
      }).success,
    ).toBe(false);
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        artifactReferences: Array.from(
          { length: 101 },
          (_, index) => ({ ...source, locator: `artifact:${index}` }),
        ),
      }).success,
    ).toBe(false);
    expect(
      runtimeEvidenceManifestSchema.safeParse({
        ...manifest,
        records: Array.from({ length: 1_000 }, (_, index) => ({
          ...unavailableRecord,
          recordId: `record:${index}`,
        })),
      }).success,
    ).toBe(true);
    expect(
      runtimeEvidenceManifestSchema.safeParse({
        ...manifest,
        records: Array.from({ length: 1_001 }, (_, index) => ({
          ...unavailableRecord,
          recordId: `record:${index}`,
        })),
      }).success,
    ).toBe(false);
    expect(
      runtimeEvidenceManifestSchema.safeParse({ ...manifest, records: [] })
        .success,
    ).toBe(false);
  });

  it("enforces truncation consistency", () => {
    for (const candidate of [
      {
        isTruncated: false,
        originalCharacters: 15,
        retainedCharacters: 14,
      },
      {
        isTruncated: true,
        originalCharacters: null,
        retainedCharacters: 14,
      },
      {
        isTruncated: true,
        originalCharacters: 13,
        retainedCharacters: 14,
      },
      {
        isTruncated: false,
        originalCharacters: 14,
        retainedCharacters: 13,
      },
    ]) {
      expect(
        runtimeAvailableBehavioralRecordSchema.safeParse({
          ...behavioralRecord,
          truncation: candidate,
        }).success,
      ).toBe(false);
    }
  });

  it("enforces producer, environment, source, and nested exact-object bounds", () => {
    expect(
      runtimeEvidenceManifestSchema.safeParse({
        ...manifest,
        producer: {
          id: "p",
          name: "x".repeat(160),
          version: "x".repeat(160),
        },
      }).success,
    ).toBe(true);
    for (const candidate of [
      { ...producer, id: "invalid id" },
      { ...producer, name: "" },
      { ...producer, name: "x".repeat(161) },
      { ...producer, version: "" },
      { ...producer, version: "x".repeat(161) },
      { ...producer, unexpected: true },
    ]) {
      expect(
        runtimeEvidenceManifestSchema.safeParse({
          ...manifest,
          producer: candidate,
        }).success,
      ).toBe(false);
    }

    for (const candidate of [
      { ...environment, name: "" },
      { ...environment, name: "x".repeat(201) },
      { ...environment, unexpected: true },
      { ...environment, source: { ...environment.source, unexpected: true } },
      { ...environment, source: { ...environment.source, system: "" } },
      { ...environment, source: { ...environment.source, locator: "" } },
    ]) {
      expect(
        runtimeAvailableBehavioralRecordSchema.safeParse({
          ...behavioralRecord,
          environment: candidate,
        }).success,
      ).toBe(false);
    }
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        environment: { ...environment, name: "x".repeat(200) },
      }).success,
    ).toBe(true);
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        environment: { ...environment, name: null },
      }).success,
    ).toBe(true);
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        source: { ...source, unexpected: true },
      }).success,
    ).toBe(false);
    expect(
      runtimeUnavailableRecordSchema.safeParse({
        ...unavailableRecord,
        reason: "x".repeat(2_000),
      }).success,
    ).toBe(true);
    expect(
      runtimeUnavailableRecordSchema.safeParse({
        ...unavailableRecord,
        reason: "x".repeat(2_001),
      }).success,
    ).toBe(false);
    expect(
      runtimeEvidenceManifestSchema.safeParse({
        ...manifest,
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        artifactReferences: [{ ...source, unexpected: true }],
      }).success,
    ).toBe(false);
  });

  it("accepts injection-shaped summary content as inert text", () => {
    const summary =
      '{"command":"npm test","credential":"secret","browserAction":"click"}';
    expect(
      runtimeAvailableBehavioralRecordSchema.safeParse({
        ...behavioralRecord,
        summary,
        truncation: {
          isTruncated: false,
          originalCharacters: summary.length,
          retainedCharacters: summary.length,
        },
      }).success,
    ).toBe(true);
  });
});

describe("runtime provenance and collection", () => {
  it("adds strict optional runtime provenance without breaking generic evidence", () => {
    const itemWithUndefined = runtimeEvidenceItem({
      id: "evidence:generic",
      type: "document",
      trustLevel: "trusted_repository",
      runtimeProvenance: undefined,
    });
    const { runtimeProvenance: _omitted, ...generic } = itemWithUndefined;
    expect(evidenceItemSchema.parse(generic)).toEqual(generic);
    expect(evidenceItemSchema.parse(runtimeEvidenceItem())).toEqual(
      runtimeEvidenceItem(),
    );
    expect(
      runtimeProvenanceSchema.safeParse({
        ...runtimeEvidenceItem().runtimeProvenance,
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      evidenceItemSchema.safeParse({
        ...runtimeEvidenceItem(),
        externalProvenance: {
          adapter: { id: "adapter:1", name: "adapter", version: "1" },
          sourceType: "document",
          title: "title",
          sourceUpdatedAt: null,
        },
      }).success,
    ).toBe(false);
    expect(
      externalEvidenceCollectionSchema.safeParse({
        schemaVersion: CORE_SCHEMA_VERSION,
        adapter: { id: "adapter:1", name: "adapter", version: "1" },
        evidenceItems: [
          {
            ...runtimeEvidenceItem(),
            type: "document",
            trustLevel: "untrusted_external",
            externalProvenance: {
              adapter: { id: "adapter:1", name: "adapter", version: "1" },
              sourceType: "document",
              title: "title",
              sourceUpdatedAt: null,
            },
          },
        ],
        missingEvidence: [],
      }).success,
    ).toBe(false);
  });

  it("enforces environment-metadata null outcome and timing", () => {
    const provenance = runtimeEvidenceItem().runtimeProvenance!;
    expect(
      runtimeProvenanceSchema.safeParse({
        ...provenance,
        kind: "environment_metadata",
        outcome: null,
        startedAt: null,
        completedAt: null,
        durationMilliseconds: null,
      }).success,
    ).toBe(true);
    for (const override of [
      { outcome: "passed" },
      { startedAt: timestamp },
      { completedAt: timestamp },
      { durationMilliseconds: 0 },
    ]) {
      expect(
        runtimeProvenanceSchema.safeParse({
          ...provenance,
          kind: "environment_metadata",
          outcome: null,
          startedAt: null,
          completedAt: null,
          durationMilliseconds: null,
          ...override,
        }).success,
      ).toBe(false);
    }
    expect(
      runtimeProvenanceSchema.safeParse({
        ...provenance,
        kind: "api_observation",
        outcome: null,
      }).success,
    ).toBe(false);
  });

  it("enforces provenance relationship uniqueness, safe duration, and timestamp order", () => {
    const provenance = runtimeEvidenceItem().runtimeProvenance!;
    expect(
      runtimeProvenanceSchema.safeParse({
        ...provenance,
        relatedEvidenceIds: ["same:id", "same:id"],
      }).success,
    ).toBe(false);
    expect(
      runtimeProvenanceSchema.safeParse({
        ...provenance,
        artifactReferences: Array.from(
          { length: 101 },
          (_, index) => ({ ...source, locator: `artifact:${index}` }),
        ),
      }).success,
    ).toBe(false);
    expect(
      runtimeProvenanceSchema.safeParse({
        ...provenance,
        environment: { ...environment, unexpected: true },
      }).success,
    ).toBe(false);
    for (const durationMilliseconds of [
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(
        runtimeProvenanceSchema.safeParse({
          ...provenance,
          durationMilliseconds,
        }).success,
      ).toBe(false);
    }
    expect(
      runtimeProvenanceSchema.safeParse({
        ...provenance,
        startedAt: "2026-07-26T12:00:03Z",
      }).success,
    ).toBe(false);
    expect(
      runtimeProvenanceSchema.safeParse({
        ...provenance,
        relatedEvidenceIds: Array.from(
          { length: 1_001 },
          (_, index) => `evidence:${index}`,
        ),
      }).success,
    ).toBe(false);
  });

  it("enforces runtime identity, trust, provenance, type-kind mapping, and timing", () => {
    const item = runtimeEvidenceItem();
    expect(
      runtimeEvidenceCollectionSchema.parse({
        schemaVersion: CORE_SCHEMA_VERSION,
        producer,
        evidenceItems: [item],
        missingEvidence: [],
      }).evidenceItems,
    ).toEqual([item]);

    const invalidItems = [
      { ...item, trustLevel: "trusted_repository" },
      { ...item, type: "document" },
      { ...item, runtimeProvenance: undefined },
      {
        ...item,
        externalProvenance: {
          adapter: { id: "adapter:1", name: "adapter", version: "1" },
          sourceType: "document",
          title: "title",
          sourceUpdatedAt: null,
        },
      },
      {
        ...item,
        runtimeProvenance: {
          ...item.runtimeProvenance!,
          producer: { ...producer, version: "different" },
        },
      },
      {
        ...item,
        runtimeProvenance: {
          ...item.runtimeProvenance!,
          startedAt: "2026-07-26T12:00:03Z",
        },
      },
    ];
    for (const candidate of invalidItems) {
      expect(
        runtimeEvidenceCollectionSchema.safeParse({
          schemaVersion: CORE_SCHEMA_VERSION,
          producer,
          evidenceItems: [candidate],
          missingEvidence: [],
        }).success,
      ).toBe(false);
    }

    const mapping = [
      ["test_run", "test_result"],
      ["test_case", "test_result"],
      ["api_observation", "runtime_observation"],
      ["browser_observation", "runtime_observation"],
      ["other", "runtime_observation"],
      ["environment_metadata", "configuration"],
    ] as const;
    for (const [kind, type] of mapping) {
      const metadata = kind === "environment_metadata";
      const runtimeProvenance = {
        ...item.runtimeProvenance!,
        kind,
        outcome: metadata ? null : "passed",
        startedAt: metadata ? null : timestamp,
        completedAt: metadata ? null : timestamp,
        durationMilliseconds: metadata ? null : 0,
      };
      expect(
        runtimeEvidenceCollectionSchema.safeParse({
          schemaVersion: CORE_SCHEMA_VERSION,
          producer,
          evidenceItems: [{ ...item, type, runtimeProvenance }],
          missingEvidence: [],
        }).success,
        `${kind} -> ${type}`,
      ).toBe(true);
      expect(
        runtimeEvidenceCollectionSchema.safeParse({
          schemaVersion: CORE_SCHEMA_VERSION,
          producer,
          evidenceItems: [
            {
              ...item,
              type: type === "configuration" ? "test_result" : "configuration",
              runtimeProvenance,
            },
          ],
          missingEvidence: [],
        }).success,
      ).toBe(false);
    }
  });

  it("enforces evidence ID uniqueness and the combined collection bound", () => {
    const item = runtimeEvidenceItem();
    expect(
      runtimeEvidenceCollectionSchema.safeParse({
        schemaVersion: CORE_SCHEMA_VERSION,
        producer,
        evidenceItems: [item, item],
        missingEvidence: [],
      }).success,
    ).toBe(false);

    const missingEvidence = Array.from({ length: 1_000 }, (_, index) => ({
      source: { ...source, locator: `missing:${index}` },
      reason: "Unavailable",
      status: "inaccessible" as const,
    }));
    expect(
      runtimeEvidenceCollectionSchema.safeParse({
        schemaVersion: CORE_SCHEMA_VERSION,
        producer,
        evidenceItems: [item],
        missingEvidence,
      }).success,
    ).toBe(false);
    expect(
      runtimeEvidenceCollectionSchema.safeParse({
        schemaVersion: CORE_SCHEMA_VERSION,
        producer,
        evidenceItems: [],
        missingEvidence,
      }).success,
    ).toBe(true);
  });
});

describe("runtime JSON Schema exports", () => {
  it("exports both assigned Draft 2020-12 documents deterministically", () => {
    const first = exportCoreJsonSchemas();
    const second = exportCoreJsonSchemas();

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.runtimeEvidenceManifest).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: `urn:change-trace-mcp:schema:runtime-evidence-manifest:${CORE_SCHEMA_VERSION}`,
      title: "RuntimeEvidenceManifest",
      type: "object",
    });
    expect(first.runtimeEvidenceCollection).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: `urn:change-trace-mcp:schema:runtime-evidence-collection:${CORE_SCHEMA_VERSION}`,
      title: "RuntimeEvidenceCollection",
      type: "object",
    });
  });
});
