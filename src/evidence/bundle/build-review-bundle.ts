import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  changeScopeSchema,
  evidenceItemSchema,
  externalEvidenceCollectionSchema,
  localEvidenceCollectionSchema,
  reviewBundleSchema,
  runtimeEvidenceCollectionSchema,
  type ChangeScope,
  type DeterministicFact,
  type EvidenceItem,
  type ExternalEvidenceCollection,
  type LocalEvidenceCollection,
  type ReviewMissingEvidence,
  type ReviewBundle,
  type RuntimeEvidenceCollection,
} from "../../schemas/index.js";

export const DEFAULT_REVIEW_BUNDLE_LIMITS = {
  maxEvidenceItems: 1_000,
  maxTotalExcerptCharacters: 200_000,
} as const;

const HARD_LIMITS = {
  maxEvidenceItems: 10_000,
  maxTotalExcerptCharacters: 2_000_000,
} as const;

export const buildReviewBundleInputSchema = z.strictObject({
  changeScope: changeScopeSchema,
  localEvidence: localEvidenceCollectionSchema,
  externalEvidenceCollections: z
    .array(externalEvidenceCollectionSchema)
    .max(16)
    .default([]),
  runtimeEvidenceCollections: z
    .array(runtimeEvidenceCollectionSchema)
    .max(16)
    .default([]),
  additionalEvidenceItems: z.array(evidenceItemSchema).max(10_000).default([]),
  maxEvidenceItems: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxEvidenceItems)
    .default(DEFAULT_REVIEW_BUNDLE_LIMITS.maxEvidenceItems),
  maxTotalExcerptCharacters: z
    .number()
    .int()
    .positive()
    .max(HARD_LIMITS.maxTotalExcerptCharacters)
    .default(DEFAULT_REVIEW_BUNDLE_LIMITS.maxTotalExcerptCharacters),
});

export type BuildReviewBundleInput = z.input<
  typeof buildReviewBundleInputSchema
>;

export type ReviewBundleBuilderOptions = {
  now?: () => Date;
};

type EvidenceCandidate = {
  item: EvidenceItem;
  fact: DeterministicFact | null;
};

function normalizePathForComparison(path: string): string {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function gitDiffEvidenceId(scope: ChangeScope, path: string): string {
  return `evidence:git-diff:${sha256(
    `${scope.resolvedBase}\0${scope.resolvedHead}\0${path}`,
  ).slice(0, 24)}`;
}

function createGitEvidence(
  scope: ChangeScope,
  retrievedAt: string,
): EvidenceCandidate[] {
  const fileCandidates = scope.files.map((file): EvidenceCandidate => {
    const id = gitDiffEvidenceId(scope, file.path);
    const excerpt =
      file.diff?.text ?? `Binary file changed: ${file.path}`;
    const sourceLocator = file.path;
    const statusStatement =
      file.previousPath === null
        ? `Git reports ${file.path} as ${file.status}.`
        : `Git reports ${file.previousPath} renamed or copied to ${file.path} with status ${file.status}.`;

    return {
      item: {
        schemaVersion: CORE_SCHEMA_VERSION,
        id,
        type: "git_diff",
        source: {
          system: "git",
          locator: sourceLocator,
          uri: null,
        },
        retrievedAt,
        contentHash:
          file.diff !== null && !file.diff.isTruncated
            ? `sha256:${sha256(file.diff.text)}`
            : null,
        relatedChangeIds: [file.id],
        excerpt,
        selectionReason: "Selected because the file is part of the resolved Git change scope.",
        trustLevel: "trusted_repository",
        truncation: {
          isTruncated: file.diff === null || file.diff.isTruncated,
          originalCharacters:
            file.diff === null || file.diff.isTruncated
              ? null
              : file.diff.text.length,
          retainedCharacters: excerpt.length,
        },
        redactions: file.redactions,
      },
      fact: {
        id: `fact:${id.slice("evidence:".length)}`,
        statement: statusStatement.slice(0, 4_000),
        evidenceIds: [id],
      },
    };
  });

  const commitCandidates = scope.commits.map((commit): EvidenceCandidate => {
    const id = `evidence:commit:${commit.objectId}`;
    return {
      item: {
        schemaVersion: CORE_SCHEMA_VERSION,
        id,
        type: "commit",
        source: {
          system: "git",
          locator: `commit:${commit.objectId}`,
          uri: null,
        },
        retrievedAt,
        contentHash: null,
        relatedChangeIds: [commit.id],
        excerpt: commit.summary,
        selectionReason: "Selected because the commit is part of the resolved Git change range.",
        trustLevel: "trusted_repository",
        truncation: {
          isTruncated: false,
          originalCharacters: commit.summary.length,
          retainedCharacters: commit.summary.length,
        },
        redactions: commit.redactions,
      },
      fact: {
        id: `fact:commit:${commit.objectId}`,
        statement: `Commit ${commit.objectId} has summary: ${commit.summary}`.slice(
          0,
          4_000,
        ),
        evidenceIds: [id],
      },
    };
  });

  return [...fileCandidates, ...commitCandidates];
}

function missingEvidenceFromInputs(
  scope: ChangeScope,
  localEvidence: LocalEvidenceCollection,
  externalEvidenceCollections: readonly ExternalEvidenceCollection[],
  runtimeEvidenceCollections: readonly RuntimeEvidenceCollection[],
): ReviewMissingEvidence[] {
  const missing: ReviewMissingEvidence[] = [];

  for (const error of scope.errors) {
    missing.push({
      source: {
        system: "git",
        locator: error.path ?? `${scope.baseRef}..${scope.headRef}`,
        uri: null,
      },
      reason: error.message,
      status: "inaccessible",
    });
  }
  if (scope.truncation.isTruncated) {
    missing.push({
      source: {
        system: "git",
        locator: `${scope.baseRef}..${scope.headRef}`,
        uri: null,
      },
      reason: `Git change evidence was truncated: ${scope.truncation.reasons.join(", ")}`,
      status: "truncated",
    });
  }
  for (const file of scope.files.filter(({ isBinary }) => isBinary)) {
    missing.push({
      source: {
        system: "git",
        locator: file.path,
        uri: null,
      },
      reason: "Binary patch content is not represented as text evidence.",
      status: "unsupported",
    });
  }

  for (const error of localEvidence.errors) {
    const status =
      error.code === "binary_document_skipped" ||
      error.code === "symlink_skipped" ||
      error.code === "unsupported_document_root"
        ? "unsupported"
        : error.code === "explicit_reference_not_selected"
          ? "not_found"
          : "inaccessible";
    missing.push({
      source: {
        system: "repository",
        locator: error.path ?? "local-evidence",
        uri: null,
      },
      reason: error.message,
      status,
    });
  }
  if (localEvidence.truncation.isTruncated) {
    missing.push({
      source: {
        system: "repository",
        locator: "local-evidence",
        uri: null,
      },
      reason: `Local document evidence was truncated: ${localEvidence.truncation.reasons.join(", ")}`,
      status: "truncated",
    });
  }

  for (const collection of externalEvidenceCollections) {
    missing.push(...collection.missingEvidence);
  }
  for (const collection of runtimeEvidenceCollections) {
    missing.push(...collection.missingEvidence);
  }

  return missing;
}

function truncateExcerpt(item: EvidenceItem, maximumCharacters: number): {
  item: EvidenceItem;
  omittedCharacters: number;
} {
  if (item.excerpt.length <= maximumCharacters) {
    return { item, omittedCharacters: 0 };
  }

  let end = maximumCharacters;
  if (
    end > 0 &&
    /[\uD800-\uDBFF]/u.test(item.excerpt.charAt(end - 1))
  ) {
    end -= 1;
  }
  const excerpt = item.excerpt.slice(0, end);

  return {
    item: {
      ...item,
      excerpt,
      truncation: {
        ...item.truncation,
        isTruncated: true,
        retainedCharacters: excerpt.length,
      },
    },
    omittedCharacters: item.excerpt.length - excerpt.length,
  };
}

function bundleId(
  scope: ChangeScope,
  evidenceItems: readonly EvidenceItem[],
  missingEvidence: readonly ReviewMissingEvidence[],
): string {
  const runtimeMissingEvidence = missingEvidence.filter(
    (
      missing,
    ): missing is Extract<
      ReviewMissingEvidence,
      { runtimeUnavailableProvenance: unknown }
    > => "runtimeUnavailableProvenance" in missing,
  );
  const identity = JSON.stringify({
    schemaVersion: CORE_SCHEMA_VERSION,
    resolvedBase: scope.resolvedBase,
    resolvedHead: scope.resolvedHead,
    evidence: evidenceItems.map((item) => ({
      id: item.id,
      source: item.source.locator,
      contentHash: item.contentHash,
      excerptHash: sha256(item.excerpt),
      ...(item.externalProvenance === undefined
        ? {}
        : { externalProvenance: item.externalProvenance }),
      ...(item.runtimeProvenance === undefined
        ? {}
        : {
            relatedChangeIds: item.relatedChangeIds,
            runtimeProvenance: item.runtimeProvenance,
          }),
    })),
    ...(runtimeMissingEvidence.length === 0
      ? {}
      : { runtimeMissingEvidence }),
  });
  return `bundle:${sha256(identity).slice(0, 32)}`;
}

export function buildReviewBundle(
  rawInput: BuildReviewBundleInput,
  options: ReviewBundleBuilderOptions = {},
): ReviewBundle {
  const input = buildReviewBundleInputSchema.parse(rawInput);
  if (
    normalizePathForComparison(input.changeScope.repositoryRoot) !==
    normalizePathForComparison(input.localEvidence.repositoryRoot)
  ) {
    throw new Error(
      "changeScope and localEvidence must refer to the same repository root",
    );
  }

  const relatedChangeIds = new Set([
    ...input.changeScope.commits.map(({ id }) => id),
    ...input.changeScope.files.map(({ id }) => id),
  ]);
  for (const collection of input.externalEvidenceCollections) {
    for (const item of collection.evidenceItems) {
      if (
        item.relatedChangeIds.some(
          (relatedChangeId) => !relatedChangeIds.has(relatedChangeId),
        )
      ) {
        throw new Error(
          "External evidence contains an unknown related change ID.",
        );
      }
    }
  }

  const nonRuntimeAdditionalEvidence =
    input.additionalEvidenceItems.filter(
      ({ runtimeProvenance }) => runtimeProvenance === undefined,
    );
  const runtimeAdditionalEvidence =
    input.additionalEvidenceItems.filter(
      ({ runtimeProvenance }) => runtimeProvenance !== undefined,
    );
  const staticDocumentIds = new Set(
    [
      ...input.localEvidence.evidenceItems,
      ...input.externalEvidenceCollections.flatMap(
        ({ evidenceItems }) => evidenceItems,
      ),
      ...nonRuntimeAdditionalEvidence,
    ]
      .filter(
        (item) =>
          item.type === "document" &&
          item.runtimeProvenance === undefined,
      )
      .map(({ id }) => id),
  );

  const validateRuntimeRelationship = (
    runtimeRelatedChangeIds: readonly string[],
    runtimeRelatedEvidenceIds: readonly string[],
  ): void => {
    if (
      runtimeRelatedChangeIds.some(
        (relatedChangeId) =>
          !relatedChangeIds.has(relatedChangeId),
      ) ||
      runtimeRelatedEvidenceIds.some(
        (relatedEvidenceId) =>
          !staticDocumentIds.has(relatedEvidenceId),
      )
    ) {
      throw new Error(
        "Runtime evidence relationship targets must be supplied change IDs and non-runtime document evidence IDs.",
      );
    }
  };

  for (const collection of input.runtimeEvidenceCollections) {
    for (const item of collection.evidenceItems) {
      validateRuntimeRelationship(
        item.relatedChangeIds,
        item.runtimeProvenance.relatedEvidenceIds,
      );
    }
    for (const missing of collection.missingEvidence) {
      validateRuntimeRelationship(
        missing.runtimeUnavailableProvenance.relatedChangeIds,
        missing.runtimeUnavailableProvenance.relatedEvidenceIds,
      );
    }
  }
  for (const item of runtimeAdditionalEvidence) {
    if (item.runtimeProvenance === undefined) {
      continue;
    }
    validateRuntimeRelationship(
      item.relatedChangeIds,
      item.runtimeProvenance.relatedEvidenceIds,
    );
  }

  const createdAt = (options.now?.() ?? new Date()).toISOString();
  const candidates: EvidenceCandidate[] = [
    ...input.localEvidence.evidenceItems.map((item) => ({ item, fact: null })),
    ...input.externalEvidenceCollections.flatMap((collection) =>
      collection.evidenceItems.map((item) => ({ item, fact: null })),
    ),
    ...nonRuntimeAdditionalEvidence.map((item) => ({
      item,
      fact: null,
    })),
    ...input.runtimeEvidenceCollections.flatMap((collection) =>
      collection.evidenceItems.map((item) => ({
        item,
        fact: null,
      })),
    ),
    ...runtimeAdditionalEvidence.map((item) => ({
      item,
      fact: null,
    })),
    ...createGitEvidence(input.changeScope, createdAt),
  ];
  const uniqueCandidates: EvidenceCandidate[] = [];
  const seenItems = new Map<string, string>();
  for (const candidate of candidates) {
    const serialized = JSON.stringify(candidate.item);
    const existing = seenItems.get(candidate.item.id);
    if (existing === serialized) {
      continue;
    }
    if (existing !== undefined) {
      throw new Error(`Conflicting evidence item ID: ${candidate.item.id}`);
    }
    seenItems.set(candidate.item.id, serialized);
    uniqueCandidates.push(candidate);
  }

  const evidenceItems: EvidenceItem[] = [];
  const deterministicFacts: DeterministicFact[] = [];
  let remainingCharacters = input.maxTotalExcerptCharacters;
  let omittedExcerptCharacters = 0;
  const retainedEvidenceIds = new Set<string>();

  for (const candidate of uniqueCandidates) {
    if (evidenceItems.length >= input.maxEvidenceItems) {
      omittedExcerptCharacters += candidate.item.excerpt.length;
      continue;
    }
    if (candidate.item.excerpt.length > 0 && remainingCharacters === 0) {
      omittedExcerptCharacters += candidate.item.excerpt.length;
      continue;
    }
    if (
      candidate.item.runtimeProvenance !== undefined &&
      candidate.item.runtimeProvenance.relatedEvidenceIds.some(
        (relatedEvidenceId) =>
          !retainedEvidenceIds.has(relatedEvidenceId),
      )
    ) {
      omittedExcerptCharacters += candidate.item.excerpt.length;
      continue;
    }

    const bounded = truncateExcerpt(candidate.item, remainingCharacters);
    evidenceItems.push(bounded.item);
    retainedEvidenceIds.add(bounded.item.id);
    remainingCharacters -= bounded.item.excerpt.length;
    omittedExcerptCharacters += bounded.omittedCharacters;
    if (candidate.fact !== null) {
      deterministicFacts.push(candidate.fact);
    }
  }

  const omittedEvidenceItems = uniqueCandidates.length - evidenceItems.length;
  const allMissingEvidence = missingEvidenceFromInputs(
    input.changeScope,
    input.localEvidence,
    input.externalEvidenceCollections,
    input.runtimeEvidenceCollections,
  );
  const missingEvidence = allMissingEvidence.slice(0, 10_000);
  const omittedMissingEvidence =
    allMissingEvidence.length - missingEvidence.length;
  const result: ReviewBundle = {
    schemaVersion: CORE_SCHEMA_VERSION,
    id: bundleId(input.changeScope, evidenceItems, missingEvidence),
    createdAt,
    changeScope: input.changeScope,
    evidenceItems,
    evidenceIndex: evidenceItems.map((item) => ({
      evidenceId: item.id,
      relatedChangeIds: item.relatedChangeIds,
    })),
    deterministicFacts,
    missingEvidence,
    limits: {
      maxEvidenceItems: input.maxEvidenceItems,
      maxTotalExcerptCharacters: input.maxTotalExcerptCharacters,
    },
    truncation: {
      isTruncated:
        omittedEvidenceItems > 0 ||
        omittedExcerptCharacters > 0 ||
        omittedMissingEvidence > 0 ||
        input.changeScope.truncation.isTruncated ||
        input.localEvidence.truncation.isTruncated,
      omittedEvidenceItems,
      omittedExcerptCharacters,
      omittedMissingEvidence,
    },
  };

  return reviewBundleSchema.parse(result);
}
