#!/usr/bin/env node

import { mkdir, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

const behavior = process.argv[2] ?? "clean";
const outputDirectory = process.env.CHANGE_TRACE_CI_OUTPUT_DIRECTORY;

if (!outputDirectory) {
  process.exitCode = 64;
} else if (behavior === "timeout") {
  setInterval(() => {}, 1_000);
} else {
  const report = {
    schemaVersion: "1.0.0",
    id: "report:fixture",
    createdAt: "2026-01-02T03:04:05.000Z",
    bundleId: "bundle:fixture",
    reviewMeta: { reviewer: "fixture-host" },
    findings: { confirmed: [], suspected: [], inconclusive: [] },
    rejectedFindings: [],
    missingEvidence: [],
    evidenceCoverage: {
      totalEvidenceItems: 0,
      referencedEvidenceIds: [],
      unreferencedEvidenceIds: [],
    },
    validationSummary: { submitted: 0, valid: 0, rejected: 0, warnings: 0 },
    bundleLimits: { maxEvidenceItems: 1, maxTotalExcerptCharacters: 1 },
    bundleTruncation: {
      isTruncated: false,
      omittedEvidenceItems: 0,
      omittedExcerptCharacters: 0,
      omittedMissingEvidence: 0,
    },
    warnings: [],
  };

  if (behavior === "findings" || behavior === "mixed") {
    report.findings.confirmed.push({ id: "finding:confirmed", status: "confirmed" });
    report.validationSummary = { submitted: 1, valid: 1, rejected: 0, warnings: 0 };
  }
  if (behavior === "inconclusive" || behavior === "mixed") {
    report.findings.inconclusive.push({ id: "finding:inconclusive", status: "inconclusive" });
    report.validationSummary = {
      submitted: report.findings.confirmed.length + 1,
      valid: report.findings.confirmed.length + 1,
      rejected: 0,
      warnings: 0,
    };
  }
  if (behavior === "rejected") {
    report.rejectedFindings.push({ index: 0, findingId: null, issues: [{ code: "fixture", path: "$", message: "fixture" }] });
    report.validationSummary = { submitted: 1, valid: 0, rejected: 1, warnings: 0 };
  }
  if (behavior === "missing") report.missingEvidence.push({
    source: { system: "fixture", locator: "fixture", uri: null },
    reason: "fixture",
    status: "not_found",
  });
  if (behavior === "truncated") report.bundleTruncation.isTruncated = true;
  if (behavior === "inconsistent") report.validationSummary.valid = 9;

  await mkdir(outputDirectory, { recursive: true });
  if (behavior !== "missing-files") {
    await writeFile(join(outputDirectory, "release-review.md"), "# Fixture review\n", "utf8");
    await writeFile(
      join(outputDirectory, "release-review.json"),
      behavior === "malformed" ? "{bad json\n" : `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
  }
  if (behavior === "secret-output") {
    process.stdout.write("HOST_SECRET=top-secret prompt=evidence /private/path\n");
    process.stderr.write("HOST_SECRET=top-secret credentials=token\n");
    process.exitCode = 7;
  }
  if (behavior === "large-output") {
    process.stdout.write("x".repeat(512 * 1024));
    process.stderr.write("y".repeat(512 * 1024));
    process.exitCode = 7;
  }
  if (behavior === "fixed-timestamps") {
    const timestamp = new Date("2001-02-03T04:05:06.000Z");
    await utimes(join(outputDirectory, "release-review.md"), timestamp, timestamp);
    await utimes(join(outputDirectory, "release-review.json"), timestamp, timestamp);
  }
  if (behavior === "ignore-term") {
    process.on("SIGTERM", () => {});
    setInterval(() => {}, 1_000);
  }
  if (behavior === "nonzero") process.exitCode = 7;
}
