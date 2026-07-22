import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  findingSchema,
  findingValidationResultSchema,
  reviewBundleSchema,
  type Finding,
  type FindingValidationIssue,
  type FindingValidationResult,
  type FindingValidationWarning,
  type SourceReference,
} from "../schemas/index.js";

export const validateFindingsInputSchema = z.strictObject({
  bundle: reviewBundleSchema,
  findings: z.array(z.unknown()).max(1_000),
});

export type ValidateFindingsInput = z.input<
  typeof validateFindingsInputSchema
>;

type ParsedCandidate = {
  index: number;
  finding: Finding;
  warnings: FindingValidationWarning[];
};

const categoryValues = new Set([
  "requirement_missing",
  "undocumented_behavior",
  "contradictory_evidence",
  "test_gap",
  "stale_documentation",
  "security",
  "other",
]);
const severityValues = new Set([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);
const recommendationValues = new Set([
  "update_code",
  "update_documentation",
  "add_or_adjust_tests",
  "investigate",
  "accept_intentional_difference",
]);
const statusValues = new Set(["confirmed", "suspected", "inconclusive"]);

function normalizeEnumToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/gu, "_")
    .replace(/[^a-z0-9_]/gu, "")
    .replace(/_+/gu, "_")
    .replace(/^_|_$/gu, "");
}

function sourceKey(source: SourceReference): string {
  return JSON.stringify([source.system, source.locator, source.uri]);
}

function issue(
  code: string,
  path: string,
  message: string,
): FindingValidationIssue {
  return {
    code,
    path,
    message: message.slice(0, 2_000),
  };
}

function extractFindingId(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u.test(value.id)
  ) {
    return value.id;
  }
  return null;
}

function normalizeCandidate(
  rawFinding: unknown,
  index: number,
):
  | ParsedCandidate
  | {
      index: number;
      findingId: string | null;
      issues: FindingValidationIssue[];
    } {
  if (
    typeof rawFinding !== "object" ||
    rawFinding === null ||
    Array.isArray(rawFinding)
  ) {
    return {
      index,
      findingId: null,
      issues: [
        issue(
          "schema_validation",
          "$",
          "Finding must be a JSON object",
        ),
      ],
    };
  }

  const candidate: Record<string, unknown> = { ...rawFinding };
  const pendingWarnings: Array<{
    path: string;
    original: string;
    normalized: string;
  }> = [];
  const enumFields: Array<{
    name: "category" | "severity" | "recommendation" | "status";
    allowed: ReadonlySet<string>;
    aliases?: Readonly<Record<string, string>>;
  }> = [
    { name: "category", allowed: categoryValues },
    {
      name: "severity",
      allowed: severityValues,
      aliases: { informational: "info" },
    },
    {
      name: "recommendation",
      allowed: recommendationValues,
      aliases: {
        add_adjust_tests: "add_or_adjust_tests",
        add_tests: "add_or_adjust_tests",
        adjust_tests: "add_or_adjust_tests",
      },
    },
    { name: "status", allowed: statusValues },
  ];

  for (const field of enumFields) {
    const original = candidate[field.name];
    if (typeof original !== "string") {
      continue;
    }
    const token = normalizeEnumToken(original);
    const normalized = field.aliases?.[token] ?? token;
    if (field.allowed.has(normalized)) {
      candidate[field.name] = normalized;
      if (original !== normalized) {
        pendingWarnings.push({
          path: field.name,
          original,
          normalized,
        });
      }
    }
  }

  const parsed = findingSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      index,
      findingId: extractFindingId(rawFinding),
      issues: parsed.error.issues.slice(0, 100).map((zodIssue) =>
        issue(
          "schema_validation",
          zodIssue.path.length === 0
            ? "$"
            : zodIssue.path.map(String).join("."),
          zodIssue.message,
        ),
      ),
    };
  }

  return {
    index,
    finding: parsed.data,
    warnings: pendingWarnings.map(({ path, original, normalized }) => ({
      findingId: parsed.data.id,
      index,
      code: "normalized_enum",
      path,
      message: `Normalized ${JSON.stringify(original)} to ${JSON.stringify(normalized)}.`,
    })),
  };
}

export function validateFindings(
  rawInput: ValidateFindingsInput,
): FindingValidationResult {
  const input = validateFindingsInputSchema.parse(rawInput);
  const parsedCandidates: ParsedCandidate[] = [];
  const rejected = new Map<
    number,
    {
      index: number;
      findingId: string | null;
      issues: FindingValidationIssue[];
    }
  >();

  input.findings.forEach((rawFinding, index) => {
    const result = normalizeCandidate(rawFinding, index);
    if ("finding" in result) {
      parsedCandidates.push(result);
    } else {
      rejected.set(index, result);
    }
  });

  const findingIdCounts = new Map<string, number>();
  for (const { finding } of parsedCandidates) {
    findingIdCounts.set(
      finding.id,
      (findingIdCounts.get(finding.id) ?? 0) + 1,
    );
  }
  const evidenceById = new Map(
    input.bundle.evidenceItems.map((item) => [item.id, item]),
  );
  const supportedSources = new Set([
    ...input.bundle.evidenceItems.map(({ source }) => sourceKey(source)),
    ...input.bundle.missingEvidence.map(({ source }) => sourceKey(source)),
  ]);

  for (const candidate of parsedCandidates) {
    const issues: FindingValidationIssue[] = [];
    const { finding } = candidate;

    if ((findingIdCounts.get(finding.id) ?? 0) > 1) {
      issues.push(
        issue(
          "duplicate_finding_id",
          "id",
          `Finding ID ${finding.id} appears more than once`,
        ),
      );
    }

    const uniqueEvidenceIds = new Set(finding.evidenceIds);
    if (uniqueEvidenceIds.size !== finding.evidenceIds.length) {
      issues.push(
        issue(
          "duplicate_evidence_reference",
          "evidenceIds",
          "Top-level evidence references must be unique",
        ),
      );
    }
    for (const [evidenceIndex, evidenceId] of finding.evidenceIds.entries()) {
      if (!evidenceById.has(evidenceId)) {
        issues.push(
          issue(
            "unknown_evidence_id",
            `evidenceIds.${evidenceIndex}`,
            `Evidence ID ${evidenceId} does not exist in bundle ${input.bundle.id}`,
          ),
        );
      }
    }

    if (
      finding.status !== "inconclusive" &&
      finding.evidenceIds.length === 0
    ) {
      issues.push(
        issue(
          "substantive_finding_without_evidence",
          "evidenceIds",
          "Confirmed and suspected findings must reference at least one bundle evidence item",
        ),
      );
    }

    finding.deterministicFacts.forEach((fact, factIndex) => {
      fact.evidenceIds.forEach((evidenceId, evidenceIndex) => {
        if (!evidenceById.has(evidenceId)) {
          issues.push(
            issue(
              "unknown_evidence_id",
              `deterministicFacts.${factIndex}.evidenceIds.${evidenceIndex}`,
              `Evidence ID ${evidenceId} does not exist in bundle ${input.bundle.id}`,
            ),
          );
        }
        if (!uniqueEvidenceIds.has(evidenceId)) {
          issues.push(
            issue(
              "fact_evidence_not_declared",
              `deterministicFacts.${factIndex}.evidenceIds.${evidenceIndex}`,
              `Fact evidence ID ${evidenceId} must also appear in the finding evidenceIds array`,
            ),
          );
        }
      });
    });

    finding.affectedSources.forEach((source, sourceIndex) => {
      if (!supportedSources.has(sourceKey(source))) {
        issues.push(
          issue(
            "unsupported_source_reference",
            `affectedSources.${sourceIndex}`,
            "Affected source does not exist in the bundle evidence or missing-evidence index",
          ),
        );
      }
    });

    if (issues.length > 0) {
      rejected.set(candidate.index, {
        index: candidate.index,
        findingId: finding.id,
        issues: issues.slice(0, 100),
      });
    }
  }

  const validCandidates = parsedCandidates.filter(
    ({ index }) => !rejected.has(index),
  );
  const warnings = validCandidates.flatMap((candidate) => candidate.warnings);
  for (const candidate of validCandidates) {
    if (
      candidate.finding.status === "inconclusive" &&
      candidate.finding.evidenceIds.length === 0 &&
      input.bundle.missingEvidence.length === 0
    ) {
      warnings.push({
        findingId: candidate.finding.id,
        index: candidate.index,
        code: "inconclusive_without_missing_evidence",
        path: "status",
        message:
          "Finding is inconclusive without evidence references or a bundle missing-evidence record.",
      });
    }
  }

  const rejectedFindings = [...rejected.values()].sort(
    (left, right) => left.index - right.index,
  );
  const result: FindingValidationResult = {
    schemaVersion: CORE_SCHEMA_VERSION,
    bundleId: input.bundle.id,
    ok: rejectedFindings.length === 0,
    validFindings: validCandidates.map(({ finding }) => finding),
    rejectedFindings,
    warnings,
    summary: {
      submitted: input.findings.length,
      valid: validCandidates.length,
      rejected: rejectedFindings.length,
      warnings: warnings.length,
    },
  };

  return findingValidationResultSchema.parse(result);
}
