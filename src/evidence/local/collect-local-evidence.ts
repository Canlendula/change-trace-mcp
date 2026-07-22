import { createHash } from "node:crypto";
import { lstat, open, readdir } from "node:fs/promises";
import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { resolveGitRepositoryRoot } from "../../git/change-scope.js";
import {
  CORE_SCHEMA_VERSION,
  MAX_EVIDENCE_EXCERPT_CHARACTERS,
  changeScopeSchema,
  type ChangeScope,
  type EvidenceItem,
  type LocalEvidenceCollection,
} from "../../schemas/index.js";

export const DEFAULT_LOCAL_EVIDENCE_LIMITS = {
  maxScannedEntries: 10_000,
  maxFiles: 100,
  maxFileBytes: 1_000_000,
  maxExcerptCharactersPerFile: 8_000,
  maxTotalExcerptCharacters: 100_000,
} as const;

const HARD_LIMITS = {
  maxScannedEntries: 100_000,
  maxFiles: 5_000,
  maxFileBytes: 10_000_000,
  maxExcerptCharactersPerFile: MAX_EVIDENCE_EXCERPT_CHARACTERS,
  maxTotalExcerptCharacters: 1_000_000,
} as const;

const relativePathSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((value) => !value.includes("\\"), {
    message: "Repository-relative paths must use forward slashes",
  })
  .refine((value) => !value.startsWith("/"), {
    message: "Repository-relative paths cannot be absolute",
  })
  .refine(
    (value) => !value.split("/").some((segment) => segment === ".."),
    { message: "Repository-relative paths cannot contain '..' segments" },
  )
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
    message: "Repository-relative paths cannot contain control characters",
  });

const documentPathSchema = relativePathSchema.refine(
  (value) => !value.split("/").includes(".git"),
  "Git metadata paths cannot be document roots or explicit references",
);

const filePatternSchema = relativePathSchema.refine(
  (value) => value !== ".",
  "File patterns cannot be '.'",
);

export const collectLocalEvidenceInputSchema = z.strictObject({
  scope: changeScopeSchema,
  documentRoots: z
    .array(documentPathSchema)
    .min(1)
    .max(100)
    .default(["README.md", "docs"]),
  filePatterns: z
    .array(filePatternSchema)
    .min(1)
    .max(100)
    .default(["*.md", "**/*.md", "*.mdx", "**/*.mdx", "*.txt", "**/*.txt"]),
  explicitReferences: z.array(documentPathSchema).max(100).default([]),
  maxScannedEntries: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxScannedEntries)
    .default(DEFAULT_LOCAL_EVIDENCE_LIMITS.maxScannedEntries),
  maxFiles: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxFiles)
    .default(DEFAULT_LOCAL_EVIDENCE_LIMITS.maxFiles),
  maxFileBytes: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxFileBytes)
    .default(DEFAULT_LOCAL_EVIDENCE_LIMITS.maxFileBytes),
  maxExcerptCharactersPerFile: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxExcerptCharactersPerFile)
    .default(DEFAULT_LOCAL_EVIDENCE_LIMITS.maxExcerptCharactersPerFile),
  maxTotalExcerptCharacters: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxTotalExcerptCharacters)
    .default(DEFAULT_LOCAL_EVIDENCE_LIMITS.maxTotalExcerptCharacters),
});

export type CollectLocalEvidenceInput = z.input<
  typeof collectLocalEvidenceInputSchema
>;

export type LocalEvidenceCollectorOptions = {
  now?: () => Date;
};

type CandidateFile = {
  path: string;
  absolutePath: string;
  isExplicit: boolean;
};

type BoundedTextFile = {
  content: string;
  contentHash: string | null;
  isByteTruncated: boolean;
  originalCharacters: number | null;
};

type ScanState = {
  scannedEntries: number;
  didReachLimit: boolean;
};

type RelatedChange = {
  id: string;
  path: string;
  needles: string[];
};

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeComparablePath(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function toRepositoryPath(repositoryRoot: string, absolutePath: string): string {
  return relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
}

function resolveConfinedPath(repositoryRoot: string, path: string): string {
  if (path.split("/").includes(".git")) {
    throw new Error("Git metadata paths cannot be collected as documents");
  }
  const target = resolve(repositoryRoot, ...path.split("/"));
  const relativeTarget = relative(repositoryRoot, target);

  if (
    (relativeTarget === "" && path !== ".") ||
    isAbsolute(relativeTarget) ||
    relativeTarget.split(/[\\/]/u).some((segment) => segment === "..")
  ) {
    throw new Error(`Path escapes the repository root: ${path}`);
  }

  return target;
}

async function rejectSymlinkSegments(
  repositoryRoot: string,
  repositoryPath: string,
): Promise<string> {
  const target = resolveConfinedPath(repositoryRoot, repositoryPath);
  let currentPath = repositoryRoot;

  for (const segment of repositoryPath.split("/")) {
    if (segment === "." || segment === "") {
      continue;
    }
    currentPath = join(currentPath, segment);
    const stats = await lstat(currentPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Symbolic links are not followed: ${repositoryPath}`);
    }
  }

  if (
    normalizeComparablePath(target) !== normalizeComparablePath(currentPath) &&
    repositoryPath !== "."
  ) {
    throw new Error(`Could not resolve repository path safely: ${repositoryPath}`);
  }

  return target;
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

async function readBoundedTextFile(
  path: string,
  maximumBytes: number,
): Promise<BoundedTextFile | null> {
  const pathStats = await lstat(path);
  if (pathStats.isSymbolicLink()) {
    throw new Error("Symbolic links are not followed");
  }
  const handle = await open(path, "r");

  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new Error("Document candidate is not a regular file");
    }

    const bytesToRead = Math.min(stats.size, maximumBytes + 1);
    const buffer = Buffer.alloc(bytesToRead);
    let bytesRead = 0;
    while (bytesRead < bytesToRead) {
      const result = await handle.read(
        buffer,
        bytesRead,
        bytesToRead - bytesRead,
        bytesRead,
      );
      if (result.bytesRead === 0) {
        break;
      }
      bytesRead += result.bytesRead;
    }

    const isByteTruncated = stats.size > maximumBytes || bytesRead > maximumBytes;
    let retainedBuffer = buffer.subarray(0, Math.min(bytesRead, maximumBytes));
    if (retainedBuffer.includes(0)) {
      return null;
    }
    if (isByteTruncated) {
      retainedBuffer = retainedBuffer.subarray(
        0,
        utf8BoundaryLength(retainedBuffer),
      );
    }

    const content = retainedBuffer.toString("utf8");
    return {
      content,
      contentHash: isByteTruncated
        ? null
        : `sha256:${createHash("sha256").update(retainedBuffer).digest("hex")}`,
      isByteTruncated,
      originalCharacters: isByteTruncated ? null : content.length,
    };
  } finally {
    await handle.close();
  }
}

function redactSecrets(content: string): {
  content: string;
  redactions: EvidenceItem["redactions"];
} {
  let count = 0;
  let redacted = content.replace(
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gu,
    (match) => {
      count += 1;
      const newlineCount = match.split("\n").length - 1;
      return `[REDACTED PRIVATE KEY]${"\n".repeat(newlineCount)}`;
    },
  );
  redacted = redacted.replace(
    /(\b(?:api[_-]?key|access[_-]?token|password|secret)\b\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s"'`]+)/giu,
    (_match, prefix: string) => {
      count += 1;
      return `${prefix}[REDACTED]`;
    },
  );
  redacted = redacted.replace(
    /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,})\b/gu,
    () => {
      count += 1;
      return "[REDACTED TOKEN]";
    },
  );

  return {
    content: redacted,
    redactions:
      count === 0
        ? []
        : [
            {
              kind: "secret",
              count,
              note: "Common credential patterns were removed from the excerpt.",
            },
          ],
  };
}

function changedFileNeedles(scope: ChangeScope): RelatedChange[] {
  return scope.files.map((file) => {
    const paths = [file.path, file.previousPath].filter(
      (path): path is string => path !== null,
    );
    const stems = paths
      .map((path) => basename(path, extname(path)))
      .filter((stem) => stem.length >= 3);

    return {
      id: file.id,
      path: file.path,
      needles: [...new Set([...paths, ...stems])],
    };
  });
}

function findRelatedChanges(
  content: string,
  scope: ChangeScope,
  isExplicit: boolean,
): { changeIds: string[]; paths: string[]; marker: string | null } {
  if (isExplicit) {
    return {
      changeIds: scope.files.map((file) => file.id),
      paths: scope.files.map((file) => file.path),
      marker: null,
    };
  }

  const lowerContent = content.toLowerCase();
  const matches = changedFileNeedles(scope).filter(({ needles }) =>
    needles.some((needle) => lowerContent.includes(needle.toLowerCase())),
  );
  const matchedNeedles = matches.flatMap(({ needles }) =>
    needles.filter((needle) => lowerContent.includes(needle.toLowerCase())),
  );
  const marker = matchedNeedles
    .map((needle) => ({
      needle,
      index: lowerContent.indexOf(needle.toLowerCase()),
    }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)[0]?.needle;

  return {
    changeIds: matches.map(({ id }) => id),
    paths: matches.map(({ path }) => path),
    marker: marker ?? null,
  };
}

function selectExcerpt(
  content: string,
  marker: string | null,
  maximumCharacters: number,
): { text: string; startLine: number; endLine: number; isTruncated: boolean } {
  const markerIndex =
    marker === null ? -1 : content.toLowerCase().indexOf(marker.toLowerCase());
  let start =
    markerIndex < 0
      ? 0
      : Math.max(0, markerIndex - Math.floor(maximumCharacters / 4));
  if (start > 0) {
    const nextLine = content.indexOf("\n", start);
    if (nextLine >= 0 && (markerIndex < 0 || nextLine < markerIndex)) {
      start = nextLine + 1;
    }
  }

  let end = Math.min(content.length, start + maximumCharacters);
  if (end < content.length) {
    const previousLine = content.lastIndexOf("\n", end);
    if (previousLine > start) {
      end = previousLine + 1;
    }
  }
  if (end <= start) {
    end = Math.min(content.length, start + maximumCharacters);
  }

  const text = content.slice(start, end);
  const startLine = content.slice(0, start).split("\n").length;
  const newlineCount = text.split("\n").length - 1;
  const endLine =
    startLine + Math.max(0, newlineCount - (text.endsWith("\n") ? 1 : 0));

  return {
    text,
    startLine,
    endLine: Math.max(startLine, endLine),
    isTruncated: start > 0 || end < content.length,
  };
}

function evidenceId(path: string): string {
  const digest = createHash("sha256").update(path).digest("hex").slice(0, 24);
  return `evidence:document:${digest}`;
}

export async function collectLocalEvidence(
  rawInput: CollectLocalEvidenceInput,
  options: LocalEvidenceCollectorOptions = {},
): Promise<LocalEvidenceCollection> {
  const input = collectLocalEvidenceInputSchema.parse(rawInput);
  const repositoryRoot = await resolveGitRepositoryRoot(
    input.scope.repositoryRoot,
  );
  if (
    normalizeComparablePath(repositoryRoot) !==
    normalizeComparablePath(input.scope.repositoryRoot)
  ) {
    throw new Error("scope.repositoryRoot must identify the exact Git root");
  }

  const explicitReferences = new Set(input.explicitReferences);
  const patterns = input.filePatterns.map(globToRegExp);
  const candidateMap = new Map<string, CandidateFile>();
  const errors: LocalEvidenceCollection["errors"] = [];
  const truncationReasons = new Set<
    LocalEvidenceCollection["truncation"]["reasons"][number]
  >();
  const scanState: ScanState = { scannedEntries: 0, didReachLimit: false };

  const pushError = (code: string, message: string, path: string | null) => {
    if (errors.length < 1_000) {
      errors.push({ code, message: message.slice(0, 2_000), path });
    }
  };

  const considerFile = (absolutePath: string) => {
    const path = toRepositoryPath(repositoryRoot, absolutePath);
    const isExplicit = explicitReferences.has(path);
    if (isExplicit || patterns.some((pattern) => pattern.test(path))) {
      candidateMap.set(path, { path, absolutePath, isExplicit });
    }
  };

  const scanDirectory = async (directoryPath: string): Promise<void> => {
    const entries = (await readdir(directoryPath, { withFileTypes: true })).sort(
      (left, right) => stableCompare(left.name, right.name),
    );

    for (const entry of entries) {
      if (scanState.scannedEntries >= input.maxScannedEntries) {
        scanState.didReachLimit = true;
        return;
      }
      scanState.scannedEntries += 1;
      const absolutePath = join(directoryPath, entry.name);
      const path = toRepositoryPath(repositoryRoot, absolutePath);

      if (path.split("/").includes(".git")) {
        continue;
      }
      if (entry.isSymbolicLink()) {
        pushError("symlink_skipped", "Symbolic links are not followed", path);
      } else if (entry.isDirectory()) {
        await scanDirectory(absolutePath);
        if (scanState.didReachLimit) {
          return;
        }
      } else if (entry.isFile()) {
        considerFile(absolutePath);
      }
    }
  };

  for (const documentRoot of [...new Set(input.documentRoots)].sort(stableCompare)) {
    if (scanState.didReachLimit) {
      break;
    }
    try {
      const absoluteRoot = await rejectSymlinkSegments(
        repositoryRoot,
        documentRoot,
      );
      const stats = await lstat(absoluteRoot);
      if (stats.isDirectory()) {
        await scanDirectory(absoluteRoot);
      } else if (stats.isFile()) {
        if (scanState.scannedEntries < input.maxScannedEntries) {
          scanState.scannedEntries += 1;
          considerFile(absoluteRoot);
        } else {
          scanState.didReachLimit = true;
        }
      } else {
        pushError(
          "unsupported_document_root",
          "Document root is neither a directory nor a regular file",
          documentRoot,
        );
      }
    } catch (error) {
      pushError(
        "document_root_unavailable",
        error instanceof Error ? error.message : String(error),
        documentRoot,
      );
    }
  }

  if (scanState.didReachLimit) {
    truncationReasons.add("scan_entry_limit");
  }

  const candidates = [...candidateMap.values()].sort((left, right) => {
    if (left.isExplicit !== right.isExplicit) {
      return left.isExplicit ? -1 : 1;
    }
    return stableCompare(left.path, right.path);
  });
  const selectedCandidates = candidates.slice(0, input.maxFiles);
  if (selectedCandidates.length < candidates.length) {
    truncationReasons.add("file_limit");
  }

  for (const explicitReference of [...explicitReferences].sort(stableCompare)) {
    if (!candidateMap.has(explicitReference)) {
      pushError(
        "explicit_reference_not_selected",
        "Explicit reference was not found beneath the configured document roots",
        explicitReference,
      );
    }
  }

  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  const evidenceItems: EvidenceItem[] = [];
  let remainingExcerptCharacters = input.maxTotalExcerptCharacters;
  let knownOmittedCharacters = 0;

  for (const candidate of selectedCandidates) {
    if (remainingExcerptCharacters === 0) {
      truncationReasons.add("total_excerpt_limit");
      continue;
    }

    try {
      const file = await readBoundedTextFile(
        candidate.absolutePath,
        input.maxFileBytes,
      );
      if (file === null) {
        pushError(
          "binary_document_skipped",
          "Document candidate contains NUL bytes and was skipped",
          candidate.path,
        );
        continue;
      }
      if (file.isByteTruncated) {
        truncationReasons.add("file_byte_limit");
      }

      const related = findRelatedChanges(
        file.content,
        input.scope,
        candidate.isExplicit,
      );
      const redacted = redactSecrets(file.content);
      const maximumCharacters = Math.min(
        input.maxExcerptCharactersPerFile,
        remainingExcerptCharacters,
      );
      const excerpt = selectExcerpt(
        redacted.content,
        related.marker,
        maximumCharacters,
      );
      if (excerpt.isTruncated) {
        truncationReasons.add(
          maximumCharacters < input.maxExcerptCharactersPerFile
            ? "total_excerpt_limit"
            : "per_file_excerpt_limit",
        );
      }
      if (file.isByteTruncated || excerpt.isTruncated) {
        knownOmittedCharacters += Math.max(
          0,
          redacted.content.length - excerpt.text.length,
        );
      }

      const fragment = `L${excerpt.startLine}-L${excerpt.endLine}`;
      const selectionReason = candidate.isExplicit
        ? "Selected because the document was explicitly referenced."
        : related.paths.length > 0
          ? `Selected because the document mentions changed file identifiers: ${related.paths.slice(0, 5).join(", ")}.`.slice(
              0,
              1_000,
            )
          : "Selected by the configured local document root and file patterns.";

      evidenceItems.push({
        schemaVersion: CORE_SCHEMA_VERSION,
        id: evidenceId(candidate.path),
        type: "document",
        source: {
          system: "repository",
          locator: `${candidate.path}#${fragment}`,
          uri: `${pathToFileURL(candidate.absolutePath).href}#${fragment}`,
        },
        retrievedAt,
        contentHash: file.contentHash,
        relatedChangeIds: related.changeIds,
        excerpt: excerpt.text,
        selectionReason,
        trustLevel: "trusted_repository",
        truncation: {
          isTruncated: file.isByteTruncated || excerpt.isTruncated,
          originalCharacters: file.originalCharacters,
          retainedCharacters: excerpt.text.length,
        },
        redactions: redacted.redactions,
      });
      remainingExcerptCharacters -= excerpt.text.length;
    } catch (error) {
      pushError(
        "document_read_failed",
        error instanceof Error ? error.message : String(error),
        candidate.path,
      );
    }
  }

  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    repositoryRoot,
    evidenceItems,
    scannedEntries: scanState.scannedEntries,
    matchedFiles: candidates.length,
    limits: {
      maxScannedEntries: input.maxScannedEntries,
      maxFiles: input.maxFiles,
      maxFileBytes: input.maxFileBytes,
      maxExcerptCharactersPerFile: input.maxExcerptCharactersPerFile,
      maxTotalExcerptCharacters: input.maxTotalExcerptCharacters,
    },
    truncation: {
      isTruncated: truncationReasons.size > 0,
      reasons: [...truncationReasons].sort(),
      omittedFiles: candidates.length - evidenceItems.length,
      knownOmittedCharacters,
    },
    errors,
  };
}
