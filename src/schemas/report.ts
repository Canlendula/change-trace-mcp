import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  stableIdSchema,
  timestampSchema,
} from "./common.js";
import {
  findingCategorySchema,
  findingRecommendationSchema,
  findingSeveritySchema,
  findingStatusSchema,
} from "./finding.js";

export const reportWarningSchema = z.strictObject({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(2_000),
  findingId: stableIdSchema.optional(),
});

export const reportFindingSchema = z.strictObject({
  id: stableIdSchema,
  category: findingCategorySchema,
  severity: findingSeveritySchema,
  confidence: z.number().min(0).max(1),
  title: z.string().min(1).max(300),
  expectedBehavior: z.string().min(1).max(8_000),
  observedBehavior: z.string().min(1).max(8_000),
  recommendation: findingRecommendationSchema,
  status: findingStatusSchema,
  evidenceCount: z.number().int().nonnegative(),
  warnings: z.array(reportWarningSchema).max(1_000),
});

export const reportRejectedFindingSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  findingId: stableIdSchema.nullable(),
  reasonCodes: z.array(z.string().min(1).max(100)).min(1).max(100),
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
      confirmed: z.array(reportFindingSchema).max(1_000),
      suspected: z.array(reportFindingSchema).max(1_000),
      inconclusive: z.array(reportFindingSchema).max(1_000),
    }),
    rejectedFindings: z.array(reportRejectedFindingSchema).max(1_000),
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
export type ReportFinding = z.infer<typeof reportFindingSchema>;
export type ReportRejectedFinding = z.infer<typeof reportRejectedFindingSchema>;
export type Report = z.infer<typeof reportSchema>;

export const writeReportInputSchema = z.strictObject({
  bundle: z.object({}).passthrough(),
  validationResult: z.object({}).passthrough(),
  reviewMeta: z.strictObject({
    reviewer: z.string().min(1).max(200),
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
  maxReportSizeBytes: z.number().int().positive().optional(),
});

export type WriteReportInput = z.infer<typeof writeReportInputSchema>;

export const writeReportOutputSchema = z.strictObject({
  reportId: stableIdSchema,
  reportPath: z.string().min(1),
  markdownFile: z.string().min(1),
  jsonFile: z.string().min(1),
  markdownSizeBytes: z.number().int().nonnegative(),
  jsonSizeBytes: z.number().int().nonnegative(),
});

export type WriteReportOutput = z.infer<typeof writeReportOutputSchema>;
