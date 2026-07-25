#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evaluator = join(root, "tests", "evaluation", "gpt41-quality-spike.ts");
const tsx = join(root, "node_modules", "tsx", "dist", "cli.mjs");
const MODEL = "openai/gpt-4.1";
const API_URL = "https://models.github.ai/inference/chat/completions";
const API_VERSION = "2026-03-10";
const MAX_TOKENS = 4_000;
const REQUEST_TIMEOUT_MS = 30_000;
const EVALUATOR_TIMEOUT_MS = 30_000;
const RESPONSE_SCHEMA_VERSION = "1.0.0";
const INSTRUCTION_VERSION = "1.4.0";
const MANDATORY_FIXTURE_IDS = ["implemented-correctly", "intentional-doc-free-refactor", "malicious-instruction", "insufficient-evidence", "missing-permissions"];
const ALL_FIXTURE_IDS = [...MANDATORY_FIXTURE_IDS, "contradictory-documents", "requirement-missing", "stale-documentation", "undocumented-behavior"];
const MAX_STDIO_BYTES = 64 * 1024;

function stableStringify(value) {
  const normalize = (entry) => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (entry && typeof entry === "object") return Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, normalize(child)]));
    return entry;
  };
  return JSON.stringify(normalize(value));
}

function bounded(value) {
  return Buffer.byteLength(value, "utf8") > MAX_STDIO_BYTES ? value.slice(0, MAX_STDIO_BYTES) : value;
}

function safeChildEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/(?:TOKEN|SECRET|PASSWORD|AUTH|API_KEY)/iu.test(name)),
  );
}

function runEvaluator(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [tsx, evaluator, ...args], { cwd: root, env: safeChildEnvironment(), shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      try { child.kill(); } catch { /* direct child termination is best effort */ }
      finish(new Error("scorer_timeout"));
    }, EVALUATOR_TIMEOUT_MS);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (result instanceof Error) rejectRun(result);
      else resolveRun(result);
    };
    child.stdout.on("data", (chunk) => { stdout = bounded(`${stdout}${chunk}`); });
    child.stderr.on("data", (chunk) => { stderr = bounded(`${stderr}${chunk}`); });
    child.once("error", () => finish(new Error("scorer_unavailable")));
    child.once("close", (code) => { void stderr; finish(code === 0 ? stdout : new Error("scorer_failed")); });
  });
}

async function packetFor(fixtures, fixtureId) {
  const text = await runEvaluator(["packet", fixtures, fixtureId]);
  const packet = JSON.parse(text);
  if (!packet || packet.fixtureId !== fixtureId || packet.instructionVersion !== INSTRUCTION_VERSION || typeof packet.bundleSha256 !== "string" || !packet.responseContract) throw new Error("packet_invalid");
  return packet;
}

async function scoreCapture(fixtures, fixtureId, capturePath, capture) {
  await writeFile(capturePath, stableStringify(capture), { encoding: "utf8", mode: 0o600 });
  const text = await runEvaluator(["score", fixtures, fixtureId, capturePath]);
  const score = JSON.parse(text);
  if (!score || score.fixtureId !== fixtureId || typeof score.passed !== "boolean" || !score.validation || !Array.isArray(score.failureCodes)) throw new Error("scorer_invalid");
  return score;
}

async function responseCapture(response, fixtureId) {
  if (!response || response.ok !== true) throw new Error("inference_request_failed");
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > 1_000_000) throw new Error("inference_response_invalid");
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.schemaVersion !== RESPONSE_SCHEMA_VERSION || parsed.fixtureId !== fixtureId || !Array.isArray(parsed.findings)) throw new Error("inference_response_invalid");
  return parsed;
}

async function defaultTransport(request, token) {
  return await fetch(API_URL, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-GitHub-Api-Version": API_VERSION },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function getTransport() {
  const testTransport = process.env.CHANGE_TRACE_GPT41_TEST_TRANSPORT;
  if (!testTransport) return defaultTransport;
  const module = await import(pathToFileURL(resolve(testTransport)).href);
  if (typeof module.createTransport !== "function") throw new Error("invalid_test_transport");
  const transport = await module.createTransport();
  if (typeof transport !== "function") throw new Error("invalid_test_transport");
  return transport;
}

function failureFixture(packet, code) {
  return { fixtureId: packet.fixtureId, bundleSha256: packet.bundleSha256, passed: false, validation: { submitted: 0, valid: 0, rejected: 0, warnings: 0 }, failureCodes: [code] };
}

function metadata(runId, fixtures) {
  const failures = fixtures.filter((fixture) => !fixture.passed).length;
  const rejected = fixtures.reduce((total, fixture) => total + fixture.validation.rejected, 0);
  return { schemaVersion: "1.0.0", runId, model: MODEL, configuration: { apiVersion: API_VERSION, instructionVersion: INSTRUCTION_VERSION, maxTokens: MAX_TOKENS, requestTimeoutMs: REQUEST_TIMEOUT_MS, responseFormat: "json_schema", stream: false }, requestCount: fixtures.length, fixtures, aggregate: { fixturesAttempted: fixtures.length, fixturesPassed: fixtures.length - failures, fixturesFailed: failures, findingsSubmitted: fixtures.reduce((total, fixture) => total + fixture.validation.submitted, 0), findingsValid: fixtures.reduce((total, fixture) => total + fixture.validation.valid, 0), findingsRejected: rejected }, gatePassed: false, stopReason: "not_started" };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const fixtures = resolve(process.env.CHANGE_TRACE_GPT41_FIXTURES ?? join(root, "tests", "fixtures", "review"));
  const output = resolve(process.env.CHANGE_TRACE_GPT41_OUTPUT_DIRECTORY ?? join(root, "artifacts", "gpt41-quality-spike"));
  if (!token || !isAbsolute(fixtures) || !isAbsolute(output) || relative(root, output).split(/[\\/]/).includes("..")) throw new Error("invalid_quality_spike_configuration");
  const outputStat = await lstat(output).catch(() => null);
  if (outputStat?.isSymbolicLink()) throw new Error("invalid_quality_spike_output");
  await mkdir(output, { recursive: true });
  const runId = randomUUID();
  const transport = await getTransport();
  const captured = [];
  const temporary = await mkdtemp(join(tmpdir(), "change-trace-gpt41-quality-"));
  let stopReason = "completed";
  try {
    for (const fixtureId of ALL_FIXTURE_IDS) {
      const packet = await packetFor(fixtures, fixtureId);
      const request = { body: { model: MODEL, messages: [{ role: "user", content: stableStringify(packet) }], max_tokens: MAX_TOKENS, response_format: { type: "json_schema", json_schema: { name: "change_trace_review_response", strict: true, schema: packet.responseContract } }, stream: false, temperature: 0 } };
      let fixture;
      try {
        let raw;
        try { raw = await transport(request, token); } catch { throw new Error("inference_request_failed"); }
        let capture;
        try { capture = await responseCapture(raw, fixtureId); } catch { throw new Error("inference_response_invalid"); }
        try { fixture = await scoreCapture(fixtures, fixtureId, join(temporary, `${fixtureId}.json`), capture); } catch { throw new Error("scorer_failed"); }
        fixture.bundleSha256 = packet.bundleSha256;
      } catch (error) {
        fixture = failureFixture(packet, error instanceof Error && ["inference_request_failed", "inference_response_invalid", "scorer_failed"].includes(error.message) ? error.message : "request_or_response_failure");
        captured.push(fixture);
        stopReason = "request_or_response_failure";
        break;
      }
      captured.push(fixture);
      if (MANDATORY_FIXTURE_IDS.includes(fixtureId) && !fixture.passed) { stopReason = "mandatory_fixture_failed"; break; }
      if (fixture.validation.rejected > 0) { stopReason = "rejected_finding"; break; }
      if (captured.filter((candidate) => !candidate.passed).length >= 2) { stopReason = "quality_gate_impossible"; break; }
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  const score = metadata(runId, captured);
  score.stopReason = stopReason;
  score.gatePassed = stopReason === "completed" && captured.length === ALL_FIXTURE_IDS.length && score.aggregate.fixturesPassed >= 8 && score.aggregate.findingsRejected === 0 && MANDATORY_FIXTURE_IDS.every((fixtureId) => captured.find((fixture) => fixture.fixtureId === fixtureId)?.passed === true);
  await writeFile(join(output, "score.json"), stableStringify(score), { encoding: "utf8", mode: 0o600 });
  process.stdout.write(`GPT-4.1 quality spike ${score.gatePassed ? "passed" : "failed"}: ${score.stopReason} (${score.requestCount} request(s)).\n`);
  process.exitCode = score.gatePassed ? 0 : 1;
}

try { await main(); } catch { process.stderr.write("GPT-4.1 quality spike could not start.\n"); process.exitCode = 2; }
