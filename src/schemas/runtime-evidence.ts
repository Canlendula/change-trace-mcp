import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  MAX_EVIDENCE_EXCERPT_CHARACTERS,
  sourceReferenceSchema,
  stableIdSchema,
  timestampSchema,
} from "./common.js";
import {
  evidenceItemSchema,
  evidenceTruncationSchema,
} from "./evidence.js";
import { missingEvidenceSchema } from "./review-bundle.js";
import {
  runtimeEnvironmentSchema,
  runtimeEvidenceProducerSchema,
  runtimeKindSchema,
  runtimeOutcomeSchema,
  runtimeProvenanceSchema,
  runtimeSourceFormatSchema,
} from "./runtime-provenance.js";

const MAX_MANIFEST_RECORDS = 1_000;
const MAX_RUNTIME_COLLECTION_OUTCOMES = 1_000;
const MAX_RELATED_CHANGE_IDS = 1_000;
const MAX_RELATED_EVIDENCE_IDS = 1_000;
const MAX_ARTIFACT_REFERENCES = 100;
const MAX_UNAVAILABLE_REASON_CHARACTERS = 2_000;

const safeDurationSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

const behavioralRuntimeKindSchema = z.enum([
  "test_run",
  "test_case",
  "api_observation",
  "browser_observation",
  "other",
]);

export const runtimeAccessStatusSchema = z.enum([
  "available",
  "not_found",
  "inaccessible",
  "unsupported",
  "malformed",
  "truncated",
]);

const runtimeRecordBaseShape = {
  recordId: stableIdSchema,
  source: sourceReferenceSchema,
  environment: runtimeEnvironmentSchema,
  relatedChangeIds: z.array(stableIdSchema).max(MAX_RELATED_CHANGE_IDS),
  relatedEvidenceIds: z.array(stableIdSchema).max(MAX_RELATED_EVIDENCE_IDS),
};

function addRelatedIdIssues(
  record: {
    relatedChangeIds: string[];
    relatedEvidenceIds: string[];
  },
  context: z.RefinementCtx,
): void {
  for (const field of ["relatedChangeIds", "relatedEvidenceIds"] as const) {
    if (new Set(record[field]).size !== record[field].length) {
      context.addIssue({
        code: "custom",
        message:
          field === "relatedChangeIds"
            ? "Related change IDs must be unique"
            : "Related evidence IDs must be unique",
        path: [field],
      });
    }
  }
}

function addTruncationIssues(
  summary: string,
  truncation: z.infer<typeof evidenceTruncationSchema>,
  context: z.RefinementCtx,
): void {
  if (truncation.retainedCharacters !== summary.length) {
    context.addIssue({
      code: "custom",
      message: "retainedCharacters must equal the summary length",
      path: ["truncation", "retainedCharacters"],
    });
  }

  if (truncation.isTruncated) {
    if (truncation.originalCharacters === null) {
      context.addIssue({
        code: "custom",
        message: "Truncated evidence requires a known original character count",
        path: ["truncation", "originalCharacters"],
      });
    } else if (
      truncation.originalCharacters < truncation.retainedCharacters
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Original characters cannot be smaller than retained characters",
        path: ["truncation", "originalCharacters"],
      });
    }
  } else if (
    truncation.originalCharacters !== null &&
    truncation.originalCharacters !== truncation.retainedCharacters
  ) {
    context.addIssue({
      code: "custom",
      message:
        "A known original character count must equal retained characters when evidence is not truncated",
      path: ["truncation", "originalCharacters"],
    });
  }
}

export const runtimeAvailableBehavioralRecordSchema = z
  .strictObject({
    ...runtimeRecordBaseShape,
    kind: behavioralRuntimeKindSchema,
    accessStatus: z.literal("available"),
    outcome: runtimeOutcomeSchema,
    startedAt: timestampSchema.nullable(),
    completedAt: timestampSchema.nullable(),
    durationMilliseconds: safeDurationSchema.nullable(),
    summary: z.string().max(MAX_EVIDENCE_EXCERPT_CHARACTERS),
    artifactReferences: z
      .array(sourceReferenceSchema)
      .max(MAX_ARTIFACT_REFERENCES),
    truncation: evidenceTruncationSchema,
  })
  .superRefine((record, context) => {
    addRelatedIdIssues(record, context);
    addTruncationIssues(record.summary, record.truncation, context);
    if (
      record.startedAt !== null &&
      record.completedAt !== null &&
      Date.parse(record.completedAt) < Date.parse(record.startedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "Runtime completion cannot precede its start",
        path: ["completedAt"],
      });
    }
  });

export const runtimeAvailableEnvironmentRecordSchema = z
  .strictObject({
    ...runtimeRecordBaseShape,
    kind: z.literal("environment_metadata"),
    accessStatus: z.literal("available"),
    summary: z.string().max(MAX_EVIDENCE_EXCERPT_CHARACTERS),
    artifactReferences: z
      .array(sourceReferenceSchema)
      .max(MAX_ARTIFACT_REFERENCES),
    truncation: evidenceTruncationSchema,
  })
  .superRefine((record, context) => {
    addRelatedIdIssues(record, context);
    addTruncationIssues(record.summary, record.truncation, context);
  });

export const runtimeUnavailableRecordSchema = z
  .strictObject({
    ...runtimeRecordBaseShape,
    kind: runtimeKindSchema,
    accessStatus: z.enum([
      "not_found",
      "inaccessible",
      "unsupported",
      "malformed",
      "truncated",
    ]),
    reason: z.string().min(1).max(MAX_UNAVAILABLE_REASON_CHARACTERS),
  })
  .superRefine(addRelatedIdIssues);

export const runtimeEvidenceManifestRecordSchema = z.union([
  runtimeAvailableBehavioralRecordSchema,
  runtimeAvailableEnvironmentRecordSchema,
  runtimeUnavailableRecordSchema,
]);

export const runtimeEvidenceManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    producer: runtimeEvidenceProducerSchema,
    sourceFormat: runtimeSourceFormatSchema,
    records: z
      .array(runtimeEvidenceManifestRecordSchema)
      .min(1)
      .max(MAX_MANIFEST_RECORDS),
  })
  .superRefine(({ records }, context) => {
    const recordIds = new Set<string>();
    records.forEach(({ recordId }, index) => {
      if (recordIds.has(recordId)) {
        context.addIssue({
          code: "custom",
          message: "Manifest record IDs must be unique",
          path: ["records", index, "recordId"],
        });
      }
      recordIds.add(recordId);
    });
  })
  .meta({
    id: `urn:change-trace-mcp:schema:runtime-evidence-manifest:${CORE_SCHEMA_VERSION}`,
    title: "RuntimeEvidenceManifest",
  });

function producersMatch(
  first: z.infer<typeof runtimeEvidenceProducerSchema>,
  second: z.infer<typeof runtimeEvidenceProducerSchema>,
): boolean {
  return (
    first.id === second.id &&
    first.name === second.name &&
    first.version === second.version
  );
}

export const runtimeEvidenceItemSchema = evidenceItemSchema.superRefine(
  (item, context) => {
    if (item.runtimeProvenance === undefined) {
      context.addIssue({
        code: "custom",
        message: "Runtime evidence requires runtime provenance",
        path: ["runtimeProvenance"],
      });
    }
  },
);

export const runtimeEvidenceCollectionSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    producer: runtimeEvidenceProducerSchema,
    evidenceItems: z
      .array(runtimeEvidenceItemSchema)
      .max(MAX_RUNTIME_COLLECTION_OUTCOMES),
    missingEvidence: z
      .array(missingEvidenceSchema)
      .max(MAX_RUNTIME_COLLECTION_OUTCOMES),
  })
  .superRefine(
    ({ producer, evidenceItems, missingEvidence }, context) => {
      if (
        evidenceItems.length + missingEvidence.length >
        MAX_RUNTIME_COLLECTION_OUTCOMES
      ) {
        context.addIssue({
          code: "custom",
          message: "Runtime evidence collections cannot exceed 1,000 outcomes",
          path: [],
        });
      }

      const evidenceIds = new Set<string>();
      evidenceItems.forEach((item, index) => {
        if (evidenceIds.has(item.id)) {
          context.addIssue({
            code: "custom",
            message: "Runtime evidence IDs must be unique",
            path: ["evidenceItems", index, "id"],
          });
        }
        evidenceIds.add(item.id);

        if (
          item.runtimeProvenance !== undefined &&
          !producersMatch(producer, item.runtimeProvenance.producer)
        ) {
          context.addIssue({
            code: "custom",
            message:
              "Runtime evidence provenance must match the collection producer",
            path: [
              "evidenceItems",
              index,
              "runtimeProvenance",
              "producer",
            ],
          });
        }
      });
    },
  )
  .meta({
    id: `urn:change-trace-mcp:schema:runtime-evidence-collection:${CORE_SCHEMA_VERSION}`,
    title: "RuntimeEvidenceCollection",
  });

export type RuntimeAccessStatus = z.infer<typeof runtimeAccessStatusSchema>;
export type RuntimeAvailableBehavioralRecord = z.infer<
  typeof runtimeAvailableBehavioralRecordSchema
>;
export type RuntimeAvailableEnvironmentRecord = z.infer<
  typeof runtimeAvailableEnvironmentRecordSchema
>;
export type RuntimeUnavailableRecord = z.infer<
  typeof runtimeUnavailableRecordSchema
>;
export type RuntimeEvidenceManifestRecord = z.infer<
  typeof runtimeEvidenceManifestRecordSchema
>;
export type RuntimeEvidenceManifest = z.infer<
  typeof runtimeEvidenceManifestSchema
>;
export type RuntimeEvidenceItem = z.infer<typeof runtimeEvidenceItemSchema>;
export type RuntimeEvidenceCollection = z.infer<
  typeof runtimeEvidenceCollectionSchema
>;
