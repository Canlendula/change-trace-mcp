import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-expect-error -- repository-only JavaScript helper intentionally has no declaration file.
import { cleanEnvironment, maxTarballFiles, npmCommand, parsePackResult, parseVersionStatus, validateTarball } from "../../scripts/release/dry-run-publish.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const packageName = "change-trace-mcp";
const version = "0.0.0-dev.1";

async function repositoryFile(path: string): Promise<string> {
  return await readFile(resolve(root, path), "utf8");
}

function packRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: packageName,
    version,
    filename: `${packageName}-${version}.tgz`,
    size: 100,
    unpackedSize: 200,
    shasum: "a".repeat(40),
    integrity: `sha512-${"A".repeat(86)}==`,
    files: [{ path: "package.json" }, { path: "dist/index.js" }],
    ...overrides,
  };
}

describe("M7 stage-only publishing contract", () => {
  it("keeps the workflow manual, pinned, cache-free, credential-separated, and stage-guarded", async () => {
    const workflow = await repositoryFile(".github/workflows/npm-stage-publish.yml");
    expect(workflow).toContain("on:\n  workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*(?:push|pull_request|schedule|workflow_call):/mu);
    expect(workflow).toContain("default: dry-run");
    expect(workflow).toContain("- dry-run");
    expect(workflow).toContain("- stage");
    for (const input of ["version", "commit", "confirmation"]) {
      expect(workflow).toMatch(new RegExp(`${input}:\\n\\s+description:[^\\n]+\\n\\s+required: false`, "u"));
    }
    expect(workflow).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
    expect(workflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020");
    expect(workflow).not.toMatch(/actions\/(?:checkout|setup-node)@v/iu);
    expect(workflow).toContain("node-version: 24.18.0");
    expect((workflow.match(/package-manager-cache: false/gu) ?? [])).toHaveLength(2);
    expect((workflow.match(/test "\$\(npm --version\)" = "11\.16\.0"/gu) ?? [])).toHaveLength(2);
    expect(workflow).not.toMatch(/npm\s+install\s+--global/iu);
    expect(workflow).toContain("npm ci --ignore-scripts --no-audit --no-fund --registry https://registry.npmjs.org/");
    expect(workflow).not.toMatch(/(?:NODE_AUTH_TOKEN|NPM_TOKEN|npmrc|secrets?\.)/iu);

    const [dryRunSection, stageSection] = workflow.split("  stage:\n", 2);
    expect(dryRunSection).toContain("permissions:\n      contents: read");
    expect(dryRunSection).not.toContain("id-token: write");
    expect(stageSection).toBeTypeOf("string");
    if (stageSection === undefined) throw new Error("stage_job_missing");
    expect(stageSection).toContain("vars.NPM_STAGE_PUBLISH_ENABLED == 'true'");
    expect(stageSection).toContain("github.ref == format('refs/tags/v{0}', inputs.version)");
    expect(stageSection).toContain("environment: npm-stage");
    expect(stageSection).toContain("id-token: write");
    expect(stageSection.indexOf("- name: Set up Node.js")).toBeLessThan(stageSection.indexOf("- name: Verify stage request guards"));
    expect(stageSection).toContain("test \"$INPUT_CONFIRMATION\" = \"STAGE CHANGE-TRACE-MCP CANDIDATE\"");
    expect(stageSection).toContain("grep -Eq '^[0-9a-f]{40}$'");
    expect(stageSection).toContain("git rev-parse HEAD");
    expect(stageSection).toContain('git rev-parse "refs/tags/v$INPUT_VERSION^{}"');
    expect(stageSection).toContain('test "$INPUT_VERSION" != "0.0.0-dev.0"');
    expect(stageSection).toContain("npm stage publish . --tag next --access public --ignore-scripts --registry https://registry.npmjs.org/");
    expect(stageSection).not.toMatch(/npm\s+publish\b|npm\s+dist-tag\b|npm\s+stage\s+(?:approve|reject)|git\s+tag|gh\s+release/iu);
  });

  it("allows only a narrow non-secret child environment and fixed temporary npm configuration", () => {
    const locations = { home: "/temporary/home", cache: "/temporary/cache", userConfig: "/temporary/npmrc" };
    const environment = cleanEnvironment({
      Path: "safe-path",
      SystemRoot: "C:\\Windows",
      TEMP: "C:\\temp",
      LANG: "en_US.UTF-8",
      NPM_CONFIG_USERCONFIG: "poison",
      npm_config_globalconfig: "poison",
      NODE_AUTH_TOKEN: "poison",
      NPM_TOKEN: "poison",
      NODE_OPTIONS: "--require poison",
      HTTPS_PROXY: "https://user:password@proxy.example",
      AWS_ACCESS_KEY_ID: "poison",
      CUSTOM_SECRET: "poison",
    }, locations);
    expect(environment).toEqual({
      Path: "safe-path",
      SystemRoot: "C:\\Windows",
      TEMP: "C:\\temp",
      LANG: "en_US.UTF-8",
      HOME: locations.home,
      USERPROFILE: locations.home,
      npm_config_cache: locations.cache,
      npm_config_userconfig: locations.userConfig,
      npm_config_registry: "https://registry.npmjs.org/",
      npm_config_ignore_scripts: "true",
      npm_config_always_auth: "false",
    });
  });

  it("builds fixed npm argv and fails closed while checking the public version", () => {
    const locations = { cache: "/temporary/cache", userConfig: "/temporary/npmrc" };
    const [executable, args] = npmCommand("publish", locations, ["/temporary/package.tgz", "--dry-run", "--tag", "next", "--access", "public"]);
    expect(executable).toBe(process.execPath);
    expect(args.slice(1)).toEqual([
      "publish", "--userconfig", locations.userConfig, "--cache", locations.cache,
      "--registry", "https://registry.npmjs.org/", "--ignore-scripts", "/temporary/package.tgz", "--dry-run", "--tag", "next", "--access", "public",
    ]);
    expect(parseVersionStatus({ code: 0, stdout: JSON.stringify(version), stderr: "" }, packageName, version)).toBe("published");
    expect(parseVersionStatus({
      code: 1,
      stdout: JSON.stringify({ error: { code: "E404", summary: `No match found for version ${version}`, detail: `'${packageName}@${version}' is not in this registry.` } }),
      stderr: "",
    }, packageName, version)).toBe("unpublished");
    expect(() => parseVersionStatus({ code: 1, stdout: JSON.stringify({ error: { code: "E500", summary: "registry unavailable" } }), stderr: "" }, packageName, version)).toThrow("version_status_unavailable");
    expect(() => parseVersionStatus({ code: 1, stdout: "not-json", stderr: "" }, packageName, version)).toThrow("version_status_unavailable");
    expect(() => parseVersionStatus({ code: 0, stdout: "not-json", stderr: "" }, packageName, version)).toThrow("view_json_invalid");
  });

  it("requires exactly one bounded tarball record with bounded package files", () => {
    const normal = parsePackResult(JSON.stringify([packRecord()]), packageName, version);
    expect(normal.files).toHaveLength(2);
    expect(() => parsePackResult("not-json", packageName, version)).toThrow("pack_json_invalid");
    expect(() => parsePackResult(JSON.stringify([packRecord(), packRecord()]), packageName, version)).toThrow("tarball_count_invalid");
    expect(() => parsePackResult(JSON.stringify([packRecord({ files: undefined })]), packageName, version)).toThrow("pack_metadata_invalid");
    expect(() => parsePackResult(JSON.stringify([packRecord({ files: Array.from({ length: maxTarballFiles + 1 }, () => ({ path: "file" })) })]), packageName, version)).toThrow("pack_metadata_invalid");
    expect(() => parsePackResult(JSON.stringify([packRecord({ size: 100_000_000 })]), packageName, version)).toThrow("pack_metadata_invalid");
    expect(() => parsePackResult(JSON.stringify([packRecord({ unpackedSize: 1_000_000_000 })]), packageName, version)).toThrow("pack_metadata_invalid");
  });

  it("checks the exact single tarball directory entry and on-disk size before hashing", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "change-trace-release-contract-"));
    const artifacts = join(temporaryRoot, "artifacts");
    const packed = parsePackResult(JSON.stringify([packRecord()]), packageName, version);
    try {
      await mkdir(artifacts);
      await writeFile(join(artifacts, packed.filename), Buffer.alloc(packed.size));
      await expect(validateTarball(artifacts, packed)).resolves.toBe(resolve(artifacts, packed.filename));
      await writeFile(join(artifacts, "unexpected.tgz"), "extra");
      await expect(validateTarball(artifacts, packed)).rejects.toThrow("tarball_directory_invalid");
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("documents manual authorization boundaries without asserting external release activity", async () => {
    const guide = await repositoryFile("docs/release/PUBLISHING.md");
    expect(guide).toContain("This is repository-maintainer guidance.");
    expect(guide).toContain("NPM_STAGE_PUBLISH_ENABLED=true");
    expect(guide).toContain("STAGE CHANGE-TRACE-MCP CANDIDATE");
    expect(guide).toContain("WebAuthn");
    expect(guide).toContain("local-dry-run-only");
    expect(guide).toContain("https://docs.npmjs.com/staged-publishing/");
    expect(guide).toContain("https://docs.npmjs.com/cli/v11/commands/npm-stage/");
    expect(guide).toContain("https://nodejs.org/en/blog/release/v24.18.0");
    expect(guide).not.toMatch(/this task (?:configured|staged|approved|published)/iu);
  });
});
