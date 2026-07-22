import { execFile, spawn } from "node:child_process";
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
const GIT_TIMEOUT_MILLISECONDS = 30_000;
const MAX_GIT_STDERR_BYTES = 64_000;

function gitArguments(args: readonly string[]): string[] {
  return ["--no-pager", "--no-optional-locks", ...args];
}

function gitEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
  };
}

export const DEFAULT_CHANGE_SCOPE_LIMITS = {
  maxCommits: 500,
  maxFiles: 500,
  maxDiffBytes: 1_000_000,
  maxPatchBytesPerFile: 64_000,
} as const;

const HARD_LIMITS = {
  maxCommits: 10_000,
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
  maxCommits: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxCommits)
    .default(DEFAULT_CHANGE_SCOPE_LIMITS.maxCommits),
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
  const { stdout } = await execFileAsync("git", gitArguments(args), {
    cwd: repositoryPath,
    encoding: "utf8",
    env: gitEnvironment(),
    maxBuffer,
    timeout: GIT_TIMEOUT_MILLISECONDS,
    windowsHide: true,
  });

  return stdout;
}

type BoundedGitOutput = {
  text: string;
  originalBytes: number;
  retainedBytes: number;
  isTruncated: boolean;
};

function utf8BoundaryLength(buffer: Buffer): number {
  if (buffer.byteLength === 0) {
    return 0;
  }

  let sequenceStart = buffer.byteLength - 1;
  while (
    sequenceStart >= 0 &&
    (buffer[sequenceStart]! & 0b1100_0000) === 0b1000_0000
  ) {
    sequenceStart -= 1;
  }
  if (sequenceStart < 0) {
    return 0;
  }

  const leadingByte = buffer[sequenceStart]!;
  const expectedBytes =
    leadingByte <= 0x7f
      ? 1
      : leadingByte >= 0xc2 && leadingByte <= 0xdf
        ? 2
        : leadingByte >= 0xe0 && leadingByte <= 0xef
          ? 3
          : leadingByte >= 0xf0 && leadingByte <= 0xf4
            ? 4
            : 1;

  return buffer.byteLength - sequenceStart < expectedBytes
    ? sequenceStart
    : buffer.byteLength;
}

async function runGitBounded(
  repositoryPath: string,
  args: readonly string[],
  maximumBytes: number,
): Promise<BoundedGitOutput> {
  return await new Promise((resolveOutput, rejectOutput) => {
    const child = spawn("git", gitArguments(args), {
      cwd: repositoryPath,
      env: gitEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const retainedChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let originalBytes = 0;
    let retainedBytes = 0;
    let stderrBytes = 0;
    let didTimeOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      didTimeOut = true;
      child.kill();
    }, GIT_TIMEOUT_MILLISECONDS);

    child.stdout.on("data", (chunk: Buffer) => {
      originalBytes += chunk.byteLength;
      const remainingBytes = maximumBytes - retainedBytes;
      if (remainingBytes > 0) {
        const retainedChunk = Buffer.from(chunk.subarray(0, remainingBytes));
        retainedChunks.push(retainedChunk);
        retainedBytes += retainedChunk.byteLength;
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const remainingBytes = MAX_GIT_STDERR_BYTES - stderrBytes;
      if (remainingBytes > 0) {
        const retainedChunk = Buffer.from(chunk.subarray(0, remainingBytes));
        stderrChunks.push(retainedChunk);
        stderrBytes += retainedChunk.byteLength;
      }
    });

    child.once("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        rejectOutput(error);
      }
    });

    child.once("close", (exitCode, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);

      if (didTimeOut) {
        rejectOutput(
          new Error(`Git command timed out after ${GIT_TIMEOUT_MILLISECONDS}ms`),
        );
        return;
      }

      if (exitCode !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        const exitDescription =
          exitCode === null ? `signal ${signal ?? "unknown"}` : `code ${exitCode}`;
        rejectOutput(
          new Error(
            stderr
              ? `Git command failed with ${exitDescription}: ${stderr}`
              : `Git command failed with ${exitDescription}`,
          ),
        );
        return;
      }

      const retainedBuffer = Buffer.concat(retainedChunks);
      const safeRetainedBytes =
        retainedBytes < originalBytes
          ? utf8BoundaryLength(retainedBuffer)
          : retainedBytes;

      resolveOutput({
        text: retainedBuffer.subarray(0, safeRetainedBytes).toString("utf8"),
        originalBytes,
        retainedBytes: safeRetainedBytes,
        isTruncated: safeRetainedBytes < originalBytes,
      });
    });
  });
}

export async function resolveGitRepositoryRoot(
  repositoryPath: string,
): Promise<string> {
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

  return paths.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*") {
      let runEnd = index + 1;
      while (pattern[runEnd] === "*") {
        runEnd += 1;
      }
      source += runEnd - index >= 2 ? ".*" : "[^/]*";
      index = runEnd - 1;
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
      "--no-ext-diff",
      "--no-textconv",
      "--find-renames=50%",
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

  const patch = await runGitBounded(
    repositoryPath,
    [
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--no-textconv",
      "--diff-algorithm=myers",
      "--no-indent-heuristic",
      "--unified=3",
      "--find-renames=50%",
      baseObjectId,
      headObjectId,
      ...pathArguments,
    ],
    maximumPatchBytes,
  );

  return {
    id: createFileId(changedPath.path),
    path: changedPath.path,
    previousPath: changedPath.previousPath,
    status: changedPath.status,
    isBinary: false,
    additions: numstat.additions,
    deletions: numstat.deletions,
    diff: {
      text: patch.text,
      isTruncated: patch.isTruncated,
      originalBytes: patch.originalBytes,
      retainedBytes: patch.retainedBytes,
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
  maximumCommits: number,
): Promise<{ commits: ChangeScope["commits"]; totalCommits: number }> {
  const countOutput = (
    await runGit(repositoryPath, [
      "rev-list",
      "--count",
      `${baseObjectId}..${headObjectId}`,
    ])
  ).trim();
  const totalCommits = Number.parseInt(countOutput, 10);
  if (!Number.isSafeInteger(totalCommits) || totalCommits < 0) {
    throw new Error("Git returned an invalid commit count");
  }

  const output = await runGit(repositoryPath, [
    "log",
    `--max-count=${maximumCommits}`,
    "--encoding=UTF-8",
    "--format=%H%x00%P%x00%cI%x00%s%x1e",
    `${baseObjectId}..${headObjectId}`,
  ]);

  const commits = output
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
    })
    .reverse();

  return { commits, totalCommits };
}

export async function collectChangeScope(
  rawInput: GetChangeScopeInput,
): Promise<ChangeScope> {
  const input = getChangeScopeInputSchema.parse(rawInput);
  const repositoryRoot = await resolveGitRepositoryRoot(input.repositoryPath);
  const resolvedBase = await resolveCommit(repositoryRoot, input.baseRef);
  const resolvedHead = await resolveCommit(repositoryRoot, input.headRef);

  const allChangedPaths = parseChangedPaths(
    await runGit(repositoryRoot, [
      "diff",
      "--name-status",
      "-z",
      "--no-ext-diff",
      "--no-textconv",
      "--find-renames=50%",
      "--find-copies=50%",
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
        message: (error instanceof Error ? error.message : String(error)).slice(
          0,
          2_000,
        ),
        path: changedPath.path,
      });
    }
  }

  const collectedCommits = await collectCommits(
    repositoryRoot,
    resolvedBase,
    resolvedHead,
    input.maxCommits,
  );
  if (collectedCommits.commits.length < collectedCommits.totalCommits) {
    truncationReasons.add("commit_limit");
  }

  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    repositoryRoot,
    baseRef: input.baseRef,
    headRef: input.headRef,
    resolvedBase,
    resolvedHead,
    commits: collectedCommits.commits,
    files,
    detectedLanguages: detectLanguages(selectedPaths),
    detectedComponents: detectComponents(selectedPaths),
    limits: {
      maxCommits: input.maxCommits,
      maxFiles: input.maxFiles,
      maxDiffBytes: input.maxDiffBytes,
      maxPatchBytesPerFile: input.maxPatchBytesPerFile,
    },
    truncation: {
      isTruncated: truncationReasons.size > 0,
      reasons: [...truncationReasons].sort(),
      omittedCommits:
        collectedCommits.totalCommits - collectedCommits.commits.length,
      omittedFiles: filteredPaths.length - selectedPaths.length,
    },
    errors,
  };
}
