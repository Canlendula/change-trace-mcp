import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { materializeGitFixture } from "../helpers/git-fixture.js";

const basicFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/basic-change", import.meta.url),
);

const fixtureDirectories = [
  basicFixtureDirectory,
  ...["rename", "deletion", "binary", "submodule", "oversized"].map(
    (fixtureName) =>
      fileURLToPath(
        new URL(`../fixtures/git/${fixtureName}`, import.meta.url),
      ),
  ),
];

describe("Git fixtures", () => {
  it.each(fixtureDirectories)(
    "materializes the two-commit fixture at %s",
    async (fixtureDirectory) => {
      const fixture = await materializeGitFixture(fixtureDirectory);

      try {
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync(
          "git",
          [
            "diff",
            "--name-status",
            "--find-renames",
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
            const [statusToken, firstPath, secondPath] = line.split("\t");
            const status = statusToken?.[0];
            if (
              (status === "R" || status === "C") &&
              firstPath !== undefined &&
              secondPath !== undefined
            ) {
              return {
                status,
                path: secondPath,
                previousPath: firstPath,
              };
            }
            return { status, path: firstPath };
          });

        expect(actualChanges).toEqual(fixture.manifest.expectedChanges);
        expect(fixture.baseObjectId).toHaveLength(40);
        expect(fixture.headObjectId).toHaveLength(40);
      } finally {
        await fixture.cleanup();
      }
    },
  );
});
