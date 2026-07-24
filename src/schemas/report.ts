import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  sourceReferenceSchema,
  stableIdSchema,
  timestampSchema,
} from "./common.js";
import {
  findingCategorySchema,
  findingRecommendationSchema,
  findingSeveritySchema,
  findingStatusSchema,
} from "./finding.js";
import { reviewBundleSchema } from "./review-bundle.js";
import { findingValidationResultSchema } from "./finding-validation.js";

export const reportWarningSchema = z.strictObject({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(2_000),
  findingId: stableIdSchema.optional(),
});

export const reportFactSchema = z.strictObject({
  statement: z.string().min(1).max(4_000),
  evidenceIds: z.array(stableIdSchema).min(1).max(1_000),
});

const baseFindingFields = {
  id: stableIdSchema,
  category: findingCategorySchema,
  severity: findingSeveritySchema,
  confidence: z.number().min(0).max(1),
  title: z.string().min(1).max(300),
  expectedBehavior: z.string().min(1).max(8_000),
  observedBehavior: z.string().min(1).max(8_000),
  deterministicFacts: z.array(reportFactSchema).max(1_000),
  inference: z.string().min(1).max(8_000),
  evidenceIds: z.array(stableIdSchema).max(1_000),
  affectedSources: z.array(sourceReferenceSchema).max(1_000),
  recommendation: findingRecommendationSchema,
  warnings: z.array(reportWarningSchema).max(1_000),
} as const;

export const reportFindingConfirmedSchema = z.strictObject({
  ...baseFindingFields,
  status: z.literal("confirmed"),
});

export const reportFindingSuspectedSchema = z.strictObject({
  ...baseFindingFields,
  status: z.literal("suspected"),
});

export const reportFindingInconclusiveSchema = z.strictObject({
  ...baseFindingFields,
  status: z.literal("inconclusive"),
});

export const reportFindingSchema = z.strictObject({
  ...baseFindingFields,
  status: findingStatusSchema,
});

export const reportValidationIssueSchema = z.strictObject({
  code: z.string().min(1).max(100),
  path: z.string().min(1).max(1_000),
  message: z.string().min(1).max(2_000),
});

export const reportRejectedFindingSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  findingId: stableIdSchema.nullable(),
  issues: z.array(reportValidationIssueSchema).min(1).max(100),
});

export const reportMissingEvidenceSchema = z.strictObject({
  source: sourceReferenceSchema,
  reason: z.string().min(1).max(2_000),
  status: z.enum(["not_found", "inaccessible", "unsupported", "truncated"]),
});

export const reportSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    id: stableIdSchema,
    createdAt: timestampSchema,
    bundleId: stableIdSchema,
    reviewMeta: z.strictObject({
      reviewer: z.string().min(1).max(200),
      toolVersion: z.string().min(1).max(100).optional(),
      notes: z.string().max(4_000).optional(),
      declaredLimitations: z
        .array(z.string().min(1).max(2_000))
        .max(100)
        .optional(),
    }),
    findings: z.strictObject({
      confirmed: z.array(reportFindingConfirmedSchema).max(1_000),
      suspected: z.array(reportFindingSuspectedSchema).max(1_000),
      inconclusive: z.array(reportFindingInconclusiveSchema).max(1_000),
    }),
    rejectedFindings: z.array(reportRejectedFindingSchema).max(1_000),
    missingEvidence: z.array(reportMissingEvidenceSchema).max(10_000),
    evidenceCoverage: z.strictObject({
      totalEvidenceItems: z.number().int().nonnegative(),
      referencedEvidenceIds: z.array(stableIdSchema).max(10_000),
      unreferencedEvidenceIds: z.array(stableIdSchema).max(10_000),
    }),
    validationSummary: z.strictObject({
      submitted: z.number().int().nonnegative(),
      valid: z.number().int().nonnegative(),
      rejected: z.number().int().nonnegative(),
      warnings: z.number().int().nonnegative(),
    }),
    bundleLimits: z.strictObject({
      maxEvidenceItems: z.number().int().positive(),
      maxTotalExcerptCharacters: z.number().int().positive(),
    }),
    bundleTruncation: z.strictObject({
      isTruncated: z.boolean(),
      omittedEvidenceItems: z.number().int().nonnegative(),
      omittedExcerptCharacters: z.number().int().nonnegative(),
      omittedMissingEvidence: z.number().int().nonnegative(),
    }),
    warnings: z.array(reportWarningSchema).max(10_000),
  })
  .meta({
    id: `urn:change-trace-mcp:schema:report:${CORE_SCHEMA_VERSION}`,
    title: "Report",
  });

export type ReportWarning = z.infer<typeof reportWarningSchema>;
export type ReportFact = z.infer<typeof reportFactSchema>;
export type ReportFinding = z.infer<typeof reportFindingSchema>;
export type ReportValidationIssue = z.infer<typeof reportValidationIssueSchema>;
export type ReportRejectedFinding = z.infer<typeof reportRejectedFindingSchema>;
export type ReportMissingEvidence = z.infer<typeof reportMissingEvidenceSchema>;
export type Report = z.infer<typeof reportSchema>;

export const DEFAULT_MAX_REPORT_SIZE_BYTES = 10 * 1024 * 1024;
export const HARD_MAX_REPORT_SIZE_BYTES = 100 * 1024 * 1024;

export const writeReportInputSchema = z.strictObject({
  bundle: reviewBundleSchema,
  validationResult: findingValidationResultSchema,
  reviewMeta: z.strictObject({
    reviewer: z.string().min(1).max(200),
    createdAt: timestampSchema,
    toolVersion: z.string().min(1).max(100).optional(),
    notes: z.string().max(4_000).optional(),
    declaredLimitations: z
      .array(z.string().min(1).max(2_000))
      .max(100)
      .optional(),
  }),
  repositoryRoot: z.string().min(1).max(4_096),
  outputDirectory: z.string().min(1).max(1_000),
  reportName: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/,
      "reportName must contain only safe filename characters",
    ),
  overwrite: z.boolean().optional(),
  maxReportSizeBytes: z
    .number()
    .int()
    .positive()
    .max(HARD_MAX_REPORT_SIZE_BYTES)
    .optional(),
});

export type WriteReportInput = z.infer<typeof writeReportInputSchema>;

export const writeReportOutputSchema = z.strictObject({
  reportId: stableIdSchema,
  reportPath: z.string().min(1).max(4_096),
  markdownFile: z.string().min(1).max(4_096),
  jsonFile: z.string().min(1).max(4_096),
  markdownSizeBytes: z.number().int().nonnegative(),
  jsonSizeBytes: z.number().int().nonnegative(),
});

export type WriteReportOutput = z.infer<typeof writeReportOutputSchema>;
