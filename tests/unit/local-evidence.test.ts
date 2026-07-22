import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  collectLocalEvidence,
  collectLocalEvidenceInputSchema,
} from "../../src/evidence/local/collect-local-evidence.js";
import { collectChangeScope } from "../../src/git/change-scope.js";
import { localEvidenceCollectionSchema } from "../../src/schemas/local-evidence.js";
import { materializeGitFixture } from "../helpers/git-fixture.js";

const basicFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/basic-change", import.meta.url),
);
const fixedNow = () => new Date("2026-07-22T16:00:00.000Z");

async function prepareFixture() {
  const fixture = await materializeGitFixture(basicFixtureDirectory);
  const scope = await collectChangeScope({
    repositoryPath: fixture.repositoryPath,
    baseRef: fixture.baseObjectId,
    headRef: fixture.headObjectId,
  });
  return { fixture, scope };
}

describe("collectLocalEvidence", () => {
  it("collects deterministic, schema-valid local document evidence", async () => {
    const { fixture, scope } = await prepareFixture();

    try {
      const input = {
        scope,
        documentRoots: ["docs"],
        filePatterns: ["**/*.md"],
      };
      const first = await collectLocalEvidence(input, { now: fixedNow });
      const second = await collectLocalEvidence(input, { now: fixedNow });

      expect(localEvidenceCollectionSchema.parse(first)).toEqual(first);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first.evidenceItems).toHaveLength(1);
      expect(first.evidenceItems[0]).toMatchObject({
        type: "document",
        source: {
          system: "repository",
          locator: "docs/requirements.md#L1-L3",
        },
        retrievedAt: "2026-07-22T16:00:00.000Z",
        trustLevel: "trusted_repository",
        truncation: { isTruncated: false },
        redactions: [],
      });
      expect(first.evidenceItems[0]?.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(first.evidenceItems[0]?.relatedChangeIds).toContain(
        scope.files.find(({ path }) => path === "src/greeting.ts")?.id,
      );
      expect(first.errors).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("prioritizes explicit references and redacts common credentials", async () => {
    const { fixture, scope } = await prepareFixture();

    try {
      await writeFile(
        join(fixture.repositoryPath, "docs", "secret.md"),
        "# Deployment\n\napi_key=\"super-secret-value\"\n",
      );
      const collection = await collectLocalEvidence(
        {
          scope,
          documentRoots: ["docs"],
          filePatterns: ["**/*.md"],
          explicitReferences: ["docs/secret.md"],
          maxFiles: 1,
        },
        { now: fixedNow },
      );

      expect(collection.evidenceItems).toHaveLength(1);
      expect(collection.evidenceItems[0]?.source.locator).toContain(
        "docs/secret.md",
      );
      expect(collection.evidenceItems[0]?.excerpt).toContain(
        "api_key=[REDACTED]",
      );
      expect(collection.evidenceItems[0]?.excerpt).not.toContain(
        "super-secret-value",
      );
      expect(collection.evidenceItems[0]?.redactions).toEqual([
        {
          kind: "secret",
          count: 1,
          note: "Common credential patterns were removed from the excerpt.",
        },
      ]);
      expect(collection.evidenceItems[0]?.relatedChangeIds).toEqual(
        scope.files.map(({ id }) => id),
      );
      expect(collection.truncation.reasons).toContain("file_limit");
    } finally {
      await fixture.cleanup();
    }
  });

  it("bounds file reads and excerpt characters independently", async () => {
    const { fixture, scope } = await prepareFixture();

    try {
      await writeFile(
        join(fixture.repositoryPath, "docs", "large.txt"),
        "local evidence line\n".repeat(100),
      );
      const collection = await collectLocalEvidence(
        {
          scope,
          documentRoots: ["docs"],
          filePatterns: ["**/*.txt"],
          explicitReferences: ["docs/large.txt"],
          maxFileBytes: 80,
          maxExcerptCharactersPerFile: 20,
          maxTotalExcerptCharacters: 20,
        },
        { now: fixedNow },
      );

      expect(collection.evidenceItems).toHaveLength(1);
      expect(collection.evidenceItems[0]?.contentHash).toBeNull();
      expect(collection.evidenceItems[0]?.excerpt.length).toBeLessThanOrEqual(
        20,
      );
      expect(collection.evidenceItems[0]?.truncation).toMatchObject({
        isTruncated: true,
        originalCharacters: null,
      });
      expect(collection.truncation.reasons).toContain("file_byte_limit");
      expect(collection.truncation.reasons).toContain(
        "per_file_excerpt_limit",
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("enforces the total excerpt budget across matched documents", async () => {
    const { fixture, scope } = await prepareFixture();

    try {
      await writeFile(
        join(fixture.repositoryPath, "docs", "a.md"),
        "1234567890abcdefghij",
      );
      const collection = await collectLocalEvidence(
        {
          scope,
          documentRoots: ["docs"],
          filePatterns: ["**/*.md"],
          maxExcerptCharactersPerFile: 100,
          maxTotalExcerptCharacters: 10,
        },
        { now: fixedNow },
      );

      expect(collection.evidenceItems).toHaveLength(1);
      expect(collection.evidenceItems[0]?.excerpt).toBe("1234567890");
      expect(collection.truncation.reasons).toContain("total_excerpt_limit");
      expect(collection.truncation.omittedFiles).toBe(1);
    } finally {
      await fixture.cleanup();
    }
  });

  it("skips document candidates that contain NUL bytes", async () => {
    const { fixture, scope } = await prepareFixture();

    try {
      await writeFile(
        join(fixture.repositoryPath, "docs", "binary.md"),
        Buffer.from([0x00, 0x01, 0x02]),
      );
      const collection = await collectLocalEvidence(
        {
          scope,
          documentRoots: ["docs"],
          filePatterns: ["**/*.md"],
          explicitReferences: ["docs/binary.md"],
          maxFiles: 1,
        },
        { now: fixedNow },
      );

      expect(collection.evidenceItems).toEqual([]);
      expect(collection.errors).toContainEqual({
        code: "binary_document_skipped",
        message: "Document candidate contains NUL bytes and was skipped",
        path: "docs/binary.md",
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects paths outside the repository and Git metadata", async () => {
    const { fixture, scope } = await prepareFixture();

    try {
      expect(
        collectLocalEvidenceInputSchema.safeParse({
          scope,
          documentRoots: ["../outside"],
        }).success,
      ).toBe(false);
      expect(
        collectLocalEvidenceInputSchema.safeParse({
          scope,
          documentRoots: [".git/config"],
        }).success,
      ).toBe(false);
    } finally {
      await fixture.cleanup();
    }
  });
});
