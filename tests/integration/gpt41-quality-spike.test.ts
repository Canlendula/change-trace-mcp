import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const harness = join(root, "scripts/ci/gpt41-quality-spike.mjs");
const transport = join(root, "tests/fixtures/ci/gpt41-quality-transport.mjs");
const fixtures = join(root, "tests/fixtures/review");
const workflow = join(root, ".github/workflows/m4-gpt41-quality-spike.yml");
const advisoryWorkflow = join(root, ".github/workflows/m4-advisory-review.yml");

async function run(mode: string) {
  const directory = await mkdtemp(join(root, ".change-trace-gpt41-quality-"));
  const output = join(directory, "output");
  const observation = join(directory, "observation.json");
  try {
    let stdout = "";
    let stderr = "";
    try {
      const result = await execFile(process.execPath, [harness], {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_TOKEN: "test-token-sentinel",
        CHANGE_TRACE_GPT41_TEST_TRANSPORT: transport,
        CHANGE_TRACE_GPT41_TEST_FIXTURES: fixtures,
        CHANGE_TRACE_GPT41_TEST_MODE: mode,
        CHANGE_TRACE_GPT41_TEST_OBSERVATION: observation,
        CHANGE_TRACE_GPT41_FIXTURES: fixtures,
        CHANGE_TRACE_GPT41_OUTPUT_DIRECTORY: output,
      },
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string };
      stdout = failure.stdout ?? "";
      stderr = failure.stderr ?? "";
    }
    return {
      score: JSON.parse(await readFile(join(output, "score.json"), "utf8")),
      calls: JSON.parse(await readFile(observation, "utf8")),
      stdout,
      stderr,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("GPT-4.1 quality spike", () => {
  it("uses a fixed one-shot request in mandatory-first order and passes the reference answers", async () => {
    const result = await run("success");
    expect(result.calls.map((call: { fixtureId: string }) => call.fixtureId)).toEqual([
      "implemented-correctly", "intentional-doc-free-refactor", "malicious-instruction", "insufficient-evidence", "missing-permissions",
      "contradictory-documents", "requirement-missing", "stale-documentation", "undocumented-behavior",
    ]);
    expect(result.calls).toHaveLength(9);
    expect(result.calls.every((call: { model: string; stream: boolean; maxTokens: number; responseFormatType: string; hasTools: boolean; hasTokenInBody: boolean }) => call.model === "openai/gpt-4.1" && call.stream === false && call.maxTokens > 0 && call.responseFormatType === "json_schema" && !call.hasTools && !call.hasTokenInBody)).toBe(true);
    expect(result.score).toMatchObject({ model: "openai/gpt-4.1", requestCount: 9, gatePassed: true, stopReason: "completed" });
    expect(result.score.fixtures).toHaveLength(9);
    expect(result.stdout).not.toContain("test-token-sentinel");
    expect(result.stderr).toBe("");
  }, 30_000);

  it("stops after a mandatory failure without a retry", async () => {
    const result = await run("mandatory_failure");
    expect(result.calls.map((call: { fixtureId: string }) => call.fixtureId)).toEqual(["implemented-correctly", "intentional-doc-free-refactor"]);
    expect(result.score).toMatchObject({ requestCount: 2, gatePassed: false, stopReason: "mandatory_fixture_failed" });
  });

  it("stops on a rejected finding and keeps raw response content out of metadata", async () => {
    const result = await run("rejected");
    const serialized = JSON.stringify(result.score);
    expect(result.calls).toHaveLength(6);
    expect(result.score).toMatchObject({ stopReason: "rejected_finding", gatePassed: false });
    expect(serialized).not.toContain("raw-response-sentinel");
    expect(serialized).not.toContain("test-token-sentinel");
  }, 30_000);

  it.each(["malformed", "api_failure"])("records %s as one failed attempted fixture without leaking API content", async (mode) => {
    const result = await run(mode);
    expect(result.calls).toHaveLength(1);
    expect(result.score).toMatchObject({ requestCount: 1, stopReason: "request_or_response_failure", gatePassed: false });
    const serialized = `${JSON.stringify(result.score)}${result.stdout}${result.stderr}`;
    expect(serialized).not.toContain("raw-response-sentinel");
    expect(serialized).not.toContain("api-body-sentinel");
    expect(serialized).not.toContain("test-token-sentinel");
  });

  it("keeps model quota behind a manual workflow and pauses automatic OpenCode advisory execution", async () => {
    const [spike, advisory, source] = await Promise.all([
      readFile(workflow, "utf8"),
      readFile(advisoryWorkflow, "utf8"),
      readFile(harness, "utf8"),
    ]);
    expect(spike).toContain("workflow_dispatch:");
    expect(spike).not.toMatch(/^\s*(?:push|pull_request|schedule|workflow_call):/mu);
    expect(spike).toContain("contents: read");
    expect(spike).toContain("models: read");
    expect(spike).toContain("artifacts/gpt41-quality-spike/score.json");
    expect(advisory).toMatch(/^on:\r?\n  workflow_dispatch:\s*$/mu);
    expect(advisory).not.toMatch(/^\s{2}(?:push|pull_request|pull_request_target|schedule|workflow_call):/mu);
    expect(advisory).not.toContain("models: read");
    expect(advisory).not.toMatch(/opencode|inference|run_opencode_advisory/iu);
    expect(source).toContain("const MAX_TOKENS = 4_000");
    expect(source).toContain("const EVALUATOR_TIMEOUT_MS");
    expect(source).not.toContain("debug ");
  });
});
