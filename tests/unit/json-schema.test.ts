import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CORE_SCHEMA_VERSION,
  exportCoreJsonSchemas,
  reportEvidenceSourceSchema,
} from "../../src/schemas/index.js";

describe("report evidence-source JSON Schema", () => {
  it("exports the required strict source catalog deterministically", () => {
    const first = exportCoreJsonSchemas();
    const second = exportCoreJsonSchemas();

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.report.$id).toBe(
      `urn:change-trace-mcp:schema:report:${CORE_SCHEMA_VERSION}`,
    );
    expect(first.report).toMatchObject({
      required: expect.arrayContaining(["evidenceSources"]),
      properties: {
        evidenceSources: {
          $ref: expect.stringMatching(/^#\/\$defs\//u),
        },
      },
    });
    const reportJsonSchema = first.report as unknown as {
      properties: { evidenceSources: { $ref: string } };
      $defs: Record<string, unknown>;
    };
    const definitionKey = reportJsonSchema.properties.evidenceSources.$ref
      .replace("#/$defs/", "");
    expect(reportJsonSchema.$defs[definitionKey]).toMatchObject({
      type: "array",
      maxItems: 10_000,
    });
    expect(
      reportEvidenceSourceSchema.safeParse({
        evidenceId: "evidence:test",
        type: "document",
        source: { system: "lark", locator: "document:test", uri: null },
        retrievedAt: "2026-07-26T11:00:00.000Z",
        contentHash: null,
        relatedChangeIds: [],
        trustLevel: "untrusted_external",
        redactions: [],
        excerpt: "forbidden duplicate content",
      }).success,
    ).toBe(false);

    const runtimeCollectionText = JSON.stringify(
      first.runtimeEvidenceCollection,
    );
    const reviewBundleText = JSON.stringify(first.reviewBundle);
    const reportText = JSON.stringify(first.report);
    for (const text of [
      runtimeCollectionText,
      reviewBundleText,
      reportText,
    ]) {
      expect(text).toContain("runtimeUnavailableProvenance");
      expect(text).toContain("accessStatus");
      expect(text).toContain("manifestRecordId");
      expect(text).toContain("relatedEvidenceIds");
    }
    expect(runtimeCollectionText).not.toContain(
      '"missingEvidence":{"type":"array","maxItems":1000,"items":{"$ref":"#/$defs/missingEvidenceSchema"}}',
    );
    expect(reportText).toContain("runtimeProvenance");
    expect(reportText).toContain("artifactReferences");

    const reportDocument = first.report as unknown as {
      $defs: Record<string, unknown>;
    };
    const objects: Array<Record<string, unknown>> = [];
    const collectObjects = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(collectObjects);
        return;
      }
      if (value === null || typeof value !== "object") {
        return;
      }
      const object = value as Record<string, unknown>;
      objects.push(object);
      Object.values(object).forEach(collectObjects);
    };
    const resolveLocalReference = (
      value: unknown,
    ): Record<string, unknown> => {
      if (
        value !== null &&
        typeof value === "object" &&
        "$ref" in value &&
        typeof value.$ref === "string"
      ) {
        const key = value.$ref.replace("#/$defs/", "");
        return reportDocument.$defs[key] as Record<string, unknown>;
      }
      return value as Record<string, unknown>;
    };
    collectObjects(first.report);
    const runtimeSourceVariant = objects.find((object) => {
      const required = object.required;
      return (
        Array.isArray(required) &&
        required.includes("runtimeProvenance") &&
        object.additionalProperties === false &&
        object.properties !== null &&
        typeof object.properties === "object" &&
        "evidenceId" in object.properties
      );
    });
    expect(runtimeSourceVariant).toBeDefined();
    const runtimeProperties = runtimeSourceVariant?.properties as Record<
      string,
      unknown
    >;
    expect(resolveLocalReference(runtimeProperties.type)).toMatchObject({
      enum: [
        "test_result",
        "runtime_observation",
        "configuration",
      ],
    });
    expect(
      resolveLocalReference(runtimeProperties.trustLevel),
    ).toMatchObject({ const: "observed_runtime" });
    expect(
      resolveLocalReference(runtimeProperties.externalProvenance),
    ).toEqual({ not: {} });
  });
});

describe("packaged external-adapter documentation", () => {
  it("keeps the guide/example in package files and links it from the README", () => {
    const root = resolve(import.meta.dirname, "../..");
    const packageJson = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8"),
    ) as { files: string[] };
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const guide = readFileSync(
      resolve(root, "docs/external-adapters/README.md"),
      "utf8",
    );
    const exampleText = readFileSync(
      resolve(root, "docs/external-adapters/config.json.example"),
      "utf8",
    );
    const example = JSON.parse(exampleText) as {
      schemaVersion: string;
      adapters: Array<Record<string, unknown>>;
    };

    expect(packageJson.files).toContain("docs/external-adapters");
    expect(readme).toContain("collect_external_evidence");
    expect(readme).toContain("docs/external-adapters/README.md");
    for (const required of [
      "CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE",
      "shell: false",
      "explicit",
      "untrusted",
      "permission",
      "Lark",
      "Jira",
      "Confluence",
      "contract fixture",
      "live vendor compatibility",
    ]) {
      expect(guide).toContain(required);
    }
    expect(example.schemaVersion).toBe(CORE_SCHEMA_VERSION);
    expect(example.adapters).toHaveLength(2);
    expect(exampleText).toContain("credentialEnvironmentNames");
    expect(exampleText).not.toMatch(
      /"(?:token|secret|password|apiKey)"\s*:/iu,
    );
  });
});
