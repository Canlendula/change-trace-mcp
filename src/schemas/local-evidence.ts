import { z } from "zod";

import { CORE_SCHEMA_VERSION, repositoryPathSchema } from "./common.js";
import { evidenceItemSchema } from "./evidence.js";

export const localEvidenceCollectionErrorSchema = z.strictObject({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(2_000),
  path: repositoryPathSchema.nullable(),
});

export const localEvidenceCollectionSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    repositoryRoot: z.string().min(1).max(4_096),
    evidenceItems: z.array(evidenceItemSchema).max(10_000),
    scannedEntries: z.number().int().nonnegative(),
    matchedFiles: z.number().int().nonnegative(),
    limits: z.strictObject({
      maxScannedEntries: z.number().int().positive(),
      maxFiles: z.number().int().positive(),
      maxFileBytes: z.number().int().positive(),
      maxExcerptCharactersPerFile: z.number().int().positive(),
      maxTotalExcerptCharacters: z.number().int().positive(),
    }),
    truncation: z.strictObject({
      isTruncated: z.boolean(),
      reasons: z
        .array(
          z.enum([
            "scan_entry_limit",
            "file_limit",
            "file_byte_limit",
            "per_file_excerpt_limit",
            "total_excerpt_limit",
          ]),
        )
        .max(5),
      omittedFiles: z.number().int().nonnegative(),
      knownOmittedCharacters: z.number().int().nonnegative(),
    }),
    errors: z.array(localEvidenceCollectionErrorSchema).max(1_000),
  })
  .meta({
    id: `urn:change-trace-mcp:schema:local-evidence-collection:${CORE_SCHEMA_VERSION}`,
    title: "LocalEvidenceCollection",
  });

export type LocalEvidenceCollection = z.infer<
  typeof localEvidenceCollectionSchema
>;
export type LocalEvidenceCollectionError = z.infer<
  typeof localEvidenceCollectionErrorSchema
>;
