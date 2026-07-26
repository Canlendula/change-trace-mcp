import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import * as publicApi from "../../src/index.js";
import {
  MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES,
  RUNTIME_EVIDENCE_COLLECTOR_ERROR_CODES,
  RuntimeEvidenceCollectorError,
  collectRuntimeEvidence,
  normalizeRuntimeEvidenceManifest,
} from "../../src/evidence/runtime/collect-runtime-evidence.js";
import {
  CORE_SCHEMA_VERSION,
  MAX_EVIDENCE_EXCERPT_CHARACTERS,
  collectRuntimeEvidenceInputSchema,
  runtimeEvidenceCollectionSchema,
  type RuntimeEvidenceManifest,
} from "../../src/schemas/index.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const timestamp = "2026-07-26T12:34:56.000Z";
const fixedClock = () => new Date(timestamp);

const producer = {
  id: "producer:fixture",
  name: "Runtime fixture",
  version: "1.2.3",
};

const source = {
  system: "ci",
  locator: "runs/42/results.json",
  uri: "https://ci.example.test/runs/42/results.json",
};

const environment = {
  kind: "staging" as const,
  name: "review-app-42",
  source: {
    system: "deployment",
    locator: "review-app-42",
    uri: "https://staging.example.test",
  },
};

function behavioralRecord(
  overrides: Record<string, unknown> = {},
): RuntimeEvidenceManifest["records"][number] {
  return {
    recordId: "record:test:1",
    kind: "test_case",
    source,
    environment,
    relatedChangeIds: ["file:src/api.ts"],
    relatedEvidenceIds: ["evidence:requirement:api"],
    accessStatus: "available",
    outcome: "failed",
    startedAt: "2026-07-26T12:00:00.000Z",
    completedAt: "2026-07-26T12:00:02.000Z",
    durationMilliseconds: 2_000,
    summary: "password=summary-secret",
    artifactReferences: [
      {
        system: "ci",
        locator: "artifacts/does-not-exist.zip",
        uri: "https://ci.example.test/artifacts/does-not-exist.zip",
      },
    ],
    truncation: {
      isTruncated: false,
      originalCharacters: 23,
      retainedCharacters: 23,
    },
    ...overrides,
  } as RuntimeEvidenceManifest["records"][number];
}

function manifest(
  records: RuntimeEvidenceManifest["records"] = [behavioralRecord()],
): RuntimeEvidenceManifest {
  return {
    schemaVersion: CORE_SCHEMA_VERSION,
    producer,
    sourceFormat: "generic_json",
    records,
  };
}

function expectedEvidenceId(
  record: RuntimeEvidenceManifest["records"][number],
): string {
  const identity = [
    producer.id,
    producer.name,
    producer.version,
    "generic_json",
    record.recordId,
    record.kind,
    record.source.system,
    record.source.locator,
    record.source.uri,
    record.environment.kind,
    record.environment.name,
    record.environment.source.system,
    record.environment.source.locator,
    record.environment.source.uri,
  ];
  return `evidence:runtime:${createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex")}`;
}

async function temporaryGitRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(
    join(tmpdir(), "change-trace-m6-collector-"),
  );
  temporaryDirectories.push(repositoryPath);
  await execFileAsync("git", ["init", "--initial-branch=main"], {
    cwd: repositoryPath,
  });
  return repositoryPath;
}

async function writeManifest(
  repositoryPath: string,
  value: unknown,
  relativePath = "runtime/manifest.json",
): Promise<string> {
  const target = join(repositoryPath, ...relativePath.split("/"));
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, JSON.stringify(value), "utf8");
  return target;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("collect runtime evidence input", () => {
  it("exposes exactly the two strict assigned paths", () => {
    const parsed = collectRuntimeEvidenceInputSchema.parse({
      repositoryPath: "C:/workspace/project",
      manifestPath: "artifacts/runtime.json",
    });
    expect(parsed).toEqual({
      repositoryPath: "C:/workspace/project",
      manifestPath: "artifacts/runtime.json",
    });
    expect(
      collectRuntimeEvidenceInputSchema.safeParse({
        ...parsed,
        command: "npm test",
      }).success,
    ).toBe(false);
  });

  it.each([
    "",
    ".",
    "/runtime.json",
    "//server/share/runtime.json",
    "\\\\server\\share\\runtime.json",
    "C:/runtime.json",
    "C:runtime.json",
    "runtime\\manifest.json",
    "runtime//manifest.json",
    "./runtime.json",
    "runtime/./manifest.json",
    "runtime/../manifest.json",
    "../runtime.json",
    ".git/runtime.json",
    "reports/.GIT/runtime.json",
    "reports/.git./runtime.json",
    "reports/.git /runtime.json",
    "runtime/",
    "runtime/\u0000manifest.json",
    `${"a".repeat(1_001)}.json`,
  ])("rejects forbidden manifest path %j", (manifestPath) => {
    expect(
      collectRuntimeEvidenceInputSchema.safeParse({
        repositoryPath: "C:/workspace/project",
        manifestPath,
      }).success,
    ).toBe(false);
  });
});

describe("runtime manifest normalization", () => {
  it("maps all available kinds, assigns one timestamp, and derives stable complete provenance", () => {
    const testRun = behavioralRecord({
      recordId: "record:test-run",
      kind: "test_run",
      summary: "test run",
      truncation: {
        isTruncated: false,
        originalCharacters: 8,
        retainedCharacters: 8,
      },
    });
    const api = behavioralRecord({
      recordId: "record:api",
      kind: "api_observation",
      summary: "api result",
      truncation: {
        isTruncated: false,
        originalCharacters: 10,
        retainedCharacters: 10,
      },
    });
    const browser = behavioralRecord({
      recordId: "record:browser",
      kind: "browser_observation",
      summary: "browser result",
      truncation: {
        isTruncated: false,
        originalCharacters: 14,
        retainedCharacters: 14,
      },
    });
    const other = behavioralRecord({
      recordId: "record:other",
      kind: "other",
      summary: "other result",
      truncation: {
        isTruncated: false,
        originalCharacters: 12,
        retainedCharacters: 12,
      },
    });
    const environmentRecord = {
      recordId: "record:environment",
      kind: "environment_metadata" as const,
      source,
      environment,
      relatedChangeIds: [],
      relatedEvidenceIds: ["evidence:requirement:environment"],
      accessStatus: "available" as const,
      summary: "staging ready",
      artifactReferences: [],
      truncation: {
        isTruncated: false,
        originalCharacters: 13,
        retainedCharacters: 13,
      },
    };

    const result = normalizeRuntimeEvidenceManifest(
      manifest([testRun, api, browser, other, environmentRecord]),
      { now: fixedClock },
    );

    expect(
      result.evidenceItems.map(({ type }) => type),
    ).toEqual([
      "test_result",
      "runtime_observation",
      "runtime_observation",
      "runtime_observation",
      "configuration",
    ]);
    expect(
      result.evidenceItems.map(({ retrievedAt }) => retrievedAt),
    ).toEqual(Array.from({ length: 5 }, () => timestamp));
    expect(result.evidenceItems[0]).toMatchObject({
      schemaVersion: CORE_SCHEMA_VERSION,
      id: expectedEvidenceId(testRun),
      source,
      relatedChangeIds: ["file:src/api.ts"],
      selectionReason:
        "Pre-produced runtime evidence supplied through an explicit manifest.",
      trustLevel: "observed_runtime",
      runtimeProvenance: {
        producer,
        sourceFormat: "generic_json",
        manifestRecordId: "record:test-run",
        kind: "test_run",
        environment,
        outcome: "failed",
        startedAt: "2026-07-26T12:00:00.000Z",
        completedAt: "2026-07-26T12:00:02.000Z",
        durationMilliseconds: 2_000,
        artifactReferences: testRun.accessStatus === "available"
          ? testRun.artifactReferences
          : [],
        relatedEvidenceIds: ["evidence:requirement:api"],
      },
    });
    expect(result.evidenceItems[4]?.runtimeProvenance).toMatchObject({
      outcome: null,
      startedAt: null,
      completedAt: null,
      durationMilliseconds: null,
    });
    expect(runtimeEvidenceCollectionSchema.parse(result)).toEqual(result);
  });

  it("redacts before exposure, hashes only complete original summaries, and keeps IDs content-independent", () => {
    const record = behavioralRecord();
    const first = normalizeRuntimeEvidenceManifest(manifest([record]), {
      now: fixedClock,
    });
    const changedSummary = "secret=another-secret";
    const secondRecord = behavioralRecord({
      summary: changedSummary,
      truncation: {
        isTruncated: false,
        originalCharacters: changedSummary.length,
        retainedCharacters: changedSummary.length,
      },
    });
    const second = normalizeRuntimeEvidenceManifest(
      manifest([secondRecord]),
      { now: () => new Date("2026-07-27T00:00:00.000Z") },
    );

    expect(first.evidenceItems[0]).toMatchObject({
      id: expectedEvidenceId(record),
      excerpt: "password=[REDACTED]",
      contentHash: `sha256:${createHash("sha256")
        .update("password=summary-secret")
        .digest("hex")}`,
      redactions: [
        {
          kind: "secret",
          count: 1,
          note: "Common credential patterns were removed from the excerpt.",
        },
      ],
    });
    expect(second.evidenceItems[0]?.id).toBe(first.evidenceItems[0]?.id);
    expect(second.evidenceItems[0]?.contentHash).not.toBe(
      first.evidenceItems[0]?.contentHash,
    );

    const truncated = behavioralRecord({
      summary: "partial",
      truncation: {
        isTruncated: true,
        originalCharacters: 100,
        retainedCharacters: 7,
      },
    });
    expect(
      normalizeRuntimeEvidenceManifest(manifest([truncated]), {
        now: fixedClock,
      }).evidenceItems[0],
    ).toMatchObject({
      contentHash: null,
      truncation: {
        isTruncated: true,
        originalCharacters: 100,
        retainedCharacters: 7,
      },
    });
  });

  it("marks redaction expansion truncation and bounds the final excerpt", () => {
    const summary = `${"a".repeat(
      MAX_EVIDENCE_EXCERPT_CHARACTERS - 12,
    )} password=x`;
    const record = behavioralRecord({
      summary,
      truncation: {
        isTruncated: false,
        originalCharacters: summary.length,
        retainedCharacters: summary.length,
      },
    });
    const item = normalizeRuntimeEvidenceManifest(manifest([record]), {
      now: fixedClock,
    }).evidenceItems[0]!;

    expect(item.excerpt).toHaveLength(MAX_EVIDENCE_EXCERPT_CHARACTERS);
    expect(item.excerpt).not.toContain("password=x");
    expect(item.truncation).toMatchObject({
      isTruncated: true,
      retainedCharacters: MAX_EVIDENCE_EXCERPT_CHARACTERS,
    });
    expect(item.truncation.originalCharacters).toBeGreaterThanOrEqual(
      item.truncation.retainedCharacters,
    );
  });

  it("maps unavailable records to ordered, redacted missing evidence without failed observations", () => {
    const statuses = [
      "not_found",
      "inaccessible",
      "unsupported",
      "malformed",
      "truncated",
    ] as const;
    const records = statuses.map((accessStatus, index) => {
      const reason =
        index === 3
          ? `${"a".repeat(1_988)} password=x`
          : `password=missing-${accessStatus}`;
      return {
        recordId: `record:missing:${index}`,
        kind: "browser_observation" as const,
        source: { ...source, locator: `missing/${index}` },
        environment,
        relatedChangeIds: [],
        relatedEvidenceIds: [],
        accessStatus,
        reason,
      };
    });

    const result = normalizeRuntimeEvidenceManifest(manifest(records), {
      now: fixedClock,
    });
    expect(result.evidenceItems).toEqual([]);
    expect(result.missingEvidence.map(({ status }) => status)).toEqual([
      "not_found",
      "inaccessible",
      "unsupported",
      "unsupported",
      "truncated",
    ]);
    expect(result.missingEvidence.map(({ source: itemSource }) =>
      itemSource.locator)).toEqual([
      "missing/0",
      "missing/1",
      "missing/2",
      "missing/3",
      "missing/4",
    ]);
    expect(
      result.missingEvidence.map(
        ({ runtimeUnavailableProvenance }) =>
          runtimeUnavailableProvenance,
      ),
    ).toEqual(
      records.map((record) => ({
        producer,
        sourceFormat: "generic_json",
        manifestRecordId: record.recordId,
        kind: record.kind,
        environment: record.environment,
        accessStatus: record.accessStatus,
        relatedChangeIds: record.relatedChangeIds,
        relatedEvidenceIds: record.relatedEvidenceIds,
      })),
    );
    expect(result.missingEvidence[3]?.reason).toHaveLength(2_000);
    expect(JSON.stringify(result)).not.toContain("password=x");
    expect(JSON.stringify(result)).not.toContain("missing-malformed");
  });

  it("rejects invalid manifests and invalid clocks through stable collector errors", () => {
    for (const action of [
      () => normalizeRuntimeEvidenceManifest({ records: [] }),
      () =>
        normalizeRuntimeEvidenceManifest(manifest(), {
          now: () => new Date(Number.NaN),
        }),
    ]) {
      expect(action).toThrow(RuntimeEvidenceCollectorError);
    }
    try {
      normalizeRuntimeEvidenceManifest(manifest(), {
        now: () => new Date(Number.NaN),
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "normalization_failed" });
      expect(String(error)).not.toContain("Invalid time");
    }
  });
});

describe("confined runtime manifest file collection", () => {
  it("loads one explicit manifest and leaves artifact references inert", async () => {
    const repositoryPath = await temporaryGitRepository();
    const inputManifest = manifest();
    await writeManifest(repositoryPath, inputManifest);

    const result = await collectRuntimeEvidence(
      {
        repositoryPath,
        manifestPath: "runtime/manifest.json",
      },
      { now: fixedClock },
    );

    expect(result).toEqual(
      normalizeRuntimeEvidenceManifest(inputManifest, { now: fixedClock }),
    );
    expect(result.evidenceItems[0]?.runtimeProvenance.artifactReferences)
      .toEqual(
        inputManifest.records[0]?.accessStatus === "available"
          ? inputManifest.records[0].artifactReferences
          : [],
      );
  });

  it.each([
    {
      name: "invalid input",
      prepare: async (repositoryPath: string) => ({
        repositoryPath,
        manifestPath: "../path-secret-sentinel.json",
        expectedCode: "invalid_input",
      }),
    },
    {
      name: "missing manifest",
      prepare: async (repositoryPath: string) => ({
        repositoryPath,
        manifestPath: "missing/path-secret-sentinel.json",
        expectedCode: "manifest_not_found",
      }),
    },
    {
      name: "directory target",
      prepare: async (repositoryPath: string) => {
        await mkdir(join(repositoryPath, "runtime"), { recursive: true });
        return {
          repositoryPath,
          manifestPath: "runtime",
          expectedCode: "manifest_file_unsafe",
        };
      },
    },
    {
      name: "oversized manifest",
      prepare: async (repositoryPath: string) => {
        await mkdir(join(repositoryPath, "runtime"), { recursive: true });
        await writeFile(
          join(repositoryPath, "runtime", "large.json"),
          Buffer.alloc(MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES + 1, 0x61),
        );
        return {
          repositoryPath,
          manifestPath: "runtime/large.json",
          expectedCode: "manifest_file_too_large",
        };
      },
    },
    {
      name: "invalid UTF-8",
      prepare: async (repositoryPath: string) => {
        await mkdir(join(repositoryPath, "runtime"), { recursive: true });
        await writeFile(
          join(repositoryPath, "runtime", "encoding.json"),
          Buffer.from([0xc3, 0x28]),
        );
        return {
          repositoryPath,
          manifestPath: "runtime/encoding.json",
          expectedCode: "manifest_encoding_invalid",
        };
      },
    },
    {
      name: "invalid JSON",
      prepare: async (repositoryPath: string) => {
        await mkdir(join(repositoryPath, "runtime"), { recursive: true });
        await writeFile(
          join(repositoryPath, "runtime", "json.json"),
          '{"content-secret-sentinel":',
          "utf8",
        );
        return {
          repositoryPath,
          manifestPath: "runtime/json.json",
          expectedCode: "manifest_json_invalid",
        };
      },
    },
    {
      name: "invalid Schema",
      prepare: async (repositoryPath: string) => {
        await writeManifest(repositoryPath, {
          schemaVersion: CORE_SCHEMA_VERSION,
          producer: {
            ...producer,
            name: "schema-secret-sentinel",
          },
          sourceFormat: "generic_json",
          records: [],
        });
        return {
          repositoryPath,
          manifestPath: "runtime/manifest.json",
          expectedCode: "manifest_schema_invalid",
        };
      },
    },
  ])("returns only static safe failure data for $name", async ({ prepare }) => {
    const repositoryPath = await temporaryGitRepository();
    const { expectedCode, ...input } = await prepare(repositoryPath);

    try {
      await collectRuntimeEvidence(input);
      throw new Error("Expected collection to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeEvidenceCollectorError);
      expect(error).toMatchObject({ code: expectedCode });
      const serialized = JSON.stringify({
        name: error instanceof Error ? error.name : "",
        message: error instanceof Error ? error.message : "",
        code:
          error instanceof RuntimeEvidenceCollectorError ? error.code : "",
      });
      for (const forbidden of [
        repositoryPath,
        "path-secret-sentinel",
        "content-secret-sentinel",
        "schema-secret-sentinel",
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(serialized.length).toBeLessThan(300);
    }
  });

  it("rejects a non-root repository path without disclosing it", async () => {
    const repositoryPath = await temporaryGitRepository();
    const nestedPath = join(repositoryPath, "nested-secret-sentinel");
    await mkdir(nestedPath);

    await expect(
      collectRuntimeEvidence({
        repositoryPath: nestedPath,
        manifestPath: "runtime.json",
      }),
    ).rejects.toMatchObject({ code: "repository_unavailable" });
  });

  it("rejects symbolic-link segments and targets", async () => {
    const repositoryPath = await temporaryGitRepository();
    const outsidePath = await mkdtemp(
      join(tmpdir(), "change-trace-m6-outside-"),
    );
    temporaryDirectories.push(outsidePath);
    await writeManifest(outsidePath, manifest());
    await symlink(outsidePath, join(repositoryPath, "linked"), "junction");

    await expect(
      collectRuntimeEvidence({
        repositoryPath,
        manifestPath: "linked/runtime/manifest.json",
      }),
    ).rejects.toMatchObject({ code: "manifest_file_unsafe" });

    await writeManifest(repositoryPath, manifest(), "runtime/real.json");
    try {
      await symlink(
        join(repositoryPath, "runtime", "real.json"),
        join(repositoryPath, "runtime", "target.json"),
        "file",
      );
      await expect(
        collectRuntimeEvidence({
          repositoryPath,
          manifestPath: "runtime/target.json",
        }),
      ).rejects.toMatchObject({ code: "manifest_file_unsafe" });
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "EPERM"
      ) {
        throw error;
      }
    }
  });

  it("exports the exact bounded failure vocabulary and byte limit", () => {
    expect(publicApi.collectRuntimeEvidence).toBe(collectRuntimeEvidence);
    expect(publicApi.normalizeRuntimeEvidenceManifest).toBe(
      normalizeRuntimeEvidenceManifest,
    );
    expect(publicApi.collectRuntimeEvidenceInputSchema).toBe(
      collectRuntimeEvidenceInputSchema,
    );
    expect(MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES).toBe(4_194_304);
    expect(RUNTIME_EVIDENCE_COLLECTOR_ERROR_CODES).toEqual([
      "invalid_input",
      "repository_unavailable",
      "manifest_not_found",
      "manifest_file_unsafe",
      "manifest_file_too_large",
      "manifest_read_failed",
      "manifest_encoding_invalid",
      "manifest_json_invalid",
      "manifest_schema_invalid",
      "normalization_failed",
    ]);
  });
});
