import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CORE_SCHEMA_VERSION,
  runtimeEvidenceManifestSchema,
  type RuntimeEvidenceManifest,
} from "../../src/schemas/index.js";

const producerPath = fileURLToPath(
  new URL(
    "../fixtures/runtime/m6-runtime-fixture-producer.mjs",
    import.meta.url,
  ),
);
const fixtureDirectory = new URL(
  "../fixtures/runtime/",
  import.meta.url,
);
const FIXED_FAILURE = "m6_runtime_fixture_failed\n";
const RELATED_CHANGE_IDS = ["file:src/greeting.ts"];
const RELATED_EVIDENCE_IDS = ["evidence:document:requirements"];

const fixtureIds = [
  "m6-junit",
  "m6-playwright-json",
  "m6-api-smoke",
  "m6-staging",
] as const;

type FixtureId = (typeof fixtureIds)[number];

type ProducerResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
};

async function runProducer(input: string): Promise<ProducerResult> {
  return new Promise((resolve, reject) => {
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
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      });
    });
    child.stdin.end(input);
  });
}

function request(fixtureId: FixtureId): string {
  return JSON.stringify({
    schemaVersion: CORE_SCHEMA_VERSION,
    fixtureId,
    relatedChangeIds: RELATED_CHANGE_IDS,
    relatedEvidenceIds: RELATED_EVIDENCE_IDS,
  });
}

async function manifestFor(
  fixtureId: FixtureId,
): Promise<{
  manifest: RuntimeEvidenceManifest;
  stdout: Buffer;
}> {
  const result = await runProducer(request(fixtureId));
  expect(result).toMatchObject({
    exitCode: 0,
    signal: null,
  });
  expect(result.stderr).toEqual(Buffer.alloc(0));
  return {
    manifest: runtimeEvidenceManifestSchema.parse(
      JSON.parse(result.stdout.toString("utf8")),
    ),
    stdout: result.stdout,
  };
}

describe("M6 fixed runtime fixture producer", () => {
  it("maps exactly four adjacent bounded fixture profiles deterministically", async () => {
    const sourceFiles = [
      "m6-junit-report.xml",
      "m6-playwright-report.json",
      "m6-api-smoke-report.json",
      "m6-staging-observation.json",
    ];
    for (const sourceFile of sourceFiles) {
      const content = await readFile(
        new URL(sourceFile, fixtureDirectory),
      );
      expect(content.byteLength).toBeGreaterThan(0);
      expect(content.byteLength).toBeLessThan(64 * 1024);
    }

    for (const fixtureId of fixtureIds) {
      const first = await manifestFor(fixtureId);
      const second = await manifestFor(fixtureId);
      expect(second.stdout).toEqual(first.stdout);
      expect(first.manifest.records.length).toBeGreaterThan(0);
      for (const record of first.manifest.records) {
        expect(record.relatedChangeIds).toEqual(RELATED_CHANGE_IDS);
        expect(record.relatedEvidenceIds).toEqual(
          RELATED_EVIDENCE_IDS,
        );
      }
    }
  });

  it("maps the pinned JUnit-style cases without retaining raw output or stacks", async () => {
    const { manifest, stdout } = await manifestFor("m6-junit");
    expect(manifest).toMatchObject({
      producer: {
        id: "producer:m6-junit-style-v1",
        version: "profile-1.0.0",
      },
      sourceFormat: "junit_xml",
    });
    expect(
      manifest.records.map((record) => ({
        recordId: record.recordId,
        kind: record.kind,
        accessStatus: record.accessStatus,
        outcome:
          record.accessStatus === "available" &&
          record.kind !== "environment_metadata"
            ? record.outcome
            : null,
        locator: record.source.locator,
      })),
    ).toEqual([
      {
        recordId: "record:junit:release-suite:passes",
        kind: "test_case",
        accessStatus: "available",
        outcome: "passed",
        locator:
          "suite:release-suite/class:release.api/case:passes",
      },
      {
        recordId: "record:junit:release-suite:fails",
        kind: "test_case",
        accessStatus: "available",
        outcome: "failed",
        locator:
          "suite:release-suite/class:release.api/case:fails",
      },
      {
        recordId: "record:junit:release-suite:errors",
        kind: "test_case",
        accessStatus: "available",
        outcome: "errored",
        locator:
          "suite:release-suite/class:release.worker/case:errors",
      },
      {
        recordId: "record:junit:release-suite:skips",
        kind: "test_case",
        accessStatus: "available",
        outcome: "skipped",
        locator:
          "suite:release-suite/class:release.ui/case:skips",
      },
    ]);
    const serialized = stdout.toString("utf8");
    for (const forbidden of [
      "junit-system-out-sentinel",
      "junit-system-err-sentinel",
      "junit-failure-stack-sentinel",
      "junit-error-stack-sentinel",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("maps final Playwright attempts and keeps only path or URI artifact references", async () => {
    const { manifest, stdout } = await manifestFor(
      "m6-playwright-json",
    );
    expect(manifest).toMatchObject({
      producer: {
        id: "producer:m6-playwright-json-v1",
        version: "profile-1.0.0",
      },
      sourceFormat: "playwright_json",
    });
    expect(
      manifest.records.map((record) => ({
        recordId: record.recordId,
        outcome:
          record.accessStatus === "available" &&
          record.kind !== "environment_metadata"
            ? record.outcome
            : null,
      })),
    ).toEqual([
      {
        recordId:
          "record:playwright:release-flow:chromium:passes",
        outcome: "passed",
      },
      {
        recordId:
          "record:playwright:release-flow:chromium:fails",
        outcome: "failed",
      },
      {
        recordId:
          "record:playwright:release-flow:firefox:times-out",
        outcome: "timed_out",
      },
      {
        recordId:
          "record:playwright:release-flow:webkit:skips",
        outcome: "skipped",
      },
      {
        recordId:
          "record:playwright:release-flow:webkit:interrupts",
        outcome: "cancelled",
      },
    ]);
    const passed = manifest.records[0];
    expect(passed).toMatchObject({
      startedAt: "2026-07-26T08:00:00.000Z",
      durationMilliseconds: 125,
      artifactReferences: [
        {
          system: "playwright",
          locator: "artifacts/release-flow/trace.zip",
          uri: null,
        },
        {
          system: "playwright",
          locator: "artifacts/release-flow/screenshot.png",
          uri: "https://ci.example.test/artifacts/screenshot.png",
        },
      ],
    });
    const serialized = stdout.toString("utf8");
    for (const forbidden of [
      "playwright-stdout-sentinel",
      "playwright-stderr-sentinel",
      "playwright-stack-sentinel",
      "playwright-step-sentinel",
      "playwright-annotation-sentinel",
      "playwright-attachment-body-sentinel",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("maps project-owned API and staging observations without active-probe content", async () => {
    const api = await manifestFor("m6-api-smoke");
    expect(api.manifest).toMatchObject({
      producer: {
        id: "producer:m6-api-smoke-v1",
        version: "profile-1.0.0",
      },
      sourceFormat: "api_smoke",
      records: [
        {
          recordId: "record:api:health",
          kind: "api_observation",
          accessStatus: "available",
          outcome: "passed",
          summary:
            "Health check passed. api_key=m6-api-summary-secret",
        },
        {
          recordId: "record:api:contract",
          kind: "api_observation",
          accessStatus: "available",
          outcome: "failed",
        },
      ],
    });
    for (const forbidden of [
      "api-request-body-sentinel",
      "api-response-body-sentinel",
      "api-header-sentinel",
      "api-cookie-sentinel",
      "api-token-sentinel",
      "api-retry-command-sentinel",
      "api-raw-log-sentinel",
    ]) {
      expect(api.stdout.toString("utf8")).not.toContain(forbidden);
    }

    const staging = await manifestFor("m6-staging");
    expect(staging.manifest).toMatchObject({
      producer: {
        id: "producer:m6-staging-summary-v1",
        version: "profile-1.0.0",
      },
      sourceFormat: "ci_summary",
      records: [
        {
          recordId: "record:staging:environment",
          kind: "environment_metadata",
          accessStatus: "available",
        },
        {
          recordId: "record:staging:observation",
          kind: "browser_observation",
          accessStatus: "inaccessible",
          reason:
            "Staging observation unavailable. access_token=m6-staging-reason-secret",
        },
      ],
    });
    const stagingSerialized = staging.stdout.toString("utf8");
    expect(stagingSerialized).not.toContain(
      "staging-probe-command-sentinel",
    );
    expect(stagingSerialized).not.toContain(
      "staging-credential-sentinel",
    );
    expect(stagingSerialized).not.toContain("outcome\":\"failed");
  });

  it("rejects malformed, unknown, duplicate, invalid, and oversized requests with one fixed token", async () => {
    const invalidInputs = [
      "{",
      "null",
      JSON.stringify({
        schemaVersion: CORE_SCHEMA_VERSION,
        fixtureId: "m6-unsupported",
        relatedChangeIds: [],
        relatedEvidenceIds: [],
      }),
      JSON.stringify({
        schemaVersion: CORE_SCHEMA_VERSION,
        fixtureId: "m6-junit",
        relatedChangeIds: [],
        relatedEvidenceIds: [],
        repositoryPath: "caller-secret-path",
      }),
      ...[
        ["rawPath", "caller-secret-raw-path"],
        ["reportContent", "caller-secret-report"],
        ["command", "caller-secret-command"],
        ["environment", "caller-secret-environment"],
        ["url", "https://caller-secret.invalid"],
        ["credential", "caller-secret-credential"],
        ["trustLevel", "trusted_local"],
        [
          "producer",
          {
            id: "producer:caller-secret",
            name: "caller secret",
            version: "1.0.0",
          },
        ],
        ["outputPath", "caller-secret-output"],
      ].map(([field, value]) =>
        JSON.stringify({
          schemaVersion: CORE_SCHEMA_VERSION,
          fixtureId: "m6-junit",
          relatedChangeIds: [],
          relatedEvidenceIds: [],
          [field as string]: value,
        }),
      ),
      JSON.stringify({
        schemaVersion: CORE_SCHEMA_VERSION,
        fixtureId: "m6-junit",
        relatedChangeIds: ["bad id"],
        relatedEvidenceIds: [],
      }),
      JSON.stringify({
        schemaVersion: CORE_SCHEMA_VERSION,
        fixtureId: "m6-junit",
        relatedChangeIds: ["file:duplicate", "file:duplicate"],
        relatedEvidenceIds: [],
      }),
      JSON.stringify({
        schemaVersion: CORE_SCHEMA_VERSION,
        fixtureId: "m6-junit",
        relatedChangeIds: [],
        relatedEvidenceIds: [
          "evidence:duplicate",
          "evidence:duplicate",
        ],
      }),
      JSON.stringify({
        schemaVersion: CORE_SCHEMA_VERSION,
        fixtureId: "m6-junit",
        relatedChangeIds: Array.from(
          { length: 1_001 },
          (_, index) => `file:${index}`,
        ),
        relatedEvidenceIds: [],
      }),
      JSON.stringify({
        schemaVersion: CORE_SCHEMA_VERSION,
        fixtureId: "m6-junit",
        relatedChangeIds: [],
        relatedEvidenceIds: [],
        padding: "oversized-secret".repeat(5_000),
      }),
    ];

    for (const input of invalidInputs) {
      const result = await runProducer(input);
      expect(result.exitCode).not.toBe(0);
      expect(result.signal).toBeNull();
      expect(result.stdout).toEqual(Buffer.alloc(0));
      expect(result.stderr.toString("utf8")).toBe(FIXED_FAILURE);
      expect(result.stderr.toString("utf8")).not.toContain(
        "caller-secret-path",
      );
      expect(result.stderr.toString("utf8")).not.toContain(
        "oversized-secret",
      );
    }
  });

  it("documents no caller-controlled execution, access, or producer fields and packages the guide", async () => {
    const producerSource = await readFile(producerPath, "utf8");
    for (const prohibitedCapability of [
      "process.env",
      "exec(",
      "execFile(",
      "spawn(",
      "fetch(",
      "http.request",
      "https.request",
    ]) {
      expect(producerSource).not.toContain(prohibitedCapability);
    }

    const packageJson = JSON.parse(
      await readFile(
        new URL("../../package.json", import.meta.url),
        "utf8",
      ),
    ) as { files?: unknown };
    expect(packageJson.files).toContain("docs/runtime-evidence");
  });
});
