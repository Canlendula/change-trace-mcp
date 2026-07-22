import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  sourceReferenceSchema,
  stableIdSchema,
} from "./common.js";

export const findingCategorySchema = z.enum([
  "requirement_missing",
  "undocumented_behavior",
  "contradictory_evidence",
  "test_gap",
  "stale_documentation",
  "security",
  "other",
]);

export const findingSeveritySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export const findingStatusSchema = z.enum([
  "confirmed",
  "suspected",
  "inconclusive",
]);

export const findingRecommendationSchema = z.enum([
  "update_code",
  "update_documentation",
  "add_or_adjust_tests",
  "investigate",
  "accept_intentional_difference",
]);

export const findingFactSchema = z.strictObject({
  statement: z.string().min(1).max(4_000),
  evidenceIds: z.array(stableIdSchema).min(1).max(1_000),
});

export const findingSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    id: stableIdSchema,
    category: findingCategorySchema,
    severity: findingSeveritySchema,
    confidence: z.number().min(0).max(1),
    title: z.string().min(1).max(300),
    expectedBehavior: z.string().min(1).max(8_000),
    observedBehavior: z.string().min(1).max(8_000),
    deterministicFacts: z.array(findingFactSchema).max(1_000),
    inference: z.string().min(1).max(8_000),
    evidenceIds: z.array(stableIdSchema).max(1_000),
    affectedSources: z.array(sourceReferenceSchema).max(1_000),
    recommendation: findingRecommendationSchema,
    status: findingStatusSchema,
  })
  .meta({
    id: `urn:change-trace-mcp:schema:finding:${CORE_SCHEMA_VERSION}`,
    title: "Finding",
  });

export type Finding = z.infer<typeof findingSchema>;
export type FindingCategory = z.infer<typeof findingCategorySchema>;
export type FindingRecommendation = z.infer<
  typeof findingRecommendationSchema
>;
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
export type FindingStatus = z.infer<typeof findingStatusSchema>;
