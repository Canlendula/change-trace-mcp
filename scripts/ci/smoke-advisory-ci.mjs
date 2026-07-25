#!/usr/bin/env node

import { lstat, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const outputDirectory = join(repositoryRoot, "artifacts", "advisory-ci-smoke");
const runner = join(repositoryRoot, "scripts", "ci", "advisory-runner.mjs");
const host = join(repositoryRoot, "tests", "fixtures", "ci", "fixture-host.mjs");

await mkdir(outputDirectory, { recursive: true });

const exitCode = await new Promise((resolveExit) => {
  const child = spawn(process.execPath, [runner], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      CHANGE_TRACE_CI_COMMAND: JSON.stringify([process.execPath, host, "clean"]),
      CHANGE_TRACE_CI_REPOSITORY_ROOT: repositoryRoot,
      CHANGE_TRACE_CI_OUTPUT_DIRECTORY: "artifacts/advisory-ci-smoke",
      CHANGE_TRACE_CI_HOST_ID: "generic-smoke-host",
      CHANGE_TRACE_CI_RUN_ATTEMPT: "1",
    },
    shell: false,
    stdio: "inherit",
  });
  child.once("error", () => resolveExit(1));
  child.once("close", (code) => resolveExit(code ?? 1));
});
if (exitCode !== 0) throw new Error("advisory runner smoke failed");

for (const name of ["release-review.md", "release-review.json", "release-review-status.json"]) {
  const artifact = join(outputDirectory, name);
  const stat = await lstat(artifact);
  if (!stat.isFile() || stat.size === 0) throw new Error("advisory runner smoke artifact missing");
}
const status = JSON.parse(await readFile(join(outputDirectory, "release-review-status.json"), "utf8"));
if (status.outcome !== "completed_no_findings") throw new Error("advisory runner smoke outcome invalid");
process.stdout.write("change-trace-advisory smoke=ok\n");
