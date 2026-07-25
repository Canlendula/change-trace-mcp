#!/usr/bin/env node

import { spawn } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const RUNTIME_KEYS = [
  "PATH", "SystemRoot", "SYSTEMROOT", "ComSpec", "WINDIR", "SYSTEMDRIVE", "HOMEDRIVE", "HOMEPATH", "USERPROFILE", "USERNAME", "USERDOMAIN", "LOGONSERVER", "LANG", "LC_ALL", "TZ",
  "TMPDIR", "TEMP", "TMP",
  "CHANGE_TRACE_CI_REPOSITORY_ROOT", "CHANGE_TRACE_CI_OUTPUT_DIRECTORY",
  "CHANGE_TRACE_CI_BASE_REVISION", "CHANGE_TRACE_CI_HEAD_REVISION", "CHANGE_TRACE_CI_RUN_ATTEMPT",
];

function isStrictDescendant(parent, child) {
  const value = relative(parent, child);
  return value !== "" && !value.startsWith("..") && !isAbsolute(value);
}

async function main() {
  const entry = process.env.CHANGE_TRACE_TRUSTED_MCP_ENTRY;
  const repositoryRoot = process.env.CHANGE_TRACE_CI_REPOSITORY_ROOT;
  const trustedRoot = process.env.CHANGE_TRACE_TRUSTED_TOOLING_ROOT;
  if (!entry || !repositoryRoot || !trustedRoot || !isAbsolute(entry) || !isAbsolute(repositoryRoot) || !isAbsolute(trustedRoot)) process.exitCode = 2;
  if (process.exitCode) return;
  const [resolvedEntry, resolvedRepository, resolvedTrusted] = await Promise.all([realpath(entry), realpath(repositoryRoot), realpath(trustedRoot)]).catch(() => []);
  if (!resolvedEntry || !resolvedRepository || !resolvedTrusted || !isStrictDescendant(resolvedTrusted, resolvedEntry)) {
    process.exitCode = 2;
    return;
  }
  const stat = await lstat(resolvedEntry).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    process.exitCode = 2;
    return;
  }
  const environment = Object.fromEntries(RUNTIME_KEYS.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]]));
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_CONFIG_GLOBAL = process.platform === "win32" ? "NUL" : "/dev/null";
  environment.GIT_TERMINAL_PROMPT = "0";
  const child = spawn(process.execPath, [resolvedEntry], { cwd: resolvedRepository, env: environment, shell: false, stdio: "inherit" });
  child.once("error", () => { process.exitCode = 1; });
  child.once("close", (code) => { process.exitCode = code ?? 1; });
}

await main();
