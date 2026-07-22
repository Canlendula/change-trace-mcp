import { z } from "zod";

import { CORE_SCHEMA_VERSION, stableIdSchema } from "./common.js";
import { findingSchema } from "./finding.js";

export const findingValidationIssueSchema = z.strictObject({
  code: z.string().min(1).max(100),
  path: z.string().min(1).max(1_000),
  message: z.string().min(1).max(2_000),
});

export const findingValidationWarningSchema = z.strictObject({
  findingId: stableIdSchema,
  index: z.number().int().nonnegative(),
  code: z.string().min(1).max(100),
  path: z.string().min(1).max(1_000),
  message: z.string().min(1).max(2_000),
});

export const findingValidationResultSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    bundleId: stableIdSchema,
    ok: z.boolean(),
    validFindings: z.array(findingSchema).max(1_000),
    rejectedFindings: z
      .array(
        z.strictObject({
          index: z.number().int().nonnegative(),
          findingId: stableIdSchema.nullable(),
          issues: z.array(findingValidationIssueSchema).min(1).max(100),
        }),
      )
      .max(1_000),
    warnings: z.array(findingValidationWarningSchema).max(10_000),
    summary: z.strictObject({
      submitted: z.number().int().nonnegative(),
      valid: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
      warnings: z.number().int().nonnegative(),
    }),
  })
  .meta({
    id: `urn:change-trace-mcp:schema:finding-validation-result:${CORE_SCHEMA_VERSION}`,
    title: "FindingValidationResult",
  });

export type FindingValidationIssue = z.infer<
  typeof findingValidationIssueSchema
>;
export type FindingValidationResult = z.infer<
  typeof findingValidationResultSchema
>;
export type FindingValidationWarning = z.infer<
  typeof findingValidationWarningSchema
>;
