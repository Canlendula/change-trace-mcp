import { access, mkdtemp, rm } from "node:fs/promises";
import { statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const smokeModulePath = "../../scripts/smoke-clean-install.mjs";
const {
  CLEAN_INSTALL_FIXTURE,
  EXPECTED_TOOL_NAMES,
  createSmokePlan,
  parsePackResult,
  resolveCliPath,
  runBounded,
  sanitizeEnvironment,
  validateSmokeSummary,
  validateLaunchResult,
  validatePackedFiles,
  withTemporaryRoot,
} = await import(smokeModulePath);

describe("clean package installation smoke helpers", () => {
  it("plans isolated artifact, cache, config, and consumer paths outside the checkout", () => {
    const plan = createSmokePlan({
      repositoryRoot: "C:/work/change-trace-mcp",
      temporaryRoot: "C:/temp/change-trace-clean-123",
      npmCliPath: "C:/node/npm-cli.js",
      npxCliPath: "C:/node/npx-cli.js",
    });

    expect({
      ...plan,
      artifactDirectory: plan.artifactDirectory.replaceAll("\\", "/"),
      cacheDirectory: plan.cacheDirectory.replaceAll("\\", "/"),
      consumerDirectory: plan.consumerDirectory.replaceAll("\\", "/"),
      npxDirectory: plan.npxDirectory.replaceAll("\\", "/"),
      userConfigPath: plan.userConfigPath.replaceAll("\\", "/"),
    }).toMatchObject({
      npmCliPath: "C:/node/npm-cli.js",
      npxCliPath: "C:/node/npx-cli.js",
      artifactDirectory: "C:/temp/change-trace-clean-123/artifact",
      cacheDirectory: "C:/temp/change-trace-clean-123/npm-cache",
      consumerDirectory: "C:/temp/change-trace-clean-123/consumer",
      npxDirectory: "C:/temp/change-trace-clean-123/npx-consumer",
      userConfigPath: "C:/temp/change-trace-clean-123/npmrc",
    });
    expect(plan.tarballPath).toBeNull();
  });

  it("rejects a temporary root inside the checkout and falls back from an invalid npm_execpath", () => {
    expect(() => createSmokePlan({
      repositoryRoot: "C:/work/change-trace-mcp",
      temporaryRoot: "C:/work/change-trace-mcp/.temporary",
    })).toThrow("temporary_root_invalid");
    const npmCliPath = resolveCliPath("npm", undefined, { npm_execpath: "C:/does-not-exist/npm-cli.js" });
    expect(statSync(npmCliPath).isFile()).toBe(true);
    expect(npmCliPath.replaceAll("\\", "/")).toMatch(/npm-cli\.js$/u);
    expect(resolveCliPath("npm", npmCliPath)).toBe(npmCliPath);
    expect(() => resolveCliPath("npm", "C:/does-not-exist/npm-cli.js")).toThrow("npm_cli_unavailable");
  });

  it("removes inherited npm, registry, and credential settings without duplicate Windows keys", () => {
    const environment = sanitizeEnvironment(
      {
        Path: "C:/Windows/System32",
        PATH: "ignored-duplicate",
        HOME: "C:/Users/unsafe",
        NPM_CONFIG_USERCONFIG: "C:/Users/unsafe/.npmrc",
        npm_config_registry: "https://private.invalid",
        NODE_AUTH_TOKEN: "secret",
        YARN_NPM_AUTH_TOKEN: "secret",
        HTTP_PROXY: "http://proxy.invalid",
      },
      {
        cacheDirectory: "C:/temp/npm-cache",
        userConfigPath: "C:/temp/npmrc",
        homeDirectory: "C:/temp/home",
      },
    );

    expect(environment.PATH).toBe("C:/Windows/System32");
    expect(environment.HOME).toBe("C:/temp/home");
    expect(environment.NPM_CONFIG_CACHE).toBe("C:/temp/npm-cache");
    expect(environment.NPM_CONFIG_USERCONFIG).toBe("C:/temp/npmrc");
    expect(environment.NPM_CONFIG_IGNORE_SCRIPTS).toBe("true");
    expect(Object.keys(environment).map((key) => key.toUpperCase())).toEqual(
      expect.arrayContaining(["PATH", "NPM_CONFIG_CACHE", "NPM_CONFIG_USERCONFIG"]),
    );
    expect(new Set(Object.keys(environment).map((key) => key.toUpperCase())).size).toBe(
      Object.keys(environment).length,
    );
    expect(environment).not.toHaveProperty("NODE_AUTH_TOKEN");
    expect(environment).not.toHaveProperty("npm_config_registry");
    expect(environment).not.toHaveProperty("HTTP_PROXY");
  });

  it("accepts exactly one matching npm pack result and rejects malformed or mismatched data", () => {
    const parsed = parsePackResult(
      JSON.stringify([
        {
          id: "change-trace-mcp@0.0.0-dev.1",
          name: "change-trace-mcp",
          version: "0.0.0-dev.1",
          filename: "change-trace-mcp-0.0.0-dev.1.tgz",
          size: 123,
          unpackedSize: 456,
          shasum: "a".repeat(40),
          integrity: "sha512-example",
          files: [{ path: "dist/cli.js", size: 1 }],
        },
      ]),
      "change-trace-mcp",
      "0.0.0-dev.1",
    );
    expect(parsed.filename).toBe("change-trace-mcp-0.0.0-dev.1.tgz");
    expect(parsed.files).toHaveLength(1);
    expect(() => parsePackResult("[]", "change-trace-mcp", "0.0.0-dev.1")).toThrow("pack_result_invalid");
    expect(() => parsePackResult(JSON.stringify([{ ...parsed, name: "other" }]), "change-trace-mcp", "0.0.0-dev.1")).toThrow("pack_identity_invalid");
  });

  it("requires package outputs and guides while rejecting checkout and credential paths", () => {
    const required = [
      "dist/cli.js",
      "dist/index.js",
      "dist/index.d.ts",
      "README.md",
      "LICENSE",
      "SECURITY.md",
      "docs/smoke-tests/README.md",
      "docs/smoke-tests/config/codex.toml.example",
      "docs/smoke-tests/config/claude.mcp.json.example",
      "docs/smoke-tests/config/opencode.json.example",
      "docs/smoke-tests/config/opencode-v2.json.example",
      "docs/security/README.md",
    ];
    expect(() => validatePackedFiles(required)).not.toThrow();
    expect(() => validatePackedFiles([...required, "src/cli.ts"])).toThrow("packed_file_forbidden");
    for (const forbidden of [".env", ".env.production", "auth.json", "token.txt", "secret.env", "credentials.json", ".npmrc", ".netrc"]) {
      expect(() => validatePackedFiles([...required, forbidden])).toThrow("packed_file_forbidden");
    }
    expect(() => validatePackedFiles(required.slice(1))).toThrow("packed_file_missing");
  });

  it("requires the exact nine-tool launch result and byte-stable fixture", () => {
    const result = {
      ok: true,
      tools: [...EXPECTED_TOOL_NAMES],
      fixture: JSON.parse(CLEAN_INSTALL_FIXTURE),
    };
    expect(() => validateLaunchResult(JSON.stringify(result))).not.toThrow();
    expect(() => validateLaunchResult(JSON.stringify({ ...result, tools: result.tools.slice(1) }))).toThrow("launch_tools_invalid");
    expect(() => validateLaunchResult(JSON.stringify({ ...result, fixture: { ok: false } }))).toThrow("launch_fixture_invalid");
  });

  it("bounds a hung child and combined stdout/stderr without leaking child output", async () => {
    await expect(runBounded(process.execPath, ["-e", "setInterval(() => {}, 1_000)"], { timeoutMs: 40 })).rejects.toThrow("command_timeout");
    await expect(runBounded(process.execPath, ["-e", "process.stdout.write('a'.repeat(32)); process.stderr.write('b'.repeat(32))"], { maxOutputBytes: 32 })).rejects.toThrow("command_output_limit");
  });

  it.skipIf(process.platform === "win32")("escalates a SIGTERM-ignoring process group to SIGKILL", async () => {
    await expect(runBounded(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1_000)"], { timeoutMs: 40 })).rejects.toThrow("command_timeout");
  });

  it("accepts only the fixed non-sensitive success summary shape", () => {
    const summary = {
      schemaVersion: "1.0.0",
      package: { name: "change-trace-mcp", sourceVersion: "0.0.0-dev.1" },
      tarball: { filename: "change-trace-mcp-0.0.0-dev.1.tgz", sha256: "a".repeat(64), npmShasum: "b".repeat(40), npmIntegrity: "sha512-example", packedSize: 1, unpackedSize: 2, fileCount: 3 },
      runtime: { node: "v24.0.0", npm: "11.3.0", platform: "win32", arch: "x64" },
      install: { ok: true, copiedPackage: true },
      npx: { ok: true },
      tools: [...EXPECTED_TOOL_NAMES],
      fixture: CLEAN_INSTALL_FIXTURE,
      cleanup: true,
    };
    expect(() => validateSmokeSummary(summary)).not.toThrow();
    expect(() => validateSmokeSummary({ ...summary, secret: "not-allowed" })).toThrow("summary_invalid");
  });

  it("removes the complete temporary root after a deterministic failure", async () => {
    let retainedRoot = "";
    await expect(
      withTemporaryRoot(async (root: string) => {
        retainedRoot = root;
        throw new Error("expected_failure");
      }),
    ).rejects.toThrow("expected_failure");
    await expect(access(retainedRoot)).rejects.toThrow();
  });

  it("does not leave test-owned temporary roots behind", async () => {
    const root = await mkdtemp(join(tmpdir(), "change-trace-clean-test-"));
    await rm(root, { recursive: true, force: true });
    await expect(access(root)).rejects.toThrow();
  });
});
