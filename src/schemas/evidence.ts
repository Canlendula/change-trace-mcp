import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  MAX_EVIDENCE_EXCERPT_CHARACTERS,
  sha256HashSchema,
  sourceReferenceSchema,
  stableIdSchema,
  timestampSchema,
} from "./common.js";
import { externalProvenanceSchema } from "./external-provenance.js";
import { runtimeProvenanceSchema } from "./runtime-provenance.js";

export const evidenceTypeSchema = z.enum([
  "git_diff",
  "commit",
  "document",
  "test_result",
  "runtime_observation",
  "configuration",
  "other",
]);

export const trustLevelSchema = z.enum([
  "trusted_repository",
  "trusted_configured_source",
  "untrusted_external",
  "observed_runtime",
]);

export const redactionSchema = z.strictObject({
  kind: z.enum(["secret", "personal_data", "policy", "other"]),
  count: z.number().int().positive(),
  note: z.string().min(1).max(500).nullable(),
});

export const evidenceTruncationSchema = z.strictObject({
  isTruncated: z.boolean(),
  originalCharacters: z.number().int().nonnegative().nullable(),
  retainedCharacters: z.number().int().nonnegative(),
});

function expectedRuntimeEvidenceType(
  kind: z.infer<typeof runtimeProvenanceSchema>["kind"],
): "test_result" | "runtime_observation" | "configuration" {
  if (kind === "test_run" || kind === "test_case") {
    return "test_result";
  }
  if (kind === "environment_metadata") {
    return "configuration";
  }
  return "runtime_observation";
}

export const evidenceItemSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    id: stableIdSchema,
    type: evidenceTypeSchema,
    source: sourceReferenceSchema,
    retrievedAt: timestampSchema,
    contentHash: sha256HashSchema.nullable(),
    relatedChangeIds: z.array(stableIdSchema).max(1_000),
    excerpt: z.string().max(MAX_EVIDENCE_EXCERPT_CHARACTERS),
    selectionReason: z.string().min(1).max(1_000),
    trustLevel: trustLevelSchema,
    truncation: evidenceTruncationSchema,
    redactions: z.array(redactionSchema).max(100),
    externalProvenance: externalProvenanceSchema.optional(),
    runtimeProvenance: runtimeProvenanceSchema.optional(),
  })
  .superRefine((item, context) => {
    if (item.runtimeProvenance === undefined) {
      return;
    }

    if (item.externalProvenance !== undefined) {
      context.addIssue({
        code: "custom",
        message: "External and runtime provenance cannot coexist",
        path: ["runtimeProvenance"],
      });
    }
    if (item.trustLevel !== "observed_runtime") {
      context.addIssue({
        code: "custom",
        message: "Runtime provenance requires observed_runtime trust",
        path: ["trustLevel"],
      });
    }
    if (item.type !== expectedRuntimeEvidenceType(item.runtimeProvenance.kind)) {
      context.addIssue({
        code: "custom",
        message: "Evidence type must match its runtime provenance kind",
        path: ["type"],
      });
    }
  })
  .meta({
    id: `urn:change-trace-mcp:schema:evidence-item:${CORE_SCHEMA_VERSION}`,
    title: "EvidenceItem",
  });

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;
export type TrustLevel = z.infer<typeof trustLevelSchema>;
