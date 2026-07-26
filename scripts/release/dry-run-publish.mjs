import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { access, lstat, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const registry = "https://registry.npmjs.org/";
const tag = "next";
const timeoutMs = 120_000;
const maxOutputBytes = 128 * 1024;
const maxDiagnosticBytes = 2_048;
const credentialKey = /(?:^|_)(?:AUTH|TOKEN|PASSWORD|PASS|CREDENTIAL|SECRET|PRIVATE_KEY)(?:_|$)|^NPM_CONFIG_.*(?:AUTH|TOKEN|PASSWORD|PASS|CREDENTIAL|KEY|CERT)/iu;

class DryRunError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function resolveNpmCli() {
  const executableDirectory = dirname(process.execPath);
  const candidates = [
    join(executableDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    join(executableDirectory, "..", "node_modules", "npm", "bin", "npm-cli.js"),
    join(executableDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    join(executableDirectory, "..", "lib64", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  try { candidates.push(require.resolve("npm/bin/npm-cli.js")); } catch { /* use fixed runtime locations */ }
  for (const candidate of candidates) {
    if (isAbsolute(candidate) && existsSync(candidate)) return resolve(candidate);
  }
  throw new DryRunError("npm_cli_unavailable");
}

const npmCliPath = resolveNpmCli();

function boundedDiagnostic(value) {
  return value.length <= maxDiagnosticBytes ? value : `${value.slice(0, maxDiagnosticBytes)}…`;
}

function cleanEnvironment(environment, locations) {
  const result = {};
  for (const [key, value] of Object.entries(environment)) {
    if (typeof value === "string" && !credentialKey.test(key)) result[key] = value;
  }
  return {
    ...result,
    HOME: locations.home,
    USERPROFILE: locations.home,
    npm_config_cache: locations.cache,
    npm_config_userconfig: locations.userConfig,
    npm_config_registry: registry,
    npm_config_ignore_scripts: "true",
    npm_config_always_auth: "false",
  };
}

async function terminate(child, environment) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid !== undefined) {
    await new Promise((resolveTermination) => {
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
        shell: false,
        stdio: "ignore",
        windowsHide: true,
        env: environment,
      });
      killer.once("close", () => resolveTermination());
      killer.once("error", () => resolveTermination());
    });
    return;
  }
  child.kill("SIGKILL");
}

function runBounded(executable, args, { cwd, env, allowFailure = false }) {
  if ((executable !== "git" && !isAbsolute(executable)) || !Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new DryRunError("command_plan_invalid");
  }
  return new Promise((resolveRun, rejectRun) => {
    let stdout = "";
    let stderr = "";
    let byteCount = 0;
    let failure;
    let settled = false;
    const child = spawn(executable, args, { cwd, env, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const settle = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) rejectRun(error);
      else resolveRun(result);
    };
    const stop = (code) => {
      if (failure !== undefined) return;
      failure = code;
      void terminate(child, env);
    };
    const append = (current, chunk) => {
      byteCount += chunk.length;
      if (byteCount > maxOutputBytes) {
        stop("command_output_overflow");
        return current;
      }
      return `${current}${chunk.toString("utf8")}`;
    };
    const timer = setTimeout(() => stop("command_timeout"), timeoutMs);
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.once("error", () => settle(new DryRunError("command_unavailable")));
    child.once("close", (code) => {
      if (failure !== undefined) settle(new DryRunError(failure));
      else if (code !== 0 && !allowFailure) settle(new DryRunError(`command_failed_${args[1] ?? "unknown"}`));
      else settle(undefined, { code, stdout, stderr });
    });
  });
}

function npmArgs(command) {
  return [npmCliPath, command, "--userconfig", "PLACEHOLDER", "--cache", "PLACEHOLDER", "--registry", registry, "--ignore-scripts"];
}

function npmCommand(command, locations, extras = []) {
  const args = npmArgs(command);
  args[2] = locations.userConfig;
  args[4] = locations.cache;
  return [process.execPath, [...args, ...extras]];
}

function parsePackResult(output, packageName, version) {
  let records;
  try {
    records = JSON.parse(output);
  } catch {
    throw new DryRunError("pack_json_invalid");
  }
  if (!Array.isArray(records) || records.length !== 1) throw new DryRunError("tarball_count_invalid");
  const record = records[0];
  if (!record || record.name !== packageName || record.version !== version || typeof record.filename !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*\.tgz$/u.test(record.filename) ||
      !Number.isSafeInteger(record.size) || record.size < 1 || !Number.isSafeInteger(record.unpackedSize) || record.unpackedSize < 1 ||
      !/^[a-f0-9]{40}$/u.test(record.shasum ?? "") || typeof record.integrity !== "string" ||
      !/^(?:sha(?:1|256|384|512)-[A-Za-z0-9+/]+={0,2})(?:\s+sha(?:1|256|384|512)-[A-Za-z0-9+/]+={0,2})*$/u.test(record.integrity)) {
    throw new DryRunError("pack_metadata_invalid");
  }
  return record;
}

async function sourceIsClean(environment) {
  const result = await runBounded("git", ["status", "--porcelain=v1", "-z"], { cwd: repositoryRoot, env: environment });
  if (result.stdout.length !== 0) throw new DryRunError("source_tree_dirty");
}

async function isPublishedWithoutCredentials(packageName, version, locations, environment) {
  const [executable, args] = npmCommand("view", locations, [`${packageName}@${version}`, "version", "--json"]);
  const result = await runBounded(executable, args, { cwd: repositoryRoot, env: environment, allowFailure: true });
  if (result.code !== 0) return false;
  let value;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    throw new DryRunError("view_json_invalid");
  }
  if (value === version || (Array.isArray(value) && value.includes(version))) return true;
  if (typeof value !== "string" && !Array.isArray(value)) throw new DryRunError("view_json_invalid");
  return false;
}

async function ensureRemoved(temporaryRoot) {
  await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
  try {
    await lstat(temporaryRoot);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return true;
    throw error;
  }
  throw new DryRunError("cleanup_failed");
}

async function executeDryRun() {
  const sourcePackage = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
  if (typeof sourcePackage.name !== "string" || typeof sourcePackage.version !== "string" || sourcePackage.name.length === 0 || sourcePackage.version.length === 0) {
    throw new DryRunError("package_identity_invalid");
  }
  const preflightEnvironment = cleanEnvironment(process.env, {
    home: tmpdir(), cache: tmpdir(), userConfig: join(tmpdir(), "change-trace-empty-npmrc"),
  });
  await sourceIsClean(preflightEnvironment);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "change-trace-publish-dry-run-"));
  let result;
  let operationError;
  let cleanup = false;
  try {
    const locations = {
      cache: join(temporaryRoot, "cache"),
      home: join(temporaryRoot, "home"),
      userConfig: join(temporaryRoot, "npmrc"),
      artifacts: join(temporaryRoot, "artifacts"),
    };
    await Promise.all([mkdir(locations.cache), mkdir(locations.home), mkdir(locations.artifacts)]);
    await writeFile(locations.userConfig, "registry=https://registry.npmjs.org/\nignore-scripts=true\nalways-auth=false\n", { encoding: "utf8", mode: 0o600 });
    const environment = cleanEnvironment(process.env, locations);
    if (await isPublishedWithoutCredentials(sourcePackage.name, sourcePackage.version, locations, environment)) {
      throw new DryRunError("version_already_published");
    }
    const [buildExecutable, buildArgs] = npmCommand("run", locations, ["build"]);
    await runBounded(buildExecutable, buildArgs, { cwd: repositoryRoot, env: environment });
    const [packExecutable, packArgs] = npmCommand("pack", locations, ["--json", "--pack-destination", locations.artifacts]);
    const packed = parsePackResult((await runBounded(packExecutable, packArgs, { cwd: repositoryRoot, env: environment })).stdout, sourcePackage.name, sourcePackage.version);
    const tarballPath = resolve(locations.artifacts, packed.filename);
    if (!tarballPath.startsWith(`${resolve(locations.artifacts)}${process.platform === "win32" ? "\\" : "/"}`)) throw new DryRunError("tarball_path_invalid");
    await access(tarballPath);
    const sha256 = createHash("sha256").update(await readFile(tarballPath)).digest("hex");
    const [publishExecutable, publishArgs] = npmCommand("publish", locations, [tarballPath, "--dry-run", "--tag", tag, "--access", "public"]);
    await runBounded(publishExecutable, publishArgs, { cwd: repositoryRoot, env: environment });
    const [versionExecutable, versionArgs] = npmCommand("--version", locations);
    const npmVersion = (await runBounded(versionExecutable, versionArgs, { cwd: repositoryRoot, env: environment })).stdout.trim();
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(npmVersion)) throw new DryRunError("npm_version_invalid");
    result = {
      schemaVersion: "1.0.0",
      evidence: "local-dry-run-only",
      package: { name: sourcePackage.name, version: sourcePackage.version },
      operation: "npm publish --dry-run",
      tag,
      registry,
      tarball: { fileCount: 1, packedSize: packed.size, unpackedSize: packed.unpackedSize, shasum: packed.shasum, integrity: packed.integrity, sha256 },
      runtime: { node: process.version, npm: npmVersion },
      publishDryRun: true,
      cleanup: true,
    };
  } catch (error) {
    operationError = error;
  }
  try {
    cleanup = await ensureRemoved(temporaryRoot);
  } catch (error) {
    throw new DryRunError(error instanceof DryRunError ? error.code : "cleanup_failed");
  }
  if (operationError) throw operationError;
  return { ...result, cleanup };
}

export { cleanEnvironment, executeDryRun, npmCommand, parsePackResult, runBounded };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(await executeDryRun())}\n`);
  } catch (error) {
    const code = error instanceof DryRunError ? error.code : "dry_run_failed";
    process.stderr.write(`${JSON.stringify({ schemaVersion: "1.0.0", ok: false, code: boundedDiagnostic(code) })}\n`);
    process.exitCode = 1;
  }
}
