import { constants } from "node:fs";
import {
  chmod,
  mkdtemp,
  mkdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ExternalAdapterConfigurationError,
  loadExternalAdaptersFile,
  loadExternalAdaptersFromEnvironment,
} from "../../src/evidence/external/load-external-adapters.js";
import { createServer } from "../../src/server.js";
import {
  CORE_SCHEMA_VERSION,
  externalAdapterConfigurationSchema,
  type ExternalAdapterRegistration,
} from "../../src/schemas/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), "change-trace-m5-config-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

function registration(
  id = "adapter:fixture",
): ExternalAdapterRegistration {
  return {
    adapter: {
      id,
      name: "Fixture adapter",
      version: "1.0.0",
    },
    argv: [process.execPath, "fixture-adapter.mjs", "secret-argv-sentinel"],
    sourceSystems: ["lark"],
    credentialEnvironmentNames: ["M5_FIXTURE_CREDENTIAL"],
    limits: {
      timeoutMilliseconds: 2_000,
      stdoutBytes: 128_000,
      stderrBytes: 16_000,
    },
  };
}

function configuration(
  adapters: ExternalAdapterRegistration[] = [],
): {
  schemaVersion: typeof CORE_SCHEMA_VERSION;
  adapters: ExternalAdapterRegistration[];
} {
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    adapters,
  };
}

async function expectConfigurationError(
  promise: Promise<unknown>,
  code: ExternalAdapterConfigurationError["code"],
  forbidden: string[] = [],
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ExternalAdapterConfigurationError);
    const configurationError =
      error as ExternalAdapterConfigurationError;
    expect(configurationError.code).toBe(code);
    const publicError = `${configurationError.name} ${configurationError.message} ${JSON.stringify(configurationError)}`;
    expect(publicError.length).toBeLessThan(500);
    for (const value of forbidden) {
      expect(publicError).not.toContain(value);
    }
    return;
  }
  throw new Error("Expected external adapter configuration to reject");
}

describe("external adapter registration configuration", () => {
  it("uses no adapters when the discovery environment variable is absent", async () => {
    await expect(
      loadExternalAdaptersFromEnvironment({}),
    ).resolves.toEqual([]);
  });

  it("loads valid empty and populated strict configuration files", async () => {
    const directory = await temporaryDirectory();
    const emptyPath = join(directory, "empty.json");
    const populatedPath = join(directory, "populated.json");
    await writeFile(emptyPath, JSON.stringify(configuration()), "utf8");
    await writeFile(
      populatedPath,
      JSON.stringify(configuration([registration()])),
      "utf8",
    );

    await expect(loadExternalAdaptersFile(emptyPath)).resolves.toEqual([]);
    await expect(
      loadExternalAdaptersFromEnvironment({
        CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE: populatedPath,
      }),
    ).resolves.toEqual([registration()]);
    expect(
      externalAdapterConfigurationSchema.parse(
        configuration([registration()]),
      ),
    ).toEqual(configuration([registration()]));
  });

  it("rejects invalid paths and unreadable or missing files without exposing paths", async () => {
    const directory = await temporaryDirectory();
    const missingPath = join(
      directory,
      "credential-path-secret-sentinel.json",
    );

    await expectConfigurationError(
      loadExternalAdaptersFromEnvironment({
        CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE: "",
      }),
      "configuration_path_invalid",
    );
    await expectConfigurationError(
      loadExternalAdaptersFile(missingPath),
      "configuration_read_failed",
      [missingPath, "credential-path-secret-sentinel"],
    );
  });

  it("rejects symbolic links, directories, and oversized files", async () => {
    const directory = await temporaryDirectory();
    const targetPath = join(directory, "target.json");
    const linkPath = join(directory, "link.json");
    const nestedDirectory = join(directory, "nested");
    const oversizedPath = join(directory, "oversized.json");
    await writeFile(targetPath, JSON.stringify(configuration()), "utf8");
    await symlink(targetPath, linkPath, "file");
    await mkdir(nestedDirectory);
    await writeFile(oversizedPath, Buffer.alloc(262_145, 0x20));

    await expectConfigurationError(
      loadExternalAdaptersFile(linkPath),
      "configuration_file_unsafe",
      [linkPath, targetPath],
    );
    await expectConfigurationError(
      loadExternalAdaptersFile(nestedDirectory),
      "configuration_file_unsafe",
      [nestedDirectory],
    );
    await expectConfigurationError(
      loadExternalAdaptersFile(oversizedPath),
      "configuration_file_too_large",
      [oversizedPath],
    );
  });

  it("rejects invalid UTF-8, malformed JSON, unknown fields, and duplicate IDs safely", async () => {
    const directory = await temporaryDirectory();
    const invalidUtf8Path = join(directory, "invalid-utf8.json");
    const invalidJsonPath = join(directory, "invalid-json.json");
    const strictPath = join(directory, "strict.json");
    const duplicatePath = join(directory, "duplicate.json");
    await writeFile(invalidUtf8Path, Buffer.from([0x7b, 0xc3, 0x28, 0x7d]));
    await writeFile(
      invalidJsonPath,
      '{"secret-content-sentinel":',
      "utf8",
    );
    await writeFile(
      strictPath,
      JSON.stringify({
        ...configuration(),
        credentialValue: "credential-value-secret-sentinel",
      }),
      "utf8",
    );
    await writeFile(
      duplicatePath,
      JSON.stringify(configuration([registration(), registration()])),
      "utf8",
    );

    await expectConfigurationError(
      loadExternalAdaptersFile(invalidUtf8Path),
      "configuration_encoding_invalid",
      [invalidUtf8Path],
    );
    await expectConfigurationError(
      loadExternalAdaptersFile(invalidJsonPath),
      "configuration_json_invalid",
      [invalidJsonPath, "secret-content-sentinel"],
    );
    await expectConfigurationError(
      loadExternalAdaptersFile(strictPath),
      "configuration_schema_invalid",
      [
        strictPath,
        "credentialValue",
        "credential-value-secret-sentinel",
      ],
    );
    await expectConfigurationError(
      loadExternalAdaptersFile(duplicatePath),
      "configuration_adapter_id_duplicate",
      [
        duplicatePath,
        "secret-argv-sentinel",
        "M5_FIXTURE_CREDENTIAL",
      ],
    );
    expect(() =>
      externalAdapterConfigurationSchema.parse(
        configuration([registration(), registration()]),
      ),
    ).toThrow();
  });

  it("rejects more than sixteen adapters and invalid programmatic registrations before server use", async () => {
    const directory = await temporaryDirectory();
    const configPath = join(directory, "too-many.json");
    await writeFile(
      configPath,
      JSON.stringify(
        configuration(
          Array.from({ length: 17 }, (_, index) =>
            registration(`adapter:${index}`),
          ),
        ),
      ),
      "utf8",
    );

    await expectConfigurationError(
      loadExternalAdaptersFile(configPath),
      "configuration_schema_invalid",
      [configPath],
    );
    expect(() =>
      createServer({
        externalAdapters: [registration(), registration()],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "configuration_adapter_id_duplicate",
      }),
    );
    expect(() =>
      createServer({
        externalAdapters: [
          {
            ...registration(),
            credentialValue: "programmatic-credential-secret",
          } as ExternalAdapterRegistration,
        ],
      }),
    ).toThrowError(
      expect.objectContaining({ code: "configuration_schema_invalid" }),
    );
  });

  it("maps a real permission denial to the stable read error when the platform enforces it", async () => {
    if (process.platform === "win32" || typeof constants.S_IRUSR !== "number") {
      return;
    }
    const directory = await temporaryDirectory();
    const configPath = join(directory, "permission.json");
    await writeFile(configPath, JSON.stringify(configuration()), "utf8");
    await chmod(configPath, 0);

    try {
      await expectConfigurationError(
        loadExternalAdaptersFile(configPath),
        "configuration_read_failed",
        [configPath],
      );
    } finally {
      await chmod(configPath, constants.S_IRUSR | constants.S_IWUSR);
    }
  });
});
