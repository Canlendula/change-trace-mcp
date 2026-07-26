import { z } from "zod";

import { sourceReferenceSchema } from "./common.js";
import { runtimeUnavailableProvenanceSchema } from "./runtime-provenance.js";

export const missingEvidenceSchema = z.strictObject({
  source: sourceReferenceSchema,
  reason: z.string().min(1).max(2_000),
  status: z.enum([
    "not_found",
    "inaccessible",
    "unsupported",
    "truncated",
  ]),
});

function normalizedRuntimeMissingStatus(
  accessStatus: z.infer<
    typeof runtimeUnavailableProvenanceSchema
  >["accessStatus"],
): z.infer<typeof missingEvidenceSchema>["status"] {
  return accessStatus === "malformed"
    ? "unsupported"
    : accessStatus;
}

export const runtimeMissingEvidenceSchema = missingEvidenceSchema
  .safeExtend({
    runtimeUnavailableProvenance:
      runtimeUnavailableProvenanceSchema,
  })
  .superRefine((missing, context) => {
    if (
      missing.status !==
      normalizedRuntimeMissingStatus(
        missing.runtimeUnavailableProvenance.accessStatus,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Runtime missing status must match its original access status",
        path: ["status"],
      });
    }
  });

export const reviewMissingEvidenceSchema = z.union([
  missingEvidenceSchema,
  runtimeMissingEvidenceSchema,
]);

export type MissingEvidence = z.infer<typeof missingEvidenceSchema>;
export type RuntimeMissingEvidence = z.infer<
  typeof runtimeMissingEvidenceSchema
>;
export type ReviewMissingEvidence = z.infer<
  typeof reviewMissingEvidenceSchema
>;
