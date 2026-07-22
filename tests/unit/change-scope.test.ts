import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { collectChangeScope } from "../../src/git/change-scope.js";
import { changeScopeSchema } from "../../src/schemas/change-scope.js";
import { materializeGitFixture } from "../helpers/git-fixture.js";

const execFileAsync = promisify(execFile);
const fixtureGitEnvironment = {
  ...process.env,
  GIT_AUTHOR_DATE: "2026-01-02T00:00:00Z",
  GIT_AUTHOR_EMAIL: "fixture@change-trace.invalid",
  GIT_AUTHOR_NAME: "Change Trace Fixture",
  GIT_COMMITTER_DATE: "2026-01-02T00:00:00Z",
  GIT_COMMITTER_EMAIL: "fixture@change-trace.invalid",
  GIT_COMMITTER_NAME: "Change Trace Fixture",
};

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
        omittedCommits: 0,
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

  it("does not execute repository-configured diff helpers", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);

    try {
      await writeFile(
        join(fixture.repositoryPath, ".git", "info", "attributes"),
        "*.ts diff=fixture\n",
      );
      await execFileAsync(
        "git",
        ["config", "diff.fixture.textconv", "change-trace-missing-textconv"],
        { cwd: fixture.repositoryPath },
      );
      await execFileAsync(
        "git",
        ["config", "diff.external", "change-trace-missing-external-diff"],
        { cwd: fixture.repositoryPath },
      );

      const scope = await collectChangeScope({
        repositoryPath: fixture.repositoryPath,
        baseRef: fixture.baseObjectId,
        headRef: fixture.headObjectId,
      });

      expect(scope.errors).toEqual([]);
      expect(scope.files[0]?.diff?.text).toContain("diff --git");
    } finally {
      await fixture.cleanup();
    }
  });

  it("bounds commit summaries and reports omitted commits", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);

    try {
      for (const [fileName, summary] of [
        ["extra-one.txt", "fixture: extra one"],
        ["extra-two.txt", "fixture: extra two"],
      ] as const) {
        await writeFile(join(fixture.repositoryPath, fileName), `${summary}\n`);
        await execFileAsync("git", ["add", "--", fileName], {
          cwd: fixture.repositoryPath,
          env: fixtureGitEnvironment,
        });
        await execFileAsync("git", ["commit", "--message", summary], {
          cwd: fixture.repositoryPath,
          env: fixtureGitEnvironment,
        });
      }
      const { stdout: headOutput } = await execFileAsync(
        "git",
        ["rev-parse", "HEAD"],
        { cwd: fixture.repositoryPath, encoding: "utf8" },
      );

      const scope = await collectChangeScope({
        repositoryPath: fixture.repositoryPath,
        baseRef: fixture.baseObjectId,
        headRef: headOutput.trim(),
        maxCommits: 1,
      });

      expect(scope.commits).toHaveLength(1);
      expect(scope.commits[0]?.summary).toBe("fixture: extra two");
      expect(scope.limits.maxCommits).toBe(1);
      expect(scope.truncation.reasons).toContain("commit_limit");
      expect(scope.truncation.omittedCommits).toBe(2);
    } finally {
      await fixture.cleanup();
    }
  });

  it("truncates patches only at complete UTF-8 code point boundaries", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);

    try {
      const fileName = "unicode.txt";
      await writeFile(
        join(fixture.repositoryPath, fileName),
        "你好，change trace。\n",
      );
      await execFileAsync("git", ["add", "--", fileName], {
        cwd: fixture.repositoryPath,
        env: fixtureGitEnvironment,
      });
      await execFileAsync(
        "git",
        ["commit", "--message", "fixture: unicode"],
        { cwd: fixture.repositoryPath, env: fixtureGitEnvironment },
      );
      const { stdout: headOutput } = await execFileAsync(
        "git",
        ["rev-parse", "HEAD"],
        { cwd: fixture.repositoryPath, encoding: "utf8" },
      );
      const input = {
        repositoryPath: fixture.repositoryPath,
        baseRef: fixture.headObjectId,
        headRef: headOutput.trim(),
      };
      const completeScope = await collectChangeScope(input);
      const completePatch = completeScope.files[0]?.diff?.text;
      expect(completePatch).toBeDefined();
      const markerOffset = Buffer.from(completePatch!).indexOf(
        Buffer.from("你"),
      );
      expect(markerOffset).toBeGreaterThan(0);

      const truncatedScope = await collectChangeScope({
        ...input,
        maxPatchBytesPerFile: markerOffset + 1,
      });
      const truncatedDiff = truncatedScope.files[0]?.diff;

      expect(truncatedDiff?.isTruncated).toBe(true);
      expect(truncatedDiff?.retainedBytes).toBe(markerOffset);
      expect(truncatedDiff?.text).not.toContain("�");
      expect(Buffer.byteLength(truncatedDiff?.text ?? "", "utf8")).toBe(
        markerOffset,
      );
    } finally {
      await fixture.cleanup();
    }
  });
});
