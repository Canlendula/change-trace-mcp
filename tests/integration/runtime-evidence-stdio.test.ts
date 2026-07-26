import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

import { CORE_SCHEMA_VERSION } from "../../src/schemas/index.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

async function temporaryGitRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(
    join(tmpdir(), "change-trace-m6-stdio-"),
  );
  temporaryDirectories.push(repositoryPath);
  await execFileAsync("git", ["init", "--initial-branch=main"], {
    cwd: repositoryPath,
  });
  return repositoryPath;
}

async function connect(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(process.cwd(), "dist/cli.js")],
    stderr: "pipe",
  });
  const client = new Client({
    name: "change-trace-m6-runtime-evidence-test",
    version: "1.0.0",
  });
  await client.connect(transport);
  return client;
}

function manifest() {
  const summary = "api_key=stdio-secret-sentinel";
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    producer: {
      id: "producer:stdio",
      name: "stdio fixture",
      version: "1.0.0",
    },
    sourceFormat: "api_smoke",
    records: [
      {
        recordId: "record:api:stdio",
        kind: "api_observation",
        source: {
          system: "ci",
          locator: "runs/stdio",
          uri: null,
        },
        environment: {
          kind: "staging",
          name: "review-app",
          source: {
            system: "deployment",
            locator: "review-app",
            uri: "https://staging.example.test",
          },
        },
        relatedChangeIds: ["file:src/api.ts"],
        relatedEvidenceIds: ["evidence:requirement:api"],
        accessStatus: "available",
        outcome: "passed",
        startedAt: null,
        completedAt: null,
        durationMilliseconds: 25,
        summary,
        artifactReferences: [
          {
            system: "ci",
            locator: "missing-artifact-secret-sentinel",
            uri: "https://ci.example.test/missing-artifact",
          },
        ],
        truncation: {
          isTruncated: false,
          originalCharacters: summary.length,
          retainedCharacters: summary.length,
        },
      },
    ],
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("collect_runtime_evidence over stdio", () => {
  it("is always discoverable with the exact read-only closed-world contract", async () => {
    const client = await connect();
    try {
      const { tools } = await client.listTools();
      const tool = tools.find(
        ({ name }) => name === "collect_runtime_evidence",
      );
      expect(tool).toBeDefined();
      expect(tool?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(tool?.description).toContain(
        "one explicit pre-produced local manifest",
      );
      for (const excludedAction of [
        "does not run tests",
        "browsers",
        "probes",
        "artifact fetches",
      ]) {
        expect(tool?.description).toContain(excludedAction);
      }
      expect(Object.keys(tool?.inputSchema.properties ?? {}).sort()).toEqual([
        "manifestPath",
        "repositoryPath",
      ]);
      const serializedSchema = JSON.stringify(tool?.inputSchema);
      for (const forbidden of [
        "argv",
        "command",
        "credential",
        "environmentVariables",
        "outputPath",
        "trustLevel",
      ]) {
        expect(serializedSchema).not.toContain(forbidden);
      }
    } finally {
      await client.close();
    }
  });

  it("returns identical text and structured normalized evidence", async () => {
    const repositoryPath = await temporaryGitRepository();
    const targetDirectory = join(repositoryPath, "runtime");
    await mkdir(targetDirectory);
    await writeFile(
      join(targetDirectory, "manifest.json"),
      JSON.stringify(manifest()),
      "utf8",
    );
    const client = await connect();

    try {
      const result = await client.callTool({
        name: "collect_runtime_evidence",
        arguments: {
          repositoryPath,
          manifestPath: "runtime/manifest.json",
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        schemaVersion: CORE_SCHEMA_VERSION,
        producer: manifest().producer,
        evidenceItems: [
          {
            type: "runtime_observation",
            source: manifest().records[0]?.source,
            excerpt: "api_key=[REDACTED]",
            trustLevel: "observed_runtime",
            runtimeProvenance: {
              sourceFormat: "api_smoke",
              manifestRecordId: "record:api:stdio",
              kind: "api_observation",
              outcome: "passed",
              artifactReferences:
                manifest().records[0]?.artifactReferences,
            },
          },
        ],
        missingEvidence: [],
      });
      const content = result.content as Array<{
        type: string;
        text?: string;
      }>;
      const text = content.find((block) => block.type === "text");
      expect(text?.type).toBe("text");
      if (typeof text?.text === "string") {
        expect(JSON.parse(text.text)).toEqual(result.structuredContent);
      }
      expect(JSON.stringify(result)).not.toContain(
        "stdio-secret-sentinel",
      );
    } finally {
      await client.close();
    }
  });

  it("projects handled failures to only the stable error and code", async () => {
    const repositoryPath = await temporaryGitRepository();
    const targetDirectory = join(repositoryPath, "runtime");
    await mkdir(targetDirectory);
    await writeFile(
      join(targetDirectory, "stdio-path-secret-sentinel.json"),
      '{"stdio-content-secret-sentinel":',
      "utf8",
    );
    const client = await connect();

    try {
      const result = await client.callTool({
        name: "collect_runtime_evidence",
        arguments: {
          repositoryPath,
          manifestPath:
            "runtime/stdio-path-secret-sentinel.json",
        },
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(result.content).toEqual([
        {
          type: "text",
          text: JSON.stringify({
            error: "collect_runtime_evidence_failed",
            code: "manifest_json_invalid",
          }),
        },
      ]);
      const serialized = JSON.stringify(result);
      for (const forbidden of [
        repositoryPath,
        "stdio-path-secret-sentinel",
        "stdio-content-secret-sentinel",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    } finally {
      await client.close();
    }
  });
});
