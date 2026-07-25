import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const workflowPath = join(root, ".github", "workflows", "m4-advisory-review.yml");
const examplePath = join(root, "docs", "ci", "github-actions.example.yml");
const docsPath = join(root, "docs", "ci", "README.md");
const smokePath = join(root, "scripts", "ci", "smoke-advisory-ci.mjs");
const managedNames = [
  "release-review.md",
  "release-review.json",
  "release-review-status.json",
];

async function readLf(path: string): Promise<string> {
  return (await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
}

function uploadPaths(document: string, stepName: string): string[] {
  const escapedName = stepName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const step = document.match(new RegExp(`- name: ${escapedName}[\\s\\S]*?(?=\\n\\s+- name:|$)`))?.[0];
  expect(step).toBeDefined();
  const pathBlock = step?.match(/\n\s+path: \|\n((?:\s+-?[^\n]*\n?)*)/)?.[1] ?? "";
  return [...pathBlock.matchAll(/^\s+([^\s#][^\n]*)$/gm)].map((match) => match[1]?.trim() ?? "");
}

describe("provider-neutral CI references", () => {
  it("keeps the live M4 workflow manual, deterministic, credential-free, and advisory", async () => {
    const workflow = await readLf(workflowPath);

    expect(workflow).toMatch(/^on:\r?\n  workflow_dispatch:\s*$/m);
    expect(workflow).not.toMatch(/^\s{2}(?:push|pull_request|pull_request_target|schedule|workflow_call):/m);
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).not.toMatch(/^\s+models:/m);
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toMatch(/opencode|inference|run_opencode_advisory/i);

    expect(workflow).toMatch(/quality:[\s\S]*?npm run check[\s\S]*?npm test/);
    expect(workflow).toMatch(/advisory-smoke:\s+needs: quality\s+if: \$\{\{ always\(\) \}\}\s+continue-on-error: true/);
    expect(workflow).toContain("timeout-minutes: 15");
    expect(workflow).toContain("node scripts/ci/smoke-advisory-ci.mjs");
    expect(workflow).toContain("CHANGE_TRACE_CI_BASE_REVISION: ${{ github.sha }}");
    expect(workflow).toContain("CHANGE_TRACE_CI_HEAD_REVISION: ${{ github.sha }}");
    expect(workflow).toContain("CHANGE_TRACE_CI_RUN_ATTEMPT: ${{ github.run_attempt }}");
    expect(workflow).toContain("github.run_id");
    expect(workflow).toContain("github.run_attempt");
    expect(workflow).toContain("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1");
    expect(workflow).not.toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02");
    expect(uploadPaths(workflow, "Upload deterministic advisory artifacts")).toEqual(
      managedNames.map((name) => `artifacts/advisory-ci-smoke/${name}`),
    );
    expect(workflow).toContain("summarize-advisory-status.mjs");
    expect(workflow).not.toMatch(/\bcat\b.*release-review|Get-Content.*release-review/i);
  });

  it("propagates safe revisions and run attempt through the deterministic smoke", async () => {
    const baseRevision = "a".repeat(40);
    const headRevision = "b".repeat(40);
    const runAttempt = "23";
    const result = await execFileAsync(process.execPath, [smokePath], {
      cwd: root,
      env: {
        ...process.env,
        CHANGE_TRACE_CI_BASE_REVISION: baseRevision,
        CHANGE_TRACE_CI_HEAD_REVISION: headRevision,
        CHANGE_TRACE_CI_RUN_ATTEMPT: runAttempt,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("change-trace-advisory smoke=ok");
    expect(result.stdout).not.toContain("release-review.md");
    const status = JSON.parse(
      await readFile(join(root, "artifacts", "advisory-ci-smoke", "release-review-status.json"), "utf8"),
    );
    expect(status.outcome).toBe("completed_no_findings");
    expect(status.run.baseRevision).toBe(baseRevision);
    expect(status.run.headRevision).toBe(headRevision);
    expect(status.run.runAttempt).toBe(23);
    expect(Object.values(status.artifacts).map((artifact: unknown) => (artifact as { name: string }).name)).toEqual(
      managedNames,
    );
  });

  it("provides a bounded provider-neutral GitHub template with explicit JSON argv", async () => {
    const example = await readLf(examplePath);
    const docs = await readLf(docsPath);

    expect(example).toContain("CHANGE_TRACE_CI_COMMAND: ${{ vars.CHANGE_TRACE_HOST_COMMAND }}");
    expect(example).toContain("CHANGE_TRACE_HOST_CREDENTIAL: ${{ secrets.CHANGE_TRACE_HOST_CREDENTIAL }}");
    expect(example).toContain("environment: change-trace-advisory");
    expect(example).toContain("continue-on-error: true");
    expect(example).toContain("timeout-minutes: 15");
    expect(example).toContain("CHANGE_TRACE_CI_TIMEOUT_MS: '840000'");
    expect(example).toContain("node scripts/ci/advisory-runner.mjs");
    expect(example).toContain("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1");
    expect(example).not.toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02");
    expect(example).not.toMatch(/opencode|codex|claude|openai|anthropic|github models/i);
    expect(uploadPaths(example, "Upload advisory artifacts")).toEqual(
      managedNames.map((name) => `subject/artifacts/advisory/${name}`),
    );
    expect(example).not.toMatch(/\bcat\b.*release-review|Get-Content.*release-review/i);

    expect(docs).toContain("JSON argv");
    expect(docs).toContain("environment masking");
    expect(docs).toContain("does not remove");
    expect(docs).toContain("MCP child");
    expect(docs).toContain("orchestration, artifact, and rerun behavior only");
    expect(docs).toContain("does not establish semantic Host/model compatibility");
    expect(docs).toContain("GitLab");
  });
});
