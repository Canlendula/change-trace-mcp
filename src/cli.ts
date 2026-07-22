#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { writeLog } from "./logger.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    writeLog("info", "server_stopping", { signal });
    await server.close();
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await server.connect(transport);
  writeLog("info", "server_started", {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    transport: "stdio",
  });
}

main().catch((error: unknown) => {
  writeLog("error", "server_failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
