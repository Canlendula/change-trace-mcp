import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import {
  buildReviewBundle,
  buildReviewBundleInputSchema,
} from "./evidence/bundle/build-review-bundle.js";
import {
  collectLocalEvidence,
  collectLocalEvidenceInputSchema,
} from "./evidence/local/collect-local-evidence.js";
import {
  createCompatibilityFixture,
  serializeCompatibilityFixture,
} from "./fixtures/compatibility.js";
import {
  validateFindings,
  validateFindingsInputSchema,
} from "./findings/validate-findings.js";
import {
  collectChangeScope,
  getChangeScopeInputSchema,
} from "./git/change-scope.js";
import { writeReport } from "./reports/write-report.js";
import { changeScopeSchema } from "./schemas/change-scope.js";
import { localEvidenceCollectionSchema } from "./schemas/local-evidence.js";
import { findingValidationResultSchema } from "./schemas/finding-validation.js";
import {
  writeReportInputSchema,
  writeReportOutputSchema,
} from "./schemas/report.js";
import { reviewBundleSchema } from "./schemas/review-bundle.js";

const serverInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  transport: z.literal("stdio"),
  nodeVersion: z.string(),
  platform: z.string(),
  architecture: z.string(),
});

const compatibilityFixtureSchema = z.object({
  schemaVersion: z.string(),
  fixtureId: z.literal("m1-host-compatibility"),
  ok: z.literal(true),
  scalar: z.literal("change-trace"),
  values: z.tuple([z.literal(1), z.literal(2), z.literal(3)]),
  nested: z.object({
    alpha: z.literal("A"),
    beta: z.literal("B"),
  }),
});

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "get_server_info",
    {
      title: "Get server information",
      description:
        "Return diagnostic metadata for this Change Trace MCP process. Use this to verify host startup and runtime compatibility.",
      inputSchema: z.object({}),
      outputSchema: serverInfoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const result = {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        transport: "stdio" as const,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "get_compatibility_fixture",
    {
      title: "Get compatibility fixture",
      description:
        "Return a fixed, versioned JSON fixture. The same package version must return byte-identical text in every MCP Host.",
      inputSchema: z.object({}),
      outputSchema: compatibilityFixtureSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const result = createCompatibilityFixture();

      return {
        content: [
          {
            type: "text",
            text: serializeCompatibilityFixture(result),
          },
        ],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "get_change_scope",
    {
      title: "Get Git change scope",
      description:
        "Resolve two Git refs and return a deterministic, bounded summary of commits, changed files, diff excerpts, detected languages, truncation, and read errors. The repository path must be an explicit Git root.",
      inputSchema: getChangeScopeInputSchema,
      outputSchema: changeScopeSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = await collectChangeScope(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      } catch (error) {
        const result = {
          error: "get_change_scope_failed",
          message: (error instanceof Error ? error.message : String(error)).slice(
            0,
            2_000,
          ),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "collect_local_evidence",
    {
      title: "Collect local document evidence",
      description:
        "Collect bounded, provenance-rich excerpts from regular files beneath configured document roots in the exact Git repository named by a ChangeScope. Symbolic links are not followed and common credential patterns are redacted.",
      inputSchema: collectLocalEvidenceInputSchema,
      outputSchema: localEvidenceCollectionSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = await collectLocalEvidence(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      } catch (error) {
        const result = {
          error: "collect_local_evidence_failed",
          message: (error instanceof Error ? error.message : String(error)).slice(
            0,
            2_000,
          ),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_review_bundle",
    {
      title: "Build a deterministic review bundle",
      description:
        "Combine a ChangeScope, local document evidence, and optional normalized evidence into a bounded ReviewBundle with a stable evidence index, deterministic Git facts, and explicit missing-evidence records.",
      inputSchema: buildReviewBundleInputSchema,
      outputSchema: reviewBundleSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = buildReviewBundle(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      } catch (error) {
        const result = {
          error: "get_review_bundle_failed",
          message: (error instanceof Error ? error.message : String(error)).slice(
            0,
            2_000,
          ),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "validate_findings",
    {
      title: "Validate Agent findings",
      description:
        "Validate Agent-produced findings against the shared schema and a ReviewBundle. Known enum formatting aliases are normalized; unknown evidence IDs, unsupported sources, duplicate IDs, and unsupported substantive findings are rejected without inventing content.",
      inputSchema: validateFindingsInputSchema,
      outputSchema: findingValidationResultSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = validateFindings(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      } catch (error) {
        const result = {
          error: "validate_findings_failed",
          message: (error instanceof Error ? error.message : String(error)).slice(
            0,
            2_000,
          ),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "write_report",
    {
      title: "Write a versioned review report",
      description:
        "Render validated Agent findings as a deterministic Markdown and JSON report pair inside a repository-relative output directory. The report preserves confirmed, suspected, and inconclusive findings, evidence coverage, bundle limits/truncation, and validation warnings.",
      inputSchema: writeReportInputSchema,
      outputSchema: writeReportOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const result = writeReport(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      } catch (error) {
        const result = {
          error: "write_report_failed",
          message: (error instanceof Error ? error.message : String(error)).slice(
            0,
            2_000,
          ),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: true,
        };
      }
    },
  );

  return server;
}
