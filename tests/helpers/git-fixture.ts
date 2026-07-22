import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

const execFileAsync = promisify(execFile);

const fixturePathSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((value) => !value.includes("\\"), {
    message: "Fixture paths must use forward slashes",
  })
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.split("/").some((segment) => segment === ".."),
    { message: "Fixture paths must stay within the repository" },
  );

const generatedFileSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("base64"),
    path: fixturePathSchema,
    contentBase64: z.string().max(1_000_000),
  }),
  z.strictObject({
    kind: z.literal("repeat"),
    path: fixturePathSchema,
    content: z.string().min(1).max(1_000),
    repeat: z.number().int().positive().max(100_000),
  }),
]);

const gitlinkSchema = z.strictObject({
  path: fixturePathSchema,
  objectId: z.string().regex(/^[0-9a-f]{40}$/u),
});

const fixtureSnapshotSchema = z.strictObject({
  generatedFiles: z.array(generatedFileSchema).max(100).optional(),
  gitlinks: z.array(gitlinkSchema).max(100).optional(),
});

const gitFixtureManifestSchema = z.strictObject({
  fixtureId: z.string().min(1),
  description: z.string().min(1),
  expectedChanges: z.array(
    z.strictObject({
      status: z.enum(["A", "M", "D", "R", "C", "T", "U"]),
      path: z.string().min(1),
      previousPath: z.string().min(1).optional(),
    }),
  ),
  snapshots: z
    .strictObject({
      base: fixtureSnapshotSchema.optional(),
      head: fixtureSnapshotSchema.optional(),
    })
    .optional(),
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

function resolveGeneratedPath(
  repositoryPath: string,
  fixturePath: string,
): string {
  const target = resolve(repositoryPath, ...fixturePath.split("/"));
  const relativeTarget = relative(repositoryPath, target);

  if (
    relativeTarget === "" ||
    isAbsolute(relativeTarget) ||
    relativeTarget.split(/[\\/]/u).some((segment) => segment === "..")
  ) {
    throw new Error(`Refusing to generate unsafe fixture path: ${fixturePath}`);
  }

  return target;
}

async function applySnapshotSetup(
  repositoryPath: string,
  snapshot: z.infer<typeof fixtureSnapshotSchema> | undefined,
): Promise<void> {
  for (const generatedFile of snapshot?.generatedFiles ?? []) {
    const target = resolveGeneratedPath(repositoryPath, generatedFile.path);
    await mkdir(dirname(target), { recursive: true });
    const content =
      generatedFile.kind === "base64"
        ? Buffer.from(generatedFile.contentBase64, "base64")
        : generatedFile.content.repeat(generatedFile.repeat);
    await writeFile(target, content);
  }
}

async function applyGitlinks(
  repositoryPath: string,
  snapshot: z.infer<typeof fixtureSnapshotSchema> | undefined,
): Promise<void> {
  for (const gitlink of snapshot?.gitlinks ?? []) {
    resolveGeneratedPath(repositoryPath, gitlink.path);
    await runGit(repositoryPath, [
      "update-index",
      "--add",
      "--cacheinfo",
      "160000",
      gitlink.objectId,
      gitlink.path,
    ]);
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
    await applySnapshotSetup(repositoryPath, manifest.snapshots?.base);
    await runGit(repositoryPath, ["add", "--all"]);
    await applyGitlinks(repositoryPath, manifest.snapshots?.base);
    await runGit(repositoryPath, ["commit", "--message", "fixture: base"]);
    const baseObjectId = await runGit(repositoryPath, ["rev-parse", "HEAD"]);

    await clearWorkingTree(repositoryPath);
    await copyTreeContents(
      join(resolvedFixtureDirectory, "head"),
      repositoryPath,
    );
    await applySnapshotSetup(repositoryPath, manifest.snapshots?.head);
    await runGit(repositoryPath, ["add", "--all"]);
    await applyGitlinks(repositoryPath, manifest.snapshots?.head);
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
