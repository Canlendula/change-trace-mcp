import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  type ChangeScope,
  type ChangedFile,
  type ChangedFileStatus,
} from "../schemas/index.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_CHANGE_SCOPE_LIMITS = {
  maxFiles: 500,
  maxDiffBytes: 1_000_000,
  maxPatchBytesPerFile: 64_000,
} as const;

const HARD_LIMITS = {
  maxFiles: 10_000,
  maxDiffBytes: 10_000_000,
  maxPatchBytesPerFile: 1_000_000,
} as const;

const refSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((value) => !value.startsWith("-"), "Git refs cannot start with '-'")
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
    message: "Git refs cannot contain control characters",
  });

const pathPatternSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((value) => !value.includes("\\"), {
    message: "Path patterns must use forward slashes",
  })
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
    message: "Path patterns cannot contain control characters",
  });

export const getChangeScopeInputSchema = z.strictObject({
  repositoryPath: z.string().min(1).max(4_096),
  baseRef: refSchema,
  headRef: refSchema,
  include: z.array(pathPatternSchema).max(100).default(["**"]),
  exclude: z.array(pathPatternSchema).max(100).default([]),
  maxFiles: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxFiles)
    .default(DEFAULT_CHANGE_SCOPE_LIMITS.maxFiles),
  maxDiffBytes: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxDiffBytes)
    .default(DEFAULT_CHANGE_SCOPE_LIMITS.maxDiffBytes),
  maxPatchBytesPerFile: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxPatchBytesPerFile)
    .default(DEFAULT_CHANGE_SCOPE_LIMITS.maxPatchBytesPerFile),
});

export type GetChangeScopeInput = z.input<typeof getChangeScopeInputSchema>;

type GitChangedPath = {
  status: ChangedFileStatus;
  path: string;
  previousPath: string | null;
};

const languageByExtension: Readonly<Record<string, string>> = {
  ".c": "C",
  ".cpp": "C++",
  ".cs": "C#",
  ".css": "CSS",
  ".go": "Go",
  ".html": "HTML",
  ".java": "Java",
  ".js": "JavaScript",
  ".json": "JSON",
  ".jsx": "JavaScript",
  ".kt": "Kotlin",
  ".md": "Markdown",
  ".php": "PHP",
  ".py": "Python",
  ".rb": "Ruby",
  ".rs": "Rust",
  ".sh": "Shell",
  ".swift": "Swift",
  ".toml": "TOML",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".xml": "XML",
  ".yaml": "YAML",
  ".yml": "YAML",
};

function normalizeRepositoryPath(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function runGit(
  repositoryPath: string,
  args: readonly string[],
  maxBuffer = 16 * 1024 * 1024,
): Promise<string> {
  const { stdout } = await execFileAsync("git", [...args], {
    cwd: repositoryPath,
    encoding: "utf8",
    maxBuffer,
    timeout: 30_000,
    windowsHide: true,
  });

  return stdout;
}

async function resolveRepositoryRoot(repositoryPath: string): Promise<string> {
  const requestedPath = await realpath(resolve(repositoryPath));
  const requestedStats = await stat(requestedPath);
  if (!requestedStats.isDirectory()) {
    throw new Error("repositoryPath must identify a directory");
  }

  const reportedRoot = (
    await runGit(requestedPath, ["rev-parse", "--show-toplevel"])
  ).trim();
  const repositoryRoot = await realpath(resolve(reportedRoot));

  if (
    normalizeRepositoryPath(repositoryRoot) !==
    normalizeRepositoryPath(requestedPath)
  ) {
    throw new Error("repositoryPath must identify the Git repository root");
  }

  return repositoryRoot;
}

async function resolveCommit(
  repositoryPath: string,
  ref: string,
): Promise<string> {
  return (
    await runGit(repositoryPath, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${ref}^{commit}`,
    ])
  ).trim();
}

function mapStatus(statusToken: string): ChangedFileStatus {
  switch (statusToken[0]) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type_changed";
    case "U":
      return "unmerged";
    default:
      return "unknown";
  }
}

function parseChangedPaths(output: string): GitChangedPath[] {
  const fields = output.split("\0");
  const paths: GitChangedPath[] = [];

  for (let index = 0; index < fields.length; ) {
    const statusToken = fields[index++];
    if (!statusToken) {
      continue;
    }

    if (statusToken.startsWith("R") || statusToken.startsWith("C")) {
      const previousPath = fields[index++];
      const path = fields[index++];
      if (previousPath === undefined || path === undefined) {
        throw new Error("Git returned an incomplete rename/copy record");
      }
      paths.push({
        status: mapStatus(statusToken),
        path,
        previousPath,
      });
      continue;
    }

    const path = fields[index++];
    if (path === undefined) {
      throw new Error("Git returned an incomplete changed-path record");
    }
    paths.push({
      status: mapStatus(statusToken),
      path,
      previousPath: null,
    });
  }

  return paths.sort((left, right) => left.path.localeCompare(right.path));
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
    } else if (character === "?") {
      source += "[^/]";
    } else if (character !== undefined) {
      source += character.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    }
  }

  return new RegExp(`${source}$`, "u");
}

function filterChangedPaths(
  paths: readonly GitChangedPath[],
  include: readonly string[],
  exclude: readonly string[],
): GitChangedPath[] {
  const includePatterns = include.map(globToRegExp);
  const excludePatterns = exclude.map(globToRegExp);

  return paths.filter(
    ({ path }) =>
      includePatterns.some((pattern) => pattern.test(path)) &&
      !excludePatterns.some((pattern) => pattern.test(path)),
  );
}

function createFileId(path: string): string {
  const digest = createHash("sha256").update(path).digest("hex").slice(0, 24);
  return `file:${digest}`;
}

function truncateUtf8(
  value: string,
  maximumBytes: number,
): { text: string; originalBytes: number; retainedBytes: number } {
  const encoded = Buffer.from(value, "utf8");
  if (encoded.byteLength <= maximumBytes) {
    return {
      text: value,
      originalBytes: encoded.byteLength,
      retainedBytes: encoded.byteLength,
    };
  }

  let retainedBytes = maximumBytes;
  while (retainedBytes > 0) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        encoded.subarray(0, retainedBytes),
      );
      return { text, originalBytes: encoded.byteLength, retainedBytes };
    } catch {
      retainedBytes -= 1;
    }
  }

  return { text: "", originalBytes: encoded.byteLength, retainedBytes: 0 };
}

function parseNumstat(output: string): {
  additions: number | null;
  deletions: number | null;
  isBinary: boolean;
} {
  const firstLine = output.split(/\r?\n/u).find(Boolean);
  if (firstLine === undefined) {
    return { additions: 0, deletions: 0, isBinary: false };
  }

  const [additions, deletions] = firstLine.split("\t");
  if (additions === "-" || deletions === "-") {
    return { additions: null, deletions: null, isBinary: true };
  }

  const parsedAdditions =
    additions === undefined ? Number.NaN : Number.parseInt(additions, 10);
  const parsedDeletions =
    deletions === undefined ? Number.NaN : Number.parseInt(deletions, 10);

  return {
    additions: Number.isFinite(parsedAdditions) ? parsedAdditions : null,
    deletions: Number.isFinite(parsedDeletions) ? parsedDeletions : null,
    isBinary: false,
  };
}

async function collectChangedFile(
  repositoryPath: string,
  baseObjectId: string,
  headObjectId: string,
  changedPath: GitChangedPath,
  maximumPatchBytes: number,
): Promise<ChangedFile> {
  const pathArguments = ["--", changedPath.path];
  const numstat = parseNumstat(
    await runGit(repositoryPath, [
      "diff",
      "--numstat",
      "--find-renames",
      baseObjectId,
      headObjectId,
      ...pathArguments,
    ]),
  );

  if (numstat.isBinary) {
    return {
      id: createFileId(changedPath.path),
      path: changedPath.path,
      previousPath: changedPath.previousPath,
      status: changedPath.status,
      isBinary: true,
      additions: null,
      deletions: null,
      diff: null,
    };
  }

  const patch = await runGit(repositoryPath, [
    "diff",
    "--no-color",
    "--no-ext-diff",
    "--unified=3",
    "--find-renames",
    baseObjectId,
    headObjectId,
    ...pathArguments,
  ]);
  const truncatedPatch = truncateUtf8(patch, maximumPatchBytes);

  return {
    id: createFileId(changedPath.path),
    path: changedPath.path,
    previousPath: changedPath.previousPath,
    status: changedPath.status,
    isBinary: false,
    additions: numstat.additions,
    deletions: numstat.deletions,
    diff: {
      text: truncatedPatch.text,
      isTruncated:
        truncatedPatch.retainedBytes < truncatedPatch.originalBytes,
      originalBytes: truncatedPatch.originalBytes,
      retainedBytes: truncatedPatch.retainedBytes,
    },
  };
}

function detectLanguages(files: readonly GitChangedPath[]): string[] {
  return [
    ...new Set(
      files
        .map(({ path }) => languageByExtension[extname(path).toLowerCase()])
        .filter((language): language is string => language !== undefined),
    ),
  ].sort();
}

function detectComponents(files: readonly GitChangedPath[]): string[] {
  return [
    ...new Set(
      files.map(({ path }) => {
        const separatorIndex = path.indexOf("/");
        return separatorIndex === -1 ? "(root)" : path.slice(0, separatorIndex);
      }),
    ),
  ].sort();
}

async function collectCommits(
  repositoryPath: string,
  baseObjectId: string,
  headObjectId: string,
): Promise<ChangeScope["commits"]> {
  const output = await runGit(repositoryPath, [
    "log",
    "--reverse",
    "--format=%H%x00%P%x00%cI%x00%s%x1e",
    `${baseObjectId}..${headObjectId}`,
  ]);

  return output
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [objectId, parentObjectIds, committedAt, summary] =
        record.split("\0");
      if (
        objectId === undefined ||
        parentObjectIds === undefined ||
        committedAt === undefined ||
        summary === undefined
      ) {
        throw new Error("Git returned an incomplete commit record");
      }

      return {
        id: `commit:${objectId}`,
        objectId,
        parentObjectIds: parentObjectIds ? parentObjectIds.split(" ") : [],
        summary: summary.slice(0, 1_000),
        committedAt,
      };
    });
}

export async function collectChangeScope(
  rawInput: GetChangeScopeInput,
): Promise<ChangeScope> {
  const input = getChangeScopeInputSchema.parse(rawInput);
  const repositoryRoot = await resolveRepositoryRoot(input.repositoryPath);
  const resolvedBase = await resolveCommit(repositoryRoot, input.baseRef);
  const resolvedHead = await resolveCommit(repositoryRoot, input.headRef);

  const allChangedPaths = parseChangedPaths(
    await runGit(repositoryRoot, [
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      "--find-copies",
      resolvedBase,
      resolvedHead,
    ]),
  );
  const filteredPaths = filterChangedPaths(
    allChangedPaths,
    input.include,
    input.exclude,
  );
  const selectedPaths = filteredPaths.slice(0, input.maxFiles);
  const files: ChangedFile[] = [];
  const errors: ChangeScope["errors"] = [];
  const truncationReasons = new Set<
    ChangeScope["truncation"]["reasons"][number]
  >();
  let remainingDiffBytes = input.maxDiffBytes;

  if (selectedPaths.length < filteredPaths.length) {
    truncationReasons.add("file_limit");
  }

  for (const changedPath of selectedPaths) {
    try {
      const maximumPatchBytes = Math.min(
        input.maxPatchBytesPerFile,
        remainingDiffBytes,
      );
      const file = await collectChangedFile(
        repositoryRoot,
        resolvedBase,
        resolvedHead,
        changedPath,
        maximumPatchBytes,
      );
      files.push(file);

      if (file.diff !== null) {
        remainingDiffBytes -= file.diff.retainedBytes;
        if (
          file.diff.isTruncated &&
          file.diff.retainedBytes === input.maxPatchBytesPerFile
        ) {
          truncationReasons.add("per_file_diff_limit");
        }
        if (file.diff.isTruncated && remainingDiffBytes === 0) {
          truncationReasons.add("total_diff_limit");
        }
      }
    } catch (error) {
      errors.push({
        code: "git_file_diff_failed",
        message: error instanceof Error ? error.message : String(error),
        path: changedPath.path,
      });
    }
  }

  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    repositoryRoot,
    baseRef: input.baseRef,
    headRef: input.headRef,
    resolvedBase,
    resolvedHead,
    commits: await collectCommits(repositoryRoot, resolvedBase, resolvedHead),
    files,
    detectedLanguages: detectLanguages(selectedPaths),
    detectedComponents: detectComponents(selectedPaths),
    limits: {
      maxFiles: input.maxFiles,
      maxDiffBytes: input.maxDiffBytes,
      maxPatchBytesPerFile: input.maxPatchBytesPerFile,
    },
    truncation: {
      isTruncated: truncationReasons.size > 0,
      reasons: [...truncationReasons].sort(),
      omittedFiles: filteredPaths.length - selectedPaths.length,
    },
    errors,
  };
}
