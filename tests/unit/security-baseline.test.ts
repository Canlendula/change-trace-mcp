import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const reviewedBaseCommit = "e5955fb27ba2bf93f70df20b6057043fdb8d1afa";
const inventoryPath = "docs/security/control-inventory.json";
const reviewPath = "docs/security/M7_SECURITY_REVIEW.md";

const toolNames = [
  "collect_external_evidence",
  "collect_local_evidence",
  "collect_runtime_evidence",
  "get_change_scope",
  "get_compatibility_fixture",
  "get_review_bundle",
  "get_server_info",
  "validate_findings",
  "write_report",
] as const;

const annotationKeys = [
  "readOnlyHint",
  "destructiveHint",
  "idempotentHint",
  "openWorldHint",
] as const;

const capabilityKeys = [
  "filesystem",
  "process",
  "networkExternal",
  "write",
] as const;
const capabilityValues = {
  filesystem: ["none", "local_read", "repository_read", "configuration_read", "repository_write"],
  process: ["none", "fixed_git", "host_configured_adapter"],
  networkExternal: ["none", "host_configured_adapter", "host_model_ci"],
  write: ["none", "report_pair"],
} as const;
const childProcessModuleSpecifiers = new Set([
  "child_process",
  "node:child_process",
]);
const allowedProductionModuleSpecifiers = new Set([
  "@modelcontextprotocol/sdk/server/mcp.js",
  "@modelcontextprotocol/sdk/server/stdio.js",
  "node:child_process",
  "node:crypto",
  "node:fs",
  "node:fs/promises",
  "node:path",
  "node:url",
  "node:util",
  "zod",
]);

type Reference = { path: string; token?: string };
type Annotation = Record<(typeof annotationKeys)[number], boolean>;
type Capability = Record<(typeof capabilityKeys)[number], string>;
type InventoryEntry = {
  id: string;
  annotations?: Annotation;
  capabilities: Capability;
  dataClasses: string[];
  trustLevel: string;
  failureProjection: string;
  controls: Reference[];
  verification: Reference[];
  operatorResponsibilities: string[];
  residualRisks: string[];
};
type Finding = {
  id: string;
  severity: string;
  title: string;
  evidence: Reference[];
  impact: string;
  disposition: string;
  followUp: string;
};
type Inventory = {
  schemaVersion: string;
  reviewedAt: string;
  reviewedBaseCommit: string;
  tools: InventoryEntry[];
  surfaces: InventoryEntry[];
  findings: Finding[];
};

function exactKeys(value: object, keys: readonly string[]): void {
  expect(Object.keys(value).sort()).toEqual([...keys].sort());
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTypeOf("object");
  expect(value, label).not.toBeNull();
  expect(Array.isArray(value), label).toBe(false);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a record`);
  }
  return value as Record<string, unknown>;
}

function assertBoundedStrings(values: unknown, label: string): asserts values is string[] {
  expect(Array.isArray(values), label).toBe(true);
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array`);
  }
  expect(values.length, label).toBeGreaterThan(0);
  expect(values.length, label).toBeLessThanOrEqual(32);
  for (const value of values) {
    expect(typeof value, label).toBe("string");
    if (typeof value !== "string") {
      throw new Error(`${label} must contain strings`);
    }
    expect(value.length, label).toBeGreaterThan(0);
    expect(value.length, label).toBeLessThanOrEqual(1_000);
  }
}

function assertReferences(value: unknown, label: string): asserts value is Reference[] {
  expect(Array.isArray(value), label).toBe(true);
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  expect(value.length, label).toBeGreaterThan(0);
  expect(value.length, label).toBeLessThanOrEqual(32);
  for (const reference of value) {
    const record = asRecord(reference, label);
    expect(Object.keys(record).every((key) => key === "path" || key === "token")).toBe(true);
    expect(typeof record.path).toBe("string");
    if (typeof record.path !== "string") {
      throw new Error(`${label} path must be a string`);
    }
    expect(record.path.length).toBeGreaterThan(0);
    expect(record.path.length).toBeLessThanOrEqual(240);
    expect(record.path).not.toMatch(/\\|^\/|(^|\/)\.\.($|\/)|\0/u);
    if (record.token !== undefined) {
      expect(typeof record.token).toBe("string");
      if (typeof record.token !== "string") {
        throw new Error(`${label} token must be a string`);
      }
      expect(record.token.length).toBeGreaterThan(0);
      expect(record.token.length).toBeLessThanOrEqual(160);
    }
  }
}

function assertEntry(value: unknown, tool: boolean): asserts value is InventoryEntry {
  const entry = asRecord(value, "inventory entry");
  exactKeys(
    entry,
    tool
      ? [
          "id",
          "annotations",
          "capabilities",
          "dataClasses",
          "trustLevel",
          "failureProjection",
          "controls",
          "verification",
          "operatorResponsibilities",
          "residualRisks",
        ]
      : [
          "id",
          "capabilities",
          "dataClasses",
          "trustLevel",
          "failureProjection",
          "controls",
          "verification",
          "operatorResponsibilities",
          "residualRisks",
        ],
  );
  expect(typeof entry.id).toBe("string");
  expect(entry.id).toMatch(/^(tool|surface):[a-z0-9_-]+$/u);
  const capabilities = asRecord(entry.capabilities, "capabilities");
  exactKeys(capabilities, capabilityKeys);
  for (const key of capabilityKeys) {
    expect(typeof capabilities[key]).toBe("string");
    expect(capabilityValues[key]).toContain(capabilities[key]);
  }
  if (tool) {
    const annotations = asRecord(entry.annotations, "annotations");
    exactKeys(annotations, annotationKeys);
    for (const key of annotationKeys) {
      expect(typeof annotations[key]).toBe("boolean");
    }
  }
  assertBoundedStrings(entry.dataClasses, "dataClasses");
  expect(["trusted_host", "trusted_repository", "untrusted_external", "observed_runtime", "mixed"]).toContain(entry.trustLevel);
  expect(["structured_safe_error", "bounded_raw_error", "not_applicable"]).toContain(entry.failureProjection);
  assertReferences(entry.controls, "controls");
  assertReferences(entry.verification, "verification");
  assertBoundedStrings(entry.operatorResponsibilities, "operatorResponsibilities");
  assertBoundedStrings(entry.residualRisks, "residualRisks");
}

async function readRepositoryFile(path: string): Promise<string> {
  return readFile(resolve(repositoryRoot, path), "utf8");
}

async function sourceFiles(directory = "src"): Promise<string[]> {
  const entries = await readdir(resolve(repositoryRoot, directory), {
    withFileTypes: true,
  });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );
  return paths.flat().filter((path) => path.endsWith(".ts")).sort();
}

function serverAnnotations(source: string): Map<string, Annotation> {
  const results = new Map<string, Annotation>();
  const pattern = /server\.registerTool\(\s*"([a-z_]+)"[\s\S]*?annotations:\s*\{\s*readOnlyHint:\s*(true|false),\s*destructiveHint:\s*(true|false),\s*idempotentHint:\s*(true|false),\s*openWorldHint:\s*(true|false),/gu;
  for (const match of source.matchAll(pattern)) {
    results.set(match[1]!, {
      readOnlyHint: match[2] === "true",
      destructiveHint: match[3] === "true",
      idempotentHint: match[4] === "true",
      openWorldHint: match[5] === "true",
    });
  }
  return results;
}

function importedModuleSpecifiers(source: string): string[] {
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*$\s{},]+?\s+from\s+)?["']([^"']+)["']/gu,
    /\bexport\s+(?:type\s+)?(?:[\w*$\s{},]+?\s+from\s+)["']([^"']+)["']/gu,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
  ];
  return patterns.flatMap((pattern) => [
    ...source.matchAll(pattern),
  ].map((match) => match[1]!));
}

function matchingModuleSpecifiers(
  source: string,
  candidates: ReadonlySet<string>,
): string[] {
  return importedModuleSpecifiers(source).filter((specifier) =>
    candidates.has(specifier),
  );
}

function isRelativeModuleSpecifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function nonLiteralLoaderCalls(source: string): Array<"require" | "import"> {
  const calls: Array<"require" | "import"> = [];
  const pattern = /\b(require|import)\s*\(\s*([^)]*?)\s*\)/gu;
  for (const match of source.matchAll(pattern)) {
    const argument = match[2]!.trim();
    if (!/^(["'])[^"']*\1$/u.test(argument)) {
      calls.push(match[1]! as "require" | "import");
    }
  }
  return calls;
}

describe("M7 security and privacy baseline", () => {
  it("keeps the strict inventory synchronized with the current MCP surface", async () => {
    const inventory = JSON.parse(await readRepositoryFile(inventoryPath)) as Inventory;
    exactKeys(inventory, [
      "schemaVersion",
      "reviewedAt",
      "reviewedBaseCommit",
      "tools",
      "surfaces",
      "findings",
    ]);
    expect(inventory.schemaVersion).toBe("1.0.0");
    expect(inventory.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(inventory.reviewedBaseCommit).toBe(reviewedBaseCommit);

    expect(inventory.tools).toHaveLength(toolNames.length);
    expect(inventory.surfaces).toHaveLength(6);
    expect(inventory.findings.length).toBeGreaterThan(0);

    const ids = new Set<string>();
    for (const tool of inventory.tools) {
      assertEntry(tool, true);
      expect(ids.has(tool.id)).toBe(false);
      ids.add(tool.id);
    }
    for (const surface of inventory.surfaces) {
      assertEntry(surface, false);
      expect(ids.has(surface.id)).toBe(false);
      ids.add(surface.id);
    }

    expect(inventory.tools.map(({ id }) => id.replace("tool:", "")).sort()).toEqual([...toolNames].sort());
    expect(inventory.surfaces.map(({ id }) => id).sort()).toEqual([
      "surface:agent-model-ci-processing",
      "surface:external-adapter-registration-loading",
      "surface:fixed-git-subprocesses",
      "surface:package-installation-supply-chain",
      "surface:report-artifact-retention",
      "surface:stdio-launch-configuration",
    ]);

    const source = await readRepositoryFile("src/server.ts");
    const actualAnnotations = serverAnnotations(source);
    expect([...actualAnnotations.keys()].sort()).toEqual([...toolNames].sort());
    for (const tool of inventory.tools) {
      expect(tool.annotations).toEqual(actualAnnotations.get(tool.id.replace("tool:", "")));
    }
    const openWorld = inventory.tools.filter(({ annotations }) => annotations?.openWorldHint).map(({ id }) => id);
    expect(openWorld).toEqual(["tool:collect_external_evidence"]);
    const destructive = inventory.tools.filter(({ annotations }) => annotations?.destructiveHint).map(({ id }) => id);
    expect(destructive).toEqual(["tool:write_report"]);
    const writable = inventory.tools.filter(({ annotations }) => annotations?.readOnlyHint === false).map(({ id }) => id);
    const nonIdempotent = inventory.tools.filter(({ annotations }) => annotations?.idempotentHint === false).map(({ id }) => id);
    expect(writable).toEqual(["tool:write_report"]);
    expect(nonIdempotent).toEqual(["tool:write_report"]);

    const processBoundaries = [...inventory.tools, ...inventory.surfaces]
      .filter((entry) => entry.capabilities.process !== "none")
      .map(({ id }) => id)
      .sort();
    expect(processBoundaries).toEqual([
      "surface:fixed-git-subprocesses",
      "tool:collect_external_evidence",
      "tool:get_change_scope",
    ]);
  });

  it("resolves every declared reference and records reviewed findings safely", async () => {
    const inventory = JSON.parse(await readRepositoryFile(inventoryPath)) as Inventory;
    const review = await readRepositoryFile(reviewPath);
    const entries = [...inventory.tools, ...inventory.surfaces];
    for (const entry of entries) {
      for (const reference of [...entry.controls, ...entry.verification]) {
        const fullPath = resolve(repositoryRoot, reference.path);
        expect(relative(repositoryRoot, fullPath)).not.toMatch(/^(\.\.(?:[\\/]|$)|[\\/])/u);
        const content = await readRepositoryFile(reference.path);
        if (reference.token !== undefined) {
          expect(content, `${reference.path} contains ${reference.token}`).toContain(reference.token);
        }
      }
    }

    const findingIds = new Set<string>();
    for (const finding of inventory.findings) {
      const record = asRecord(finding, "finding");
      exactKeys(record, ["id", "severity", "title", "evidence", "impact", "disposition", "followUp"]);
      expect(typeof finding.id).toBe("string");
      expect(finding.id).toMatch(/^FIND-M7-\d{3}$/u);
      expect(findingIds.has(finding.id)).toBe(false);
      findingIds.add(finding.id);
      expect(["critical", "high", "medium", "low", "informational"]).toContain(finding.severity);
      expect(["mitigated", "open", "accepted", "out_of_scope"]).toContain(finding.disposition);
      expect(finding.title.length).toBeGreaterThan(0);
      expect(finding.impact.length).toBeGreaterThan(0);
      expect(finding.followUp.length).toBeGreaterThan(0);
      assertReferences(finding.evidence, "finding evidence");
      for (const reference of finding.evidence) {
        const content = await readRepositoryFile(reference.path);
        if (reference.token !== undefined) {
          expect(content).toContain(reference.token);
        }
      }
      expect(review).toContain(finding.id);
      if (finding.severity === "critical" || finding.severity === "high") {
        expect(finding.disposition).not.toBe("accepted");
        if (finding.disposition === "mitigated") {
          expect(finding.evidence.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("rejects unreviewed module imports and non-literal loaders", () => {
    const fixture = [
      'import { spawn } from "node:child_process";',
      "import 'child_process';",
      'const processModule = require("node:child_process");',
      "const dynamicProcessModule = import('child_process');",
      'import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";',
      'import { z } from "zod";',
      'import { createHash } from "node:crypto";',
      'import "./internal.js";',
      'import "../parent.js";',
      'import "@modelcontextprotocol/sdk/client/sse.js";',
      'import "node:module";',
      'import "unknown-package";',
      "const dynamicClient = import('@modelcontextprotocol/sdk/client/stdio.js');",
      "const unknownDynamic = import(moduleSpecifier);",
      "const unknownRequire = require(resolveSpecifier);",
    ].join("\n");
    expect(matchingModuleSpecifiers(fixture, childProcessModuleSpecifiers)).toEqual([
      "node:child_process",
      "child_process",
      "node:child_process",
      "child_process",
    ]);
    expect(
      importedModuleSpecifiers(fixture).filter(
        (specifier) =>
          !isRelativeModuleSpecifier(specifier) &&
          !allowedProductionModuleSpecifiers.has(specifier),
      ),
    ).toEqual([
      "child_process",
      "@modelcontextprotocol/sdk/client/sse.js",
      "node:module",
      "unknown-package",
      "child_process",
      "@modelcontextprotocol/sdk/client/stdio.js",
    ]);
    expect(nonLiteralLoaderCalls(fixture)).toEqual(["import", "require"]);
  });

  it("guards package, README, and first-party process/network boundaries", async () => {
    const packageJson = JSON.parse(await readRepositoryFile("package.json")) as Record<string, unknown>;
    const basePackage = JSON.parse(
      execFileSync("git", ["show", `${reviewedBaseCommit}:package.json`], {
        cwd: repositoryRoot,
        encoding: "utf8",
      }),
    ) as Record<string, unknown>;
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageJson.files).toEqual(expect.arrayContaining(["SECURITY.md", "docs/security"]));
    for (const key of ["version", "dependencies", "devDependencies", "scripts", "engines", "overrides", "publishConfig"]) {
      expect(packageJson[key], `package ${key} changed`).toEqual(basePackage[key]);
    }

    const readme = await readRepositoryFile("README.md");
    for (const link of ["SECURITY.md", "docs/security/README.md", "docs/security/THREAT_MODEL.md", "docs/security/PRIVACY.md", "docs/security/control-inventory.json"]) {
      expect(readme).toContain(link);
    }

    const sourcePaths = await sourceFiles();
    const sourceTexts = await Promise.all(sourcePaths.map(async (path) => [path.replaceAll("\\", "/"), await readRepositoryFile(path)] as const));
    const networkCall = /\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(/u;
    const processSources = new Map<string, string[]>();
    const productionModuleSpecifiers = new Set<string>();
    for (const [path, source] of sourceTexts) {
      const moduleSpecifiers = importedModuleSpecifiers(source);
      const nonRelativeModuleSpecifiers = moduleSpecifiers.filter(
        (specifier) => !isRelativeModuleSpecifier(specifier),
      );
      expect(
        nonRelativeModuleSpecifiers.filter(
          (specifier) => !allowedProductionModuleSpecifiers.has(specifier),
        ),
        `${path} must not add an unreviewed production module import`,
      ).toEqual([]);
      expect(
        nonLiteralLoaderCalls(source),
        `${path} must not add a non-literal module loader`,
      ).toEqual([]);
      for (const specifier of nonRelativeModuleSpecifiers) {
        productionModuleSpecifiers.add(specifier);
      }
      expect(source, `${path} must not add a first-party network call`).not.toMatch(networkCall);
      const processReferences = matchingModuleSpecifiers(
        source,
        childProcessModuleSpecifiers,
      );
      if (processReferences.length > 0) {
        processSources.set(path, processReferences);
      }
    }
    expect([...productionModuleSpecifiers].sort()).toEqual(
      [...allowedProductionModuleSpecifiers].sort(),
    );
    expect([...processSources.entries()]).toEqual([
      ["src/evidence/external/run-external-adapter.ts", ["node:child_process"]],
      ["src/git/change-scope.ts", ["node:child_process"]],
    ]);
  });
});
