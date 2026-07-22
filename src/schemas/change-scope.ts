import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  MAX_PATCH_CHARACTERS,
  gitObjectIdSchema,
  repositoryPathSchema,
  stableIdSchema,
  timestampSchema,
} from "./common.js";

export const changedFileStatusSchema = z.enum([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "type_changed",
  "unmerged",
  "unknown",
]);

export const commitSummarySchema = z.strictObject({
  id: stableIdSchema,
  objectId: gitObjectIdSchema,
  parentObjectIds: z.array(gitObjectIdSchema).max(64),
  summary: z.string().max(1_000),
  committedAt: timestampSchema,
});

export const diffExcerptSchema = z.strictObject({
  text: z.string().max(MAX_PATCH_CHARACTERS),
  isTruncated: z.boolean(),
  originalBytes: z.number().int().nonnegative().nullable(),
  retainedBytes: z.number().int().nonnegative(),
});

export const changedFileSchema = z.strictObject({
  id: stableIdSchema,
  path: repositoryPathSchema,
  previousPath: repositoryPathSchema.nullable(),
  status: changedFileStatusSchema,
  isBinary: z.boolean(),
  additions: z.number().int().nonnegative().nullable(),
  deletions: z.number().int().nonnegative().nullable(),
  diff: diffExcerptSchema.nullable(),
});

export const changeScopeErrorSchema = z.strictObject({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(2_000),
  path: repositoryPathSchema.nullable(),
});

export const changeScopeSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    repositoryRoot: z.string().min(1).max(4_096),
    baseRef: z.string().min(1).max(1_000),
    headRef: z.string().min(1).max(1_000),
    resolvedBase: gitObjectIdSchema,
    resolvedHead: gitObjectIdSchema,
    commits: z.array(commitSummarySchema).max(10_000),
    files: z.array(changedFileSchema).max(100_000),
    detectedLanguages: z.array(z.string().min(1).max(100)).max(1_000),
    detectedComponents: z.array(z.string().min(1).max(500)).max(10_000),
    limits: z.strictObject({
      maxFiles: z.number().int().positive(),
      maxDiffBytes: z.number().int().positive(),
      maxPatchBytesPerFile: z.number().int().positive(),
    }),
    truncation: z.strictObject({
      isTruncated: z.boolean(),
      reasons: z
        .array(
          z.enum([
            "file_limit",
            "total_diff_limit",
            "per_file_diff_limit",
          ]),
        )
        .max(3),
      omittedFiles: z.number().int().nonnegative(),
    }),
    errors: z.array(changeScopeErrorSchema).max(1_000),
  })
  .meta({
    id: `urn:change-trace-mcp:schema:change-scope:${CORE_SCHEMA_VERSION}`,
    title: "ChangeScope",
  });

export type ChangeScope = z.infer<typeof changeScopeSchema>;
export type ChangedFile = z.infer<typeof changedFileSchema>;
export type ChangedFileStatus = z.infer<typeof changedFileStatusSchema>;
