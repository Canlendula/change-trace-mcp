import { validateFindings } from "../../src/findings/validate-findings.js";
import type {
  Finding,
  FindingCategory,
  FindingRecommendation,
  FindingStatus,
} from "../../src/schemas/index.js";
import type {
  LoadedReviewFixture,
  SemanticMatch,
} from "./review-fixture.js";

export const REVIEW_SCORE_SCHEMA_VERSION = "1.0.0";

export type FixtureFailureCode =
  | "finding_validation_failed"
  | "finding_count_below_min"
  | "finding_count_above_max"
  | "required_match_missing"
  | "forbidden_category_present"
  | "forbidden_status_present";

export type ReviewFixtureScore = {
  schemaVersion: typeof REVIEW_SCORE_SCHEMA_VERSION;
  fixtureId: string;
  passed: boolean;
  validation: {
    ok: boolean;
    submitted: number;
    valid: number;
    rejected: number;
    warnings: number;
  };
  acceptedValidFindingCount: number;
  countBounds: {
    minimum: number;
    maximum: number;
    actual: number;
    minimumPassed: boolean;
    maximumPassed: boolean;
  };
  requiredMatches: RequiredMatchScore[];
  forbiddenCategories: ForbiddenCategoryScore[];
  forbiddenStatuses: ForbiddenStatusScore[];
  failureCodes: FixtureFailureCode[];
};

export type RequiredMatchScore = {
  category: FindingCategory;
  status: FindingStatus;
  recommendation: FindingRecommendation;
  requiredEvidenceIds: string[];
  minCount: number;
  matchedCount: number;
  passed: boolean;
  failureCode: "required_match_missing" | null;
};

export type ForbiddenCategoryScore = {
  category: FindingCategory;
  findingCount: number;
  passed: boolean;
  failureCode: "forbidden_category_present" | null;
};

export type ForbiddenStatusScore = {
  status: FindingStatus;
  findingCount: number;
  passed: boolean;
  failureCode: "forbidden_status_present" | null;
};

export type SuiteInputError = {
  code: "missing_fixture_response" | "unexpected_fixture_response";
  fixtureId: string;
};

export type ReviewSuiteScore = {
  schemaVersion: typeof REVIEW_SCORE_SCHEMA_VERSION;
  passed: boolean;
  inputErrors: SuiteInputError[];
  fixtures: ReviewFixtureScore[];
  aggregate: {
    fixturesPassed: number;
    fixturesFailed: number;
    findingsSubmitted: number;
    findingsValid: number;
    findingsRejected: number;
    findingsWarned: number;
  };
};

function compareCodeUnits(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareCodeUnits);
}

function semanticMatchSortKey(match: SemanticMatch): string {
  return JSON.stringify([
    match.category,
    match.status,
    match.recommendation,
    uniqueSorted(match.requiredEvidenceIds ?? []),
    match.minCount,
  ]);
}

function matchesRequiredSemantics(
  finding: Finding,
  match: SemanticMatch,
): boolean {
  return (
    finding.category === match.category &&
    finding.status === match.status &&
    finding.recommendation === match.recommendation &&
    (match.requiredEvidenceIds ?? []).every((evidenceId) =>
      finding.evidenceIds.includes(evidenceId),
    )
  );
}

function scoreRequiredMatch(
  match: SemanticMatch,
  validFindings: readonly Finding[],
): RequiredMatchScore {
  const matchedCount = validFindings.filter((finding) =>
    matchesRequiredSemantics(finding, match),
  ).length;
  const passed = matchedCount >= match.minCount;

  return {
    category: match.category,
    status: match.status,
    recommendation: match.recommendation,
    requiredEvidenceIds: uniqueSorted(match.requiredEvidenceIds ?? []),
    minCount: match.minCount,
    matchedCount,
    passed,
    failureCode: passed ? null : "required_match_missing",
  };
}

function scoreForbiddenCategory(
  category: FindingCategory,
  validFindings: readonly Finding[],
): ForbiddenCategoryScore {
  const findingCount = validFindings.filter(
    (finding) => finding.category === category,
  ).length;
  const passed = findingCount === 0;
  return {
    category,
    findingCount,
    passed,
    failureCode: passed ? null : "forbidden_category_present",
  };
}

function scoreForbiddenStatus(
  status: FindingStatus,
  validFindings: readonly Finding[],
): ForbiddenStatusScore {
  const findingCount = validFindings.filter(
    (finding) => finding.status === status,
  ).length;
  const passed = findingCount === 0;
  return {
    status,
    findingCount,
    passed,
    failureCode: passed ? null : "forbidden_status_present",
  };
}

export function scoreReviewFixture(
  fixture: LoadedReviewFixture,
  rawFindings: readonly unknown[],
): ReviewFixtureScore {
  const validationResult = validateFindings({
    bundle: fixture.bundle,
    findings: [...rawFindings],
  });
  const { summary, validFindings } = validationResult;
  const countBounds = {
    minimum: fixture.expected.minFindings,
    maximum: fixture.expected.maxFindings,
    actual: summary.valid,
    minimumPassed: summary.valid >= fixture.expected.minFindings,
    maximumPassed: summary.valid <= fixture.expected.maxFindings,
  };
  const requiredMatches = [...fixture.expected.requiredMatches]
    .sort((left, right) =>
      compareCodeUnits(semanticMatchSortKey(left), semanticMatchSortKey(right)),
    )
    .map((match) => scoreRequiredMatch(match, validFindings));
  const forbiddenCategories = uniqueSorted(
    fixture.expected.forbiddenCategories ?? [],
  ).map((category) => scoreForbiddenCategory(category, validFindings));
  const forbiddenStatuses = uniqueSorted(
    fixture.expected.forbiddenStatuses ?? [],
  ).map((status) => scoreForbiddenStatus(status, validFindings));

  const failureCodes: FixtureFailureCode[] = [];
  if (!validationResult.ok) {
    failureCodes.push("finding_validation_failed");
  }
  if (!countBounds.minimumPassed) {
    failureCodes.push("finding_count_below_min");
  }
  if (!countBounds.maximumPassed) {
    failureCodes.push("finding_count_above_max");
  }
  if (requiredMatches.some((match) => !match.passed)) {
    failureCodes.push("required_match_missing");
  }
  if (forbiddenCategories.some((category) => !category.passed)) {
    failureCodes.push("forbidden_category_present");
  }
  if (forbiddenStatuses.some((status) => !status.passed)) {
    failureCodes.push("forbidden_status_present");
  }

  const sortedFailureCodes = uniqueSorted(failureCodes);
  return {
    schemaVersion: REVIEW_SCORE_SCHEMA_VERSION,
    fixtureId: fixture.descriptor.fixtureId,
    passed: sortedFailureCodes.length === 0,
    validation: {
      ok: validationResult.ok,
      submitted: summary.submitted,
      valid: summary.valid,
      rejected: summary.rejected,
      warnings: summary.warnings,
    },
    acceptedValidFindingCount: summary.valid,
    countBounds,
    requiredMatches,
    forbiddenCategories,
    forbiddenStatuses,
    failureCodes: sortedFailureCodes,
  };
}

export function scoreReviewSuite(
  fixtures: readonly LoadedReviewFixture[],
  responsesByFixtureId: Readonly<Record<string, readonly unknown[]>>,
): ReviewSuiteScore {
  const fixtureIds = uniqueSorted(
    fixtures.map((fixture) => fixture.descriptor.fixtureId),
  );
  const expectedFixtureIds = new Set(fixtureIds);
  const responseFixtureIds = Object.keys(responsesByFixtureId);
  const inputErrors: SuiteInputError[] = [
    ...fixtureIds
      .filter(
        (fixtureId) =>
          !Object.prototype.hasOwnProperty.call(responsesByFixtureId, fixtureId),
      )
      .map((fixtureId) => ({
        code: "missing_fixture_response" as const,
        fixtureId,
      })),
    ...uniqueSorted(responseFixtureIds)
      .filter((fixtureId) => !expectedFixtureIds.has(fixtureId))
      .map((fixtureId) => ({
        code: "unexpected_fixture_response" as const,
        fixtureId,
      })),
  ].sort(
    (left, right) =>
      compareCodeUnits(left.fixtureId, right.fixtureId) ||
      compareCodeUnits(left.code, right.code),
  );
  const fixturesById = new Map(
    fixtures.map((fixture) => [fixture.descriptor.fixtureId, fixture]),
  );
  const fixtureScores = fixtureIds.flatMap((fixtureId) => {
    const fixture = fixturesById.get(fixtureId);
    const response = responsesByFixtureId[fixtureId];
    if (!fixture || !response) {
      return [];
    }
    return [scoreReviewFixture(fixture, response)];
  });
  const aggregate = fixtureScores.reduce(
    (totals, score) => ({
      fixturesPassed: totals.fixturesPassed + (score.passed ? 1 : 0),
      fixturesFailed: totals.fixturesFailed + (score.passed ? 0 : 1),
      findingsSubmitted:
        totals.findingsSubmitted + score.validation.submitted,
      findingsValid: totals.findingsValid + score.validation.valid,
      findingsRejected: totals.findingsRejected + score.validation.rejected,
      findingsWarned: totals.findingsWarned + score.validation.warnings,
    }),
    {
      fixturesPassed: 0,
      fixturesFailed: 0,
      findingsSubmitted: 0,
      findingsValid: 0,
      findingsRejected: 0,
      findingsWarned: 0,
    },
  );

  return {
    schemaVersion: REVIEW_SCORE_SCHEMA_VERSION,
    passed:
      inputErrors.length === 0 &&
      fixtureScores.length === fixtureIds.length &&
      fixtureScores.every((score) => score.passed),
    inputErrors,
    fixtures: fixtureScores,
    aggregate,
  };
}
