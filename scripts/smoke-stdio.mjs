#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const EXPECTED_FIXTURE =
  '{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}';

const [command, ...args] = process.argv.slice(2);

if (command === undefined) {
  process.stderr.write(
    "Usage: node scripts/smoke-stdio.mjs <command> [args...]\n",
  );
  process.exitCode = 2;
} else {
  const transport = new StdioClientTransport({
    command,
    args,
    stderr: "pipe",
  });
  const client = new Client({
    name: "change-trace-mcp-smoke-client",
    version: "1.0.0",
  });

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    const toolNames = tools.map((tool) => tool.name).sort();
    const requiredTools = [
      "get_compatibility_fixture",
      "get_server_info",
    ];

    if (JSON.stringify(toolNames) !== JSON.stringify(requiredTools)) {
      throw new Error(`Unexpected tool list: ${JSON.stringify(toolNames)}`);
    }

    const result = await client.callTool({
      name: "get_compatibility_fixture",
      arguments: {},
    });
    const textBlock = result.content.find((block) => block.type === "text");

    if (textBlock?.type !== "text" || textBlock.text !== EXPECTED_FIXTURE) {
      throw new Error("Compatibility fixture did not match the expected bytes");
    }

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        command,
        args,
        tools: toolNames,
        fixture: JSON.parse(textBlock.text),
      })}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
