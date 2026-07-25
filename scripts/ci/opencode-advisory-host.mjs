#!/usr/bin/env node

import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sanitizer = join(scriptRoot, "scripts", "ci", "start-sanitized-mcp.mjs");
const promptPath = join(scriptRoot, "scripts", "ci", "opencode-advisory-prompt.md");
const safeRevision = /^(?:|HEAD|[a-f0-9]{7,64}|refs\/(?:heads|tags|remotes)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,127})$/;
const HOST_TIMEOUT_MS = 12 * 60 * 1000;
const TERMINATION_GRACE_MS = 250;

function isStrictDescendant(parent, child) {
  const value = relative(parent, child);
  return value !== "" && !isAbsolute(value) && !value.split(/[\\/]/).includes("..");
}

function requireAbsoluteEnvironment(name) {
  const value = process.env[name];
  if (!value || !isAbsolute(value)) throw new Error(`missing_${name}`);
  return resolve(value);
}

async function regularFile(path) {
  const stat = await lstat(path).catch(() => null);
  return Boolean(stat?.isFile() && !stat.isSymbolicLink());
}

async function boundedRun(command, environment, cwd, timeoutMs) {
  return await new Promise((done) => {
    let bytes = 0;
    let settled = false;
    let forced;
    let settle;
    const discard = (chunk) => { bytes = Math.min(64 * 1024, bytes + chunk.length); };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forced);
      clearTimeout(settle);
      done(value);
    };
    const child = spawn(command[0], command.slice(1), { cwd, env: environment, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* direct child only */ }
      forced = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* direct child only */ }
        settle = setTimeout(() => finish(false), TERMINATION_GRACE_MS);
      }, TERMINATION_GRACE_MS);
    }, timeoutMs);
    child.stdout.on("data", discard);
    child.stderr.on("data", discard);
    child.once("error", () => finish(false));
    child.once("close", (code) => { void bytes; finish(code === 0); });
  });
}

async function main() {
  const trustedRoot = requireAbsoluteEnvironment("CHANGE_TRACE_TRUSTED_TOOLING_ROOT");
  const subjectRoot = requireAbsoluteEnvironment("CHANGE_TRACE_CI_REPOSITORY_ROOT");
  const output = requireAbsoluteEnvironment("CHANGE_TRACE_CI_OUTPUT_DIRECTORY");
  const base = process.env.CHANGE_TRACE_CI_BASE_REVISION ?? "";
  const head = process.env.CHANGE_TRACE_CI_HEAD_REVISION ?? "";
  const attempt = process.env.CHANGE_TRACE_CI_RUN_ATTEMPT ?? "1";
  const requestedTimeout = process.env.CHANGE_TRACE_OPENCODE_TIMEOUT_MS;
  const timeoutMs = requestedTimeout === undefined ? HOST_TIMEOUT_MS : /^\d+$/.test(requestedTimeout) ? Number(requestedTimeout) : 0;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > HOST_TIMEOUT_MS) throw new Error("invalid_host_timeout");
  if (!safeRevision.test(base) || !safeRevision.test(head) || !/^\d+$/.test(attempt) || Number(attempt) < 1) throw new Error("invalid_run_context");
  const [trusted, subject, outputRoot, nodeBinary] = await Promise.all([realpath(trustedRoot), realpath(subjectRoot), realpath(output), realpath(process.execPath)]);
  if (trusted !== await realpath(scriptRoot) || !isStrictDescendant(subject, outputRoot)) throw new Error("untrusted_path");
  const outputRelative = relative(subject, outputRoot).replace(/\\/g, "/");
  if (!outputRelative || !isStrictDescendant(subject, outputRoot)) throw new Error("invalid_output_path");
  const mcpEntry = join(trusted, "dist", "cli.js");
  const binary = process.env.CHANGE_TRACE_OPENCODE_BIN;
  const fixtureEntry = process.env.CHANGE_TRACE_TEST_OPENCODE_ENTRY;
  const resolvedBinary = binary && isAbsolute(binary) ? await realpath(binary).catch(() => "") : "";
  const resolvedFixture = fixtureEntry && isAbsolute(fixtureEntry) ? await realpath(fixtureEntry).catch(() => "") : "";
  if (!binary || !resolvedBinary || !await regularFile(mcpEntry) || !await regularFile(resolvedBinary) || (resolvedBinary !== nodeBinary && !isStrictDescendant(trusted, resolvedBinary)) || (fixtureEntry && (!resolvedFixture || !await regularFile(resolvedFixture) || !isStrictDescendant(trusted, resolvedFixture)))) throw new Error("missing_trusted_binary");
  const state = await mkdtemp(join(tmpdir(), "change-trace-opencode-"));
  try {
  const configDirectory = join(state, "config");
  const cacheDirectory = join(state, "provider-cache");
  const configPath = join(configDirectory, "opencode.json");
  const prompt = await readFile(promptPath, "utf8");
  await mkdir(cacheDirectory, { recursive: true });
  const config = {
    "$schema": "https://opencode.ai/config.json",
    share: "disabled",
    snapshot: false,
    autoupdate: false,
    plugin: [],
    instructions: [],
    subagent_depth: 0,
    enabled_providers: ["github_models"],
    model: "github_models/openai/gpt-4.1",
    permission: { "*": "deny", "change_trace_*": "allow" },
    provider: {
      github_models: {
        npm: "@ai-sdk/openai-compatible",
        name: "GitHub Models",
        options: { baseURL: "https://models.github.ai/inference", apiKey: "{env:GITHUB_MODELS_TOKEN}" },
        models: { "openai/gpt-4.1": { name: "GPT-4.1" } },
      },
    },
    mcp: {
      change_trace: {
        type: "local", enabled: true, timeout: 10_000,
        command: [process.execPath, sanitizer],
        environment: {
          CHANGE_TRACE_TRUSTED_MCP_ENTRY: mcpEntry,
          CHANGE_TRACE_TRUSTED_TOOLING_ROOT: trusted,
          CHANGE_TRACE_CI_REPOSITORY_ROOT: subject,
          CHANGE_TRACE_CI_OUTPUT_DIRECTORY: outputRoot,
          CHANGE_TRACE_CI_BASE_REVISION: base,
          CHANGE_TRACE_CI_HEAD_REVISION: head,
          CHANGE_TRACE_CI_RUN_ATTEMPT: attempt,
          GITHUB_MODELS_TOKEN: "",
          GITHUB_TOKEN: "",
        },
      },
    },
    agent: {
      change_trace_advisory: {
        mode: "primary", model: "github_models/openai/gpt-4.1",
        permission: { "*": "deny", "change_trace_*": "allow" },
      },
    },
  };
  await mkdir(configDirectory, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  const isolatedEnvironment = {
    PATH: process.env.PATH ?? "", HOME: state, USERPROFILE: state,
    XDG_CONFIG_HOME: configDirectory, XDG_DATA_HOME: join(state, "data"), XDG_CACHE_HOME: join(state, "cache"),
    OPENCODE_CONFIG: configPath, BUN_INSTALL_CACHE_DIR: cacheDirectory,
    CHANGE_TRACE_TEST_OBSERVATION: process.env.CHANGE_TRACE_TEST_OBSERVATION ?? "",
    CHANGE_TRACE_TEST_HANG: process.env.CHANGE_TRACE_TEST_HANG ?? "",
  };
  if (!process.env.GITHUB_MODELS_TOKEN) throw new Error("missing_model_token");
  const context = `\n\nTrusted run context:\nrepositoryRoot: ${subject}\noutputDirectory: ${outputRelative}\nreportName: release-review\noverwrite: true\nbase revision: ${base || "null"}\nhead revision: ${head || "null"}\nrun attempt: ${attempt}\n`;
  const command = resolvedFixture ? [resolvedBinary, resolvedFixture] : [resolvedBinary];
  const ok = await boundedRun([...command, "run", "--pure", "--format", "json", "--agent", "change_trace_advisory", `${prompt}${context}`], { ...isolatedEnvironment, GITHUB_MODELS_TOKEN: process.env.GITHUB_MODELS_TOKEN }, trusted, timeoutMs);
  if (!ok) throw new Error("opencode_failed");
  } finally {
    await rm(state, { recursive: true, force: true });
  }
}

try { await main(); } catch { process.exitCode = 1; }
