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
