import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import {
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import { resolveGitRepositoryRoot } from "../../git/change-scope.js";
import {
  CORE_SCHEMA_VERSION,
  MAX_EVIDENCE_EXCERPT_CHARACTERS,
  collectRuntimeEvidenceInputSchema,
  runtimeEvidenceCollectionSchema,
  runtimeEvidenceManifestSchema,
  type CollectRuntimeEvidenceInput,
  type MissingEvidence,
  type RuntimeEvidenceCollection,
  type RuntimeEvidenceItem,
  type RuntimeEvidenceManifest,
  type RuntimeEvidenceManifestRecord,
} from "../../schemas/index.js";
import { redactCommonSecrets } from "../../security/redact.js";

export const MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES = 4_194_304;

export const RUNTIME_EVIDENCE_COLLECTOR_ERROR_CODES = [
  "invalid_input",
  "repository_unavailable",
  "manifest_not_found",
  "manifest_file_unsafe",
  "manifest_file_too_large",
  "manifest_read_failed",
  "manifest_encoding_invalid",
  "manifest_json_invalid",
  "manifest_schema_invalid",
  "normalization_failed",
] as const;

export type RuntimeEvidenceCollectorErrorCode =
  (typeof RUNTIME_EVIDENCE_COLLECTOR_ERROR_CODES)[number];

const ERROR_MESSAGES: Readonly<
  Record<RuntimeEvidenceCollectorErrorCode, string>
> = {
  invalid_input: "Runtime evidence collector input is invalid.",
  repository_unavailable: "Runtime evidence repository is unavailable.",
  manifest_not_found: "Runtime evidence manifest was not found.",
  manifest_file_unsafe: "Runtime evidence manifest file is unsafe.",
  manifest_file_too_large: "Runtime evidence manifest exceeds its byte limit.",
  manifest_read_failed: "Runtime evidence manifest could not be read.",
  manifest_encoding_invalid: "Runtime evidence manifest encoding is invalid.",
  manifest_json_invalid: "Runtime evidence manifest JSON is invalid.",
  manifest_schema_invalid: "Runtime evidence manifest schema is invalid.",
  normalization_failed: "Runtime evidence normalization failed.",
};

const SELECTION_REASON =
  "Pre-produced runtime evidence supplied through an explicit manifest.";
const MAX_MISSING_REASON_CHARACTERS = 2_000;

export class RuntimeEvidenceCollectorError extends Error {
  readonly code: RuntimeEvidenceCollectorErrorCode;

  constructor(code: RuntimeEvidenceCollectorErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "RuntimeEvidenceCollectorError";
    this.code = code;
  }
}

export type RuntimeEvidenceCollectorOptions = {
  now?: () => Date;
};

function isCollectorError(
  error: unknown,
): error is RuntimeEvidenceCollectorError {
  return error instanceof RuntimeEvidenceCollectorError;
}

function errorCode(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "code" in error
    ? String(error.code)
    : "";
}

function normalizeComparablePath(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function resolveConfinedManifestPath(
  repositoryRoot: string,
  manifestPath: string,
): string {
  const target = resolve(repositoryRoot, ...manifestPath.split("/"));
  const relativeTarget = relative(repositoryRoot, target);
  if (
    relativeTarget === "" ||
    isAbsolute(relativeTarget) ||
    relativeTarget
      .split(/[\\/]/u)
      .some((segment) => segment === "..")
  ) {
    throw new RuntimeEvidenceCollectorError("invalid_input");
  }
  return target;
}

async function lstatManifestSegment(
  path: string,
  missingIsUnsafe: boolean,
) {
  try {
    return await lstat(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new RuntimeEvidenceCollectorError(
        missingIsUnsafe ? "manifest_file_unsafe" : "manifest_not_found",
      );
    }
    throw new RuntimeEvidenceCollectorError("manifest_read_failed");
  }
}

async function inspectManifestPath(
  repositoryRoot: string,
  manifestPath: string,
  missingIsUnsafe = false,
): Promise<{
  target: string;
  stats: Awaited<ReturnType<typeof lstat>>;
  segmentStats: Array<Awaited<ReturnType<typeof lstat>>>;
}> {
  const target = resolveConfinedManifestPath(repositoryRoot, manifestPath);
  let currentPath = repositoryRoot;
  const segments = manifestPath.split("/");
  const segmentStats: Array<Awaited<ReturnType<typeof lstat>>> = [];

  for (const [index, segment] of segments.entries()) {
    currentPath = join(currentPath, segment);
    const stats = await lstatManifestSegment(
      currentPath,
      missingIsUnsafe,
    );
    segmentStats.push(stats);
    if (stats.isSymbolicLink()) {
      throw new RuntimeEvidenceCollectorError("manifest_file_unsafe");
    }
    if (index < segments.length - 1 && !stats.isDirectory()) {
      throw new RuntimeEvidenceCollectorError("manifest_file_unsafe");
    }
    if (index === segments.length - 1) {
      if (
        normalizeComparablePath(currentPath) !==
        normalizeComparablePath(target)
      ) {
        throw new RuntimeEvidenceCollectorError("manifest_file_unsafe");
      }
      return { target, stats, segmentStats };
    }
  }

  throw new RuntimeEvidenceCollectorError("manifest_file_unsafe");
}

function sameFileIdentity(
  first: { dev: number | bigint; ino: number | bigint },
  second: { dev: number | bigint; ino: number | bigint },
): boolean {
  const inodeIsKnown =
    first.ino !== 0 &&
    first.ino !== 0n &&
    second.ino !== 0 &&
    second.ino !== 0n;
  const deviceMatches =
    first.dev === second.dev || first.dev === 0 || second.dev === 0;
  return inodeIsKnown && deviceMatches && first.ino === second.ino;
}

async function readBoundedManifestFile(
  repositoryRoot: string,
  manifestPath: string,
): Promise<Buffer> {
  const inspected = await inspectManifestPath(
    repositoryRoot,
    manifestPath,
  );
  if (!inspected.stats.isFile()) {
    throw new RuntimeEvidenceCollectorError("manifest_file_unsafe");
  }
  if (inspected.stats.size > MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES) {
    throw new RuntimeEvidenceCollectorError(
      "manifest_file_too_large",
    );
  }

  let handle;
  try {
    const noFollow = constants.O_NOFOLLOW ?? 0;
    handle = await open(
      inspected.target,
      constants.O_RDONLY | noFollow,
    );
  } catch (error) {
    throw new RuntimeEvidenceCollectorError(
      errorCode(error) === "ELOOP" ||
        errorCode(error) === "ENOENT"
        ? "manifest_file_unsafe"
        : "manifest_read_failed",
    );
  }

  try {
    const openedStats = await handle.stat();
    if (
      !openedStats.isFile() ||
      !sameFileIdentity(openedStats, inspected.stats)
    ) {
      throw new RuntimeEvidenceCollectorError("manifest_file_unsafe");
    }
    if (openedStats.size > MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES) {
      throw new RuntimeEvidenceCollectorError(
        "manifest_file_too_large",
      );
    }
    if (openedStats.size !== inspected.stats.size) {
      throw new RuntimeEvidenceCollectorError("manifest_file_unsafe");
    }

    const buffer = Buffer.alloc(
      MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES + 1,
    );
    let totalBytes = 0;
    while (totalBytes < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        totalBytes,
        buffer.length - totalBytes,
        totalBytes,
      );
      if (bytesRead === 0) {
        break;
      }
      totalBytes += bytesRead;
    }
    if (totalBytes > MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES) {
      throw new RuntimeEvidenceCollectorError(
        "manifest_file_too_large",
      );
    }

    const finalStats = await handle.stat();
    const finalInspected = await inspectManifestPath(
      repositoryRoot,
      manifestPath,
      true,
    );
    if (finalStats.size > MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES) {
      throw new RuntimeEvidenceCollectorError(
        "manifest_file_too_large",
      );
    }
    const segmentsRemainStable =
      finalInspected.segmentStats.length ===
        inspected.segmentStats.length &&
      finalInspected.segmentStats.every((stats, index) => {
        const initialStats = inspected.segmentStats[index];
        return (
          initialStats !== undefined &&
          sameFileIdentity(stats, initialStats)
        );
      });
    if (
      !finalStats.isFile() ||
      !sameFileIdentity(finalStats, openedStats) ||
      !segmentsRemainStable ||
      normalizeComparablePath(finalInspected.target) !==
        normalizeComparablePath(inspected.target) ||
      !finalInspected.stats.isFile() ||
      !sameFileIdentity(finalInspected.stats, finalStats) ||
      finalInspected.stats.size !== finalStats.size ||
      finalStats.size !== openedStats.size ||
      totalBytes !== finalStats.size
    ) {
      throw new RuntimeEvidenceCollectorError("manifest_file_unsafe");
    }
    return buffer.subarray(0, totalBytes);
  } catch (error) {
    if (isCollectorError(error)) {
      throw error;
    }
    throw new RuntimeEvidenceCollectorError("manifest_read_failed");
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function evidenceType(
  kind: RuntimeEvidenceManifestRecord["kind"],
): RuntimeEvidenceItem["type"] {
  if (kind === "test_run" || kind === "test_case") {
    return "test_result";
  }
  if (kind === "environment_metadata") {
    return "configuration";
  }
  return "runtime_observation";
}

function runtimeEvidenceId(
  manifest: RuntimeEvidenceManifest,
  record: RuntimeEvidenceManifestRecord,
): string {
  const identity = [
    manifest.producer.id,
    manifest.producer.name,
    manifest.producer.version,
    manifest.sourceFormat,
    record.recordId,
    record.kind,
    record.source.system,
    record.source.locator,
    record.source.uri,
    record.environment.kind,
    record.environment.name,
    record.environment.source.system,
    record.environment.source.locator,
    record.environment.source.uri,
  ];
  return `evidence:runtime:${createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex")}`;
}

function hashCompleteSummary(summary: string): string {
  return `sha256:${createHash("sha256")
    .update(summary)
    .digest("hex")}`;
}

function normalizeAvailableRecord(
  manifest: RuntimeEvidenceManifest,
  record: Extract<
    RuntimeEvidenceManifestRecord,
    { accessStatus: "available" }
  >,
  retrievedAt: string,
): RuntimeEvidenceItem {
  const redacted = redactCommonSecrets(record.summary);
  const excerpt = redacted.content.slice(
    0,
    MAX_EVIDENCE_EXCERPT_CHARACTERS,
  );
  const normalizationTruncated =
    excerpt.length < redacted.content.length;
  const isTruncated =
    record.truncation.isTruncated || normalizationTruncated;
  const originalCharacters = isTruncated
    ? Math.max(
        record.truncation.originalCharacters ?? record.summary.length,
        redacted.content.length,
        excerpt.length,
      )
    : excerpt.length;
  const isEnvironment = record.kind === "environment_metadata";

  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    id: runtimeEvidenceId(manifest, record),
    type: evidenceType(record.kind),
    source: record.source,
    retrievedAt,
    contentHash: record.truncation.isTruncated
      ? null
      : hashCompleteSummary(record.summary),
    relatedChangeIds: record.relatedChangeIds,
    excerpt,
    selectionReason: SELECTION_REASON,
    trustLevel: "observed_runtime",
    truncation: {
      isTruncated,
      originalCharacters,
      retainedCharacters: excerpt.length,
    },
    redactions: redacted.redactions,
    runtimeProvenance: {
      producer: manifest.producer,
      sourceFormat: manifest.sourceFormat,
      manifestRecordId: record.recordId,
      kind: record.kind,
      environment: record.environment,
      outcome: isEnvironment ? null : record.outcome,
      startedAt: isEnvironment ? null : record.startedAt,
      completedAt: isEnvironment ? null : record.completedAt,
      durationMilliseconds: isEnvironment
        ? null
        : record.durationMilliseconds,
      artifactReferences: record.artifactReferences,
      relatedEvidenceIds: record.relatedEvidenceIds,
    },
  };
}

function normalizeUnavailableRecord(
  record: Extract<
    RuntimeEvidenceManifestRecord,
    { accessStatus: Exclude<
      RuntimeEvidenceManifestRecord["accessStatus"],
      "available"
    > }
  >,
): MissingEvidence {
  const redacted = redactCommonSecrets(record.reason);
  return {
    source: record.source,
    reason: redacted.content.slice(0, MAX_MISSING_REASON_CHARACTERS),
    status:
      record.accessStatus === "malformed"
        ? "unsupported"
        : record.accessStatus,
  };
}

export function normalizeRuntimeEvidenceManifest(
  rawManifest: unknown,
  options: RuntimeEvidenceCollectorOptions = {},
): RuntimeEvidenceCollection {
  const parsed = runtimeEvidenceManifestSchema.safeParse(rawManifest);
  if (!parsed.success) {
    throw new RuntimeEvidenceCollectorError("manifest_schema_invalid");
  }

  let retrievedAt: string;
  try {
    retrievedAt = (options.now?.() ?? new Date()).toISOString();
  } catch {
    throw new RuntimeEvidenceCollectorError("normalization_failed");
  }

  try {
    const evidenceItems: RuntimeEvidenceItem[] = [];
    const missingEvidence: MissingEvidence[] = [];

    for (const record of parsed.data.records) {
      if (record.accessStatus === "available") {
        evidenceItems.push(
          normalizeAvailableRecord(parsed.data, record, retrievedAt),
        );
      } else {
        missingEvidence.push(normalizeUnavailableRecord(record));
      }
    }

    const result = runtimeEvidenceCollectionSchema.safeParse({
      schemaVersion: CORE_SCHEMA_VERSION,
      producer: parsed.data.producer,
      evidenceItems,
      missingEvidence,
    });
    if (!result.success) {
      throw new RuntimeEvidenceCollectorError("normalization_failed");
    }
    return result.data;
  } catch (error) {
    if (isCollectorError(error)) {
      throw error;
    }
    throw new RuntimeEvidenceCollectorError("normalization_failed");
  }
}

export async function collectRuntimeEvidence(
  rawInput: CollectRuntimeEvidenceInput,
  options: RuntimeEvidenceCollectorOptions = {},
): Promise<RuntimeEvidenceCollection> {
  const parsedInput = collectRuntimeEvidenceInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    throw new RuntimeEvidenceCollectorError("invalid_input");
  }

  let repositoryRoot: string;
  try {
    repositoryRoot = await resolveGitRepositoryRoot(
      parsedInput.data.repositoryPath,
    );
  } catch {
    throw new RuntimeEvidenceCollectorError("repository_unavailable");
  }

  const bytes = await readBoundedManifestFile(
    repositoryRoot,
    parsedInput.data.manifestPath,
  );
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RuntimeEvidenceCollectorError(
      "manifest_encoding_invalid",
    );
  }

  let manifestInput: unknown;
  try {
    manifestInput = JSON.parse(text);
  } catch {
    throw new RuntimeEvidenceCollectorError("manifest_json_invalid");
  }

  return normalizeRuntimeEvidenceManifest(manifestInput, options);
}
