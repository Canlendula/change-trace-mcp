import { access, mkdtemp, rm } from "node:fs/promises";
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

  it("builds strict, ephemeral Claude and OpenCode commands", () => {
    const plan = harness.createHostPlan({ repositoryRoot: "C:/work/repo", stateRoot: "C:/temp/m7", serverName: "m7_real_123" });
    const claude = harness.createHostCommand("claude", plan, "C:/tools/claude.exe");
    expect(claude.args).toEqual(expect.arrayContaining(["--mcp-config", plan.claudeConfigPath, "--strict-mcp-config", "--no-session-persistence", "--print"]));
    expect(claude.args).not.toContain("--continue");
    const opencode = harness.createHostCommand("opencode", plan, "C:/tools/opencode.exe");
    expect(opencode.args).toEqual(["run", "--format", "json", "--dir", plan.hostWorkingDirectory, expect.any(String)]);
    expect(opencode.environment.OPENCODE_CONFIG).toBe(plan.opencodeConfigPath);
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
  });

  it("rejects a mismatched host, artifact, incomplete attempt, or unbounded excerpt", () => {
    const artifact = { sha256: "a".repeat(64), distCliSha256: "b".repeat(64), package: "change-trace-mcp", version: "0.0.0-dev.1", fileCount: 1, packedSize: 1, unpackedSize: 1, npmShasum: "c".repeat(40), npmIntegrity: "sha512-test" };
    const attempt = { host: "claude", hostVersion: "2.1.217", artifactSha256: artifact.sha256, distCliSha256: artifact.distCliSha256, exitCode: 0, durationMs: 1, lifecycle: [{ type: "server_started" }, { type: "tools_list", tools: [...harness.EXPECTED_TOOL_NAMES] }, { type: "fixture_call", arguments: {} }, { type: "fixture_result", text: harness.FIXTURE_TEXT }, { type: "server_closed", code: 0, signal: null }], excerptSha256: "d".repeat(64), excerptBytes: 1 };
    expect(() => harness.validateAttempt(attempt, artifact)).not.toThrow();
    expect(() => harness.validateAttempt({ ...attempt, hostVersion: "2.1.216" }, artifact)).toThrow("host_version_invalid");
    expect(() => harness.validateAttempt({ ...attempt, artifactSha256: "e".repeat(64) }, artifact)).toThrow("artifact_binding_invalid");
    expect(() => harness.validateAttempt({ ...attempt, excerptBytes: 65 * 1024 }, artifact)).toThrow("attempt_excerpt_invalid");
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

  it("removes a temporary test state root", async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), "change-trace-m7-real-test-"));
    await harness.cleanupStateRoot(stateRoot);
    await expect(access(stateRoot)).rejects.toThrow();
  });
});
