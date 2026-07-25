import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

import {
  CORE_SCHEMA_VERSION,
  MAX_EVIDENCE_EXCERPT_CHARACTERS,
  externalAdapterRegistrationSchema,
  externalAdapterRequestSchema,
  externalAdapterResponseSchema,
  externalEvidenceCollectionSchema,
  type EvidenceItem,
  type ExternalAdapterIdentity,
  type ExternalAdapterRegistration,
  type ExternalAdapterRequest,
  type ExternalAdapterResponse,
  type ExternalEvidenceCollection,
  type ExplicitExternalReference,
  type MissingEvidence,
} from "../../schemas/index.js";
import { redactCommonSecrets } from "../../security/redact.js";

export const EXTERNAL_ADAPTER_RUNNER_ERROR_CODES = [
  "invalid_registration",
  "invalid_request",
  "spawn_failed",
  "timeout",
  "stdout_limit_exceeded",
  "stderr_limit_exceeded",
  "nonzero_exit",
  "invalid_response",
  "identity_mismatch",
  "result_coverage_mismatch",
  "source_type_mismatch",
  "source_system_not_allowed",
  "source_system_mismatch",
  "normalization_failed",
] as const;

export type ExternalAdapterRunnerErrorCode =
  (typeof EXTERNAL_ADAPTER_RUNNER_ERROR_CODES)[number];

const ERROR_MESSAGES: Readonly<
  Record<ExternalAdapterRunnerErrorCode, string>
> = {
  invalid_registration: "External adapter registration is invalid.",
  invalid_request: "External adapter request is invalid.",
  spawn_failed: "External adapter process could not be started.",
  timeout: "External adapter process exceeded its time limit.",
  stdout_limit_exceeded: "External adapter stdout exceeded its byte limit.",
  stderr_limit_exceeded: "External adapter stderr exceeded its byte limit.",
  nonzero_exit: "External adapter process exited unsuccessfully.",
  invalid_response: "External adapter response is invalid.",
  identity_mismatch: "External adapter identity does not match.",
  result_coverage_mismatch:
    "External adapter results do not cover the request exactly.",
  source_type_mismatch: "External adapter result source type does not match.",
  source_system_not_allowed:
    "External adapter source system is not allowlisted.",
  source_system_mismatch: "External adapter result changed the source system.",
  normalization_failed: "External adapter result could not be normalized.",
};

export class ExternalAdapterRunnerError extends Error {
  readonly code: ExternalAdapterRunnerErrorCode;
  readonly exitCode: number | null;

  constructor(
    code: ExternalAdapterRunnerErrorCode,
    exitCode: number | null = null,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "ExternalAdapterRunnerError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

// The child receives only this fixed OS bootstrap set plus credential names
// selected by the trusted registration. Windows process creation can surface
// the listed user/session bootstrap variables even when Node is given a
// smaller object, so they are explicit here and covered as part of the bound.
const WINDOWS_BASELINE_ENVIRONMENT_NAMES = [
  "PATH",
  "SYSTEMROOT",
  "SYSTEMDRIVE",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "TEMP",
  "TMP",
  "HOMEDRIVE",
  "HOMEPATH",
  "LOGONSERVER",
  "USERDOMAIN",
  "USERNAME",
  "USERPROFILE",
] as const;

const POSIX_BASELINE_ENVIRONMENT_NAMES = [
  "PATH",
  "HOME",
  "TMPDIR",
  "LANG",
  "LC_ALL",
] as const;

function childEnvironment(
  credentialEnvironmentNames: readonly string[],
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  const baselineNames =
    process.platform === "win32"
      ? WINDOWS_BASELINE_ENVIRONMENT_NAMES
      : POSIX_BASELINE_ENVIRONMENT_NAMES;

  for (const name of [...baselineNames, ...credentialEnvironmentNames]) {
    const value = process.env[name];
    if (value !== undefined) {
      environment[name] = value;
    }
  }

  return environment;
}

type ProcessOutput = {
  stdout: Buffer;
  exitCode: number | null;
};

function runAdapterProcess(
  registration: ExternalAdapterRegistration,
  request: ExternalAdapterRequest,
): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    const [executable, ...args] = registration.argv;
    let child;
    try {
      child = spawn(executable!, args, {
        env: childEnvironment(registration.credentialEnvironmentNames),
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch {
      reject(new ExternalAdapterRunnerError("spawn_failed"));
      return;
    }

    const stdoutChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let terminalErrorCode: ExternalAdapterRunnerErrorCode | null = null;
    let settled = false;

    const terminate = (code: ExternalAdapterRunnerErrorCode): void => {
      if (terminalErrorCode !== null) {
        return;
      }
      terminalErrorCode = code;
      child.kill("SIGKILL");
    };

    const timer = setTimeout(() => {
      terminate("timeout");
    }, registration.limits.timeoutMilliseconds);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > registration.limits.stdoutBytes) {
        terminate("stdout_limit_exceeded");
        return;
      }
      stdoutChunks.push(Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > registration.limits.stderrBytes) {
        terminate("stderr_limit_exceeded");
      }
    });

    child.stdin.on("error", () => {
      // Process failures are reported through the bounded close/error paths.
    });

    child.once("error", () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(new ExternalAdapterRunnerError("spawn_failed"));
    });

    child.once("close", (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);

      if (terminalErrorCode !== null) {
        reject(new ExternalAdapterRunnerError(terminalErrorCode));
        return;
      }
      if (exitCode !== 0) {
        reject(new ExternalAdapterRunnerError("nonzero_exit", exitCode));
        return;
      }
      resolve({
        stdout: Buffer.concat(stdoutChunks),
        exitCode,
      });
    });

    child.stdin.end(JSON.stringify(request));
  });
}

function adaptersMatch(
  first: ExternalAdapterIdentity,
  second: ExternalAdapterIdentity,
): boolean {
  return (
    first.id === second.id &&
    first.name === second.name &&
    first.version === second.version
  );
}

function validateResponseCoverage(
  registration: ExternalAdapterRegistration,
  request: ExternalAdapterRequest,
  response: ExternalAdapterResponse,
): Map<string, ExternalAdapterResponse["results"][number]> {
  if (
    request.adapterId !== registration.adapter.id ||
    !adaptersMatch(response.adapter, registration.adapter)
  ) {
    throw new ExternalAdapterRunnerError("identity_mismatch");
  }

  if (response.results.length !== request.references.length) {
    throw new ExternalAdapterRunnerError("result_coverage_mismatch");
  }

  const resultByRequestId = new Map(
    response.results.map((result) => [result.requestId, result]),
  );
  if (resultByRequestId.size !== request.references.length) {
    throw new ExternalAdapterRunnerError("result_coverage_mismatch");
  }

  const allowlistedSystems = new Set(registration.sourceSystems);
  for (const reference of request.references) {
    if (!allowlistedSystems.has(reference.source.system)) {
      throw new ExternalAdapterRunnerError("source_system_not_allowed");
    }

    const result = resultByRequestId.get(reference.requestId);
    if (result === undefined) {
      throw new ExternalAdapterRunnerError("result_coverage_mismatch");
    }
    if (result.sourceType !== reference.sourceType) {
      throw new ExternalAdapterRunnerError("source_type_mismatch");
    }
    if (!allowlistedSystems.has(result.source.system)) {
      throw new ExternalAdapterRunnerError("source_system_not_allowed");
    }
    if (result.source.system !== reference.source.system) {
      throw new ExternalAdapterRunnerError("source_system_mismatch");
    }
  }

  return resultByRequestId;
}

function evidenceId(
  adapter: ExternalAdapterIdentity,
  reference: ExplicitExternalReference,
  source: ExternalAdapterResponse["results"][number]["source"],
): string {
  const identity = JSON.stringify([
    adapter.id,
    adapter.name,
    adapter.version,
    reference.requestId,
    reference.sourceType,
    source.system,
    source.locator,
    source.uri,
  ]);
  const digest = createHash("sha256").update(identity, "utf8").digest("hex");
  return `evidence:external:${digest}`;
}

function contentHash(excerpt: string): string {
  return `sha256:${createHash("sha256").update(excerpt, "utf8").digest("hex")}`;
}

function normalizeAvailableResult(
  registration: ExternalAdapterRegistration,
  reference: ExplicitExternalReference,
  result: Extract<
    ExternalAdapterResponse["results"][number],
    { accessStatus: "available" }
  >,
): EvidenceItem {
  const redacted = redactCommonSecrets(result.excerpt);
  const excerpt = redacted.content.slice(
    0,
    MAX_EVIDENCE_EXCERPT_CHARACTERS,
  );
  const wasRunnerTruncated = excerpt.length < redacted.content.length;

  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    id: evidenceId(registration.adapter, reference, result.source),
    type: "document",
    source: result.source,
    retrievedAt: result.retrievedAt,
    contentHash: result.truncation.isTruncated
      ? null
      : contentHash(result.excerpt),
    relatedChangeIds: reference.relatedChangeIds,
    excerpt,
    selectionReason: reference.relationReason,
    trustLevel: "untrusted_external",
    truncation: {
      isTruncated: result.truncation.isTruncated || wasRunnerTruncated,
      originalCharacters: result.truncation.originalCharacters,
      retainedCharacters: excerpt.length,
    },
    redactions: redacted.redactions,
    externalProvenance: {
      adapter: registration.adapter,
      sourceType: result.sourceType,
      title: result.title,
      sourceUpdatedAt: result.sourceUpdatedAt,
    },
  };
}

function missingStatus(
  accessStatus: Exclude<
    ExternalAdapterResponse["results"][number]["accessStatus"],
    "available"
  >,
): MissingEvidence["status"] {
  switch (accessStatus) {
    case "not_found":
      return "not_found";
    case "unsupported":
      return "unsupported";
    case "permission_denied":
    case "error":
      return "inaccessible";
  }
}

function normalizeUnavailableResult(
  result: Exclude<
    ExternalAdapterResponse["results"][number],
    { accessStatus: "available" }
  >,
): MissingEvidence {
  const reason = redactCommonSecrets(result.message).content.slice(0, 2_000);
  return {
    source: result.source,
    reason,
    status: missingStatus(result.accessStatus),
  };
}

export async function runExternalAdapter(
  registrationInput: ExternalAdapterRegistration,
  requestInput: ExternalAdapterRequest,
): Promise<ExternalEvidenceCollection> {
  const registrationResult =
    externalAdapterRegistrationSchema.safeParse(registrationInput);
  if (!registrationResult.success) {
    throw new ExternalAdapterRunnerError("invalid_registration");
  }
  const requestResult = externalAdapterRequestSchema.safeParse(requestInput);
  if (!requestResult.success) {
    throw new ExternalAdapterRunnerError("invalid_request");
  }

  const registration = registrationResult.data;
  const request = requestResult.data;
  if (request.adapterId !== registration.adapter.id) {
    throw new ExternalAdapterRunnerError("identity_mismatch");
  }
  const allowlistedSystems = new Set(registration.sourceSystems);
  if (
    request.references.some(
      (reference) => !allowlistedSystems.has(reference.source.system),
    )
  ) {
    throw new ExternalAdapterRunnerError("source_system_not_allowed");
  }

  const processOutput = await runAdapterProcess(registration, request);
  let responseInput: unknown;
  try {
    const responseText = new TextDecoder("utf-8", { fatal: true }).decode(
      processOutput.stdout,
    );
    responseInput = JSON.parse(responseText);
  } catch {
    throw new ExternalAdapterRunnerError("invalid_response");
  }
  const responseResult = externalAdapterResponseSchema.safeParse(responseInput);
  if (!responseResult.success) {
    throw new ExternalAdapterRunnerError("invalid_response");
  }
  const response = responseResult.data;
  const resultByRequestId = validateResponseCoverage(
    registration,
    request,
    response,
  );

  const evidenceItems: EvidenceItem[] = [];
  const missingEvidence: MissingEvidence[] = [];
  for (const reference of request.references) {
    const result = resultByRequestId.get(reference.requestId)!;
    if (result.accessStatus === "available") {
      evidenceItems.push(
        normalizeAvailableResult(registration, reference, result),
      );
    } else {
      missingEvidence.push(normalizeUnavailableResult(result));
    }
  }

  const collection = {
    schemaVersion: CORE_SCHEMA_VERSION,
    adapter: registration.adapter,
    evidenceItems,
    missingEvidence,
  };
  const collectionResult = externalEvidenceCollectionSchema.safeParse(collection);
  if (!collectionResult.success) {
    throw new ExternalAdapterRunnerError("normalization_failed");
  }
  return collectionResult.data;
}
