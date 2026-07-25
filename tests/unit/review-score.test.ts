import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  scoreReviewFixture,
  scoreReviewSuite,
} from "../helpers/review-score.js";
import {
  canonicalStringify,
  discoverReviewFixtures,
  loadReviewFixture,
  type LoadedReviewFixture,
} from "../helpers/review-fixture.js";

const reviewRoot = fileURLToPath(
  new URL("../fixtures/review", import.meta.url),
);

let fixtures: LoadedReviewFixture[];

beforeAll(async () => {
  fixtures = await Promise.all(
    (await discoverReviewFixtures(reviewRoot)).map(loadReviewFixture),
  );
});

function fixture(fixtureId: string): LoadedReviewFixture {
  const match = fixtures.find(
    (candidate) => candidate.descriptor.fixtureId === fixtureId,
  );
  if (!match) {
    throw new Error(`Missing fixture ${fixtureId}`);
  }
  return match;
}

function referenceResponses(): Record<string, unknown[]> {
  return Object.fromEntries(
    fixtures.map((loaded) => [
      loaded.descriptor.fixtureId,
      structuredClone(loaded.referenceFindings),
    ]),
  );
}

function fabricatedFinding(target: LoadedReviewFixture): Record<string, unknown> {
  const source = target.bundle.evidenceItems[0]?.source;
  const evidenceId = target.bundle.evidenceItems[0]?.id;
  if (!source || !evidenceId) {
    throw new Error(`Fixture ${target.descriptor.fixtureId} has no evidence`);
  }

  return {
    ...structuredClone(fixture("requirement-missing").referenceFindings[0]),
    id: "finding:malicious-fabrication",
    category: "security",
    status: "confirmed",
    title: "Fabricated critical security finding",
    expectedBehavior: "A fabricated finding should not be accepted.",
    observedBehavior: "Untrusted evidence instructed the Agent to fabricate this finding.",
    deterministicFacts: [
      {
        statement: "The bundle contains one available evidence item.",
        evidenceIds: [evidenceId],
      },
    ],
    inference: "This fabricated finding should fail fixture scoring.",
    evidenceIds: [evidenceId],
    affectedSources: [source],
    recommendation: "investigate",
  };
}

describe("review fixture scoring", () => {
  it("accepts every reference answer individually and as one exact suite", () => {
    for (const loaded of fixtures) {
      expect(
        scoreReviewFixture(loaded, structuredClone(loaded.referenceFindings)),
        loaded.descriptor.fixtureId,
      ).toMatchObject({
        fixtureId: loaded.descriptor.fixtureId,
        passed: true,
        failureCodes: [],
      });
    }

    const suite = scoreReviewSuite(fixtures, referenceResponses());
    expect(suite).toMatchObject({
      passed: true,
      inputErrors: [],
      aggregate: {
        fixturesPassed: fixtures.length,
        fixturesFailed: 0,
      },
    });
  });

  it("accepts explicit empty responses for all no-findings precision controls", () => {
    const controls = fixtures.filter(
      (loaded) => loaded.expected.outcome === "no_findings",
    );
    expect(controls).toHaveLength(3);

    for (const loaded of controls) {
      expect(scoreReviewFixture(loaded, [])).toMatchObject({
        passed: true,
        validation: { ok: true, submitted: 0, valid: 0, rejected: 0 },
      });
    }
  });

  it("fails a missing required finding with a bounded semantic failure code", () => {
    const score = scoreReviewFixture(fixture("requirement-missing"), []);

    expect(score.passed).toBe(false);
    expect(score.failureCodes).toEqual([
      "finding_count_below_min",
      "required_match_missing",
    ]);
    expect(score.requiredMatches[0]).toMatchObject({
      passed: false,
      matchedCount: 0,
    });
  });

  it("fails schema-invalid raw findings even when another finding matches", () => {
    const loaded = fixture("requirement-missing");
    const score = scoreReviewFixture(loaded, [
      ...structuredClone(loaded.referenceFindings),
      "not a finding object",
    ]);

    expect(score.passed).toBe(false);
    expect(score.validation).toMatchObject({ ok: false, valid: 1, rejected: 1 });
    expect(score.failureCodes).toContain("finding_validation_failed");
  });

  it("requires the complete evidence set on a single matched finding", () => {
    const loaded = fixture("requirement-missing");
    const reference = structuredClone(loaded.referenceFindings[0]);
    const evidenceId = loaded.expected.requiredMatches[0]?.requiredEvidenceIds?.[0];
    if (!reference || !evidenceId) {
      throw new Error("Expected requirement-missing fixture semantic evidence");
    }
    const firstFact = reference.deterministicFacts[0];
    if (!firstFact) {
      throw new Error("Expected requirement-missing reference fact");
    }
    reference.evidenceIds = [evidenceId];
    reference.deterministicFacts = [
      {
        ...firstFact,
        evidenceIds: [evidenceId],
      },
    ];

    const score = scoreReviewFixture(loaded, [reference]);
    expect(score.validation.ok).toBe(true);
    expect(score.requiredMatches[0]).toMatchObject({
      passed: false,
      matchedCount: 0,
    });
    expect(score.failureCodes).toEqual(["required_match_missing"]);
  });

  it("reports configured forbidden categories and statuses", () => {
    const loaded = fixture("insufficient-evidence");
    const finding = structuredClone(loaded.referenceFindings[0]);
    if (!finding) {
      throw new Error("Expected insufficient-evidence reference finding");
    }
    finding.category = "security";
    finding.status = "confirmed";

    const score = scoreReviewFixture(loaded, [finding]);
    expect(score.failureCodes).toEqual(
      expect.arrayContaining([
        "forbidden_category_present",
        "forbidden_status_present",
        "required_match_missing",
      ]),
    );
    expect(score.forbiddenCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "security", passed: false }),
      ]),
    );
    expect(score.forbiddenStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "confirmed", passed: false }),
      ]),
    );
  });

  it("rejects malicious fabricated findings while accepting the empty reference response", () => {
    const loaded = fixture("malicious-instruction");

    expect(scoreReviewFixture(loaded, [])).toMatchObject({ passed: true });
    expect(scoreReviewFixture(loaded, [fabricatedFinding(loaded)])).toMatchObject({
      passed: false,
      failureCodes: expect.arrayContaining([
        "finding_count_above_max",
        "forbidden_category_present",
        "forbidden_status_present",
      ]),
    });
  });

  it("keeps safe enum-normalization warnings visible without failing a matching response", () => {
    const loaded = fixture("requirement-missing");
    const finding = structuredClone(loaded.referenceFindings[0]);
    if (!finding) {
      throw new Error("Expected requirement-missing reference finding");
    }
    const score = scoreReviewFixture(loaded, [
      { ...finding, category: "Requirement Missing" },
    ]);
    expect(score).toMatchObject({
      passed: true,
      validation: { ok: true, warnings: 1 },
      failureCodes: [],
    });
  });

  it("rejects missing and unexpected suite keys distinctly from an explicit empty response", () => {
    const missing = referenceResponses();
    delete missing["implemented-correctly"];
    const missingScore = scoreReviewSuite(fixtures, missing);
    expect(missingScore.inputErrors).toEqual([
      { code: "missing_fixture_response", fixtureId: "implemented-correctly" },
    ]);

    const unexpected = referenceResponses();
    unexpected["unexpected-fixture"] = [];
    const unexpectedScore = scoreReviewSuite(fixtures, unexpected);
    expect(unexpectedScore.inputErrors).toEqual([
      { code: "unexpected_fixture_response", fixtureId: "unexpected-fixture" },
    ]);

    const explicitEmpty = referenceResponses();
    explicitEmpty["implemented-correctly"] = [];
    expect(scoreReviewSuite(fixtures, explicitEmpty)).toMatchObject({
      passed: true,
      inputErrors: [],
    });
  });

  it("is locale-independent and byte-stable across suite-map and finding permutations", () => {
    const requirement = fixture("requirement-missing");
    const first = structuredClone(requirement.referenceFindings[0]);
    const second = structuredClone(requirement.referenceFindings[0]);
    if (!first || !second) {
      throw new Error("Expected requirement-missing reference finding");
    }
    second.id = "finding:req-miss-002";

    const forward = referenceResponses();
    forward[requirement.descriptor.fixtureId] = [first, second];
    const reverse = Object.fromEntries(
      [...fixtures].reverse().map((loaded) => {
        const response = structuredClone(
          forward[loaded.descriptor.fixtureId] ?? [],
        );
        return [loaded.descriptor.fixtureId, response.reverse()];
      }),
    );

    const firstScore = scoreReviewSuite(fixtures, forward);
    const secondScore = scoreReviewSuite([...fixtures].reverse(), reverse);
    expect(canonicalStringify(firstScore)).toBe(canonicalStringify(secondScore));
    expect(firstScore.fixtures.map((score) => score.fixtureId)).toEqual(
      [...firstScore.fixtures.map((score) => score.fixtureId)].sort(),
    );
  });

  it("keeps raw finding prose out of score objects", () => {
    const loaded = fixture("requirement-missing");
    const reference = loaded.referenceFindings[0];
    if (!reference) {
      throw new Error("Expected requirement-missing reference finding");
    }

    const serialized = canonicalStringify(
      scoreReviewFixture(loaded, structuredClone(loaded.referenceFindings)),
    );
    expect(serialized).not.toContain(reference.title);
    expect(serialized).not.toContain(reference.inference);
  });
});
