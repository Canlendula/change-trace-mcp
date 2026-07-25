import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  CORE_SCHEMA_VERSION,
  type ExternalAdapterRegistration,
  type ExternalAdapterRequest,
} from "../../src/schemas/index.js";

const fixturePath = fileURLToPath(
  new URL("../fixtures/external-adapter/fixture-adapter.mjs", import.meta.url),
);
const execFileAsync = promisify(execFile);
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
    join(tmpdir(), "change-trace-m5-stdio-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

function registration(
  mode: string,
  extraArgv: string[] = [],
  overrides: Partial<ExternalAdapterRegistration> = {},
): ExternalAdapterRegistration {
  return {
    adapter: {
      id: "adapter:fixture",
      name: "Fixture adapter",
      version: "1.0.0",
    },
    argv: [process.execPath, fixturePath, mode, ...extraArgv],
    sourceSystems: ["lark"],
    credentialEnvironmentNames: [],
    limits: {
      timeoutMilliseconds: 2_000,
      stdoutBytes: 128_000,
      stderrBytes: 16_000,
    },
    ...overrides,
  };
}

function request(
  adapterId = "adapter:fixture",
): ExternalAdapterRequest {
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    adapterId,
    references: [
      {
        requestId: "request:stdio",
        sourceType: "document",
        source: {
          system: "lark",
          locator: "document:stdio",
          uri: "https://example.larksuite.com/docx/stdio",
        },
        relatedChangeIds: ["file:src/example.ts"],
        relationReason: "Explicit requirement for the changed file.",
      },
    ],
  };
}

async function writeConfiguration(
  directory: string,
  adapters: ExternalAdapterRegistration[],
): Promise<string> {
  const configPath = join(directory, "external-adapters.json");
  await writeFile(
    configPath,
    JSON.stringify({
      schemaVersion: CORE_SCHEMA_VERSION,
      adapters,
    }),
    "utf8",
  );
  return configPath;
}

async function connectWithConfiguration(
  configPath: string,
  extraEnvironment: Record<string, string> = {},
): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(process.cwd(), "dist/cli.js")],
    env: {
      ...getDefaultEnvironment(),
      ...extraEnvironment,
      CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE: configPath,
    },
    stderr: "pipe",
  });
  const client = new Client({
    name: "change-trace-m5-external-evidence-test",
    version: "1.0.0",
  });
  await client.connect(transport);
  return { client, transport };
}

describe("collect_external_evidence over stdio", () => {
  it("is always discoverable with an open-world read-only contract and no configuration input", async () => {
    const directory = await temporaryDirectory();
    const configPath = await writeConfiguration(directory, []);
    const { client } = await connectWithConfiguration(configPath);

    try {
      const { tools } = await client.listTools();
      const tool = tools.find(
        ({ name }) => name === "collect_external_evidence",
      );
      expect(tool).toBeDefined();
      expect(tool?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
      expect(tool?.description).toContain("untrusted");
      expect(tool?.description).toContain("explicit");
      expect(tool?.description).toContain(
        "does not provide source discovery",
      );
      expect(Object.keys(tool?.inputSchema.properties ?? {}).sort()).toEqual([
        "adapterId",
        "references",
        "schemaVersion",
      ]);
      const serializedSchema = JSON.stringify(tool?.inputSchema);
      for (const forbidden of [
        "argv",
        "credential",
        "environment",
        "trustLevel",
        "searchQuery",
      ]) {
        expect(serializedSchema).not.toContain(forbidden);
      }
    } finally {
      await client.close();
    }
  });

  it("collects normalized untrusted evidence through the configured exact adapter", async () => {
    const directory = await temporaryDirectory();
    const configPath = await writeConfiguration(directory, [
      registration("injection-secret"),
    ]);
    const { client } = await connectWithConfiguration(configPath);

    try {
      await rm(configPath);
      const result = await client.callTool({
        name: "collect_external_evidence",
        arguments: request(),
      });

      expect(result.isError).not.toBe(true);
      expect(result).toMatchObject({
        structuredContent: {
          schemaVersion: CORE_SCHEMA_VERSION,
          adapter: registration("success").adapter,
          evidenceItems: [
            {
              type: "document",
              trustLevel: "untrusted_external",
              selectionReason:
                "Explicit requirement for the changed file.",
              relatedChangeIds: ["file:src/example.ts"],
              externalProvenance: {
                adapter: registration("success").adapter,
                sourceType: "document",
                title: "Title for request:stdio",
                sourceUpdatedAt: "2026-07-25T10:00:00.000Z",
              },
            },
          ],
          missingEvidence: [],
        },
      });
      const serialized = JSON.stringify(result);
      expect(serialized).toContain("api_key=[REDACTED]");
      expect(serialized).not.toContain("excerpt-secret-sentinel");
      for (const forbidden of [
        fixturePath,
        "argv",
        "credentialEnvironmentNames",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    } finally {
      await client.close();
    }
  });

  it("returns a bounded error and does not execute a process for an unknown adapter ID", async () => {
    const directory = await temporaryDirectory();
    const executionCapture = join(directory, "must-not-exist.json");
    const configPath = await writeConfiguration(directory, [
      registration("env-capture", [executionCapture]),
    ]);
    const { client } = await connectWithConfiguration(configPath);

    try {
      const result = await client.callTool({
        name: "collect_external_evidence",
        arguments: request("adapter:unknown"),
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(result.content).toEqual([
        {
          type: "text",
          text: JSON.stringify({
            error: "collect_external_evidence_failed",
            code: "adapter_not_configured",
          }),
        },
      ]);
      expect(existsSync(executionCapture)).toBe(false);
    } finally {
      await client.close();
    }
  });

  it("projects runner failures to safe codes without config, argv, environment, credential, or stderr data", async () => {
    const directory = await temporaryDirectory();
    const configPath = await writeConfiguration(directory, [
      registration("nonzero", ["argv-secret-sentinel"], {
        credentialEnvironmentNames: ["M5_STDIO_SECRET"],
      }),
    ]);
    const { client } = await connectWithConfiguration(configPath, {
      M5_STDIO_SECRET: "credential-value-secret-sentinel",
    });

    try {
      const result = await client.callTool({
        name: "collect_external_evidence",
        arguments: request(),
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(result.content).toEqual([
        {
          type: "text",
          text: JSON.stringify({
            error: "collect_external_evidence_failed",
            code: "nonzero_exit",
          }),
        },
      ]);
      const serialized = JSON.stringify(result);
      for (const forbidden of [
        configPath,
        fixturePath,
        "argv-secret-sentinel",
        "M5_STDIO_SECRET",
        "credential-value-secret-sentinel",
        "nonzero-stream-sentinel",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    } finally {
      await client.close();
    }
  });

  it("reports startup configuration failures without logging path or file content", async () => {
    const directory = await temporaryDirectory();
    const configPath = join(
      directory,
      "startup-path-secret-sentinel.json",
    );
    await writeFile(
      configPath,
      '{"startup-content-secret-sentinel":',
      "utf8",
    );

    try {
      await execFileAsync(
        process.execPath,
        [resolve(process.cwd(), "dist/cli.js")],
        {
          env: {
            ...process.env,
            CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE: configPath,
          },
          timeout: 5_000,
        },
      );
      throw new Error("Expected CLI startup to reject invalid JSON");
    } catch (error) {
      const failure = error as {
        code?: number | string;
        stderr?: string;
      };
      expect(failure.code).toBe(1);
      expect(failure.stderr).toContain("server_failed");
      expect(failure.stderr).toContain(
        "External adapter configuration JSON is invalid.",
      );
      expect(failure.stderr).not.toContain(configPath);
      expect(failure.stderr).not.toContain(
        "startup-content-secret-sentinel",
      );
      expect(failure.stderr?.length).toBeLessThan(1_000);
    }
  });
});
