import { z } from "zod";

import {
  sourceReferenceSchema,
  stableIdSchema,
  timestampSchema,
} from "./common.js";

const MAX_PRODUCER_IDENTITY_CHARACTERS = 160;
const MAX_ENVIRONMENT_NAME_CHARACTERS = 200;
const MAX_RUNTIME_ARTIFACT_REFERENCES = 100;
const MAX_RELATED_EVIDENCE_IDS = 1_000;

const safeDurationSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const runtimeEvidenceProducerSchema = z.strictObject({
  id: stableIdSchema,
  name: z.string().min(1).max(MAX_PRODUCER_IDENTITY_CHARACTERS),
  version: z.string().min(1).max(MAX_PRODUCER_IDENTITY_CHARACTERS),
});

export const runtimeSourceFormatSchema = z.enum([
  "junit_xml",
  "playwright_json",
  "playwright_blob",
  "api_smoke",
  "browser_mcp",
  "ci_summary",
  "generic_json",
  "other",
]);

export const runtimeKindSchema = z.enum([
  "test_run",
  "test_case",
  "api_observation",
  "browser_observation",
  "environment_metadata",
  "other",
]);

export const runtimeOutcomeSchema = z.enum([
  "passed",
  "failed",
  "skipped",
  "timed_out",
  "cancelled",
  "errored",
]);

export const runtimeEnvironmentKindSchema = z.enum([
  "local",
  "ci",
  "staging",
  "other",
]);

export const runtimeEnvironmentSchema = z.strictObject({
  kind: runtimeEnvironmentKindSchema,
  name: z.string().min(1).max(MAX_ENVIRONMENT_NAME_CHARACTERS).nullable(),
  source: sourceReferenceSchema,
});

export const runtimeProvenanceSchema = z
  .strictObject({
    producer: runtimeEvidenceProducerSchema,
    sourceFormat: runtimeSourceFormatSchema,
    manifestRecordId: stableIdSchema,
    kind: runtimeKindSchema,
    environment: runtimeEnvironmentSchema,
    outcome: runtimeOutcomeSchema.nullable(),
    startedAt: timestampSchema.nullable(),
    completedAt: timestampSchema.nullable(),
    durationMilliseconds: safeDurationSchema.nullable(),
    artifactReferences: z
      .array(sourceReferenceSchema)
      .max(MAX_RUNTIME_ARTIFACT_REFERENCES),
    relatedEvidenceIds: z.array(stableIdSchema).max(MAX_RELATED_EVIDENCE_IDS),
  })
  .superRefine((provenance, context) => {
    const relatedEvidenceIds = new Set(provenance.relatedEvidenceIds);
    if (relatedEvidenceIds.size !== provenance.relatedEvidenceIds.length) {
      context.addIssue({
        code: "custom",
        message: "Related evidence IDs must be unique",
        path: ["relatedEvidenceIds"],
      });
    }

    if (provenance.kind === "environment_metadata") {
      for (const field of [
        "outcome",
        "startedAt",
        "completedAt",
        "durationMilliseconds",
      ] as const) {
        if (provenance[field] !== null) {
          context.addIssue({
            code: "custom",
            message:
              "Environment metadata cannot carry execution outcome or timing",
            path: [field],
          });
        }
      }
    } else if (provenance.outcome === null) {
      context.addIssue({
        code: "custom",
        message: "Executed runtime provenance requires an outcome",
        path: ["outcome"],
      });
    }

    if (
      provenance.startedAt !== null &&
      provenance.completedAt !== null &&
      Date.parse(provenance.completedAt) < Date.parse(provenance.startedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "Runtime completion cannot precede its start",
        path: ["completedAt"],
      });
    }
  });

export type RuntimeEvidenceProducer = z.infer<
  typeof runtimeEvidenceProducerSchema
>;
export type RuntimeSourceFormat = z.infer<typeof runtimeSourceFormatSchema>;
export type RuntimeKind = z.infer<typeof runtimeKindSchema>;
export type RuntimeOutcome = z.infer<typeof runtimeOutcomeSchema>;
export type RuntimeEnvironmentKind = z.infer<
  typeof runtimeEnvironmentKindSchema
>;
export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;
export type RuntimeProvenance = z.infer<typeof runtimeProvenanceSchema>;
