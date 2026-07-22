import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildReviewBundle } from "../../src/evidence/bundle/build-review-bundle.js";
import { collectLocalEvidence } from "../../src/evidence/local/collect-local-evidence.js";
import { validateFindings } from "../../src/findings/validate-findings.js";
import { collectChangeScope } from "../../src/git/change-scope.js";
import { findingValidationResultSchema } from "../../src/schemas/finding-validation.js";
import { materializeGitFixture } from "../helpers/git-fixture.js";

const basicFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/basic-change", import.meta.url),
);
const fixedNow = () => new Date("2026-07-22T18:00:00.000Z");

async function prepareBundle() {
  const fixture = await materializeGitFixture(basicFixtureDirectory);
  const changeScope = await collectChangeScope({
    repositoryPath: fixture.repositoryPath,
    baseRef: fixture.baseObjectId,
    headRef: fixture.headObjectId,
  });
  const localEvidence = await collectLocalEvidence(
    {
      scope: changeScope,
      documentRoots: ["docs"],
      filePatterns: ["**/*.md"],
    },
    { now: fixedNow },
  );
  const bundle = buildReviewBundle(
    { changeScope, localEvidence },
    { now: fixedNow },
  );
  return { fixture, bundle };
}

function validRawFinding(bundle: Awaited<ReturnType<typeof prepareBundle>>["bundle"]) {
  const evidence = bundle.evidenceItems[0]!;
  return {
    schemaVersion: "1.0.0",
    id: "finding:greeting-requirement",
    category: "Requirement-Missing",
    severity: "HIGH",
    confidence: 0.82,
    title: "Greeting requirement may be missing",
    expectedBehavior: "The greeting follows the documented format.",
    observedBehavior: "The implementation should be compared with the requirement.",
    deterministicFacts: [
      {
        statement: "A greeting requirement document was collected.",
        evidenceIds: [evidence.id],
      },
    ],
    inference: "The changed implementation may not satisfy the requirement.",
    evidenceIds: [evidence.id],
    affectedSources: [evidence.source],
    recommendation: "add/adjust tests",
    status: "Suspected",
  };
}

describe("validateFindings", () => {
  it("normalizes safe enum aliases and validates bundle references", async () => {
    const { fixture, bundle } = await prepareBundle();

    try {
      const input = { bundle, findings: [validRawFinding(bundle)] };
      const first = validateFindings(input);
      const second = validateFindings(input);

      expect(findingValidationResultSchema.parse(first)).toEqual(first);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first.ok).toBe(true);
      expect(first.validFindings).toHaveLength(1);
      expect(first.validFindings[0]).toMatchObject({
        category: "requirement_missing",
        severity: "high",
        recommendation: "add_or_adjust_tests",
        status: "suspected",
      });
      expect(first.warnings).toHaveLength(4);
      expect(first.warnings.every(({ code }) => code === "normalized_enum")).toBe(
        true,
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects unknown evidence and unsupported source references", async () => {
    const { fixture, bundle } = await prepareBundle();

    try {
      const finding = validRawFinding(bundle);
      finding.id = "finding:invalid-references";
      finding.evidenceIds = ["evidence:missing"];
      finding.deterministicFacts[0]!.evidenceIds = ["evidence:missing"];
      finding.affectedSources = [
        {
          system: "repository",
          locator: "docs/unknown.md",
          uri: null,
        },
      ];

      const result = validateFindings({ bundle, findings: [finding] });

      expect(result.ok).toBe(false);
      expect(result.validFindings).toEqual([]);
      expect(
        result.rejectedFindings[0]?.issues.map(({ code }) => code),
      ).toEqual(
        expect.arrayContaining([
          "unknown_evidence_id",
          "unsupported_source_reference",
        ]),
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects duplicate finding IDs and substantive findings without evidence", async () => {
    const { fixture, bundle } = await prepareBundle();

    try {
      const first = validRawFinding(bundle);
      const second = { ...validRawFinding(bundle) };
      const unsupported = {
        ...validRawFinding(bundle),
        id: "finding:no-evidence",
        evidenceIds: [],
        deterministicFacts: [],
        affectedSources: [],
        status: "confirmed",
      };

      const result = validateFindings({
        bundle,
        findings: [first, second, unsupported, "malformed"],
      });

      expect(result.ok).toBe(false);
      expect(result.summary).toMatchObject({
        submitted: 4,
        valid: 0,
        rejected: 4,
      });
      expect(
        result.rejectedFindings
          .flatMap(({ issues }) => issues)
          .map(({ code }) => code),
      ).toEqual(
        expect.arrayContaining([
          "duplicate_finding_id",
          "substantive_finding_without_evidence",
          "schema_validation",
        ]),
      );
    } finally {
      await fixture.cleanup();
    }
  });
});
