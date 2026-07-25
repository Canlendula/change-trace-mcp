import { describe, expect, it } from "vitest";

import {
  CORE_SCHEMA_VERSION,
  evidenceItemSchema,
  exportCoreJsonSchemas,
  externalAdapterRegistrationSchema,
  externalEvidenceCollectionSchema,
  externalProvenanceSchema,
  type EvidenceItem,
  type ExternalAdapterRegistration,
  type ExternalEvidenceCollection,
} from "../../src/schemas/index.js";

const adapter = {
  id: "adapter:fixture",
  name: "Fixture adapter",
  version: "1.0.0",
};

const registration: ExternalAdapterRegistration = {
  adapter,
  argv: ["node", "fixture-adapter.mjs", "--readonly"],
  sourceSystems: ["lark", "jira"],
  credentialEnvironmentNames: ["LARK_TOKEN", "JIRA_API_TOKEN"],
  limits: {
    timeoutMilliseconds: 10_000,
    stdoutBytes: 64_000,
    stderrBytes: 16_000,
  },
};

const externalEvidence: EvidenceItem = {
  schemaVersion: CORE_SCHEMA_VERSION,
  id: "evidence:external:fixture",
  type: "document" as const,
  source: {
    system: "lark",
    locator: "document:requirement",
    uri: "https://example.larksuite.com/docx/requirement",
  },
  retrievedAt: "2026-07-26T10:00:00.000Z",
  contentHash: `sha256:${"a".repeat(64)}`,
  relatedChangeIds: ["file:src/example.ts"],
  excerpt: "The changed behavior must follow the requirement.",
  selectionReason: "Explicit requirement for the changed component.",
  trustLevel: "untrusted_external" as const,
  truncation: {
    isTruncated: false,
    originalCharacters: 49,
    retainedCharacters: 49,
  },
  redactions: [],
  externalProvenance: {
    adapter,
    sourceType: "document" as const,
    title: "Release requirement",
    sourceUpdatedAt: "2026-07-25T10:00:00.000Z",
  },
};

const collection: ExternalEvidenceCollection = {
  schemaVersion: CORE_SCHEMA_VERSION,
  adapter,
  evidenceItems: [externalEvidence],
  missingEvidence: [
    {
      source: {
        system: "jira",
        locator: "issue:PROJ-42",
        uri: null,
      },
      reason: "The configured adapter cannot access this issue.",
      status: "inaccessible",
    },
  ],
};

describe("external evidence schemas", () => {
  it("accepts one strict bounded preconfigured adapter registration", () => {
    expect(externalAdapterRegistrationSchema.parse(registration)).toEqual(
      registration,
    );
    expect(
      externalAdapterRegistrationSchema.safeParse({
        ...registration,
        credentialValues: { LARK_TOKEN: "secret" },
      }).success,
    ).toBe(false);
    expect(
      externalAdapterRegistrationSchema.safeParse({
        ...registration,
        shell: true,
      }).success,
    ).toBe(false);
  });

  it("bounds argv, limits, allowlists, and safe unique environment names", () => {
    const invalidRegistrations = [
      { ...registration, argv: [] },
      { ...registration, argv: ["node", "\u0000"] },
      { ...registration, argv: Array.from({ length: 65 }, () => "arg") },
      { ...registration, sourceSystems: [] },
      { ...registration, sourceSystems: ["lark", "lark"] },
      {
        ...registration,
        credentialEnvironmentNames: ["LARK_TOKEN", "LARK_TOKEN"],
      },
      {
        ...registration,
        credentialEnvironmentNames: ["LARK_TOKEN=secret"],
      },
      {
        ...registration,
        credentialEnvironmentNames: ["1INVALID"],
      },
      {
        ...registration,
        limits: { ...registration.limits, timeoutMilliseconds: 0 },
      },
      {
        ...registration,
        limits: { ...registration.limits, timeoutMilliseconds: 300_001 },
      },
      {
        ...registration,
        limits: { ...registration.limits, stdoutBytes: 16_777_217 },
      },
      {
        ...registration,
        limits: { ...registration.limits, stderrBytes: 1_048_577 },
      },
    ];

    for (const invalid of invalidRegistrations) {
      expect(externalAdapterRegistrationSchema.safeParse(invalid).success).toBe(
        false,
      );
    }
  });

  it("adds strict external provenance without invalidating existing evidence", () => {
    expect(
      externalProvenanceSchema.parse(externalEvidence.externalProvenance),
    ).toEqual(externalEvidence.externalProvenance);
    expect(evidenceItemSchema.parse(externalEvidence)).toEqual(externalEvidence);

    const { externalProvenance: _externalProvenance, ...existingEvidence } =
      externalEvidence;
    expect(evidenceItemSchema.safeParse(existingEvidence).success).toBe(true);
    expect(
      externalProvenanceSchema.safeParse({
        ...externalEvidence.externalProvenance,
        trustLevel: "trusted_configured_source",
      }).success,
    ).toBe(false);
  });

  it("requires external collection trust, provenance, adapter match, and document type", () => {
    expect(externalEvidenceCollectionSchema.parse(collection)).toEqual(
      collection,
    );

    for (const changedEvidence of [
      { ...externalEvidence, trustLevel: "trusted_configured_source" },
      { ...externalEvidence, type: "other" },
      { ...externalEvidence, externalProvenance: undefined },
      {
        ...externalEvidence,
        externalProvenance: {
          ...externalEvidence.externalProvenance,
          adapter: { ...adapter, version: "2.0.0" },
        },
      },
    ]) {
      expect(
        externalEvidenceCollectionSchema.safeParse({
          ...collection,
          evidenceItems: [changedEvidence],
        }).success,
      ).toBe(false);
    }
  });

  it("enforces a combined maximum of 100 outcomes", () => {
    expect(
      externalEvidenceCollectionSchema.safeParse({
        ...collection,
        evidenceItems: Array.from({ length: 50 }, (_, index) => ({
          ...externalEvidence,
          id: `evidence:external:${index}`,
        })),
        missingEvidence: Array.from({ length: 50 }, (_, index) => ({
          ...collection.missingEvidence[0],
          source: {
            ...collection.missingEvidence[0]!.source,
            locator: `issue:${index}`,
          },
        })),
      }).success,
    ).toBe(true);

    expect(
      externalEvidenceCollectionSchema.safeParse({
        ...collection,
        evidenceItems: Array.from({ length: 51 }, (_, index) => ({
          ...externalEvidence,
          id: `evidence:external:${index}`,
        })),
        missingEvidence: Array.from({ length: 50 }, (_, index) => ({
          ...collection.missingEvidence[0],
          source: {
            ...collection.missingEvidence[0]!.source,
            locator: `issue:${index}`,
          },
        })),
      }).success,
    ).toBe(false);
  });

  it("exports a deterministic Draft 2020-12 external collection contract", () => {
    const first = exportCoreJsonSchemas();
    const second = exportCoreJsonSchemas();

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.externalEvidenceCollection).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: `urn:change-trace-mcp:schema:external-evidence-collection:${CORE_SCHEMA_VERSION}`,
      title: "ExternalEvidenceCollection",
      type: "object",
    });
    expect(first.evidenceItem.$id).toBe(
      `urn:change-trace-mcp:schema:evidence-item:${CORE_SCHEMA_VERSION}`,
    );
  });
});
