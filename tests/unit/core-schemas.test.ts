import { describe, expect, it } from "vitest";

import {
  CORE_SCHEMA_VERSION,
  changeScopeSchema,
  evidenceItemSchema,
  exportCoreJsonSchemas,
  findingSchema,
  reviewBundleSchema,
  type ChangeScope,
  type EvidenceItem,
} from "../../src/schemas/index.js";

const hash = `sha256:${"a".repeat(64)}`;

const changeScope: ChangeScope = {
  schemaVersion: CORE_SCHEMA_VERSION,
  repositoryRoot: "/workspace/example",
  baseRef: "main",
  headRef: "feature/example",
  resolvedBase: "a".repeat(40),
  resolvedHead: "b".repeat(40),
  commits: [
    {
      id: "commit:bbbbbbb",
      objectId: "b".repeat(40),
      parentObjectIds: ["a".repeat(40)],
      summary: "Add documented behavior",
      committedAt: "2026-07-22T12:00:00Z",
      redactions: [],
    },
  ],
  files: [
    {
      id: "file:src/example.ts",
      path: "src/example.ts",
      previousPath: null,
      status: "added",
      isBinary: false,
      additions: 3,
      deletions: 0,
      diff: {
        text: "+export const example = true;",
        isTruncated: false,
        originalBytes: 29,
        retainedBytes: 29,
      },
      redactions: [],
    },
  ],
  detectedLanguages: ["TypeScript"],
  detectedComponents: ["src"],
  limits: {
    maxCommits: 500,
    maxFiles: 500,
    maxDiffBytes: 1_000_000,
    maxPatchBytesPerFile: 64_000,
  },
  truncation: {
    isTruncated: false,
    reasons: [],
    omittedCommits: 0,
    omittedFiles: 0,
  },
  errors: [],
};

const evidenceItem: EvidenceItem = {
  schemaVersion: CORE_SCHEMA_VERSION,
  id: "evidence:document:requirement-1",
  type: "document",
  source: {
    system: "repository",
    locator: "docs/requirements.md#example",
    uri: "file:///workspace/example/docs/requirements.md",
  },
  retrievedAt: "2026-07-22T12:01:00Z",
  contentHash: hash,
  relatedChangeIds: ["file:src/example.ts"],
  excerpt: "The example behavior must be enabled.",
  selectionReason: "The changed symbol is named in this requirement.",
  trustLevel: "trusted_repository",
  truncation: {
    isTruncated: false,
    originalCharacters: 37,
    retainedCharacters: 37,
  },
  redactions: [],
};

describe("core schemas", () => {
  it("accepts a complete evidence item and rejects unknown fields", () => {
    expect(evidenceItemSchema.parse(evidenceItem)).toEqual(evidenceItem);
    expect(
      evidenceItemSchema.safeParse({ ...evidenceItem, unexpected: true })
        .success,
    ).toBe(false);
  });

  it("accepts a bounded change scope", () => {
    expect(changeScopeSchema.parse(changeScope)).toEqual(changeScope);
  });

  it("accepts a review bundle with explicit limits and provenance", () => {
    const bundle = {
      schemaVersion: CORE_SCHEMA_VERSION,
      id: "bundle:example",
      createdAt: "2026-07-22T12:02:00Z",
      changeScope,
      evidenceItems: [evidenceItem],
      evidenceIndex: [
        {
          evidenceId: evidenceItem.id,
          relatedChangeIds: evidenceItem.relatedChangeIds,
        },
      ],
      deterministicFacts: [
        {
          id: "fact:example-enabled",
          statement: "The requirement says the behavior must be enabled.",
          evidenceIds: [evidenceItem.id],
        },
      ],
      missingEvidence: [],
      limits: {
        maxEvidenceItems: 100,
        maxTotalExcerptCharacters: 100_000,
      },
      truncation: {
        isTruncated: false,
        omittedEvidenceItems: 0,
        omittedExcerptCharacters: 0,
        omittedMissingEvidence: 0,
      },
    };

    expect(reviewBundleSchema.parse(bundle)).toEqual(bundle);
  });

  it("bounds finding confidence and keeps facts separate from inference", () => {
    const finding = {
      schemaVersion: CORE_SCHEMA_VERSION,
      id: "finding:example",
      category: "requirement_missing",
      severity: "medium",
      confidence: 0.8,
      title: "Required behavior is missing",
      expectedBehavior: "The example behavior is enabled.",
      observedBehavior: "The changed implementation leaves it disabled.",
      deterministicFacts: [
        {
          statement: "The requirement says the behavior must be enabled.",
          evidenceIds: [evidenceItem.id],
        },
      ],
      inference: "The implementation may not satisfy the requirement.",
      evidenceIds: [evidenceItem.id],
      affectedSources: [evidenceItem.source],
      recommendation: "update_code",
      status: "suspected",
    };

    expect(findingSchema.parse(finding)).toEqual(finding);
    expect(
      findingSchema.safeParse({ ...finding, confidence: 1.1 }).success,
    ).toBe(false);
  });

  it("exports deterministic Draft 2020-12 JSON Schemas", () => {
    const first = JSON.stringify(exportCoreJsonSchemas());
    const second = JSON.stringify(exportCoreJsonSchemas());

    expect(first).toBe(second);
    expect(exportCoreJsonSchemas().evidenceItem).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: `urn:change-trace-mcp:schema:evidence-item:${CORE_SCHEMA_VERSION}`,
      title: "EvidenceItem",
      type: "object",
    });
    expect(exportCoreJsonSchemas().localEvidenceCollection.$id).toBe(
      `urn:change-trace-mcp:schema:local-evidence-collection:${CORE_SCHEMA_VERSION}`,
    );
    expect(exportCoreJsonSchemas().findingValidationResult.$id).toBe(
      `urn:change-trace-mcp:schema:finding-validation-result:${CORE_SCHEMA_VERSION}`,
    );
  });
});
