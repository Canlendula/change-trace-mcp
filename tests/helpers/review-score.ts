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
import { EXPECTED_FIXTURE_IDS } from "./review-fixture.js";

export const REVIEW_SCORE_SCHEMA_VERSION = "1.0.0";
export const MAX_SUITE_INPUT_ERRORS = 64;
export const MAX_SUITE_INPUT_ERROR_FIXTURE_ID_LENGTH = 160;

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
  code: SuiteInputErrorCode;
  fixtureId: string;
};

export type SuiteInputErrorCode =
  | "duplicate_fixture_definition"
  | "invalid_fixture_response"
  | "missing_fixture_definition"
  | "missing_fixture_response"
  | "unexpected_fixture_definition"
  | "unexpected_fixture_response";

export type ReviewSuiteScore = {
  schemaVersion: typeof REVIEW_SCORE_SCHEMA_VERSION;
  passed: boolean;
  inputErrors: SuiteInputError[];
  omittedInputErrors: number;
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

function boundedFixtureId(fixtureId: string): string {
  return fixtureId.slice(0, MAX_SUITE_INPUT_ERROR_FIXTURE_ID_LENGTH);
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
  responsesByFixtureId: Readonly<Record<string, unknown>>,
): ReviewSuiteScore {
  const expectedFixtureIds = [...EXPECTED_FIXTURE_IDS].sort(compareCodeUnits);
  const expectedFixtureIdSet = new Set<string>(expectedFixtureIds);
  const definitionsByFixtureId = new Map<string, LoadedReviewFixture[]>();
  for (const fixture of fixtures) {
    const fixtureId = fixture.descriptor.fixtureId;
    const definitions = definitionsByFixtureId.get(fixtureId) ?? [];
    definitions.push(fixture);
    definitionsByFixtureId.set(fixtureId, definitions);
  }

  type PendingSuiteInputError = {
    code: SuiteInputErrorCode;
    fixtureId: string;
  };
  const pendingInputErrors: PendingSuiteInputError[] = [];
  for (const fixtureId of expectedFixtureIds) {
    const definitionCount = definitionsByFixtureId.get(fixtureId)?.length ?? 0;
    if (definitionCount === 0) {
      pendingInputErrors.push({
        code: "missing_fixture_definition",
        fixtureId,
      });
    }
  }
  for (const fixtureId of uniqueSorted([...definitionsByFixtureId.keys()])) {
    if (!expectedFixtureIdSet.has(fixtureId)) {
      pendingInputErrors.push({
        code: "unexpected_fixture_definition",
        fixtureId,
      });
    }
    if ((definitionsByFixtureId.get(fixtureId)?.length ?? 0) > 1) {
      pendingInputErrors.push({
        code: "duplicate_fixture_definition",
        fixtureId,
      });
    }
  }

  const responseFixtureIds = Object.keys(responsesByFixtureId);
  for (const fixtureId of uniqueSorted(responseFixtureIds)) {
    if (!expectedFixtureIdSet.has(fixtureId)) {
      pendingInputErrors.push({
        code: "unexpected_fixture_response",
        fixtureId,
      });
    }
  }

  const fixtureScores: ReviewFixtureScore[] = [];
  const aggregate = {
    fixturesPassed: 0,
    fixturesFailed: 0,
    findingsSubmitted: 0,
    findingsValid: 0,
    findingsRejected: 0,
    findingsWarned: 0,
  };

  for (const fixtureId of expectedFixtureIds) {
    const definitions = definitionsByFixtureId.get(fixtureId) ?? [];
    const fixture = definitions[0];
    if (definitions.length !== 1 || !fixture) {
      aggregate.fixturesFailed += 1;
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(responsesByFixtureId, fixtureId)) {
      pendingInputErrors.push({
        code: "missing_fixture_response",
        fixtureId,
      });
      aggregate.fixturesFailed += 1;
      continue;
    }

    const rawResponse = responsesByFixtureId[fixtureId];
    if (!Array.isArray(rawResponse)) {
      pendingInputErrors.push({
        code: "invalid_fixture_response",
        fixtureId,
      });
      aggregate.fixturesFailed += 1;
      continue;
    }

    const score = scoreReviewFixture(fixture, rawResponse);
    fixtureScores.push(score);
    aggregate.fixturesPassed += score.passed ? 1 : 0;
    aggregate.fixturesFailed += score.passed ? 0 : 1;
    aggregate.findingsSubmitted += score.validation.submitted;
    aggregate.findingsValid += score.validation.valid;
    aggregate.findingsRejected += score.validation.rejected;
    aggregate.findingsWarned += score.validation.warnings;
  }

  const boundedInputErrors = pendingInputErrors
    .sort(
      (left, right) =>
        compareCodeUnits(left.fixtureId, right.fixtureId) ||
        compareCodeUnits(left.code, right.code),
    )
    .slice(0, MAX_SUITE_INPUT_ERRORS)
    .map(({ code, fixtureId }) => ({
      code,
      fixtureId: boundedFixtureId(fixtureId),
    }));
  const boundedOmittedInputErrors =
    pendingInputErrors.length - boundedInputErrors.length;

  return {
    schemaVersion: REVIEW_SCORE_SCHEMA_VERSION,
    passed:
      boundedInputErrors.length === 0 &&
      aggregate.fixturesPassed === expectedFixtureIds.length,
    inputErrors: boundedInputErrors,
    omittedInputErrors: boundedOmittedInputErrors,
    fixtures: fixtureScores,
    aggregate,
  };
}
