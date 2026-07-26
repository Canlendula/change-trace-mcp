import { access, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// @ts-expect-error JavaScript harness is intentionally imported directly for its offline helpers.
const harness = await import("../../scripts/smoke-real-hosts.mjs");

describe("real Host compatibility harness helpers", () => {
  it("uses the frozen nine-tool set and exact fixture", () => {
    expect(harness.EXPECTED_TOOL_NAMES).toEqual([
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
    expect(harness.FIXTURE_TEXT).toBe('{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}');
  });

  it("creates only contained temporary paths and rejects a state root in the checkout", () => {
    const plan = harness.createHostPlan({
      repositoryRoot: "C:/work/change-trace-mcp",
      stateRoot: "C:/temp/change-trace-m7-123",
      serverName: "m7_real_123",
    });
    expect(plan.installedCli.replaceAll("\\", "/")).toBe("C:/temp/change-trace-m7-123/consumer/node_modules/change-trace-mcp/dist/cli.js");
    expect(plan.probePath.replaceAll("\\", "/")).toBe("C:/temp/change-trace-m7-123/probe.mjs");
    expect(plan.serverName).toBe("m7_real_123");
    expect(() => harness.createHostPlan({
      repositoryRoot: "C:/work/change-trace-mcp",
      stateRoot: "C:/work/change-trace-mcp/.m7-state",
      serverName: "m7_real_123",
    })).toThrow("state_root_invalid");
  });

  it("sanitizes npm and installed-MCP environments without reading values", () => {
    const environment = harness.sanitizeChildEnvironment({
      PATH: "C:/Windows/System32",
      NODE_AUTH_TOKEN: "opaque",
      NPM_CONFIG_USERCONFIG: "C:/unsafe/.npmrc",
      OPENCODE_CONFIG: "C:/unsafe/opencode.json",
      ANTHROPIC_API_KEY: "opaque",
      HTTP_PROXY: "http://proxy.invalid",
    }, {
      cacheDirectory: "C:/temp/cache",
      userConfigPath: "C:/temp/npmrc",
      homeDirectory: "C:/temp/home",
    });
    expect(environment).toMatchObject({
      PATH: "C:/Windows/System32",
      HOME: "C:/temp/home",
      USERPROFILE: "C:/temp/home",
      NPM_CONFIG_CACHE: "C:/temp/cache",
      NPM_CONFIG_USERCONFIG: "C:/temp/npmrc",
      NPM_CONFIG_IGNORE_SCRIPTS: "true",
    });
    expect(Object.keys(environment).map((key) => key.toUpperCase())).not.toContain("NODE_AUTH_TOKEN");
    expect(Object.keys(environment).map((key) => key.toUpperCase())).not.toContain("ANTHROPIC_API_KEY");
    expect(Object.keys(environment).map((key) => key.toUpperCase())).not.toContain("OPENCODE_CONFIG");
  });

  it("accepts only an identity-bound pack result with the installed CLI", () => {
    const sourcePackage = { name: "change-trace-mcp", version: "0.0.0-dev.1" };
    const record = { name: sourcePackage.name, version: sourcePackage.version, filename: "change-trace-mcp-0.0.0-dev.1.tgz", size: 1, unpackedSize: 2, shasum: "a".repeat(40), integrity: "sha512-test=", files: [{ path: "dist/cli.js" }] };
    expect(harness.parsePack(JSON.stringify([record]), sourcePackage)).toMatchObject({ filename: record.filename, fileCount: 1 });
    expect(() => harness.parsePack(JSON.stringify([{ ...record, size: -1 }]), sourcePackage)).toThrow("pack_result_invalid");
    expect(() => harness.parsePack(JSON.stringify([{ ...record, files: [] }]), sourcePackage)).toThrow("pack_result_invalid");
    expect(() => harness.parsePack(JSON.stringify([{ ...record, shasum: "not-a-hash" }]), sourcePackage)).toThrow("pack_result_invalid");
  });

  it("builds strict, ephemeral Claude and OpenCode commands", () => {
    const plan = harness.createHostPlan({ repositoryRoot: "C:/work/repo", stateRoot: "C:/temp/m7", serverName: "m7_real_123" });
    const claude = harness.createHostCommand("claude", plan, "C:/tools/claude.exe");
    expect(claude.args).toEqual(expect.arrayContaining(["--mcp-config", plan.claudeConfigPath, "--strict-mcp-config", "--no-session-persistence", "--print", "--verbose"]));
    expect(claude.args).not.toContain("--continue");
    const opencode = harness.createHostCommand("opencode", plan, "C:/tools/opencode.exe");
    expect(opencode.args).toEqual(["run", "--format", "json", "--dir", plan.hostWorkingDirectory, expect.any(String)]);
    expect(opencode.environment.OPENCODE_CONFIG).toBe(plan.opencodeConfigPath);
  });

  it("accepts only the frozen observed executable versions", () => {
    expect(harness.parseHostVersion("claude", "2.1.217 (Claude Code)\n")).toBe("2.1.217");
    expect(harness.parseHostVersion("opencode", "1.18.4\n")).toBe("1.18.4");
    expect(() => harness.parseHostVersion("claude", "2.1.220 (Claude Code)")).toThrow("host_version_invalid");
    expect(() => harness.parseHostVersion("opencode", "unexpected output")).toThrow("host_version_invalid");
  });

  it("requires zero-exit preparation and version results without exposing output", () => {
    expect(harness.requireSuccessfulResult({ exitCode: 0, signal: null, stdout: "opaque-success", stderr: "" }, "npm_install_failed")).toMatchObject({ exitCode: 0 });
    try {
      harness.requireSuccessfulResult({ exitCode: 1, signal: null, stdout: "opaque-failure", stderr: "opaque-stderr" }, "host_version_command_failed");
      throw new Error("expected fixed failure");
    } catch (error) {
      expect(error).toHaveProperty("message", "host_version_command_failed");
      expect(String(error)).not.toContain("opaque");
    }
  });

  it("validates the exact lifecycle, discovery, call arguments, and fixture result", () => {
    const valid = [
      { type: "server_started" },
      { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] },
      { type: "fixture_call", arguments: {} },
      { type: "fixture_result", text: harness.FIXTURE_TEXT },
      { type: "server_closed", code: 0, signal: null },
    ];
    expect(() => harness.validateLifecycle(valid)).not.toThrow();
    expect(() => harness.validateLifecycle(valid.slice(1))).toThrow("lifecycle_start_missing");
    expect(() => harness.validateLifecycle(valid.map((event) => event.type === "fixture_call" ? { ...event, arguments: { unexpected: true } } : event))).toThrow("fixture_arguments_invalid");
    expect(() => harness.validateLifecycle(valid.map((event: any) => event.type === "tools_list" ? { ...event, tools: event.tools.slice(1) } : event))).toThrow("tool_discovery_invalid");
    expect(harness.latestLifecycleSession([{ type: "server_started" }, ...valid])).toEqual(valid);
    expect(() => harness.latestLifecycleSession(valid.slice(0, -1))).toThrow("lifecycle_shutdown_invalid");
    const prior = [...valid];
    const currentInvalid = [{ type: "server_started" }, { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] }, { type: "server_closed", code: 0, signal: null }];
    expect(() => harness.latestLifecycleSession([...prior, ...currentInvalid])).toThrow("fixture_call_count_invalid");
  });

  it("rejects a mismatched host, artifact, incomplete attempt, or unbounded excerpt", () => {
    const artifact = { sha256: "a".repeat(64), distCliSha256: "b".repeat(64), package: "change-trace-mcp", version: "0.0.0-dev.1", fileCount: 1, packedSize: 1, unpackedSize: 1, npmShasum: "c".repeat(40), npmIntegrity: "sha512-test" };
    const attempt = { host: "claude", hostVersion: "2.1.217", observedHostVersion: "2.1.217", artifactSha256: artifact.sha256, distCliSha256: artifact.distCliSha256, exitCode: 0, durationMs: 1, lifecycle: [{ type: "server_started" }, { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] }, { type: "fixture_call", arguments: {} }, { type: "fixture_result", text: harness.FIXTURE_TEXT }, { type: "server_closed", code: 0, signal: null }], excerptSha256: "d".repeat(64), excerptBytes: 1 };
    expect(() => harness.validateAttempt(attempt, artifact)).not.toThrow();
    expect(() => harness.validateAttempt({ ...attempt, hostVersion: "2.1.216" }, artifact)).toThrow("host_version_invalid");
    expect(() => harness.validateAttempt({ ...attempt, artifactSha256: "e".repeat(64) }, artifact)).toThrow("artifact_binding_invalid");
    expect(() => harness.validateAttempt({ ...attempt, excerptBytes: 65 * 1024 }, artifact)).toThrow("attempt_excerpt_invalid");
  });

  it("normalizes Codex Host-held evidence without fabricating a graceful close", () => {
    const artifact = { sha256: "a".repeat(64), distCliSha256: "b".repeat(64) };
    const attempt = { host: "codex", hostVersion: "26.707.3748.0", artifactSha256: artifact.sha256, distCliSha256: artifact.distCliSha256, exitCode: null, durationMs: 10, mcpDurationMs: 2, shutdownDisposition: "host_held_explicit_cleanup", lifecycle: [{ type: "server_started" }, { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] }, { type: "fixture_call", arguments: {} }, { type: "fixture_result", text: harness.FIXTURE_TEXT }] };
    expect(() => harness.validateCodexHostHeldAttempt(attempt, artifact)).not.toThrow();
    expect(() => harness.validateCodexHostHeldAttempt({ ...attempt, exitCode: 0 }, artifact)).toThrow("codex_host_held_invalid");
    expect(() => harness.validateCodexHostHeldAttempt({ ...attempt, lifecycle: [...attempt.lifecycle, { type: "server_closed", code: 0, signal: null }] }, artifact)).toThrow("codex_host_held_invalid");
    expect(() => harness.validateCodexHostHeldAttempt({ ...attempt, artifactSha256: "c".repeat(64) }, artifact)).toThrow("artifact_binding_invalid");
    expect(harness.normalizeCodexHostHeldAttempt({ threadId: "019f9e52-8a07-78e2-a6c7-f0ff30d0187a", durationMs: 10, mcpDurationMs: 2, lifecycle: attempt.lifecycle, artifactSha256: artifact.sha256, distCliSha256: artifact.distCliSha256 }, artifact)).toMatchObject({ exitCode: null, shutdownDisposition: "host_held_explicit_cleanup" });
  });

  it("accounts for failed attempts without keeping their raw output", () => {
    const normalized = harness.normalizeAttemptFailure({ host: "opencode", hostVersion: "1.18.4", code: "command_timeout", durationMs: 10, rawOutput: "must not persist" });
    expect(normalized).toEqual({ host: "opencode", hostVersion: "1.18.4", status: "failed", code: "command_timeout", durationMs: 10 });
  });

  it("classifies only authentication, trust, and provider-selection blockers from Host output", () => {
    expect(harness.classifyHostFailure("Please log in in a browser")).toBe("authentication_required");
    expect(harness.classifyHostFailure("Trust this workspace first")).toBe("trust_confirmation_required");
    expect(harness.classifyHostFailure("Choose a provider")).toBe("provider_selection_required");
    expect(harness.classifyHostFailure("invalid option")).toBe("host_command_failed");
  });

  it("bounds a hung child and combined stdout/stderr", async () => {
    await expect(harness.runBounded(process.execPath, ["-e", "setInterval(() => {}, 1_000)"], { timeoutMs: 40 })).rejects.toThrow("command_timeout");
    await expect(harness.runBounded(process.execPath, ["-e", "process.stdout.write('a'.repeat(32)); process.stderr.write('b'.repeat(32))"], { maxOutputBytes: 32 })).rejects.toThrow("command_output_limit");
  });

  it("terminates a spawned descendant before resolving a bounded failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "change-trace-m7-descendant-"));
    const marker = join(root, "orphan-marker");
    const childProgram = `const fs = require('node:fs'); setInterval(() => fs.appendFileSync(${JSON.stringify(marker)}, 'x'), 20);`;
    const parentProgram = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(childProgram)}], { stdio: 'ignore' }); setInterval(() => {}, 1_000);`;
    await expect(harness.runBounded(process.execPath, ["-e", parentProgram], { timeoutMs: 40 })).rejects.toThrow("command_timeout");
    const initialSize = await stat(marker).then((value) => value.size).catch(() => 0);
    await new Promise((resolveWait) => setTimeout(resolveWait, 120));
    const finalSize = await stat(marker).then((value) => value.size).catch(() => 0);
    expect(finalSize).toBe(initialSize);
    await rm(root, { recursive: true, force: true });
  });

  it.skipIf(process.platform === "win32")("escalates a SIGTERM-ignoring process group", async () => {
    await expect(harness.runBounded(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1_000)"], { timeoutMs: 40 })).rejects.toThrow("command_timeout");
  });

  it("resolves only a real npm CLI and validates a matching finalization checkpoint", async () => {
    const npm = harness.resolveCliPath("npm", undefined, { npm_execpath: "C:/missing/npm-cli.js" });
    expect(npm.replaceAll("\\", "/")).toMatch(/npm-cli\.js$/u);
    expect(() => harness.resolveCliPath("npm", "C:/missing/npm-cli.js")).toThrow("npm_cli_unavailable");
    const stateRoot = await mkdtemp(join(tmpdir(), "change-trace-m7-real-test-"));
    const fakeRepository = await mkdtemp(join(tmpdir(), "change-trace-m7-fake-repo-"));
    const plan = harness.createHostPlan({ repositoryRoot: fakeRepository, stateRoot, serverName: "m7_real_finalize" });
    const artifact = { sha256: "a".repeat(64), distCliSha256: "b".repeat(64) };
    const graceful = (host: "claude" | "opencode", version: string) => ({ host, hostVersion: version, observedHostVersion: version, status: "passed", artifactSha256: artifact.sha256, distCliSha256: artifact.distCliSha256, exitCode: 0, durationMs: 1, excerptSha256: "c".repeat(64), excerptBytes: 1, lifecycle: [{ type: "server_started" }, { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] }, { type: "fixture_call", arguments: {} }, { type: "fixture_result", text: harness.FIXTURE_TEXT }, { type: "server_closed", code: 0, signal: null }] });
    const codexLifecycle = [{ type: "server_started" }, { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] }, { type: "fixture_call", arguments: {} }, { type: "fixture_result", text: harness.FIXTURE_TEXT }];
    await writeFile(plan.manifestPath, JSON.stringify({ serverName: plan.serverName, artifact, attempts: [graceful("claude", "2.1.217"), graceful("opencode", "1.18.4")] }), "utf8");
    await writeFile(plan.lifecyclePath, codexLifecycle.map((event) => JSON.stringify(event)).join("\n"), "utf8");
    const configPath = join(fakeRepository, ".codex", "config.toml");
    await mkdir(join(fakeRepository, ".codex"));
    await writeFile(configPath, harness.checkpointContent(plan), "utf8");
    await expect(harness.recordCodexHeld({ stateRoot, repositoryRoot: fakeRepository, threadId: "019f9e52-8a07-78e2-a6c7-f0ff30d0187a", durationMs: 10, mcpDurationMs: 2 })).resolves.toMatchObject({ action: "record-codex-held", shutdownDisposition: "host_held_explicit_cleanup" });
    await expect(harness.finalizeState({ stateRoot, repositoryRoot: fakeRepository, configPath })).resolves.toMatchObject({ ok: true, cleanup: true });
    await expect(access(stateRoot)).rejects.toThrow();
    await expect(harness.finalizeState({ stateRoot: process.cwd(), repositoryRoot: process.cwd(), configPath })).rejects.toThrow("state_root_invalid");
    await rm(fakeRepository, { recursive: true, force: true });
  });

  it("records only the latest valid Codex Host-held lifecycle segment", async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), "change-trace-m7-real-test-"));
    const plan = harness.createHostPlan({ repositoryRoot: process.cwd(), stateRoot, serverName: "m7_real_record" });
    const artifact = { sha256: "a".repeat(64), distCliSha256: "b".repeat(64) };
    const held = [{ type: "server_started" }, { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] }, { type: "fixture_call", arguments: {} }, { type: "fixture_result", text: harness.FIXTURE_TEXT }];
    await writeFile(plan.manifestPath, JSON.stringify({ serverName: plan.serverName, artifact, attempts: [] }), "utf8");
    await writeFile(plan.lifecyclePath, [...held, ...held].map((event) => JSON.stringify(event)).join("\n"), "utf8");
    await expect(harness.recordCodexHeld({ stateRoot, repositoryRoot: process.cwd(), threadId: "019f9e52-8a07-78e2-a6c7-f0ff30d0187a", durationMs: 10, mcpDurationMs: 2 })).resolves.toMatchObject({ action: "record-codex-held" });
    await harness.cleanupStateRoot(stateRoot);
  });

  it("rejects Codex recording when the latest segment is incomplete", async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), "change-trace-m7-real-test-"));
    const plan = harness.createHostPlan({ repositoryRoot: process.cwd(), stateRoot, serverName: "m7_real_incomplete" });
    const artifact = { sha256: "a".repeat(64), distCliSha256: "b".repeat(64) };
    const prior = [{ type: "server_started" }, { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] }, { type: "fixture_call", arguments: {} }, { type: "fixture_result", text: harness.FIXTURE_TEXT }];
    const current = [{ type: "server_started" }, { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] }];
    await writeFile(plan.manifestPath, JSON.stringify({ serverName: plan.serverName, artifact, attempts: [] }), "utf8");
    await writeFile(plan.lifecyclePath, [...prior, ...current].map((event) => JSON.stringify(event)).join("\n"), "utf8");
    await expect(harness.recordCodexHeld({ stateRoot, repositoryRoot: process.cwd(), threadId: "019f9e52-8a07-78e2-a6c7-f0ff30d0187a", durationMs: 10, mcpDurationMs: 2 })).rejects.toThrow("codex_host_held_invalid");
    await harness.cleanupStateRoot(stateRoot);
  });

  it("removes a temporary test state root", async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), "change-trace-m7-real-test-"));
    await harness.cleanupStateRoot(stateRoot);
    await expect(access(stateRoot)).rejects.toThrow();
  });
});
