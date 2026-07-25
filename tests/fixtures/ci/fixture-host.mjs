#!/usr/bin/env node

import { mkdir, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

const behavior = process.argv[2] ?? "clean";
const outputDirectory = process.env.CHANGE_TRACE_CI_OUTPUT_DIRECTORY;

function coreEvidenceSource() {
  return {
    evidenceId: "evidence:fixture",
    type: "git_diff",
    source: {
      system: "fixture",
      locator: "src/fixture.ts",
      uri: null,
    },
    retrievedAt: "2026-01-02T03:04:05.000Z",
    contentHash: `sha256:${"a".repeat(64)}`,
    relatedChangeIds: ["change:fixture"],
    trustLevel: "trusted_repository",
    redactions: [{ kind: "secret", count: 1, note: "fixture redaction" }],
  };
}

function externalEvidenceSource() {
  return {
    ...coreEvidenceSource(),
    evidenceId: "evidence:external-fixture",
    type: "document",
    source: {
      system: "fixture-external",
      locator: "document:fixture",
      uri: "https://example.invalid/documents/fixture",
    },
    contentHash: null,
    trustLevel: "untrusted_external",
    redactions: [],
    externalProvenance: {
      adapter: {
        id: "adapter:fixture",
        name: "Fixture adapter",
        version: "1.0.0",
      },
      sourceType: "document",
      title: "Fixture document",
      sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

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
    evidenceSources: [],
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
  if (behavior === "evidence-source-core") report.evidenceSources = [coreEvidenceSource()];
  if (behavior === "evidence-source-external") report.evidenceSources = [externalEvidenceSource()];
  if (behavior === "missing-evidence-sources") delete report.evidenceSources;
  if (behavior === "malformed-evidence-source") {
    report.evidenceSources = [{ ...coreEvidenceSource(), type: "invalid" }];
  }
  if (behavior === "invalid-evidence-id") {
    report.evidenceSources = [{ ...coreEvidenceSource(), evidenceId: "invalid id" }];
  }
  if (behavior === "invalid-retrieved-at") {
    report.evidenceSources = [{ ...coreEvidenceSource(), retrievedAt: "2026-02-30T00:00:00.000Z" }];
  }
  if (behavior === "invalid-content-hash") {
    report.evidenceSources = [{ ...coreEvidenceSource(), contentHash: "sha256:invalid" }];
  }
  if (behavior === "invalid-related-change-id") {
    report.evidenceSources = [{ ...coreEvidenceSource(), relatedChangeIds: ["invalid id"] }];
  }
  if (behavior === "invalid-trust-level") {
    report.evidenceSources = [{ ...coreEvidenceSource(), trustLevel: "invalid" }];
  }
  if (behavior === "invalid-source-reference") {
    const evidence = coreEvidenceSource();
    evidence.source = { ...evidence.source, system: "" };
    report.evidenceSources = [evidence];
  }
  if (behavior === "invalid-redaction") {
    const evidence = coreEvidenceSource();
    evidence.redactions = [{
      kind: "secret",
      count: Number.MAX_SAFE_INTEGER + 1,
      note: null,
    }];
    report.evidenceSources = [evidence];
  }
  if (behavior === "invalid-external-provenance") {
    const evidence = externalEvidenceSource();
    evidence.externalProvenance = {
      ...evidence.externalProvenance,
      sourceType: "invalid",
    };
    report.evidenceSources = [evidence];
  }
  if (behavior === "unknown-evidence-source-field") {
    report.evidenceSources = [{ ...coreEvidenceSource(), unexpected: true }];
  }
  if (behavior === "unknown-evidence-source-source-field") {
    const evidence = coreEvidenceSource();
    evidence.source = { ...evidence.source, unexpected: true };
    report.evidenceSources = [evidence];
  }
  if (behavior === "unknown-redaction-field") {
    const evidence = coreEvidenceSource();
    evidence.redactions[0] = { ...evidence.redactions[0], unexpected: true };
    report.evidenceSources = [evidence];
  }
  if (behavior === "unknown-adapter-field") {
    const evidence = externalEvidenceSource();
    evidence.externalProvenance.adapter = {
      ...evidence.externalProvenance.adapter,
      unexpected: true,
    };
    report.evidenceSources = [evidence];
  }
  if (behavior === "unknown-provenance-field") {
    const evidence = externalEvidenceSource();
    evidence.externalProvenance = {
      ...evidence.externalProvenance,
      unexpected: true,
    };
    report.evidenceSources = [evidence];
  }
  if (behavior === "too-many-evidence-sources") {
    report.evidenceSources = Array.from({ length: 10_001 }, coreEvidenceSource);
  }
  if (behavior === "too-many-related-change-ids") {
    const evidence = coreEvidenceSource();
    evidence.relatedChangeIds = Array.from({ length: 1_001 }, (_, index) => `change:${index}`);
    report.evidenceSources = [evidence];
  }
  if (behavior === "too-many-redactions") {
    const evidence = coreEvidenceSource();
    evidence.redactions = Array.from(
      { length: 101 },
      () => ({ kind: "secret", count: 1, note: null }),
    );
    report.evidenceSources = [evidence];
  }
  if (behavior.startsWith("evidence-source-") || behavior.startsWith("invalid-") || [
    "malformed-evidence-source",
    "unknown-evidence-source-field",
    "unknown-evidence-source-source-field",
    "unknown-redaction-field",
    "unknown-adapter-field",
    "unknown-provenance-field",
    "too-many-evidence-sources",
    "too-many-related-change-ids",
    "too-many-redactions",
    "evidence-coverage-count-mismatch",
  ].includes(behavior)) {
    report.evidenceCoverage.totalEvidenceItems = report.evidenceSources.length;
    report.evidenceCoverage.unreferencedEvidenceIds = report.evidenceSources.map(
      (evidence) => evidence.evidenceId,
    );
  }
  if (behavior === "evidence-coverage-count-mismatch") {
    report.evidenceSources = [coreEvidenceSource()];
    report.evidenceCoverage.totalEvidenceItems = 0;
    report.evidenceCoverage.unreferencedEvidenceIds = [];
  }
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
