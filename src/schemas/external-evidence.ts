import { z } from "zod";

import { CORE_SCHEMA_VERSION } from "./common.js";
import { evidenceItemSchema } from "./evidence.js";
import { externalAdapterIdentitySchema } from "./external-provenance.js";
import { missingEvidenceSchema } from "./missing-evidence.js";

const MAX_EXTERNAL_OUTCOMES = 100;

function adaptersMatch(
  first: z.infer<typeof externalAdapterIdentitySchema>,
  second: z.infer<typeof externalAdapterIdentitySchema>,
): boolean {
  return (
    first.id === second.id &&
    first.name === second.name &&
    first.version === second.version
  );
}

export const externalEvidenceCollectionSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    adapter: externalAdapterIdentitySchema,
    evidenceItems: z.array(evidenceItemSchema).max(MAX_EXTERNAL_OUTCOMES),
    missingEvidence: z.array(missingEvidenceSchema).max(MAX_EXTERNAL_OUTCOMES),
  })
  .superRefine(
    ({ adapter, evidenceItems, missingEvidence }, context) => {
      if (evidenceItems.length + missingEvidence.length > MAX_EXTERNAL_OUTCOMES) {
        context.addIssue({
          code: "custom",
          message: "External evidence collections cannot exceed 100 outcomes",
          path: [],
        });
      }

      evidenceItems.forEach((item, index) => {
        if (item.type !== "document") {
          context.addIssue({
            code: "custom",
            message: "External evidence items must use the document type",
            path: ["evidenceItems", index, "type"],
          });
        }
        if (item.trustLevel !== "untrusted_external") {
          context.addIssue({
            code: "custom",
            message: "External evidence must remain untrusted",
            path: ["evidenceItems", index, "trustLevel"],
          });
        }
        if (item.externalProvenance === undefined) {
          context.addIssue({
            code: "custom",
            message: "External evidence requires external provenance",
            path: ["evidenceItems", index, "externalProvenance"],
          });
        } else if (!adaptersMatch(adapter, item.externalProvenance.adapter)) {
          context.addIssue({
            code: "custom",
            message:
              "External evidence provenance must match the collection adapter",
            path: [
              "evidenceItems",
              index,
              "externalProvenance",
              "adapter",
            ],
          });
        }
      });
    },
  )
  .meta({
    id: `urn:change-trace-mcp:schema:external-evidence-collection:${CORE_SCHEMA_VERSION}`,
    title: "ExternalEvidenceCollection",
  });

export type ExternalEvidenceCollection = z.infer<
  typeof externalEvidenceCollectionSchema
>;
