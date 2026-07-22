import { z } from "zod";

import { changeScopeSchema } from "./change-scope.js";
import { CORE_SCHEMA_VERSION } from "./common.js";
import { evidenceItemSchema } from "./evidence.js";
import { findingSchema } from "./finding.js";
import { localEvidenceCollectionSchema } from "./local-evidence.js";
import { reviewBundleSchema } from "./review-bundle.js";

export type JsonSchemaDocument = Readonly<Record<string, unknown>> & {
  readonly $id: string;
  readonly $schema?: string;
};

export type CoreJsonSchemas = {
  readonly evidenceItem: JsonSchemaDocument;
  readonly changeScope: JsonSchemaDocument;
  readonly reviewBundle: JsonSchemaDocument;
  readonly finding: JsonSchemaDocument;
  readonly localEvidenceCollection: JsonSchemaDocument;
};

export function exportCoreJsonSchemas(): CoreJsonSchemas {
  const options = {
    target: "draft-2020-12" as const,
    io: "output" as const,
    reused: "ref" as const,
  };

  return {
    evidenceItem: {
      $id: `urn:change-trace-mcp:schema:evidence-item:${CORE_SCHEMA_VERSION}`,
      ...z.toJSONSchema(evidenceItemSchema, options),
    },
    changeScope: {
      $id: `urn:change-trace-mcp:schema:change-scope:${CORE_SCHEMA_VERSION}`,
      ...z.toJSONSchema(changeScopeSchema, options),
    },
    reviewBundle: {
      $id: `urn:change-trace-mcp:schema:review-bundle:${CORE_SCHEMA_VERSION}`,
      ...z.toJSONSchema(reviewBundleSchema, options),
    },
    finding: {
      $id: `urn:change-trace-mcp:schema:finding:${CORE_SCHEMA_VERSION}`,
      ...z.toJSONSchema(findingSchema, options),
    },
    localEvidenceCollection: {
      $id: `urn:change-trace-mcp:schema:local-evidence-collection:${CORE_SCHEMA_VERSION}`,
      ...z.toJSONSchema(localEvidenceCollectionSchema, options),
    },
  };
}
