import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

import {
  MAX_EXTERNAL_ADAPTER_REGISTRATIONS,
  externalAdapterConfigurationSchema,
  externalAdapterRegistrationSchema,
  type ExternalAdapterRegistration,
} from "../../schemas/index.js";

export const MAX_EXTERNAL_ADAPTER_CONFIGURATION_BYTES = 262_144;
export const EXTERNAL_ADAPTER_CONFIGURATION_ENVIRONMENT_NAME =
  "CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE";

export const EXTERNAL_ADAPTER_CONFIGURATION_ERROR_CODES = [
  "configuration_path_invalid",
  "configuration_read_failed",
  "configuration_file_unsafe",
  "configuration_file_too_large",
  "configuration_encoding_invalid",
  "configuration_json_invalid",
  "configuration_schema_invalid",
  "configuration_adapter_id_duplicate",
] as const;

export type ExternalAdapterConfigurationErrorCode =
  (typeof EXTERNAL_ADAPTER_CONFIGURATION_ERROR_CODES)[number];

const ERROR_MESSAGES: Readonly<
  Record<ExternalAdapterConfigurationErrorCode, string>
> = {
  configuration_path_invalid:
    "External adapter configuration path is invalid.",
  configuration_read_failed:
    "External adapter configuration could not be read.",
  configuration_file_unsafe:
    "External adapter configuration file is unsafe.",
  configuration_file_too_large:
    "External adapter configuration file exceeds its byte limit.",
  configuration_encoding_invalid:
    "External adapter configuration encoding is invalid.",
  configuration_json_invalid:
    "External adapter configuration JSON is invalid.",
  configuration_schema_invalid:
    "External adapter configuration schema is invalid.",
  configuration_adapter_id_duplicate:
    "External adapter configuration contains a duplicate adapter ID.",
};

export class ExternalAdapterConfigurationError extends Error {
  readonly code: ExternalAdapterConfigurationErrorCode;

  constructor(code: ExternalAdapterConfigurationErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ExternalAdapterConfigurationError";
    this.code = code;
  }
}

function isConfigurationError(
  error: unknown,
): error is ExternalAdapterConfigurationError {
  return error instanceof ExternalAdapterConfigurationError;
}

function validatePath(path: string): void {
  if (
    path.length === 0 ||
    path.length > 4_096 ||
    path.includes("\0")
  ) {
    throw new ExternalAdapterConfigurationError(
      "configuration_path_invalid",
    );
  }
}

function validateUniqueAdapterIds(
  registrations: readonly ExternalAdapterRegistration[],
): void {
  const adapterIds = new Set<string>();
  for (const registration of registrations) {
    if (adapterIds.has(registration.adapter.id)) {
      throw new ExternalAdapterConfigurationError(
        "configuration_adapter_id_duplicate",
      );
    }
    adapterIds.add(registration.adapter.id);
  }
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

export function validateExternalAdapterRegistrations(
  registrations: readonly ExternalAdapterRegistration[],
): ExternalAdapterRegistration[] {
  const result = externalAdapterRegistrationSchema
    .array()
    .max(MAX_EXTERNAL_ADAPTER_REGISTRATIONS)
    .safeParse(registrations);
  if (!result.success) {
    throw new ExternalAdapterConfigurationError(
      "configuration_schema_invalid",
    );
  }
  validateUniqueAdapterIds(result.data);
  return result.data;
}

async function readBoundedRegularFile(path: string): Promise<Buffer> {
  let pathStat;
  try {
    pathStat = await lstat(path);
  } catch {
    throw new ExternalAdapterConfigurationError(
      "configuration_read_failed",
    );
  }

  if (pathStat.isSymbolicLink() || !pathStat.isFile()) {
    throw new ExternalAdapterConfigurationError(
      "configuration_file_unsafe",
    );
  }
  if (pathStat.size > MAX_EXTERNAL_ADAPTER_CONFIGURATION_BYTES) {
    throw new ExternalAdapterConfigurationError(
      "configuration_file_too_large",
    );
  }

  let handle;
  try {
    const noFollow = constants.O_NOFOLLOW ?? 0;
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    throw new ExternalAdapterConfigurationError(
      code === "ELOOP"
        ? "configuration_file_unsafe"
        : "configuration_read_failed",
    );
  }

  try {
    const openedStat = await handle.stat();
    if (
      !openedStat.isFile() ||
      !sameFileIdentity(openedStat, pathStat)
    ) {
      throw new ExternalAdapterConfigurationError(
        "configuration_file_unsafe",
      );
    }
    if (openedStat.size > MAX_EXTERNAL_ADAPTER_CONFIGURATION_BYTES) {
      throw new ExternalAdapterConfigurationError(
        "configuration_file_too_large",
      );
    }

    const buffer = Buffer.alloc(
      MAX_EXTERNAL_ADAPTER_CONFIGURATION_BYTES + 1,
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
    if (totalBytes > MAX_EXTERNAL_ADAPTER_CONFIGURATION_BYTES) {
      throw new ExternalAdapterConfigurationError(
        "configuration_file_too_large",
      );
    }

    const finalStat = await handle.stat();
    let finalPathStat;
    try {
      finalPathStat = await lstat(path);
    } catch {
      throw new ExternalAdapterConfigurationError(
        "configuration_file_unsafe",
      );
    }
    if (
      !finalStat.isFile() ||
      !sameFileIdentity(finalStat, openedStat) ||
      finalPathStat.isSymbolicLink() ||
      !finalPathStat.isFile() ||
      !sameFileIdentity(finalPathStat, finalStat) ||
      finalStat.size !== openedStat.size ||
      totalBytes !== finalStat.size
    ) {
      throw new ExternalAdapterConfigurationError(
        "configuration_file_unsafe",
      );
    }
    return buffer.subarray(0, totalBytes);
  } catch (error) {
    if (isConfigurationError(error)) {
      throw error;
    }
    throw new ExternalAdapterConfigurationError(
      "configuration_read_failed",
    );
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export async function loadExternalAdaptersFile(
  path: string,
): Promise<ExternalAdapterRegistration[]> {
  validatePath(path);
  const bytes = await readBoundedRegularFile(path);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ExternalAdapterConfigurationError(
      "configuration_encoding_invalid",
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new ExternalAdapterConfigurationError(
      "configuration_json_invalid",
    );
  }

  const result = externalAdapterConfigurationSchema.safeParse(input);
  if (!result.success) {
    if (
      result.error.issues.some(
        ({ message }) => message === "Adapter IDs must be unique",
      )
    ) {
      throw new ExternalAdapterConfigurationError(
        "configuration_adapter_id_duplicate",
      );
    }
    throw new ExternalAdapterConfigurationError(
      "configuration_schema_invalid",
    );
  }
  validateUniqueAdapterIds(result.data.adapters);
  return result.data.adapters;
}

export async function loadExternalAdaptersFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<ExternalAdapterRegistration[]> {
  const path =
    environment[EXTERNAL_ADAPTER_CONFIGURATION_ENVIRONMENT_NAME];
  if (path === undefined) {
    return [];
  }
  return loadExternalAdaptersFile(path);
}
