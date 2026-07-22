import { z } from "zod";

import { changeScopeSchema } from "./change-scope.js";
import {
  CORE_SCHEMA_VERSION,
  sourceReferenceSchema,
  stableIdSchema,
  timestampSchema,
} from "./common.js";
import { evidenceItemSchema } from "./evidence.js";

export const deterministicFactSchema = z.strictObject({
  id: stableIdSchema,
  statement: z.string().min(1).max(4_000),
  evidenceIds: z.array(stableIdSchema).min(1).max(1_000),
});

export const missingEvidenceSchema = z.strictObject({
  source: sourceReferenceSchema,
  reason: z.string().min(1).max(2_000),
  status: z.enum(["not_found", "inaccessible", "unsupported", "truncated"]),
});

export const reviewBundleSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    id: stableIdSchema,
    createdAt: timestampSchema,
    changeScope: changeScopeSchema,
    evidenceItems: z.array(evidenceItemSchema).max(10_000),
    evidenceIndex: z
      .array(
        z.strictObject({
          evidenceId: stableIdSchema,
          relatedChangeIds: z.array(stableIdSchema).max(1_000),
        }),
      )
      .max(10_000),
    deterministicFacts: z.array(deterministicFactSchema).max(10_000),
    missingEvidence: z.array(missingEvidenceSchema).max(10_000),
    limits: z.strictObject({
      maxEvidenceItems: z.number().int().positive(),
      maxTotalExcerptCharacters: z.number().int().positive(),
    }),
    truncation: z.strictObject({
      isTruncated: z.boolean(),
      omittedEvidenceItems: z.number().int().nonnegative(),
      omittedExcerptCharacters: z.number().int().nonnegative(),
      omittedMissingEvidence: z.number().int().nonnegative(),
    }),
  })
  .meta({
    id: `urn:change-trace-mcp:schema:review-bundle:${CORE_SCHEMA_VERSION}`,
    title: "ReviewBundle",
  });

export type DeterministicFact = z.infer<typeof deterministicFactSchema>;
export type MissingEvidence = z.infer<typeof missingEvidenceSchema>;
export type ReviewBundle = z.infer<typeof reviewBundleSchema>;
