import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

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
});
