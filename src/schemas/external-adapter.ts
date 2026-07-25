import { z } from "zod";

import {
  CORE_SCHEMA_VERSION,
  MAX_EVIDENCE_EXCERPT_CHARACTERS,
  sourceReferenceSchema,
  stableIdSchema,
  timestampSchema,
} from "./common.js";
import { evidenceTruncationSchema } from "./evidence.js";
import {
  externalAdapterIdentitySchema,
  externalSourceTypeSchema,
} from "./external-provenance.js";
export {
  externalAdapterIdentitySchema,
  externalSourceTypeSchema,
  type ExternalAdapterIdentity,
  type ExternalSourceType,
} from "./external-provenance.js";

const MAX_EXTERNAL_REFERENCES = 100;
const MAX_RELATED_CHANGE_IDS = 1_000;
const MAX_RELATION_REASON_CHARACTERS = 1_000;
const MAX_EXTERNAL_TITLE_CHARACTERS = 1_000;
const MAX_EXTERNAL_DIAGNOSTIC_CHARACTERS = 2_000;
const MAX_ADAPTER_ARGV_ENTRIES = 64;
const MAX_ADAPTER_ARGUMENT_CHARACTERS = 8_192;
const MAX_ADAPTER_SOURCE_SYSTEMS = 100;
const MAX_ADAPTER_CREDENTIAL_ENVIRONMENT_NAMES = 100;
const MAX_ADAPTER_TIMEOUT_MILLISECONDS = 300_000;
const MAX_ADAPTER_STDOUT_BYTES = 16 * 1024 * 1024;
const MAX_ADAPTER_STDERR_BYTES = 1024 * 1024;

const adapterArgumentSchema = z
  .string()
  .min(1)
  .max(MAX_ADAPTER_ARGUMENT_CHARACTERS)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
    message: "Adapter arguments cannot contain control characters",
  });

const adapterSourceSystemSchema = z.string().min(1).max(80);

const credentialEnvironmentNameSchema = z
  .string()
  .max(160)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/u);

export const externalAccessStatusSchema = z.enum([
  "available",
  "not_found",
  "permission_denied",
  "unsupported",
  "error",
]);

export const explicitExternalReferenceSchema = z.strictObject({
  requestId: stableIdSchema,
  sourceType: externalSourceTypeSchema,
  source: sourceReferenceSchema,
  relatedChangeIds: z.array(stableIdSchema).max(MAX_RELATED_CHANGE_IDS),
  relationReason: z
    .string()
    .min(1)
    .max(MAX_RELATION_REASON_CHARACTERS),
});

export const externalAdapterRegistrationSchema = z
  .strictObject({
    adapter: externalAdapterIdentitySchema,
    argv: z
      .array(adapterArgumentSchema)
      .min(1)
      .max(MAX_ADAPTER_ARGV_ENTRIES),
    sourceSystems: z
      .array(adapterSourceSystemSchema)
      .min(1)
      .max(MAX_ADAPTER_SOURCE_SYSTEMS),
    credentialEnvironmentNames: z
      .array(credentialEnvironmentNameSchema)
      .max(MAX_ADAPTER_CREDENTIAL_ENVIRONMENT_NAMES),
    limits: z.strictObject({
      timeoutMilliseconds: z
        .number()
        .int()
        .positive()
        .max(MAX_ADAPTER_TIMEOUT_MILLISECONDS),
      stdoutBytes: z
        .number()
        .int()
        .positive()
        .max(MAX_ADAPTER_STDOUT_BYTES),
      stderrBytes: z
        .number()
        .int()
        .positive()
        .max(MAX_ADAPTER_STDERR_BYTES),
    }),
  })
  .superRefine(
    ({ sourceSystems, credentialEnvironmentNames }, context) => {
      const uniqueSourceSystems = new Set(sourceSystems);
      if (uniqueSourceSystems.size !== sourceSystems.length) {
        context.addIssue({
          code: "custom",
          message: "Source-system allowlist entries must be unique",
          path: ["sourceSystems"],
        });
      }

      const normalizedEnvironmentNames = credentialEnvironmentNames.map(
        (name) => name.toUpperCase(),
      );
      if (
        new Set(normalizedEnvironmentNames).size !==
        normalizedEnvironmentNames.length
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Credential environment-variable allowlist entries must be unique",
          path: ["credentialEnvironmentNames"],
        });
      }
    },
  );

export const externalAvailableResultSchema = z
  .strictObject({
    accessStatus: z.literal("available"),
    requestId: stableIdSchema,
    sourceType: externalSourceTypeSchema,
    source: sourceReferenceSchema,
    title: z.string().min(1).max(MAX_EXTERNAL_TITLE_CHARACTERS),
    sourceUpdatedAt: timestampSchema.nullable(),
    retrievedAt: timestampSchema,
    excerpt: z.string().max(MAX_EVIDENCE_EXCERPT_CHARACTERS),
    truncation: evidenceTruncationSchema,
  })
  .superRefine(({ excerpt, truncation }, context) => {
    if (truncation.retainedCharacters !== excerpt.length) {
      context.addIssue({
        code: "custom",
        message: "retainedCharacters must equal the excerpt length",
        path: ["truncation", "retainedCharacters"],
      });
    }

    if (truncation.isTruncated) {
      if (truncation.originalCharacters === null) {
        context.addIssue({
          code: "custom",
          message: "Truncated results require a known original character count",
          path: ["truncation", "originalCharacters"],
        });
      } else if (
        truncation.originalCharacters < truncation.retainedCharacters
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Original characters cannot be smaller than retained characters",
          path: ["truncation", "originalCharacters"],
        });
      }
    } else if (
      truncation.originalCharacters !== null &&
      truncation.originalCharacters !== truncation.retainedCharacters
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A known original character count must equal retained characters when content is not truncated",
        path: ["truncation", "originalCharacters"],
      });
    }
  });

export const externalUnavailableResultSchema = z.strictObject({
  accessStatus: z.enum([
    "not_found",
    "permission_denied",
    "unsupported",
    "error",
  ]),
  requestId: stableIdSchema,
  sourceType: externalSourceTypeSchema,
  source: sourceReferenceSchema,
  retrievedAt: timestampSchema,
  message: z.string().min(1).max(MAX_EXTERNAL_DIAGNOSTIC_CHARACTERS),
});

export const externalAdapterResultSchema = z.discriminatedUnion(
  "accessStatus",
  [externalAvailableResultSchema, externalUnavailableResultSchema],
);

export const externalAdapterRequestSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    adapterId: stableIdSchema,
    references: z
      .array(explicitExternalReferenceSchema)
      .min(1)
      .max(MAX_EXTERNAL_REFERENCES),
  })
  .superRefine(({ references }, context) => {
    const requestIds = new Set<string>();
    references.forEach(({ requestId }, index) => {
      if (requestIds.has(requestId)) {
        context.addIssue({
          code: "custom",
          message: "Request IDs must be unique",
          path: ["references", index, "requestId"],
        });
      }
      requestIds.add(requestId);
    });
  })
  .meta({
    id: `urn:change-trace-mcp:schema:external-adapter-request:${CORE_SCHEMA_VERSION}`,
    title: "ExternalAdapterRequest",
  });

export const externalAdapterResponseSchema = z
  .strictObject({
    schemaVersion: z.literal(CORE_SCHEMA_VERSION),
    adapter: externalAdapterIdentitySchema,
    results: z
      .array(externalAdapterResultSchema)
      .min(1)
      .max(MAX_EXTERNAL_REFERENCES),
  })
  .superRefine(({ results }, context) => {
    const requestIds = new Set<string>();
    results.forEach(({ requestId }, index) => {
      if (requestIds.has(requestId)) {
        context.addIssue({
          code: "custom",
          message: "Result request IDs must be unique",
          path: ["results", index, "requestId"],
        });
      }
      requestIds.add(requestId);
    });
  })
  .meta({
    id: `urn:change-trace-mcp:schema:external-adapter-response:${CORE_SCHEMA_VERSION}`,
    title: "ExternalAdapterResponse",
  });

export type ExternalAccessStatus = z.infer<typeof externalAccessStatusSchema>;
export type ExplicitExternalReference = z.infer<
  typeof explicitExternalReferenceSchema
>;
export type ExternalAdapterRegistration = z.infer<
  typeof externalAdapterRegistrationSchema
>;
export type ExternalAvailableResult = z.infer<
  typeof externalAvailableResultSchema
>;
export type ExternalUnavailableResult = z.infer<
  typeof externalUnavailableResultSchema
>;
export type ExternalAdapterResult = z.infer<
  typeof externalAdapterResultSchema
>;
export type ExternalAdapterRequest = z.infer<
  typeof externalAdapterRequestSchema
>;
export type ExternalAdapterResponse = z.infer<
  typeof externalAdapterResponseSchema
>;
