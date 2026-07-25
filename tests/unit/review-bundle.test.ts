import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildReviewBundle } from "../../src/evidence/bundle/build-review-bundle.js";
import { collectLocalEvidence } from "../../src/evidence/local/collect-local-evidence.js";
import { collectChangeScope } from "../../src/git/change-scope.js";
import { reviewBundleSchema } from "../../src/schemas/review-bundle.js";
import {
  CORE_SCHEMA_VERSION,
  type ExternalEvidenceCollection,
} from "../../src/schemas/index.js";
import { materializeGitFixture } from "../helpers/git-fixture.js";

const basicFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/basic-change", import.meta.url),
);
const binaryFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/binary", import.meta.url),
);
const fixedNow = () => new Date("2026-07-22T17:00:00.000Z");

async function collectFixtureInputs(fixtureDirectory = basicFixtureDirectory) {
  const fixture = await materializeGitFixture(fixtureDirectory);
  const changeScope = await collectChangeScope({
    repositoryPath: fixture.repositoryPath,
    baseRef: fixture.baseObjectId,
    headRef: fixture.headObjectId,
  });
  const localEvidence = await collectLocalEvidence(
    {
      scope: changeScope,
      documentRoots:
        fixtureDirectory === basicFixtureDirectory ? ["docs"] : ["."],
      filePatterns: ["**/*.md"],
    },
    { now: fixedNow },
  );
  return { fixture, changeScope, localEvidence };
}

function externalCollection(
  relatedChangeIds: string[],
  overrides: {
    itemId?: string;
    title?: string;
    sourceType?: "document" | "project_item" | "comment" | "linked_page" | "other";
    sourceUpdatedAt?: string | null;
    adapterId?: string;
    adapterName?: string;
    adapterVersion?: string;
    excerpt?: string;
  } = {},
): ExternalEvidenceCollection {
  const adapter = {
    id: overrides.adapterId ?? "adapter:fixture",
    name: overrides.adapterName ?? "Fixture adapter",
    version: overrides.adapterVersion ?? "1.0.0",
  };
  const excerpt = overrides.excerpt ?? "External requirement evidence.";
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    adapter,
    evidenceItems: [
      {
        schemaVersion: CORE_SCHEMA_VERSION,
        id: overrides.itemId ?? "evidence:external:fixture",
        type: "document",
        source: {
          system: "lark",
          locator: "document:fixture",
          uri: "https://example.larksuite.com/docx/fixture",
        },
        retrievedAt: "2026-07-26T10:00:00.000Z",
        contentHash: null,
        relatedChangeIds,
        excerpt,
        selectionReason: "Explicitly linked external requirement.",
        trustLevel: "untrusted_external",
        truncation: {
          isTruncated: false,
          originalCharacters: excerpt.length,
          retainedCharacters: excerpt.length,
        },
        redactions: [
          {
            kind: "secret",
            count: 1,
            note: "A fixture secret was redacted.",
          },
        ],
        externalProvenance: {
          adapter,
          sourceType: overrides.sourceType ?? "document",
          title: overrides.title ?? "External requirement",
          sourceUpdatedAt:
            overrides.sourceUpdatedAt === undefined
              ? "2026-07-25T10:00:00.000Z"
              : overrides.sourceUpdatedAt,
        },
      },
    ],
    missingEvidence: [
      {
        source: {
          system: "lark",
          locator: "document:missing",
          uri: "https://example.larksuite.com/docx/missing",
        },
        reason: "Access denied by the source system.",
        status: "inaccessible",
      },
    ],
  };
}

describe("buildReviewBundle", () => {
  it("builds a deterministic, schema-valid bundle with indexed Git facts", async () => {
    const { fixture, changeScope, localEvidence } =
      await collectFixtureInputs();

    try {
      const input = { changeScope, localEvidence };
      const first = buildReviewBundle(input, { now: fixedNow });
      const second = buildReviewBundle(input, { now: fixedNow });

      expect(reviewBundleSchema.parse(first)).toEqual(first);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first.createdAt).toBe("2026-07-22T17:00:00.000Z");
      expect(first.id).toBe(
        "bundle:a64242ade46cbe01ea1dc3044b71dd59",
      );
      expect(first.evidenceItems[0]?.type).toBe("document");
      expect(first.evidenceItems.filter(({ type }) => type === "git_diff")).toHaveLength(
        changeScope.files.length,
      );
      expect(first.evidenceItems.filter(({ type }) => type === "commit")).toHaveLength(
        changeScope.commits.length,
      );
      const evidenceIds = new Set(first.evidenceItems.map(({ id }) => id));
      expect(
        first.deterministicFacts.every(({ evidenceIds: factEvidenceIds }) =>
          factEvidenceIds.every((id) => evidenceIds.has(id)),
        ),
      ).toBe(true);
      expect(first.truncation).toEqual({
        isTruncated: false,
        omittedEvidenceItems: 0,
        omittedExcerptCharacters: 0,
        omittedMissingEvidence: 0,
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("applies bundle-level item and excerpt limits", async () => {
    const { fixture, changeScope, localEvidence } =
      await collectFixtureInputs();

    try {
      const bundle = buildReviewBundle(
        {
          changeScope,
          localEvidence,
          maxEvidenceItems: 1,
          maxTotalExcerptCharacters: 10,
        },
        { now: fixedNow },
      );

      expect(bundle.evidenceItems).toHaveLength(1);
      expect(bundle.evidenceItems[0]?.excerpt.length).toBeLessThanOrEqual(10);
      expect(bundle.evidenceItems[0]?.truncation.isTruncated).toBe(true);
      expect(bundle.truncation.isTruncated).toBe(true);
      expect(bundle.truncation.omittedEvidenceItems).toBeGreaterThan(0);
      expect(bundle.truncation.omittedExcerptCharacters).toBeGreaterThan(0);
    } finally {
      await fixture.cleanup();
    }
  });

  it("records unsupported binary patch content as missing evidence", async () => {
    const { fixture, changeScope, localEvidence } = await collectFixtureInputs(
      binaryFixtureDirectory,
    );

    try {
      const bundle = buildReviewBundle(
        { changeScope, localEvidence },
        { now: fixedNow },
      );

      expect(bundle.missingEvidence).toContainEqual({
        source: {
          system: "git",
          locator: "assets/fixture.bin",
          uri: null,
        },
        reason: "Binary patch content is not represented as text evidence.",
        status: "unsupported",
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("merges external evidence between local and additional evidence while preserving provenance and missing records", async () => {
    const { fixture, changeScope, localEvidence } =
      await collectFixtureInputs();

    try {
      const relatedChangeId = changeScope.files[0]!.id;
      const external = externalCollection([relatedChangeId]);
      const additional = {
        ...external.evidenceItems[0]!,
        id: "evidence:additional:fixture",
        externalProvenance: undefined,
      };
      const bundle = buildReviewBundle(
        {
          changeScope,
          localEvidence,
          externalEvidenceCollections: [external],
          additionalEvidenceItems: [additional],
        },
        { now: fixedNow },
      );

      expect(bundle.evidenceItems.map(({ id }) => id)).toEqual([
        ...localEvidence.evidenceItems.map(({ id }) => id),
        external.evidenceItems[0]!.id,
        additional.id,
        ...changeScope.files.map(({ path }) =>
          expect.stringMatching(/^evidence:git-diff:/u),
        ),
        ...changeScope.commits.map(({ objectId }) =>
          `evidence:commit:${objectId}`,
        ),
      ]);
      expect(bundle.evidenceItems[localEvidence.evidenceItems.length]).toEqual(
        external.evidenceItems[0],
      );
      expect(bundle.missingEvidence).toContainEqual(
        external.missingEvidence[0],
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("preserves external collection and request order for missing evidence", async () => {
    const { fixture, changeScope, localEvidence } =
      await collectFixtureInputs();

    try {
      const relatedChangeId = changeScope.files[0]!.id;
      const first = externalCollection([relatedChangeId]);
      first.evidenceItems = [];
      first.missingEvidence = [
        {
          source: { system: "lark", locator: "first", uri: null },
          reason: "First missing record.",
          status: "not_found",
        },
        {
          source: { system: "lark", locator: "second", uri: null },
          reason: "Second missing record.",
          status: "inaccessible",
        },
      ];
      const second = externalCollection([relatedChangeId], {
        adapterId: "adapter:second",
      });
      second.evidenceItems = [];
      second.missingEvidence = [
        {
          source: { system: "jira", locator: "third", uri: null },
          reason: "Third missing record.",
          status: "unsupported",
        },
      ];

      const bundle = buildReviewBundle(
        {
          changeScope,
          localEvidence,
          externalEvidenceCollections: [first, second],
        },
        { now: fixedNow },
      );
      expect(
        bundle.missingEvidence.slice(-3).map(({ source }) => source.locator),
      ).toEqual(["first", "second", "third"]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects unknown external related-change IDs and conflicting evidence IDs", async () => {
    const { fixture, changeScope, localEvidence } =
      await collectFixtureInputs();

    try {
      expect(() =>
        buildReviewBundle({
          changeScope,
          localEvidence,
          externalEvidenceCollections: [
            externalCollection(["file:unknown"]),
          ],
        }),
      ).toThrow(/unknown related change ID/iu);

      const relatedChangeId = changeScope.files[0]!.id;
      const first = externalCollection([relatedChangeId], {
        excerpt: "First content.",
      });
      const conflicting = externalCollection([relatedChangeId], {
        excerpt: "Conflicting content.",
      });
      expect(() =>
        buildReviewBundle({
          changeScope,
          localEvidence,
          externalEvidenceCollections: [first, conflicting],
        }),
      ).toThrow(/Conflicting evidence item ID/u);
    } finally {
      await fixture.cleanup();
    }
  });

  it("deduplicates identical external evidence and applies item, excerpt, missing, and collection bounds", async () => {
    const { fixture, changeScope, localEvidence } =
      await collectFixtureInputs();

    try {
      const relatedChangeId = changeScope.files[0]!.id;
      const external = externalCollection([relatedChangeId], {
        excerpt: "External evidence longer than the retained limit.",
      });
      const bundle = buildReviewBundle(
        {
          changeScope,
          localEvidence: {
            ...localEvidence,
            evidenceItems: [],
          },
          externalEvidenceCollections: [external, external],
          maxEvidenceItems: 1,
          maxTotalExcerptCharacters: 10,
        },
        { now: fixedNow },
      );

      expect(bundle.evidenceItems).toHaveLength(1);
      expect(bundle.evidenceItems[0]?.id).toBe(
        external.evidenceItems[0]?.id,
      );
      expect(bundle.evidenceItems[0]?.excerpt).toBe(
        "External e",
      );
      expect(bundle.evidenceItems[0]?.externalProvenance).toEqual(
        external.evidenceItems[0]?.externalProvenance,
      );
      expect(bundle.evidenceItems[0]).toMatchObject({
        source: external.evidenceItems[0]?.source,
        retrievedAt: external.evidenceItems[0]?.retrievedAt,
        selectionReason: external.evidenceItems[0]?.selectionReason,
        trustLevel: "untrusted_external",
        redactions: external.evidenceItems[0]?.redactions,
      });
      expect(bundle.missingEvidence.filter(
        ({ source }) => source.locator === "document:missing",
      )).toHaveLength(2);
      expect(bundle.truncation).toMatchObject({
        isTruncated: true,
        omittedExcerptCharacters: expect.any(Number),
      });

      expect(() =>
        buildReviewBundle({
          changeScope,
          localEvidence,
          externalEvidenceCollections: Array.from(
            { length: 17 },
            () => external,
          ),
        }),
      ).toThrow();
    } finally {
      await fixture.cleanup();
    }
  });

  it("keeps non-external identity stable and includes every structured external provenance field in external identity", async () => {
    const { fixture, changeScope, localEvidence } =
      await collectFixtureInputs();

    try {
      const withoutExternal = buildReviewBundle(
        { changeScope, localEvidence },
        { now: fixedNow },
      );
      const explicitEmpty = buildReviewBundle(
        {
          changeScope,
          localEvidence,
          externalEvidenceCollections: [],
        },
        { now: fixedNow },
      );
      expect(explicitEmpty).toEqual(withoutExternal);

      const relatedChangeId = changeScope.files[0]!.id;
      const baseline = externalCollection([relatedChangeId]);
      const baselineId = buildReviewBundle(
        {
          changeScope,
          localEvidence,
          externalEvidenceCollections: [baseline],
        },
        { now: fixedNow },
      ).id;
      const variations = [
        externalCollection([relatedChangeId], {
          title: "Changed title",
        }),
        externalCollection([relatedChangeId], {
          sourceUpdatedAt: null,
        }),
        externalCollection([relatedChangeId], {
          sourceType: "linked_page",
        }),
        externalCollection([relatedChangeId], {
          adapterId: "adapter:changed",
        }),
        externalCollection([relatedChangeId], {
          adapterName: "Changed adapter name",
        }),
        externalCollection([relatedChangeId], {
          adapterVersion: "2.0.0",
        }),
      ];
      for (const variation of variations) {
        expect(
          buildReviewBundle(
            {
              changeScope,
              localEvidence,
              externalEvidenceCollections: [variation],
            },
            { now: fixedNow },
          ).id,
        ).not.toBe(baselineId);
      }
    } finally {
      await fixture.cleanup();
    }
  });

  it("applies the existing missing-evidence limit to external records", async () => {
    const { fixture, changeScope, localEvidence } =
      await collectFixtureInputs();

    try {
      const template = changeScope.files[0]!;
      const files = Array.from({ length: 10_001 }, (_, index) => ({
        ...template,
        id: `file:binary-${index}`,
        path: `assets/binary-${index}.bin`,
        previousPath: null,
        isBinary: true,
        additions: null,
        deletions: null,
        diff: null,
      }));
      const boundedScope = {
        ...changeScope,
        files,
        limits: {
          ...changeScope.limits,
          maxFiles: files.length,
        },
      };
      const external = externalCollection([files[0]!.id]);
      external.evidenceItems = [];
      const bundle = buildReviewBundle(
        {
          changeScope: boundedScope,
          localEvidence: {
            ...localEvidence,
            evidenceItems: [],
          },
          externalEvidenceCollections: [external],
          maxEvidenceItems: 1,
          maxTotalExcerptCharacters: 1,
        },
        { now: fixedNow },
      );

      expect(bundle.missingEvidence).toHaveLength(10_000);
      expect(bundle.truncation).toMatchObject({
        isTruncated: true,
        omittedMissingEvidence: 2,
      });
    } finally {
      await fixture.cleanup();
    }
  });
});
