import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { materializeGitFixture } from "../helpers/git-fixture.js";

const basicFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/basic-change", import.meta.url),
);

describe("Git fixtures", () => {
  it("materializes a deterministic two-commit repository", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);

    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync(
        "git",
        [
          "diff",
          "--name-status",
          fixture.baseObjectId,
          fixture.headObjectId,
        ],
        {
          cwd: fixture.repositoryPath,
          encoding: "utf8",
        },
      );

      const actualChanges = stdout
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => {
          const [status, path] = line.split("\t");
          return { status, path };
        });

      expect(actualChanges).toEqual(fixture.manifest.expectedChanges);
      expect(fixture.baseObjectId).toHaveLength(40);
      expect(fixture.headObjectId).toHaveLength(40);
    } finally {
      await fixture.cleanup();
    }
  });
});
