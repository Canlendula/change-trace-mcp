import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

import { materializeGitFixture } from "../helpers/git-fixture.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const basicFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/basic-change", import.meta.url),
);

describe("stdio MCP server", () => {
  it("initializes, lists tools, and returns the stable fixture", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(process.cwd(), "dist/cli.js")],
      stderr: "pipe",
    });
    const client = new Client({
      name: "change-trace-mcp-integration-test",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);

      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual([
        "collect_local_evidence",
        "get_change_scope",
        "get_compatibility_fixture",
        "get_review_bundle",
        "get_server_info",
        "validate_findings",
        "write_report",
      ]);
      expect(
        tools
          .filter((t) => t.name !== "write_report")
          .every(
            (tool) =>
              tool.annotations?.readOnlyHint === true &&
              tool.annotations.destructiveHint === false &&
              tool.annotations.idempotentHint === true &&
              tool.annotations.openWorldHint === false,
          ),
      ).toBe(true);
      const writeTool = tools.find((t) => t.name === "write_report");
      expect(writeTool?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      });

      const first = await client.callTool({
        name: "get_compatibility_fixture",
        arguments: {},
      });
      const second = await client.callTool({
        name: "get_compatibility_fixture",
        arguments: {},
      });

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        structuredContent: {
          schemaVersion: "1.0.0",
          fixtureId: "m1-host-compatibility",
          ok: true,
        },
      });
    } finally {
      await client.close();
    }
  });

  it("calls get_change_scope over stdio for a real Git fixture", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(process.cwd(), "dist/cli.js")],
      stderr: "pipe",
    });
    const client = new Client({
      name: "change-trace-mcp-change-scope-test",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);
      const result = await client.callTool({
        name: "get_change_scope",
        arguments: {
          repositoryPath: fixture.repositoryPath,
          baseRef: fixture.baseObjectId,
          headRef: fixture.headObjectId,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result).toMatchObject({
        structuredContent: {
          schemaVersion: "1.0.0",
          resolvedBase: fixture.baseObjectId,
          resolvedHead: fixture.headObjectId,
          truncation: {
            isTruncated: false,
          },
        },
      });

      const localEvidenceResult = await client.callTool({
        name: "collect_local_evidence",
        arguments: {
          scope: result.structuredContent,
          documentRoots: ["docs"],
          filePatterns: ["**/*.md"],
        },
      });
      expect(localEvidenceResult.isError).not.toBe(true);
      expect(localEvidenceResult).toMatchObject({
        structuredContent: {
          schemaVersion: "1.0.0",
          matchedFiles: 1,
          evidenceItems: [
            {
              type: "document",
              source: { locator: "docs/requirements.md#L1-L3" },
            },
          ],
        },
      });

      const reviewBundleResult = await client.callTool({
        name: "get_review_bundle",
        arguments: {
          changeScope: result.structuredContent,
          localEvidence: localEvidenceResult.structuredContent,
        },
      });
      expect(reviewBundleResult.isError).not.toBe(true);
      expect(reviewBundleResult).toMatchObject({
        structuredContent: {
          schemaVersion: "1.0.0",
          changeScope: {
            resolvedBase: fixture.baseObjectId,
            resolvedHead: fixture.headObjectId,
          },
          truncation: { isTruncated: false },
        },
      });

      const reviewBundle = reviewBundleResult.structuredContent as {
        evidenceItems: Array<{
          id: string;
          source: { system: string; locator: string; uri: string | null };
        }>;
      };
      const evidence = reviewBundle.evidenceItems[0]!;
      const validationResult = await client.callTool({
        name: "validate_findings",
        arguments: {
          bundle: reviewBundleResult.structuredContent,
          findings: [
            {
              schemaVersion: "1.0.0",
              id: "finding:stdio-example",
              category: "Requirement-Missing",
              severity: "MEDIUM",
              confidence: 0.7,
              title: "Example finding",
              expectedBehavior: "The requirement is followed.",
              observedBehavior: "The implementation requires Agent review.",
              deterministicFacts: [
                {
                  statement: "A local requirement document was collected.",
                  evidenceIds: [evidence.id],
                },
              ],
              inference: "The implementation may differ from the requirement.",
              evidenceIds: [evidence.id],
              affectedSources: [evidence.source],
              recommendation: "investigate",
              status: "Suspected",
            },
          ],
        },
      });
      expect(validationResult.isError).not.toBe(true);
      expect(validationResult).toMatchObject({
        structuredContent: {
          ok: true,
          summary: { submitted: 1, valid: 1, rejected: 0 },
          validFindings: [
            {
              category: "requirement_missing",
              severity: "medium",
              status: "suspected",
            },
          ],
        },
      });
    } finally {
      await client.close();
      await fixture.cleanup();
    }
  });

  it("discovers and calls write_report over stdio using a temp repo output directory", async () => {
    const fixture = await materializeGitFixture(basicFixtureDirectory);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(process.cwd(), "dist/cli.js")],
      stderr: "pipe",
    });
    const client = new Client({
      name: "change-trace-mcp-write-report-test",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);

      const changeScopeResult = await client.callTool({
        name: "get_change_scope",
        arguments: {
          repositoryPath: fixture.repositoryPath,
          baseRef: fixture.baseObjectId,
          headRef: fixture.headObjectId,
        },
      });
      expect(changeScopeResult.isError).not.toBe(true);

      const localEvidenceResult = await client.callTool({
        name: "collect_local_evidence",
        arguments: {
          scope: changeScopeResult.structuredContent,
          documentRoots: ["docs"],
          filePatterns: ["**/*.md"],
        },
      });
      expect(localEvidenceResult.isError).not.toBe(true);

      const reviewBundleResult = await client.callTool({
        name: "get_review_bundle",
        arguments: {
          changeScope: changeScopeResult.structuredContent,
          localEvidence: localEvidenceResult.structuredContent,
        },
      });
      expect(reviewBundleResult.isError).not.toBe(true);

      const reviewBundle = reviewBundleResult.structuredContent as {
        evidenceItems: Array<{
          id: string;
          source: { system: string; locator: string; uri: string | null };
        }>;
      };
      const evidence = reviewBundle.evidenceItems[0]!;

      const validationResult = await client.callTool({
        name: "validate_findings",
        arguments: {
          bundle: reviewBundleResult.structuredContent,
          findings: [
            {
              schemaVersion: "1.0.0",
              id: "finding:stdio-write-test",
              category: "Requirement-Missing",
              severity: "MEDIUM",
              confidence: 0.7,
              title: "Write report integration finding",
              expectedBehavior: "The system writes reports correctly.",
              observedBehavior: "The report tool is being tested.",
              deterministicFacts: [
                {
                  statement: "A local requirement document was collected.",
                  evidenceIds: [evidence.id],
                },
              ],
              inference: "Integration test verifies the write path.",
              evidenceIds: [evidence.id],
              affectedSources: [evidence.source],
              recommendation: "investigate",
              status: "Suspected",
            },
          ],
        },
      });
      expect(validationResult.isError).not.toBe(true);
      expect(validationResult).toMatchObject({
        structuredContent: { ok: true, summary: { submitted: 1, valid: 1, rejected: 0 } },
      });

      const outputDir = join(fixture.repositoryPath, "reports");
      await mkdir(outputDir, { recursive: true });

      const writeResult = await client.callTool({
        name: "write_report",
        arguments: {
          bundle: reviewBundleResult.structuredContent,
          validationResult: validationResult.structuredContent,
          reviewMeta: { reviewer: "stdio-integration-test" },
          repositoryRoot: fixture.repositoryPath,
          outputDirectory: "reports",
          reportName: "integration-test",
          overwrite: true,
        },
      });

      expect(writeResult.isError).not.toBe(true);
      expect(writeResult).toMatchObject({
        structuredContent: {
          reportId: "report:integration-test",
          markdownFile: expect.any(String),
          jsonFile: expect.any(String),
          markdownSizeBytes: expect.any(Number),
          jsonSizeBytes: expect.any(Number),
        },
      });

      const output = writeResult.structuredContent as {
        reportId: string;
        markdownFile: string;
        jsonFile: string;
        markdownSizeBytes: number;
        jsonSizeBytes: number;
      };

      expect(output.markdownSizeBytes).toBeGreaterThan(0);
      expect(output.jsonSizeBytes).toBeGreaterThan(0);
      expect(existsSync(output.markdownFile)).toBe(true);
      expect(existsSync(output.jsonFile)).toBe(true);

      const mdContent = readFileSync(output.markdownFile, "utf-8");
      expect(mdContent).toContain("# Change Trace Review Report");
      expect(mdContent).toContain("report:integration-test");
      expect(mdContent).toContain("Suspected Findings");

      const jsonContent = JSON.parse(readFileSync(output.jsonFile, "utf-8"));
      expect(jsonContent.schemaVersion).toBe("1.0.0");
      expect(jsonContent.id).toBe("report:integration-test");
      expect(jsonContent.findings.suspected).toHaveLength(1);
      expect(jsonContent.findings.suspected[0].title).toBe(
        "Write report integration finding",
      );
    } finally {
      await client.close();
      await fixture.cleanup();
    }
  });
});
