#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) process.exitCode = 2;
else {
  try {
    const score = JSON.parse(await readFile(path, "utf8"));
    if (!score || typeof score.model !== "string" || !Array.isArray(score.fixtures) || !score.aggregate) throw new Error("invalid");
    const lines = ["# GPT-4.1 quality spike", "", `- Gate: ${score.gatePassed === true ? "PASS" : "FAIL"}`, `- Stop reason: ${String(score.stopReason)}`, `- Requests: ${Number(score.requestCount)}`, `- Model: ${score.model}`, `- Fixtures: ${Number(score.aggregate.fixturesPassed)} passed / ${Number(score.aggregate.fixturesAttempted)} attempted`, `- Rejected findings: ${Number(score.aggregate.findingsRejected)}`];
    process.stdout.write(`${lines.join("\n")}\n`);
  } catch { process.stderr.write("Unable to summarize GPT-4.1 quality spike metadata.\n"); process.exitCode = 2; }
}
