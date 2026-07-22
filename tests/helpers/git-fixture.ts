import { execFile } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

const execFileAsync = promisify(execFile);

const gitFixtureManifestSchema = z.strictObject({
  fixtureId: z.string().min(1),
  description: z.string().min(1),
  expectedChanges: z.array(
    z.strictObject({
      status: z.enum(["A", "M", "D", "R", "C", "T", "U"]),
      path: z.string().min(1),
    }),
  ),
});

export type GitFixtureManifest = z.infer<typeof gitFixtureManifestSchema>;

export type MaterializedGitFixture = {
  repositoryPath: string;
  baseObjectId: string;
  headObjectId: string;
  manifest: GitFixtureManifest;
  cleanup: () => Promise<void>;
};

async function runGit(
  repositoryPath: string,
  args: readonly string[],
): Promise<string> {
  const { stdout } = await execFileAsync("git", [...args], {
    cwd: repositoryPath,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
      GIT_AUTHOR_EMAIL: "fixture@change-trace.invalid",
      GIT_AUTHOR_NAME: "Change Trace Fixture",
      GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
      GIT_COMMITTER_EMAIL: "fixture@change-trace.invalid",
      GIT_COMMITTER_NAME: "Change Trace Fixture",
    },
  });

  return stdout.trim();
}

async function copyTreeContents(
  sourceDirectory: string,
  destinationDirectory: string,
): Promise<void> {
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    await cp(
      join(sourceDirectory, entry.name),
      join(destinationDirectory, entry.name),
      { recursive: true },
    );
  }
}

async function clearWorkingTree(repositoryPath: string): Promise<void> {
  const resolvedRepositoryPath = resolve(repositoryPath);

  for (const entry of await readdir(resolvedRepositoryPath)) {
    if (entry === ".git") {
      continue;
    }

    const target = resolve(resolvedRepositoryPath, entry);
    if (
      dirname(target) !== resolvedRepositoryPath ||
      basename(target) !== entry
    ) {
      throw new Error(`Refusing to clear unsafe fixture path: ${target}`);
    }

    await rm(target, { recursive: true, force: true });
  }
}

export async function materializeGitFixture(
  fixtureDirectory: string,
): Promise<MaterializedGitFixture> {
  const resolvedFixtureDirectory = resolve(fixtureDirectory);
  const repositoryPath = await mkdtemp(
    join(tmpdir(), "change-trace-git-fixture-"),
  );

  const manifest = gitFixtureManifestSchema.parse(
    JSON.parse(
      await readFile(join(resolvedFixtureDirectory, "manifest.json"), "utf8"),
    ),
  );

  try {
    await runGit(repositoryPath, ["init", "--initial-branch=main"]);
    await runGit(repositoryPath, ["config", "core.autocrlf", "false"]);
    await runGit(repositoryPath, ["config", "core.filemode", "false"]);
    await copyTreeContents(
      join(resolvedFixtureDirectory, "base"),
      repositoryPath,
    );
    await runGit(repositoryPath, ["add", "--all"]);
    await runGit(repositoryPath, ["commit", "--message", "fixture: base"]);
    const baseObjectId = await runGit(repositoryPath, ["rev-parse", "HEAD"]);

    await clearWorkingTree(repositoryPath);
    await copyTreeContents(
      join(resolvedFixtureDirectory, "head"),
      repositoryPath,
    );
    await runGit(repositoryPath, ["add", "--all"]);
    await runGit(repositoryPath, ["commit", "--message", "fixture: head"]);
    const headObjectId = await runGit(repositoryPath, ["rev-parse", "HEAD"]);

    return {
      repositoryPath,
      baseObjectId,
      headObjectId,
      manifest,
      cleanup: async () => {
        await rm(repositoryPath, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(repositoryPath, { recursive: true, force: true });
    throw error;
  }
}
