import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { validateFindings } from "../../src/findings/validate-findings.js";
import { reviewBundleSchema } from "../../src/schemas/review-bundle.js";
import {
  EXPECTED_FILES,
  EXPECTED_FIXTURE_IDS,
  canonicalStringify,
  discoverReviewFixtures,
  expectedSchema,
  loadReviewFixture,
  validateFixtureDirectory,
  type LoadedReviewFixture,
  type ReviewFixtureDescriptor,
} from "../helpers/review-fixture.js";

const reviewRoot = fileURLToPath(
  new URL("../fixtures/review", import.meta.url),
);

let fixtures: ReviewFixtureDescriptor[];
let loaded: LoadedReviewFixture[];

beforeAll(async () => {
  fixtures = await discoverReviewFixtures(reviewRoot);
  loaded = await Promise.all(fixtures.map(loadReviewFixture));
});

describe("review fixture corpus", () => {
  it("contains only expected fixture IDs with no duplicates", () => {
    const ids = fixtures.map((f) => f.fixtureId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...EXPECTED_FIXTURE_IDS].sort());
  });

  it.each(EXPECTED_FIXTURE_IDS)(
    "resolves fixture %s",
    async (fixtureId) => {
      const match = fixtures.find((f) => f.fixtureId === fixtureId);
      expect(match, `Missing fixture: ${fixtureId}`).toBeDefined();
    },
  );

  it("each fixture directory has exactly the three required files", async () => {
    for (const descriptor of fixtures) {
      expect(await validateFixtureDirectory(descriptor), descriptor.fixtureId).toEqual([]);
    }
  });

  it("rejects unexpected root files, directories, and symbolic links", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-fixture-root-"));
    try {
      await writeFile(join(root, "unexpected.json"), "{}", "utf-8");
      await mkdir(join(root, "unexpected-fixture"));
      await symlink(join(root, "unexpected.json"), join(root, "unexpected-link"));
      await expect(discoverReviewFixtures(root)).rejects.toThrow(
        /Unexpected (non-directory entry|fixture directory|symbolic link)/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects nested directories and symbolic links in a fixture directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-fixture-directory-"));
    const directory = join(root, "implemented-correctly");
    try {
      await mkdir(directory);
      for (const file of EXPECTED_FILES) {
        await writeFile(join(directory, file), "{}", "utf-8");
      }
      await mkdir(join(directory, "nested"));
      await symlink(join(directory, "bundle.json"), join(directory, "bundle-link.json"));
      const descriptor = {
        fixtureId: "implemented-correctly",
        directory,
        bundlePath: join(directory, "bundle.json"),
        referenceFindingsPath: join(directory, "reference-findings.json"),
        expectedPath: join(directory, "expected.json"),
      };
      await expect(validateFixtureDirectory(descriptor)).resolves.toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Unexpected non-file entry nested/),
          expect.stringMatching(/Unexpected symbolic link bundle-link.json/),
        ]),
      );
      await expect(loadReviewFixture(descriptor)).rejects.toThrow(
        /Invalid review fixture/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("every bundle parses through ReviewBundle schema", () => {
    for (const { descriptor, bundle } of loaded) {
      const parsed = reviewBundleSchema.parse(bundle);
      expect(parsed, descriptor.fixtureId).toBeDefined();
    }
  });

  it("every bundle has at most 8 evidence items and 4 changed files", () => {
    for (const { descriptor, bundle } of loaded) {
      expect(
        bundle.evidenceItems.length,
        `${descriptor.fixtureId} evidence items`,
      ).toBeLessThanOrEqual(8);
      expect(
        bundle.changeScope.files.length,
        `${descriptor.fixtureId} changed files`,
      ).toBeLessThanOrEqual(4);
    }
  });

  it("every bundle has at most 12000 total excerpt characters", () => {
    for (const { descriptor, bundle } of loaded) {
      const totalExcerptChars = bundle.evidenceItems.reduce(
        (sum, item) => sum + item.excerpt.length,
        0,
      );
      expect(
        totalExcerptChars,
        `${descriptor.fixtureId} total excerpt chars`,
      ).toBeLessThanOrEqual(12000);
    }
  });

  it("no individual evidence excerpt exceeds 3000 characters", () => {
    for (const { descriptor, bundle } of loaded) {
      for (const item of bundle.evidenceItems) {
        expect(
          item.excerpt.length,
          `${descriptor.fixtureId}:${item.id}`,
        ).toBeLessThanOrEqual(3000);
      }
    }
  });

  it("recomputes evidence character metadata and diff UTF-8 byte metadata", () => {
    for (const { descriptor, bundle } of loaded) {
      for (const item of bundle.evidenceItems) {
        const retainedCharacters = item.excerpt.length;
        expect(
          item.truncation.retainedCharacters,
          `${descriptor.fixtureId}:${item.id} retained characters`,
        ).toBe(retainedCharacters);
        if (item.truncation.isTruncated) {
          expect(
            item.truncation.originalCharacters,
            `${descriptor.fixtureId}:${item.id} original characters`,
          ).toBeGreaterThanOrEqual(retainedCharacters);
        } else {
          expect(
            item.truncation.originalCharacters,
            `${descriptor.fixtureId}:${item.id} original characters`,
          ).toBe(retainedCharacters);
        }
      }

      for (const file of bundle.changeScope.files) {
        if (file.diff === null) {
          continue;
        }
        const retainedBytes = Buffer.byteLength(file.diff.text, "utf8");
        expect(
          file.diff.retainedBytes,
          `${descriptor.fixtureId}:${file.id} retained bytes`,
        ).toBe(retainedBytes);
        if (file.diff.isTruncated) {
          expect(
            file.diff.originalBytes,
            `${descriptor.fixtureId}:${file.id} original bytes`,
          ).toBeGreaterThanOrEqual(retainedBytes);
        } else {
          expect(
            file.diff.originalBytes,
            `${descriptor.fixtureId}:${file.id} original bytes`,
          ).toBe(retainedBytes);
        }
      }
    }
  });

  it("all timestamps are 2026-01-01T00:00:00.000Z", () => {
    for (const { descriptor, bundle } of loaded) {
      expect(bundle.createdAt, descriptor.fixtureId).toBe(
        "2026-01-01T00:00:00.000Z",
      );
      for (const item of bundle.evidenceItems) {
        expect(item.retrievedAt, `${descriptor.fixtureId}:${item.id}`).toBe(
          "2026-01-01T00:00:00.000Z",
        );
      }
      for (const commit of bundle.changeScope.commits) {
        expect(
          commit.committedAt,
          `${descriptor.fixtureId}:commit:${commit.id}`,
        ).toBe("2026-01-01T00:00:00.000Z");
      }
    }
  });

  it("validateFindings accepts all reference findings without rejection", () => {
    for (const { descriptor, bundle, referenceFindings } of loaded) {
      if (referenceFindings.length === 0) {
        continue;
      }
      const result = validateFindings({ bundle, findings: referenceFindings });
      expect(result.ok, descriptor.fixtureId).toBe(true);
      expect(result.rejectedFindings, descriptor.fixtureId).toEqual([]);
      expect(result.summary.valid, descriptor.fixtureId).toBe(
        referenceFindings.length,
      );
    }
  });

  it("reference finding evidence IDs and affected sources are supported by the bundle", () => {
    for (const { descriptor, bundle, referenceFindings } of loaded) {
      const evidenceIds = new Set(
        bundle.evidenceItems.map((item) => item.id),
      );
      const sourceKeys = new Set([
        ...bundle.evidenceItems.map(
          (item) => `${item.source.system}|${item.source.locator}`,
        ),
        ...bundle.missingEvidence.map(
          (me) => `${me.source.system}|${me.source.locator}`,
        ),
      ]);

      for (const finding of referenceFindings) {
        for (const evidenceId of finding.evidenceIds) {
          expect(
            evidenceIds.has(evidenceId),
            `${descriptor.fixtureId}:${finding.id} references unknown evidence ${evidenceId}`,
          ).toBe(true);
        }
        for (const fact of finding.deterministicFacts) {
          for (const evidenceId of fact.evidenceIds) {
            expect(
              evidenceIds.has(evidenceId),
              `${descriptor.fixtureId}:${finding.id} fact references unknown evidence ${evidenceId}`,
            ).toBe(true);
          }
        }
        for (const source of finding.affectedSources) {
          expect(
            sourceKeys.has(`${source.system}|${source.locator}`),
            `${descriptor.fixtureId}:${finding.id} references unsupported source ${source.system}|${source.locator}`,
          ).toBe(true);
        }
      }
    }
  });

  it("keeps evidence indexes, deterministic facts, and change links internally consistent", () => {
    for (const { descriptor, bundle } of loaded) {
      const evidenceById = new Map(
        bundle.evidenceItems.map((item) => [item.id, item]),
      );
      const evidenceIndexById = new Map(
        bundle.evidenceIndex.map((item) => [item.evidenceId, item]),
      );
      const changeIds = new Set([
        ...bundle.changeScope.commits.map((commit) => commit.id),
        ...bundle.changeScope.files.map((file) => file.id),
      ]);

      expect(evidenceIndexById.size, `${descriptor.fixtureId} evidence index IDs`).toBe(
        bundle.evidenceIndex.length,
      );
      expect([...evidenceIndexById.keys()].sort()).toEqual(
        [...evidenceById.keys()].sort(),
      );

      for (const [evidenceId, evidence] of evidenceById) {
        const indexEntry = evidenceIndexById.get(evidenceId);
        expect(indexEntry, `${descriptor.fixtureId}:${evidenceId} index entry`).toBeDefined();
        expect(indexEntry?.relatedChangeIds, `${descriptor.fixtureId}:${evidenceId} change links`).toEqual(
          evidence.relatedChangeIds,
        );
        for (const relatedChangeId of evidence.relatedChangeIds) {
          expect(changeIds.has(relatedChangeId), `${descriptor.fixtureId}:${evidenceId} known change`).toBe(true);
        }
      }

      const factIds = bundle.deterministicFacts.map((fact) => fact.id);
      expect(new Set(factIds).size, `${descriptor.fixtureId} deterministic fact IDs`).toBe(
        factIds.length,
      );
      for (const fact of bundle.deterministicFacts) {
        for (const evidenceId of fact.evidenceIds) {
          expect(evidenceById.has(evidenceId), `${descriptor.fixtureId}:${fact.id} known evidence`).toBe(true);
        }
      }

      if (!bundle.truncation.isTruncated) {
        expect(bundle.truncation.omittedEvidenceItems, descriptor.fixtureId).toBe(0);
        expect(bundle.truncation.omittedExcerptCharacters, descriptor.fixtureId).toBe(0);
        expect(bundle.truncation.omittedMissingEvidence, descriptor.fixtureId).toBe(0);
      }
    }
  });

  it("expected count bounds are internally consistent and contain reference answer", () => {
    for (const { descriptor, referenceFindings, expected } of loaded) {
      expect(
        expected.minFindings,
        `${descriptor.fixtureId} minFindings <= maxFindings`,
      ).toBeLessThanOrEqual(expected.maxFindings);

      expect(
        referenceFindings.length,
        `${descriptor.fixtureId} reference within bounds`,
      ).toBeGreaterThanOrEqual(expected.minFindings);
      expect(
        referenceFindings.length,
        `${descriptor.fixtureId} reference within bounds`,
      ).toBeLessThanOrEqual(expected.maxFindings);

      if (expected.outcome === "no_findings") {
        expect(
          referenceFindings,
          `${descriptor.fixtureId} no_findings outcome`,
        ).toHaveLength(0);
      }

      if (expected.outcome === "findings") {
        expect(
          referenceFindings.length,
          `${descriptor.fixtureId} findings outcome`,
        ).toBeGreaterThan(0);
      }

      if (expected.outcome === "inconclusive") {
        expect(referenceFindings, `${descriptor.fixtureId} inconclusive outcome`).not.toHaveLength(0);
        expect(
          referenceFindings.every((finding) => finding.status === "inconclusive"),
          `${descriptor.fixtureId} inconclusive findings only`,
        ).toBe(true);
      }
    }
  });

  it("reference findings satisfy required semantic matches", () => {
    for (const { descriptor, referenceFindings, expected } of loaded) {
      for (const match of expected.requiredMatches) {
        const matched = referenceFindings.filter(
          (f) =>
            f.category === match.category &&
            f.status === match.status &&
            f.recommendation === match.recommendation &&
            (match.requiredEvidenceIds ?? []).every((evidenceId) =>
              f.evidenceIds.includes(evidenceId),
            ),
        );
        expect(
          matched.length,
          `${descriptor.fixtureId}: ${match.category}/${match.status}/${match.recommendation} min ${match.minCount}`,
        ).toBeGreaterThanOrEqual(match.minCount);

      }
    }
  });

  it("reference findings contain no forbidden categories or statuses", () => {
    for (const { descriptor, referenceFindings, expected } of loaded) {
      if (expected.forbiddenCategories) {
        for (const finding of referenceFindings) {
          for (const forbiddenCategory of expected.forbiddenCategories) {
            expect(finding.category, descriptor.fixtureId).not.toBe(
              forbiddenCategory,
            );
          }
        }
      }
      if (expected.forbiddenStatuses) {
        for (const finding of referenceFindings) {
          for (const forbiddenStatus of expected.forbiddenStatuses) {
            expect(finding.status, descriptor.fixtureId).not.toBe(
              forbiddenStatus,
            );
          }
        }
      }
    }
  });

  it("expected.json parses through expected schema", () => {
    for (const { descriptor, expected } of loaded) {
      const parsed = expectedSchema.parse(expected);
      expect(parsed.fixtureId, descriptor.fixtureId).toBe(
        descriptor.fixtureId,
      );
    }
  });

  it("expected.json is deterministic across repeated loads", async () => {
    for (const fixture of fixtures) {
      const firstRaw = await readFile(fixture.expectedPath, "utf-8");
      const secondRaw = await readFile(fixture.expectedPath, "utf-8");
      const first = JSON.parse(firstRaw);
      const second = JSON.parse(secondRaw);
      const firstStr = canonicalStringify(first);
      const secondStr = canonicalStringify(second);
      expect(firstStr, `${fixture.fixtureId} expected.json`).toBe(secondStr);
    }
  });

  it("canonical serialization is byte-stable across repeated runs", () => {
    for (const { descriptor, bundle, referenceFindings, expected } of loaded) {
      const bundleStr1 = canonicalStringify(bundle);
      const bundleStr2 = canonicalStringify(bundle);
      expect(bundleStr1, `${descriptor.fixtureId} bundle`).toBe(bundleStr2);

      const findingsStr1 = canonicalStringify(referenceFindings);
      const findingsStr2 = canonicalStringify(referenceFindings);
      expect(findingsStr1, `${descriptor.fixtureId} findings`).toBe(
        findingsStr2,
      );

      const expectedStr1 = canonicalStringify(expected);
      const expectedStr2 = canonicalStringify(expected);
      expect(expectedStr1, `${descriptor.fixtureId} expected`).toBe(
        expectedStr2,
      );
    }
  });

  it("canonical serialization uses LF line endings and ends with one newline", () => {
    for (const { descriptor, bundle, referenceFindings, expected } of loaded) {
      for (const value of [bundle, referenceFindings, expected]) {
        const serialized = canonicalStringify(value);
        expect(
          serialized,
          `${descriptor.fixtureId} ends with newline`,
        ).toMatch(/\n$/);
        expect(
          serialized,
          `${descriptor.fixtureId} no CR`,
        ).not.toContain("\r");
      }
    }
  });
});
