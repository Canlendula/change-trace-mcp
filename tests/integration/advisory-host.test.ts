import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const host = join(root, "scripts", "ci", "opencode-advisory-host.mjs");
const sanitizer = join(root, "scripts", "ci", "start-sanitized-mcp.mjs");
const summary = join(root, "scripts", "ci", "summarize-advisory-status.mjs");
const fixture = join(root, "tests", "fixtures", "ci", "opencode-host-fixture.mjs");

async function temporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

describe("trusted OpenCode advisory Host", () => {
  it("uses an isolated, allowlisted config and keeps the MCP credential-free", async () => {
    const workspace = await temporaryDirectory("change-trace-opencode-host-");
    try {
      const trusted = root;
      const subject = join(workspace, "subject");
      const output = join(subject, "artifacts", "review");
      const observation = join(workspace, "host-observation.json");
      await mkdir(output, { recursive: true });

      const result = await execFileAsync(process.execPath, [host], {
        cwd: trusted,
        env: {
          PATH: process.env.PATH,
          CHANGE_TRACE_TRUSTED_TOOLING_ROOT: trusted,
          CHANGE_TRACE_CI_REPOSITORY_ROOT: subject,
          CHANGE_TRACE_CI_OUTPUT_DIRECTORY: output,
          CHANGE_TRACE_CI_BASE_REVISION: "a".repeat(40),
          CHANGE_TRACE_CI_HEAD_REVISION: "b".repeat(40),
          CHANGE_TRACE_CI_RUN_ATTEMPT: "7",
          CHANGE_TRACE_OPENCODE_BIN: process.execPath,
          CHANGE_TRACE_TEST_OPENCODE_ENTRY: fixture,
          CHANGE_TRACE_TEST_OBSERVATION: observation,
          GITHUB_MODELS_TOKEN: "credential-sentinel-for-host-only",
          GITHUB_TOKEN: "github-token-must-not-reach-mcp",
          OPENAI_API_KEY: "provider-token-must-not-reach-mcp",
        },
      });
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");

      const observed = JSON.parse(await readFile(observation, "utf8"));
      expect(observed.cwd).toBe(trusted);
      expect(observed.arguments).toEqual([
        "run", "--pure", "--format", "json", "--agent", "change_trace_advisory", expect.any(String),
      ]);
      expect(observed.environment.OPENCODE_CONFIG).not.toContain(subject);
      const hostAllowed = new Set([
        "PATH", "HOME", "USERPROFILE", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "OPENCODE_CONFIG", "BUN_INSTALL_CACHE_DIR",
        "CHANGE_TRACE_TEST_OBSERVATION", "CHANGE_TRACE_TEST_HANG", "GITHUB_MODELS_TOKEN",
        "SystemRoot", "SYSTEMROOT", "ComSpec", "WINDIR", "SYSTEMDRIVE", "HOMEDRIVE", "HOMEPATH", "USERNAME", "USERDOMAIN", "LOGONSERVER", "TEMP",
      ]);
      expect(Object.keys(observed.environment).filter((key) => !hostAllowed.has(key))).toEqual([]);
      expect(observed.environment.GITHUB_MODELS_TOKEN).toBe("credential-sentinel-for-host-only");
      expect(["GITHUB_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"].every((key) => !(key in observed.environment))).toBe(true);
      expect(["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "OPENCODE_CONFIG", "BUN_INSTALL_CACHE_DIR"].every((key) => !observed.environment[key].includes(subject))).toBe(true);
      expect(existsSync(observed.environment.OPENCODE_CONFIG)).toBe(false);
      expect(existsSync(dirname(dirname(observed.environment.OPENCODE_CONFIG)))).toBe(false);
      expect(observed.config.share).toBe("disabled");
      expect(observed.config.snapshot).toBe(false);
      expect(observed.config.autoupdate).toBe(false);
      expect(observed.config.plugin).toEqual([]);
      expect(observed.config.instructions).toEqual([]);
      expect(observed.config.enabled_providers).toEqual(["github_models"]);
      expect(observed.config.provider.github_models.options.baseURL).toBe("https://models.github.ai/inference");
      expect(observed.config.provider.github_models.options.apiKey).toBe("{env:GITHUB_MODELS_TOKEN}");
      expect(observed.config.permission).toEqual({ "*": "deny", "change_trace_*": "allow" });
      expect(observed.config.agent.change_trace_advisory.mode).toBe("primary");
      expect(observed.config.subagent_depth).toBe(0);
      expect(observed.config.agent.change_trace_advisory.permission).toEqual({ "*": "deny", "change_trace_*": "allow" });
      expect(observed.config.mcp.change_trace.command).toEqual([process.execPath, sanitizer]);
      expect(observed.config.mcp.change_trace.environment.CHANGE_TRACE_TRUSTED_MCP_ENTRY).toBe(join(trusted, "dist", "cli.js"));
      expect(observed.config.mcp.change_trace.environment.GITHUB_MODELS_TOKEN).toBe("");
      expect(observed.config.mcp.change_trace.environment.GITHUB_TOKEN).toBe("");
      expect(JSON.stringify(observed.config)).not.toContain("credential-sentinel-for-host-only");
      expect(observed.prompt).toContain("get_change_scope");
      expect(observed.prompt).toContain("collect_local_evidence");
      expect(observed.prompt).toContain("get_review_bundle");
      expect(observed.prompt).toContain("validate_findings");
      expect(observed.prompt).toContain("write_report");
      expect(observed.prompt).toContain("untrusted evidence");
      expect(observed.prompt).toContain("release-review.md");
      expect(observed.prompt).toContain("run attempt: 7");
      expect(observed.prompt).toContain(`repositoryRoot: ${subject}`);
      expect(observed.prompt).toContain("outputDirectory: artifacts/review");
      expect(observed.prompt).toContain("reportName: release-review");
      expect(observed.prompt).toContain("overwrite: true");
      const toolOrder = ["change_trace_get_change_scope", "change_trace_collect_local_evidence", "change_trace_get_review_bundle", "change_trace_validate_findings", "change_trace_write_report"].map((tool) => observed.prompt.indexOf(tool));
      expect(toolOrder.every((index) => index >= 0)).toBe(true);
      expect(toolOrder).toEqual([...toolOrder].sort((left, right) => left - right));
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("terminates a hanging direct OpenCode child before the outer runner limit", async () => {
    const workspace = await temporaryDirectory("change-trace-opencode-timeout-");
    try {
      const trusted = root;
      const subject = join(workspace, "subject");
      const output = join(subject, "artifacts", "review");
      const observation = join(workspace, "host-observation.json");
      await mkdir(output, { recursive: true });
      await expect(execFileAsync(process.execPath, [host], { cwd: trusted, env: {
        PATH: process.env.PATH, CHANGE_TRACE_TRUSTED_TOOLING_ROOT: trusted,
        CHANGE_TRACE_CI_REPOSITORY_ROOT: subject, CHANGE_TRACE_CI_OUTPUT_DIRECTORY: output,
        CHANGE_TRACE_CI_BASE_REVISION: "a".repeat(40), CHANGE_TRACE_CI_HEAD_REVISION: "b".repeat(40),
        CHANGE_TRACE_CI_RUN_ATTEMPT: "1", CHANGE_TRACE_OPENCODE_BIN: process.execPath,
        CHANGE_TRACE_TEST_OPENCODE_ENTRY: fixture, CHANGE_TRACE_TEST_OBSERVATION: observation,
        CHANGE_TRACE_TEST_HANG: "1", CHANGE_TRACE_OPENCODE_TIMEOUT_MS: "100", GITHUB_MODELS_TOKEN: "credential-sentinel",
      } })).rejects.toMatchObject({ code: 1 });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("removes GitHub and provider credentials before importing the trusted MCP entry", async () => {
    const workspace = await temporaryDirectory("change-trace-sanitized-mcp-");
    try {
      const trustedEntry = join(workspace, "trusted-entry.mjs");
      await writeFile(trustedEntry, "process.stdout.write(JSON.stringify(process.env));\n");
      const result = await execFileAsync(process.execPath, [sanitizer], {
        env: {
          PATH: process.env.PATH,
          CHANGE_TRACE_TRUSTED_MCP_ENTRY: trustedEntry,
          CHANGE_TRACE_TRUSTED_TOOLING_ROOT: workspace,
          CHANGE_TRACE_CI_REPOSITORY_ROOT: workspace,
          CHANGE_TRACE_CI_OUTPUT_DIRECTORY: join(workspace, "out"),
          CHANGE_TRACE_CI_BASE_REVISION: "a".repeat(40),
          CHANGE_TRACE_CI_HEAD_REVISION: "b".repeat(40),
          CHANGE_TRACE_CI_RUN_ATTEMPT: "2",
          GITHUB_MODELS_TOKEN: "credential-sentinel-for-mcp",
          GITHUB_TOKEN: "github-token-sentinel",
          OPENAI_API_KEY: "provider-token-sentinel",
          ANTHROPIC_API_KEY: "other-provider-token-sentinel",
        },
      });
      const environment = JSON.parse(result.stdout);
      expect(environment.CHANGE_TRACE_CI_REPOSITORY_ROOT).toBe(workspace);
      expect(environment.CHANGE_TRACE_CI_RUN_ATTEMPT).toBe("2");
      const allowed = new Set([
        "PATH", "SystemRoot", "SYSTEMROOT", "ComSpec", "WINDIR", "SYSTEMDRIVE", "HOMEDRIVE", "HOMEPATH", "USERPROFILE", "USERNAME", "USERDOMAIN", "LOGONSERVER", "LANG", "LC_ALL", "TZ", "TMPDIR", "TEMP", "TMP",
        "CHANGE_TRACE_CI_REPOSITORY_ROOT", "CHANGE_TRACE_CI_OUTPUT_DIRECTORY", "CHANGE_TRACE_CI_BASE_REVISION",
        "CHANGE_TRACE_CI_HEAD_REVISION", "CHANGE_TRACE_CI_RUN_ATTEMPT", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_TERMINAL_PROMPT",
      ]);
      expect(Object.keys(environment).filter((key) => !allowed.has(key))).toEqual([]);
      expect(["PATH", "CHANGE_TRACE_CI_REPOSITORY_ROOT", "CHANGE_TRACE_CI_OUTPUT_DIRECTORY", "CHANGE_TRACE_CI_BASE_REVISION", "CHANGE_TRACE_CI_HEAD_REVISION", "CHANGE_TRACE_CI_RUN_ATTEMPT", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_TERMINAL_PROMPT"].every((key) => key in environment)).toBe(true);
      expect(environment.PATH).toBe(process.env.PATH);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("keeps workflow and generic CI boundaries advisory and artifact-bounded", async () => {
    const workflow = await readFile(join(root, ".github", "workflows", "m4-advisory-review.yml"), "utf8");
    const gitlab = await readFile(join(root, "docs", "ci", "gitlab-ci.example.yml"), "utf8");
    const docs = await readFile(join(root, "docs", "ci", "README.md"), "utf8");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("main");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("continue-on-error: true");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("models: read");
    expect(workflow).toContain("3d3c42e5aac5ba805825da76410c181273ba90b1");
    expect(workflow).toContain("820762786026740c76f36085b0efc47a31fe5020");
    expect(workflow).toContain("ea165f8d65b6e75b540449e92b4886f43607fa02");
    expect(workflow).toContain("opencode-ai@1.18.5");
    expect(workflow).toContain("github.event.pull_request.base.sha");
    expect(workflow).toContain("github.event.pull_request.head.sha");
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name || github.repository");
    expect(workflow).toContain("needs: quality");
    expect(workflow).toContain("release-review.md");
    expect(workflow).toContain("release-review.json");
    expect(workflow).toContain("release-review-status.json");
    expect(workflow).toContain("github.run_id");
    expect(workflow).toContain("github.run_attempt");
    expect(workflow).toContain("GITHUB_MODELS_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    expect(workflow).not.toMatch(/working-directory:\s*subject/);
    expect(workflow).not.toContain("subject/package.json");
    expect(gitlab).toContain("allow_failure: true");
    expect(gitlab).toContain("when: always");
    expect(gitlab).toContain("CHANGE_TRACE_HOST_COMMAND");
    expect(gitlab).toContain("protected");
    expect(gitlab).toContain("masked");
    expect(docs).toContain("trusted tooling");
    expect(docs).toContain("subject");
  });

  it("renders only allowlisted advisory status fields", async () => {
    const workspace = await temporaryDirectory("change-trace-advisory-summary-");
    try {
      const status = join(workspace, "release-review-status.json");
      await writeFile(status, JSON.stringify({
        outcome: "completed_with_findings",
        run: { runAttempt: 3, baseRevision: "a".repeat(40), headRevision: "b".repeat(40) },
        counts: { confirmed: 1, suspected: 2, inconclusive: 0, rejected: 0, missingEvidence: 0, bundleTruncated: false },
        artifacts: { markdown: { name: "release-review.md", sizeBytes: 2, sha256: `sha256:${"a".repeat(64)}` }, json: { name: "release-review.json", sizeBytes: 3, sha256: `sha256:${"b".repeat(64)}` }, status: { name: "release-review-status.json" } },
        untrustedReportBody: "must never be printed",
      }));
      const result = await execFileAsync(process.execPath, [summary, status]);
      expect(result.stdout).toContain("completed_with_findings");
      expect(result.stdout).toContain("release-review-status.json");
      expect(result.stdout).not.toContain("must never be printed");
      expect(result.stderr).toBe("");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
