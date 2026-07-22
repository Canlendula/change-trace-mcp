import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { collectChangeScope } from "../../src/git/change-scope.js";
import { changeScopeSchema } from "../../src/schemas/change-scope.js";
import { materializeGitFixture } from "../helpers/git-fixture.js";

const basicFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/basic-change", import.meta.url),
);

describe("collectChangeScope", () => {
  it("returns a deterministic, schema-valid scope for a real repository", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);

    try {
      const input = {
        repositoryPath: fixture.repositoryPath,
        baseRef: fixture.baseObjectId,
        headRef: fixture.headObjectId,
      };
      const first = await collectChangeScope(input);
      const second = await collectChangeScope(input);

      expect(changeScopeSchema.parse(first)).toEqual(first);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first.resolvedBase).toBe(fixture.baseObjectId);
      expect(first.resolvedHead).toBe(fixture.headObjectId);
      expect(first.commits).toHaveLength(1);
      expect(first.files.map(({ path, status }) => ({ path, status }))).toEqual([
        { path: "src/greeting.ts", status: "modified" },
        { path: "tests/greeting.test.ts", status: "added" },
      ]);
      expect(first.detectedLanguages).toEqual(["TypeScript"]);
      expect(first.detectedComponents).toEqual(["src", "tests"]);
      expect(first.truncation).toEqual({
        isTruncated: false,
        reasons: [],
        omittedFiles: 0,
      });
      expect(first.errors).toEqual([]);
      expect(first.files[0]?.diff?.text).toContain(
        "export function greeting(name: string)",
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("filters repository paths before collecting patches", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);

    try {
      const scope = await collectChangeScope({
        repositoryPath: fixture.repositoryPath,
        baseRef: fixture.baseObjectId,
        headRef: fixture.headObjectId,
        include: ["src/**"],
        exclude: [],
      });

      expect(scope.files.map(({ path }) => path)).toEqual(["src/greeting.ts"]);
      expect(scope.detectedComponents).toEqual(["src"]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("records diff truncation without exceeding configured limits", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);

    try {
      const scope = await collectChangeScope({
        repositoryPath: fixture.repositoryPath,
        baseRef: fixture.baseObjectId,
        headRef: fixture.headObjectId,
        include: ["**"],
        exclude: [],
        maxFiles: 10,
        maxDiffBytes: 20,
        maxPatchBytesPerFile: 10,
      });

      expect(
        scope.files.reduce(
          (total, file) => total + (file.diff?.retainedBytes ?? 0),
          0,
        ),
      ).toBeLessThanOrEqual(20);
      expect(scope.truncation.isTruncated).toBe(true);
      expect(scope.truncation.reasons).toContain("per_file_diff_limit");
      expect(scope.truncation.reasons).toContain("total_diff_limit");
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects a nested directory instead of expanding scope to its parent", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);

    try {
      await expect(
        collectChangeScope({
          repositoryPath: join(fixture.repositoryPath, "src"),
          baseRef: fixture.baseObjectId,
          headRef: fixture.headObjectId,
        }),
      ).rejects.toThrow("repository root");
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects ref values that could be parsed as Git options", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);

    try {
      await expect(
        collectChangeScope({
          repositoryPath: fixture.repositoryPath,
          baseRef: "--all",
          headRef: fixture.headObjectId,
        }),
      ).rejects.toThrow("Git refs cannot start");
    } finally {
      await fixture.cleanup();
    }
  });
});
