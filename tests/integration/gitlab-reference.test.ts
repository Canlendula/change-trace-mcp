import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const require = createRequire(import.meta.url);
const npmCli = process.env.npm_execpath ?? require.resolve("npm/bin/npm-cli.js");
const reference = join(root, "docs", "ci", "gitlab-reference");
const runner = join(root, "scripts", "ci", "advisory-runner.mjs");
const fixtureHost = join(root, "docs", "ci", "fixtures", "deterministic-advisory-host.mjs");
const managedNames = ["release-review.md", "release-review.json", "release-review-status.json"];
const inheritedRuntimeKeys = ["PATH", "SYSTEMROOT", "COMSPEC", "PATHEXT", "WINDIR", "TEMP", "TMP", "TERM", "LANG", "LC_ALL"];

async function readLf(path: string): Promise<string> {
  return (await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
}

function minimalRuntimeEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of inheritedRuntimeKeys) {
    const sourceKey = Object.keys(process.env).find((candidate) => candidate.toUpperCase() === key);
    if (sourceKey === undefined) continue;
    const value = process.env[sourceKey];
    if (value !== undefined) environment[key === "PATH" ? "PATH" : sourceKey] = value;
  }
  return environment;
}

describe("GitLab hosted reference preparation", () => {
  it("keeps the baseline dependency-free and feature overlays intentionally stale until follow-up", async () => {
    const subject = await mkdtemp(join(tmpdir(), "change-trace-gitlab-reference-subject-"));
    try {
      await cp(join(reference, "baseline"), subject, { recursive: true });
      await execFileAsync(process.execPath, [npmCli, "ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: subject });
      const baseline = await execFileAsync(process.execPath, ["--test"], { cwd: subject });
      expect(baseline.stdout).toContain("pass 1");

      await cp(join(reference, "feature", "src", "service-status.mjs"), join(subject, "src", "service-status.mjs"));
      await cp(join(reference, "feature", "test", "service-status.test.mjs"), join(subject, "test", "service-status.test.mjs"));
      const feature = await execFileAsync(process.execPath, ["--test"], { cwd: subject });
      expect(feature.stdout).toContain("pass 2");
      const staleDocument = await readLf(join(subject, "docs", "product-behavior.md"));
      expect(staleDocument).not.toContain("maintenance");

      await cp(join(reference, "follow-up", "docs", "product-behavior.md"), join(subject, "docs", "product-behavior.md"));
      const synchronizedDocument = await readLf(join(subject, "docs", "product-behavior.md"));
      expect(synchronizedDocument).toContain("CTGR-001");
      expect(synchronizedDocument).toContain("operational");
      expect(synchronizedDocument).toContain("maintenance");
    } finally {
      await rm(subject, { recursive: true, force: true });
      expect(existsSync(subject)).toBe(false);
    }
  });

  it("keeps the Feishu template synthetic and free of credential or executable instructions", async () => {
    const template = await readLf(join(reference, "feishu-product-update-template.md"));
    expect(template).toContain("Change Trace GitLab Reference — Maintenance Status Update");
    expect(template).toContain("CTGR-001");
    expect(template).toContain("operational");
    expect(template).toContain("maintenance");
    expect(template).not.toMatch(/(?:API[_ -]?KEY|TOKEN|SECRET|PASSWORD|LARK_APP_ID|LARK_APP_SECRET|https?:\/\/)/i);
    expect(template).not.toMatch(/(?:^|\n)\s*(?:run|execute|ignore previous|system prompt|agent instruction)\b/i);
  });

  it("preserves the credential-free, bounded GitLab mechanics contract", async () => {
    const yaml = await readLf(join(reference, "gitlab-ci.yml.example"));
    expect(yaml).toContain("image: node:22-bookworm");
    expect(yaml).toContain("stages: [test, advisory]");
    expect(yaml).toContain("npm ci --ignore-scripts --no-audit --no-fund");
    expect(yaml).toContain("npm test");
    expect(yaml).toContain("$CI_PIPELINE_SOURCE == \"schedule\"");
    expect(yaml).toContain("when: never");
    expect(yaml).toContain("merge_request_event");
    expect(yaml).toContain("$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH");
    expect(yaml).toContain("$CI_PIPELINE_SOURCE == \"web\"");
    expect(yaml).toContain("https://github.com/Canlendula/change-trace-mcp.git");
    expect(yaml).toContain("aa52a1795a587cb32704018bdd60b1d33649309d");
    expect(yaml).toContain("test ! -L");
    expect(yaml).toContain("rev-parse HEAD");
    expect(yaml).toContain("CHANGE_TRACE_CI_COMMAND");
    expect(yaml).toContain("deterministic-advisory-host.mjs");
    expect(yaml).toContain("CHANGE_TRACE_CI_BASE_REVISION");
    expect(yaml).toContain("CHANGE_TRACE_CI_HEAD_REVISION");
    expect(yaml).toContain("CHANGE_TRACE_CI_RUN_ATTEMPT=\"$CI_JOB_ID\"");
    expect(yaml).toContain("CHANGE_TRACE_CI_TIMEOUT_MS=840000");
    expect(yaml).toContain("timeout: 15m");
    expect(yaml).toContain("retry: 0");
    expect(yaml).toContain("allow_failure: true");
    expect(yaml).toContain("when: always");
    expect(yaml).toContain("expire_in: 7 days");
    expect([...yaml.matchAll(/^\s+- artifacts\/advisory\/release-review(?:-status)?\.(?:md|json)$/gm)]).toHaveLength(3);
    expect(yaml).not.toMatch(/(?:CODEX_API_KEY|OPENAI_API_KEY|CHANGE_TRACE_HOST_CREDENTIAL|LARK_APP_ID|LARK_APP_SECRET|GITLAB_TOKEN)/i);
    expect(yaml).not.toMatch(/^\s*schedule:/m);
  });

  it("runs the accepted deterministic fixture locally with exactly three managed artifacts", async () => {
    const subject = await mkdtemp(join(tmpdir(), "change-trace-gitlab-reference-runner-"));
    try {
      const result = await execFileAsync(process.execPath, [runner], {
        cwd: root,
        env: {
          ...minimalRuntimeEnvironment(),
          CHANGE_TRACE_CI_COMMAND: JSON.stringify([process.execPath, fixtureHost]),
          CHANGE_TRACE_CI_REPOSITORY_ROOT: subject,
          CHANGE_TRACE_CI_OUTPUT_DIRECTORY: "artifacts/advisory",
          CHANGE_TRACE_CI_BASE_REVISION: "a".repeat(40),
          CHANGE_TRACE_CI_HEAD_REVISION: "b".repeat(40),
          CHANGE_TRACE_CI_RUN_ATTEMPT: "1",
          CHANGE_TRACE_CI_TIMEOUT_MS: "2000",
        },
      });
      expect(result.stdout).toContain("completed_no_findings");
      const output = join(subject, "artifacts", "advisory");
      const entries = await Promise.all(managedNames.map(async (name) => ({ name, exists: existsSync(join(output, name)) })));
      expect(entries.filter((entry) => entry.exists).map((entry) => entry.name)).toEqual(managedNames);
      const status = JSON.parse(await readFile(join(output, "release-review-status.json"), "utf8"));
      expect(status.outcome).toBe("completed_no_findings");
    } finally {
      await rm(subject, { recursive: true, force: true });
      expect(existsSync(subject)).toBe(false);
    }
  });
});
