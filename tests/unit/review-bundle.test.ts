import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildReviewBundle } from "../../src/evidence/bundle/build-review-bundle.js";
import { collectLocalEvidence } from "../../src/evidence/local/collect-local-evidence.js";
import { collectChangeScope } from "../../src/git/change-scope.js";
import { reviewBundleSchema } from "../../src/schemas/review-bundle.js";
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
});
