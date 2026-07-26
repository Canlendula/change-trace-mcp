#!/usr/bin/env node

// Public mechanics-only fixture. It writes a fixed no-findings report pair to
// the runner-provided output directory. It intentionally has no network,
// Git, model, credential, or subject-checkout behavior.
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

const outputDirectory = process.env.CHANGE_TRACE_CI_OUTPUT_DIRECTORY;
if (typeof outputDirectory !== "string" || !isAbsolute(outputDirectory)) {
  process.exitCode = 1;
} else {
  const report = {
    schemaVersion: "1.0.0",
    id: "deterministic-advisory-report",
    bundleId: "deterministic-advisory-bundle",
    createdAt: "2026-01-01T00:00:00.000Z",
    reviewMeta: { reviewer: "deterministic-public-fixture" },
    findings: { confirmed: [], suspected: [], inconclusive: [] },
    rejectedFindings: [],
    missingEvidence: [],
    evidenceSources: [],
    evidenceCoverage: { totalEvidenceItems: 0, referencedEvidenceIds: [], unreferencedEvidenceIds: [] },
    validationSummary: { submitted: 0, valid: 0, rejected: 0, warnings: 0 },
    bundleLimits: { maxEvidenceItems: 1, maxTotalExcerptCharacters: 1 },
    bundleTruncation: { isTruncated: false, omittedEvidenceItems: 0, omittedExcerptCharacters: 0, omittedMissingEvidence: 0 },
    warnings: [],
  };
  const markdown = "# Deterministic advisory fixture\n\nThis mechanics-only fixture reports no findings.\n";
  await writeFile(join(outputDirectory, "release-review.md"), markdown, "utf8");
  await writeFile(join(outputDirectory, "release-review.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
