import { z } from "zod";

export const CORE_SCHEMA_VERSION = "1.0.0";
export const MAX_EVIDENCE_EXCERPT_CHARACTERS = 32_000;
export const MAX_PATCH_CHARACTERS = 1_000_000;

export const stableIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);

export const gitObjectIdSchema = z
  .string()
  .regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);

export const sha256HashSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const timestampSchema = z.iso.datetime({ offset: true });

export const repositoryPathSchema = z.string().min(1).max(4_096);

export const sourceReferenceSchema = z
  .strictObject({
    system: z.string().min(1).max(80),
    locator: z.string().min(1).max(4_096),
    uri: z.string().min(1).max(8_192).nullable(),
  })
  .meta({
    id: `urn:change-trace-mcp:schema:source-reference:${CORE_SCHEMA_VERSION}`,
    title: "SourceReference",
  });

export type SourceReference = z.infer<typeof sourceReferenceSchema>;
