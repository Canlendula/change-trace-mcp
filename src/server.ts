import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import {
  createCompatibilityFixture,
  serializeCompatibilityFixture,
} from "./fixtures/compatibility.js";
import {
  collectChangeScope,
  getChangeScopeInputSchema,
} from "./git/change-scope.js";
import { changeScopeSchema } from "./schemas/change-scope.js";

const serverInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  transport: z.literal("stdio"),
  nodeVersion: z.string(),
  platform: z.string(),
  architecture: z.string(),
});

const compatibilityFixtureSchema = z.object({
  schemaVersion: z.string(),
  fixtureId: z.literal("m1-host-compatibility"),
  ok: z.literal(true),
  scalar: z.literal("change-trace"),
  values: z.tuple([z.literal(1), z.literal(2), z.literal(3)]),
  nested: z.object({
    alpha: z.literal("A"),
    beta: z.literal("B"),
  }),
});

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "get_server_info",
    {
      title: "Get server information",
      description:
        "Return diagnostic metadata for this Change Trace MCP process. Use this to verify host startup and runtime compatibility.",
      inputSchema: z.object({}),
      outputSchema: serverInfoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const result = {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        transport: "stdio" as const,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "get_compatibility_fixture",
    {
      title: "Get compatibility fixture",
      description:
        "Return a fixed, versioned JSON fixture. The same package version must return byte-identical text in every MCP Host.",
      inputSchema: z.object({}),
      outputSchema: compatibilityFixtureSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const result = createCompatibilityFixture();

      return {
        content: [
          {
            type: "text",
            text: serializeCompatibilityFixture(result),
          },
        ],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "get_change_scope",
    {
      title: "Get Git change scope",
      description:
        "Resolve two Git refs and return a deterministic, bounded summary of commits, changed files, diff excerpts, detected languages, truncation, and read errors. The repository path must be an explicit Git root.",
      inputSchema: getChangeScopeInputSchema,
      outputSchema: changeScopeSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = await collectChangeScope(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      } catch (error) {
        const result = {
          error: "get_change_scope_failed",
          message: error instanceof Error ? error.message : String(error),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: true,
        };
      }
    },
  );

  return server;
}
