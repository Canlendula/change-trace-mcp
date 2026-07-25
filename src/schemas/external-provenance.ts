import { z } from "zod";

import { stableIdSchema, timestampSchema } from "./common.js";

const MAX_ADAPTER_IDENTITY_CHARACTERS = 160;
const MAX_EXTERNAL_TITLE_CHARACTERS = 1_000;

export const externalSourceTypeSchema = z.enum([
  "document",
  "project_item",
  "comment",
  "linked_page",
  "other",
]);

export const externalAdapterIdentitySchema = z.strictObject({
  id: stableIdSchema,
  name: z.string().min(1).max(MAX_ADAPTER_IDENTITY_CHARACTERS),
  version: z.string().min(1).max(MAX_ADAPTER_IDENTITY_CHARACTERS),
});

export const externalProvenanceSchema = z.strictObject({
  adapter: externalAdapterIdentitySchema,
  sourceType: externalSourceTypeSchema,
  title: z.string().min(1).max(MAX_EXTERNAL_TITLE_CHARACTERS),
  sourceUpdatedAt: timestampSchema.nullable(),
});

export type ExternalSourceType = z.infer<typeof externalSourceTypeSchema>;
export type ExternalAdapterIdentity = z.infer<
  typeof externalAdapterIdentitySchema
>;
export type ExternalProvenance = z.infer<typeof externalProvenanceSchema>;
