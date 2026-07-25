#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const host = join(root, "scripts", "ci", "opencode-advisory-host.mjs");
const fixture = join(root, "tests", "fixtures", "ci", "opencode-host-fixture.mjs");
const workspace = await mkdtemp(join(tmpdir(), "change-trace-opencode-smoke-"));
try {
  const trusted = root;
  const subject = join(workspace, "subject");
  const output = join(subject, "artifacts", "review");
  const observed = join(workspace, "observation.json");
  await mkdir(output, { recursive: true });
  await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [host], { cwd: trusted, env: {
      PATH: process.env.PATH, CHANGE_TRACE_TRUSTED_TOOLING_ROOT: trusted,
      CHANGE_TRACE_CI_REPOSITORY_ROOT: subject, CHANGE_TRACE_CI_OUTPUT_DIRECTORY: output,
      CHANGE_TRACE_CI_BASE_REVISION: "a".repeat(40), CHANGE_TRACE_CI_HEAD_REVISION: "b".repeat(40),
      CHANGE_TRACE_CI_RUN_ATTEMPT: "1", CHANGE_TRACE_OPENCODE_BIN: process.execPath,
      CHANGE_TRACE_TEST_OPENCODE_ENTRY: fixture, CHANGE_TRACE_TEST_OBSERVATION: observed, GITHUB_MODELS_TOKEN: "smoke-sentinel",
    }, stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolveRun() : reject(new Error("host failed")));
  });
  const result = JSON.parse(await readFile(observed, "utf8"));
  if (result.config.enabled_providers?.join() !== "github_models" || result.config.permission?.["change_trace_*"] !== "allow" || JSON.stringify(result.config).includes("smoke-sentinel")) throw new Error("unsafe Host configuration");
  process.stdout.write("change-trace-opencode-host smoke passed\n");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
