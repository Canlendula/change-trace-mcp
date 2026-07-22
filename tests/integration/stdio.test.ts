import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

import { materializeGitFixture } from "../helpers/git-fixture.js";

const basicFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/basic-change", import.meta.url),
);

describe("stdio MCP server", () => {
  it("initializes, lists tools, and returns the stable fixture", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(process.cwd(), "dist/cli.js")],
      stderr: "pipe",
    });
    const client = new Client({
      name: "change-trace-mcp-integration-test",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);

      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual([
        "get_change_scope",
        "get_compatibility_fixture",
        "get_server_info",
      ]);
      expect(
        tools.every(
          (tool) =>
            tool.annotations?.readOnlyHint === true &&
            tool.annotations.destructiveHint === false &&
            tool.annotations.idempotentHint === true &&
            tool.annotations.openWorldHint === false,
        ),
      ).toBe(true);

      const first = await client.callTool({
        name: "get_compatibility_fixture",
        arguments: {},
      });
      const second = await client.callTool({
        name: "get_compatibility_fixture",
        arguments: {},
      });

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        structuredContent: {
          schemaVersion: "1.0.0",
          fixtureId: "m1-host-compatibility",
          ok: true,
        },
      });
    } finally {
      await client.close();
    }
  });

  it("calls get_change_scope over stdio for a real Git fixture", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(process.cwd(), "dist/cli.js")],
      stderr: "pipe",
    });
    const client = new Client({
      name: "change-trace-mcp-change-scope-test",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);
      const result = await client.callTool({
        name: "get_change_scope",
        arguments: {
          repositoryPath: fixture.repositoryPath,
          baseRef: fixture.baseObjectId,
          headRef: fixture.headObjectId,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result).toMatchObject({
        structuredContent: {
          schemaVersion: "1.0.0",
          resolvedBase: fixture.baseObjectId,
          resolvedHead: fixture.headObjectId,
          truncation: {
            isTruncated: false,
          },
        },
      });
    } finally {
      await client.close();
      await fixture.cleanup();
    }
  });
});
