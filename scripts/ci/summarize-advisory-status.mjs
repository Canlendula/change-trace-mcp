#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const allowedOutcomes = new Set(["infrastructure_failure", "inconclusive", "completed_with_findings", "completed_no_findings"]);
const revision = /^(?:[a-f0-9]{7,64}|HEAD)$/;
const hash = /^sha256:[a-f0-9]{64}$/;

function count(value) { return Number.isInteger(value) && value >= 0 && value <= 1_000_000; }
function reportArtifact(artifact, name) {
  return artifact && artifact.name === name && Number.isInteger(artifact.sizeBytes) && artifact.sizeBytes >= 0 && artifact.sizeBytes <= 10 * 1024 * 1024 && hash.test(artifact.sha256);
}

try {
  const status = JSON.parse(await readFile(process.argv[2], "utf8"));
  if (!allowedOutcomes.has(status.outcome) || !Number.isInteger(status.run?.runAttempt) || status.run.runAttempt < 1 || !revision.test(status.run.baseRevision ?? "HEAD") || !revision.test(status.run.headRevision ?? "HEAD") || !status.counts || !["confirmed", "suspected", "inconclusive", "rejected", "missingEvidence"].every((key) => count(status.counts[key])) || typeof status.counts.bundleTruncated !== "boolean" || !reportArtifact(status.artifacts?.markdown, "release-review.md") || !reportArtifact(status.artifacts?.json, "release-review.json") || status.artifacts?.status?.name !== "release-review-status.json") throw new Error("invalid_status");
  const artifactLines = [
    `- ${status.artifacts.markdown.name}: ${status.artifacts.markdown.sizeBytes} bytes, ${status.artifacts.markdown.sha256}`,
    `- ${status.artifacts.json.name}: ${status.artifacts.json.sizeBytes} bytes, ${status.artifacts.json.sha256}`,
    `- ${status.artifacts.status.name}`,
  ];
  process.stdout.write(`# Change Trace advisory review\n\n- outcome: ${status.outcome}\n- run attempt: ${status.run.runAttempt}\n- revisions: ${status.run.baseRevision ?? "null"} → ${status.run.headRevision ?? "null"}\n- findings: confirmed ${status.counts.confirmed}, suspected ${status.counts.suspected}, inconclusive ${status.counts.inconclusive}, rejected ${status.counts.rejected}\n- missing evidence: ${status.counts.missingEvidence}; bundle truncated: ${status.counts.bundleTruncated}\n${artifactLines.join("\n")}\n`);
} catch {
  process.stdout.write("# Change Trace advisory review\n\n- status summary unavailable\n");
}
