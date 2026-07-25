import { readFile, writeFile } from "node:fs/promises";

const configPath = process.env.OPENCODE_CONFIG;
const observationPath = process.env.CHANGE_TRACE_TEST_OBSERVATION;
if (!configPath || !observationPath) process.exit(2);
if (process.env.CHANGE_TRACE_TEST_HANG === "1") setInterval(() => {}, 1_000);

const argumentsFromHost = process.argv.slice(2);
const prompt = argumentsFromHost.at(-1);
const config = JSON.parse(await readFile(configPath, "utf8"));
await writeFile(observationPath, JSON.stringify({
  cwd: process.cwd(),
  arguments: argumentsFromHost,
  environment: { OPENCODE_CONFIG: configPath },
  config,
  prompt,
}));
