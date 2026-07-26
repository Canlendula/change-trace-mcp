import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

import {
  changeScopeSchema,
  CORE_SCHEMA_VERSION,
  findingValidationResultSchema,
  localEvidenceCollectionSchema,
  reportSchema,
  reviewBundleSchema,
  runtimeEvidenceCollectionSchema,
  runtimeEvidenceManifestSchema,
  writeReportOutputSchema,
  type RuntimeEvidenceManifest,
} from "../../src/schemas/index.js";
import { materializeGitFixture } from "../helpers/git-fixture.js";

const basicFixtureDirectory = fileURLToPath(
  new URL("../fixtures/git/basic-change", import.meta.url),
);
const producerPath = fileURLToPath(
  new URL(
    "../fixtures/runtime/m6-runtime-fixture-producer.mjs",
    import.meta.url,
  ),
);
const fixtureIds = [
  "m6-junit",
  "m6-playwright-json",
  "m6-api-smoke",
  "m6-staging",
] as const;
const RAW_API_SECRET = "m6-api-summary-secret";
const RAW_STAGING_SECRET = "m6-staging-reason-secret";
const FORBIDDEN_SOURCE_CONTENT = [
  "junit-system-out-sentinel",
  "junit-system-err-sentinel",
  "junit-failure-stack-sentinel",
  "junit-error-stack-sentinel",
  "playwright-stdout-sentinel",
  "playwright-stderr-sentinel",
  "playwright-stack-sentinel",
  "playwright-step-sentinel",
  "playwright-annotation-sentinel",
  "playwright-attachment-body-sentinel",
  "api-request-body-sentinel",
  "api-response-body-sentinel",
  "api-header-sentinel",
  "api-cookie-sentinel",
  "api-token-sentinel",
  "api-retry-command-sentinel",
  "api-raw-log-sentinel",
] as const;
const DOWNSTREAM_SECRETS = [
  RAW_API_SECRET,
  RAW_STAGING_SECRET,
] as const;

type ProducerResult = {
  exitCode: number | null;
  stdout: Buffer;
  stderr: Buffer;
};

async function runProducer(input: string): Promise<ProducerResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [producerPath], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("runtime fixture producer timed out"));
    }, 5_000);
    child.stdout.on("data", (chunk) => {
      stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderr.push(Buffer.from(chunk));
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      });
    });
    child.stdin.end(input);
  });
}

function serialize(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function expectAbsent(
  value: unknown,
  sentinels: readonly string[],
): void {
  const serialized = serialize(value);
  for (const sentinel of sentinels) {
    expect(serialized).not.toContain(sentinel);
  }
}

async function produceManifest(
  fixtureId: (typeof fixtureIds)[number],
  relatedChangeId: string,
  relatedEvidenceId: string,
): Promise<{
  manifest: RuntimeEvidenceManifest;
  bytes: Buffer;
}> {
  const input = JSON.stringify({
    schemaVersion: CORE_SCHEMA_VERSION,
    fixtureId,
    relatedChangeIds: [relatedChangeId],
    relatedEvidenceIds: [relatedEvidenceId],
  });
  const first = await runProducer(input);
  const second = await runProducer(input);
  expect(first).toMatchObject({ exitCode: 0 });
  expect(first.stderr).toEqual(Buffer.alloc(0));
  expect(second).toMatchObject({ exitCode: 0 });
  expect(second.stderr).toEqual(Buffer.alloc(0));
  expect(second.stdout).toEqual(first.stdout);
  const manifest = runtimeEvidenceManifestSchema.parse(
    JSON.parse(first.stdout.toString("utf8")),
  );
  for (const record of manifest.records) {
    expect(record.relatedChangeIds).toEqual([relatedChangeId]);
    expect(record.relatedEvidenceIds).toEqual([relatedEvidenceId]);
  }
  expectAbsent(manifest, FORBIDDEN_SOURCE_CONTENT);
  return { manifest, bytes: first.stdout };
}

describe("M6 pinned runtime sources over the built stdio pipeline", () => {
  it(
    "preserves bounded observations and unavailable staging provenance in deterministic reports",
    { timeout: 45_000 },
    async () => {
      const fixture = await materializeGitFixture(
        basicFixtureDirectory,
      );
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [resolve(process.cwd(), "dist/cli.js")],
        stderr: "pipe",
      });
      const stderrChunks: string[] = [];
      transport.stderr?.on("data", (chunk) => {
        stderrChunks.push(Buffer.from(chunk).toString("utf8"));
      });
      const client = new Client({
        name: "change-trace-m6-runtime-source-fixture-test",
        version: "1.0.0",
      });

      try {
        await client.connect(transport);
        const { tools } = await client.listTools();
        expect(tools.map(({ name }) => name).sort()).toEqual([
          "collect_external_evidence",
          "collect_local_evidence",
          "collect_runtime_evidence",
          "get_change_scope",
          "get_compatibility_fixture",
          "get_review_bundle",
          "get_server_info",
          "validate_findings",
          "write_report",
        ]);
        const compatibility = await client.callTool({
          name: "get_compatibility_fixture",
          arguments: {},
        });
        expect(compatibility.structuredContent).toEqual({
          schemaVersion: "1.0.0",
          fixtureId: "m1-host-compatibility",
          ok: true,
          scalar: "change-trace",
          values: [1, 2, 3],
          nested: {
            alpha: "A",
            beta: "B",
          },
        });

        const unsupported = await runProducer(
          JSON.stringify({
            schemaVersion: CORE_SCHEMA_VERSION,
            fixtureId: "m6-unsupported-secret-profile",
            relatedChangeIds: [],
            relatedEvidenceIds: [],
          }),
        );
        expect(unsupported.exitCode).not.toBe(0);
        expect(unsupported.stdout).toEqual(Buffer.alloc(0));
        expect(unsupported.stderr.toString("utf8")).toBe(
          "m6_runtime_fixture_failed\n",
        );
        expect(unsupported.stderr.toString("utf8")).not.toContain(
          "m6-unsupported-secret-profile",
        );
        expect((await client.listTools()).tools).toHaveLength(9);

        const changeScopeResult = await client.callTool({
          name: "get_change_scope",
          arguments: {
            repositoryPath: fixture.repositoryPath,
            baseRef: fixture.baseObjectId,
            headRef: fixture.headObjectId,
          },
        });
        expect(changeScopeResult.isError).not.toBe(true);
        const changeScope = changeScopeSchema.parse(
          changeScopeResult.structuredContent,
        );
        const relatedChangeId =
          changeScope.files.find(
            ({ path }) => path === "src/greeting.ts",
          )?.id ?? changeScope.files[0]?.id;
        expect(relatedChangeId).toBeDefined();

        const localResult = await client.callTool({
          name: "collect_local_evidence",
          arguments: {
            scope: changeScope,
            documentRoots: ["docs"],
            filePatterns: ["**/*.md"],
          },
        });
        expect(localResult.isError).not.toBe(true);
        const localEvidence = localEvidenceCollectionSchema.parse(
          localResult.structuredContent,
        );
        const requirementEvidence = localEvidence.evidenceItems.find(
          ({ type, source }) =>
            type === "document" &&
            source.locator.startsWith("docs/requirements.md"),
        );
        expect(requirementEvidence).toBeDefined();
        if (
          relatedChangeId === undefined ||
          requirementEvidence === undefined
        ) {
          throw new Error("deterministic relation targets were not found");
        }

        const runtimeDirectory = join(
          fixture.repositoryPath,
          "runtime-manifests",
        );
        await mkdir(runtimeDirectory);
        const produced = [];
        for (const fixtureId of fixtureIds) {
          const output = await produceManifest(
            fixtureId,
            relatedChangeId,
            requirementEvidence.id,
          );
          produced.push({ fixtureId, ...output });
          await writeFile(
            join(runtimeDirectory, `${fixtureId}.json`),
            output.bytes,
          );
        }
        expect(
          serialize(
            produced.find(
              ({ fixtureId }) => fixtureId === "m6-api-smoke",
            )?.manifest,
          ),
        ).toContain(RAW_API_SECRET);
        expect(
          serialize(
            produced.find(
              ({ fixtureId }) => fixtureId === "m6-staging",
            )?.manifest,
          ),
        ).toContain(RAW_STAGING_SECRET);

        const runtimeCollections = [];
        for (const fixtureId of fixtureIds) {
          const result = await client.callTool({
            name: "collect_runtime_evidence",
            arguments: {
              repositoryPath: fixture.repositoryPath,
              manifestPath: `runtime-manifests/${fixtureId}.json`,
            },
          });
          expect(result.isError).not.toBe(true);
          expectAbsent(result, DOWNSTREAM_SECRETS);
          expectAbsent(result, FORBIDDEN_SOURCE_CONTENT);
          runtimeCollections.push(
            runtimeEvidenceCollectionSchema.parse(
              result.structuredContent,
            ),
          );
        }

        expect(
          runtimeCollections.map(({ producer }) => producer.id),
        ).toEqual([
          "producer:m6-junit-style-v1",
          "producer:m6-playwright-json-v1",
          "producer:m6-api-smoke-v1",
          "producer:m6-staging-summary-v1",
        ]);
        expect(
          runtimeCollections.flatMap(({ evidenceItems }) =>
            evidenceItems
              .filter(
                ({ runtimeProvenance }) =>
                  runtimeProvenance.kind !==
                  "environment_metadata",
              )
              .map(
                ({ runtimeProvenance }) =>
                  runtimeProvenance.outcome,
              ),
          ),
        ).toEqual([
          "passed",
          "failed",
          "errored",
          "skipped",
          "passed",
          "failed",
          "timed_out",
          "skipped",
          "cancelled",
          "passed",
          "failed",
        ]);
        const stagingCollection = runtimeCollections.at(-1);
        expect(stagingCollection?.evidenceItems).toHaveLength(1);
        expect(stagingCollection?.evidenceItems[0]).toMatchObject({
          type: "configuration",
          runtimeProvenance: {
            kind: "environment_metadata",
            environment: {
              kind: "staging",
              name: "review-app-42",
            },
            outcome: null,
            startedAt: null,
            completedAt: null,
            durationMilliseconds: null,
          },
        });
        expect(stagingCollection?.missingEvidence).toEqual([
          expect.objectContaining({
            status: "inaccessible",
            reason:
              "Staging observation unavailable. access_token=[REDACTED]",
            runtimeUnavailableProvenance: expect.objectContaining({
              manifestRecordId: "record:staging:observation",
              kind: "browser_observation",
              accessStatus: "inaccessible",
              relatedChangeIds: [relatedChangeId],
              relatedEvidenceIds: [requirementEvidence.id],
            }),
          }),
        ]);
        for (const collection of runtimeCollections) {
          for (const item of collection.evidenceItems) {
            expect(item.relatedChangeIds).toEqual([
              relatedChangeId,
            ]);
            expect(
              item.runtimeProvenance.relatedEvidenceIds,
            ).toEqual([requirementEvidence.id]);
          }
        }

        const bundleResult = await client.callTool({
          name: "get_review_bundle",
          arguments: {
            changeScope,
            localEvidence,
            runtimeEvidenceCollections: runtimeCollections,
          },
        });
        expect(bundleResult.isError).not.toBe(true);
        expectAbsent(bundleResult, DOWNSTREAM_SECRETS);
        expectAbsent(bundleResult, FORBIDDEN_SOURCE_CONTENT);
        const bundle = reviewBundleSchema.parse(
          bundleResult.structuredContent,
        );
        const runtimeItems = bundle.evidenceItems.filter(
          ({ runtimeProvenance }) =>
            runtimeProvenance !== undefined,
        );
        expect(runtimeItems).toHaveLength(12);
        for (const item of runtimeItems) {
          expect(item.relatedChangeIds).toEqual([relatedChangeId]);
          expect(
            item.runtimeProvenance?.relatedEvidenceIds,
          ).toEqual([requirementEvidence.id]);
        }
        const bundledStagingMissing = bundle.missingEvidence.find(
          (missing) =>
            "runtimeUnavailableProvenance" in missing &&
            missing.runtimeUnavailableProvenance
              .manifestRecordId ===
              "record:staging:observation",
        );
        expect(bundledStagingMissing).toMatchObject({
          status: "inaccessible",
          runtimeUnavailableProvenance: {
            relatedChangeIds: [relatedChangeId],
            relatedEvidenceIds: [requirementEvidence.id],
          },
        });
        expect(
          runtimeItems.some(
            ({ source }) =>
              source.locator === "staging:review-app-42",
          ),
        ).toBe(false);

        const validationResult = await client.callTool({
          name: "validate_findings",
          arguments: {
            bundle,
            findings: [],
          },
        });
        expect(validationResult.isError).not.toBe(true);
        const validation = findingValidationResultSchema.parse(
          validationResult.structuredContent,
        );
        expect(validation).toMatchObject({
          ok: true,
          summary: {
            submitted: 0,
            valid: 0,
            rejected: 0,
            warnings: 0,
          },
          validFindings: [],
        });

        const reportArguments = {
          bundle,
          validationResult: validation,
          reviewMeta: {
            reviewer: "m6-runtime-source-fixture-test",
            createdAt: "2026-07-26T16:00:00.000Z",
            declaredLimitations: [
              "Pinned offline mapping profiles only; no live access.",
            ],
          },
          repositoryRoot: fixture.repositoryPath,
          outputDirectory: "m6-reports",
          reportName: "runtime-source-fixtures",
          overwrite: false,
        };
        const firstWrite = await client.callTool({
          name: "write_report",
          arguments: reportArguments,
        });
        expect(firstWrite.isError).not.toBe(true);
        const firstOutput = writeReportOutputSchema.parse(
          firstWrite.structuredContent,
        );
        const firstJson = await readFile(firstOutput.jsonFile);
        const firstMarkdown = await readFile(
          firstOutput.markdownFile,
        );
        const report = reportSchema.parse(
          JSON.parse(firstJson.toString("utf8")),
        );
        expect(report.findings).toEqual({
          confirmed: [],
          suspected: [],
          inconclusive: [],
        });
        const runtimeSources = report.evidenceSources.filter(
          ({ runtimeProvenance }) =>
            runtimeProvenance !== undefined,
        );
        expect(runtimeSources).toHaveLength(12);
        expect(
          runtimeSources.map(
            ({ runtimeProvenance }) =>
              runtimeProvenance?.sourceFormat,
          ),
        ).toEqual([
          ...Array(4).fill("junit_xml"),
          ...Array(5).fill("playwright_json"),
          ...Array(2).fill("api_smoke"),
          "ci_summary",
        ]);
        expect(
          runtimeSources
            .flatMap(
              ({ runtimeProvenance }) =>
                runtimeProvenance?.artifactReferences ?? [],
            )
            .map(({ locator }) => locator),
        ).toEqual([
          "artifacts/release-flow/trace.zip",
          "artifacts/release-flow/screenshot.png",
        ]);
        const reportPlaywrightPassed = runtimeSources.find(
          ({ runtimeProvenance }) =>
            runtimeProvenance?.manifestRecordId ===
            "record:playwright:release-flow:chromium:passes",
        );
        expect(reportPlaywrightPassed).toMatchObject({
          type: "test_result",
          source: {
            system: "playwright",
            locator:
              "suite:release-flow/spec:passes/project:chromium/test:tests/release-flow.spec.ts:10:3",
            uri: null,
          },
          relatedChangeIds: [relatedChangeId],
          trustLevel: "observed_runtime",
          runtimeProvenance: {
            producer: {
              id: "producer:m6-playwright-json-v1",
              version: "profile-1.0.0",
            },
            sourceFormat: "playwright_json",
            kind: "test_case",
            environment: {
              kind: "ci",
              name: "playwright-fixture-job",
            },
            outcome: "passed",
            startedAt: "2026-07-26T08:00:00.000Z",
            completedAt: "2026-07-26T08:00:00.125Z",
            durationMilliseconds: 125,
            relatedEvidenceIds: [requirementEvidence.id],
          },
        });
        const reportStagingMetadata = runtimeSources.find(
          ({ runtimeProvenance }) =>
            runtimeProvenance?.manifestRecordId ===
            "record:staging:environment",
        );
        expect(reportStagingMetadata).toMatchObject({
          type: "configuration",
          source: {
            system: "ci-summary",
            locator: "staging/review-app-42",
            uri: null,
          },
          relatedChangeIds: [relatedChangeId],
          runtimeProvenance: {
            producer: {
              id: "producer:m6-staging-summary-v1",
            },
            sourceFormat: "ci_summary",
            kind: "environment_metadata",
            environment: {
              kind: "staging",
              name: "review-app-42",
              source: {
                system: "deployment-metadata",
                locator: "review-app-42",
                uri: "https://staging.example.test/review-app-42",
              },
            },
            outcome: null,
            startedAt: null,
            completedAt: null,
            durationMilliseconds: null,
            relatedEvidenceIds: [requirementEvidence.id],
          },
        });
        expect(report.missingEvidence).toContainEqual(
          bundledStagingMissing,
        );

        const jsonText = firstJson.toString("utf8");
        const markdown = firstMarkdown.toString("utf8");
        expectAbsent(jsonText, DOWNSTREAM_SECRETS);
        expectAbsent(markdown, DOWNSTREAM_SECRETS);
        expectAbsent(jsonText, FORBIDDEN_SOURCE_CONTENT);
        expectAbsent(markdown, FORBIDDEN_SOURCE_CONTENT);
        const sourceSummaries = produced.flatMap(({ manifest }) =>
          manifest.records.flatMap((record) =>
            record.accessStatus === "available"
              ? [record.summary]
              : [],
          ),
        );
        for (const omittedRuntimeContent of [
          ...sourceSummaries,
          "Pre-produced runtime evidence supplied through an explicit manifest.",
        ]) {
          expect(jsonText).not.toContain(omittedRuntimeContent);
          expect(markdown).not.toContain(omittedRuntimeContent);
        }
        for (const expected of [
          "producer:m6-junit-style-v1",
          "producer:m6-playwright-json-v1",
          "producer:m6-api-smoke-v1",
          "producer:m6-staging-summary-v1",
          "junit_xml",
          "playwright_json",
          "api_smoke",
          "ci_summary",
          "artifacts/release-flow/trace.zip",
          "artifacts/release-flow/screenshot.png",
          "2026-07-26T08:00:00.000Z",
          "2026-07-26T08:00:00.125Z",
          "playwright-fixture-job",
          "review-app-42",
          relatedChangeId,
          requirementEvidence.id,
          "Runtime observation unavailable / not observed",
          "inaccessible",
        ]) {
          expect(jsonText + markdown).toContain(expected);
        }
        expect(markdown).toContain(
          "**Runtime outcome:** `failed`",
        );
        expect(markdown).toContain(
          "**Runtime outcome:** `timed_out`",
        );
        expect(markdown).toContain(
          "**Runtime outcome:** `cancelled`",
        );

        await unlink(firstOutput.jsonFile);
        await unlink(firstOutput.markdownFile);
        const secondWrite = await client.callTool({
          name: "write_report",
          arguments: reportArguments,
        });
        expect(secondWrite.isError).not.toBe(true);
        const secondOutput = writeReportOutputSchema.parse(
          secondWrite.structuredContent,
        );
        expect(await readFile(secondOutput.jsonFile)).toEqual(
          firstJson,
        );
        expect(await readFile(secondOutput.markdownFile)).toEqual(
          firstMarkdown,
        );
      } finally {
        await client.close();
        const stderr = stderrChunks.join("");
        expectAbsent(stderr, DOWNSTREAM_SECRETS);
        expectAbsent(stderr, FORBIDDEN_SOURCE_CONTENT);
        await fixture.cleanup();
      }
    },
  );
});
