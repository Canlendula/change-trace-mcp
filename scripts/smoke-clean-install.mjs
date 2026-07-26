import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { lstatSync } from "node:fs";
import { access, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const referenceClientPath = join(repositoryRoot, "scripts", "smoke-stdio.mjs");
const MAX_OUTPUT_BYTES = 512 * 1024;
const COMMAND_TIMEOUT_MS = 90_000;
const TERMINATION_GRACE_MS = 1_000;

export const CLEAN_INSTALL_FIXTURE =
  '{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}';
export const EXPECTED_TOOL_NAMES = [
  "collect_external_evidence",
  "collect_local_evidence",
  "collect_runtime_evidence",
  "get_change_scope",
  "get_compatibility_fixture",
  "get_review_bundle",
  "get_server_info",
  "validate_findings",
  "write_report",
];

const REQUIRED_PACKED_FILES = [
  "dist/cli.js",
  "dist/index.js",
  "dist/index.d.ts",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "docs/smoke-tests/README.md",
  "docs/smoke-tests/config/codex.toml.example",
  "docs/smoke-tests/config/claude.mcp.json.example",
  "docs/smoke-tests/config/opencode.json.example",
  "docs/smoke-tests/config/opencode-v2.json.example",
  "docs/security/README.md",
  "docs/ci/README.md",
  "docs/ci/github-actions.example.yml",
  "docs/ci/gitlab-ci.example.yml",
  "docs/ci/portable-advisory.sh.example",
  "docs/ci/fixtures/deterministic-advisory-host.mjs",
  "scripts/ci/advisory-runner.mjs",
  "scripts/ci/summarize-advisory-status.mjs",
];
const CI_ARTIFACT_NAMES = ["release-review.md", "release-review.json", "release-review-status.json"];
const MAX_CI_ARTIFACT_BYTES = 10 * 1024 * 1024;

class SmokeError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function smokeError(code) {
  return new SmokeError(code);
}

function normalizedPath(path) {
  return path.replaceAll("\\", "/");
}

function isWithin(parent, candidate) {
  const value = relative(resolve(parent), resolve(candidate));
  return value === "" || (!isAbsolute(value) && !value.startsWith(`..${sep}`) && value !== "..");
}

export function createSmokePlan({ repositoryRoot: sourceRoot, temporaryRoot, npmCliPath, npxCliPath }) {
  if (isWithin(sourceRoot, temporaryRoot)) throw smokeError("temporary_root_invalid");
  const artifactDirectory = join(temporaryRoot, "artifact");
  return {
    repositoryRoot: resolve(sourceRoot),
    temporaryRoot: resolve(temporaryRoot),
    artifactDirectory,
    cacheDirectory: join(temporaryRoot, "npm-cache"),
    consumerDirectory: join(temporaryRoot, "consumer"),
    npxDirectory: join(temporaryRoot, "npx-consumer"),
    homeDirectory: join(temporaryRoot, "home"),
    subjectDirectory: join(temporaryRoot, "subject"),
    fixtureOutputDirectory: join(temporaryRoot, "subject", "advisory-output"),
    userConfigPath: join(temporaryRoot, "npmrc"),
    tarballPath: null,
    npmCliPath,
    npxCliPath,
  };
}

function setCaseInsensitive(target, key, value) {
  const canonicalKey = key.toUpperCase();
  for (const existing of Object.keys(target)) {
    if (existing.toUpperCase() === canonicalKey) delete target[existing];
  }
  target[key] = value;
}

export function sanitizeEnvironment(source, { cacheDirectory, userConfigPath, homeDirectory, ignoreScripts = true }) {
  const environment = {};
  const inheritedSystemKeys = new Set(["PATH", "SYSTEMROOT", "COMSPEC", "PATHEXT", "WINDIR", "TEMP", "TMP", "TERM", "LANG", "LC_ALL"]);
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string" || !inheritedSystemKeys.has(key.toUpperCase())) continue;
    if (Object.keys(environment).some((existing) => existing.toUpperCase() === key.toUpperCase())) continue;
    setCaseInsensitive(environment, key.toUpperCase() === "PATH" ? "PATH" : key, value);
  }
  setCaseInsensitive(environment, "HOME", homeDirectory);
  setCaseInsensitive(environment, "USERPROFILE", homeDirectory);
  setCaseInsensitive(environment, "NPM_CONFIG_CACHE", cacheDirectory);
  setCaseInsensitive(environment, "NPM_CONFIG_USERCONFIG", userConfigPath);
  setCaseInsensitive(environment, "NPM_CONFIG_AUDIT", "false");
  setCaseInsensitive(environment, "NPM_CONFIG_FUND", "false");
  setCaseInsensitive(environment, "NPM_CONFIG_PACKAGE_LOCK", "false");
  setCaseInsensitive(environment, "NPM_CONFIG_UPDATE_NOTIFIER", "false");
  setCaseInsensitive(environment, "NO_UPDATE_NOTIFIER", "true");
  if (ignoreScripts) setCaseInsensitive(environment, "NPM_CONFIG_IGNORE_SCRIPTS", "true");
  return environment;
}

function validatePackFile(file) {
  if (!file || typeof file !== "object" || typeof file.path !== "string") throw smokeError("pack_files_invalid");
  return normalizedPath(file.path);
}

export function parsePackResult(output, expectedName, expectedVersion) {
  let records;
  try {
    records = JSON.parse(output);
  } catch {
    throw smokeError("pack_result_invalid");
  }
  if (!Array.isArray(records) || records.length !== 1 || !records[0] || typeof records[0] !== "object") throw smokeError("pack_result_invalid");
  const record = records[0];
  const requiredStringFields = ["name", "version", "filename", "shasum", "integrity"];
  if (requiredStringFields.some((field) => typeof record[field] !== "string" || record[field].length === 0) ||
      !Number.isSafeInteger(record.size) || record.size < 0 ||
      !Number.isSafeInteger(record.unpackedSize) || record.unpackedSize < 0 ||
      !Array.isArray(record.files)) {
    throw smokeError("pack_result_invalid");
  }
  if (record.name !== expectedName || record.version !== expectedVersion || basename(record.filename) !== record.filename) {
    throw smokeError("pack_identity_invalid");
  }
  return {
    name: record.name,
    version: record.version,
    filename: record.filename,
    size: record.size,
    unpackedSize: record.unpackedSize,
    shasum: record.shasum,
    integrity: record.integrity,
    files: record.files.map(validatePackFile),
  };
}

export function validatePackedFiles(files) {
  const packed = new Set(files.map(normalizedPath));
  for (const required of REQUIRED_PACKED_FILES) {
    if (!packed.has(required)) throw smokeError("packed_file_missing");
  }
  const forbidden = /^(?:src|tests|node_modules|\.git|\.github|docs\/work-items)(?:\/|$)|(?:^|\/)(?:\.env(?:\.[^/]+)?|\.npmrc|npmrc|\.yarnrc|\.pnpmrc|\.pypirc|\.netrc|\.gitconfig|package-lock\.json|\.gitignore|auth(?:entication)?(?:\.[^/]+)?|tokens?(?:\.[^/]+)?|secrets?(?:\.[^/]+)?|credentials?(?:\.[^/]+)?)(?:$|\/)/iu;
  if (files.some((file) => forbidden.test(normalizedPath(file)))) throw smokeError("packed_file_forbidden");
  const permittedCiScripts = new Set(["scripts/ci/advisory-runner.mjs", "scripts/ci/summarize-advisory-status.mjs"]);
  if (files.some((file) => normalizedPath(file).startsWith("scripts/ci/") && !permittedCiScripts.has(normalizedPath(file)))) {
    throw smokeError("packed_ci_script_forbidden");
  }
}

export async function validateInstalledCiArtifacts(outputDirectory) {
  const entries = (await readdir(outputDirectory)).sort();
  if (JSON.stringify(entries) !== JSON.stringify([...CI_ARTIFACT_NAMES].sort())) throw smokeError("ci_artifacts_invalid");
  const artifacts = {};
  for (const name of CI_ARTIFACT_NAMES) {
    const path = join(outputDirectory, name);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > MAX_CI_ARTIFACT_BYTES) {
      throw smokeError("ci_artifacts_invalid");
    }
    artifacts[name] = await readFile(path, "utf8");
  }
  let report;
  let status;
  try {
    report = JSON.parse(artifacts["release-review.json"]);
    status = JSON.parse(artifacts["release-review-status.json"]);
  } catch {
    throw smokeError("ci_artifacts_invalid");
  }
  if (report.schemaVersion !== "1.0.0" || report.id !== "deterministic-advisory-report" || report.bundleId !== "deterministic-advisory-bundle" ||
      report.reviewMeta?.reviewer !== "deterministic-public-fixture" ||
      JSON.stringify(report.findings) !== JSON.stringify({ confirmed: [], suspected: [], inconclusive: [] }) ||
      !Array.isArray(report.evidenceSources) || report.evidenceSources.length !== 0 ||
      report.validationSummary?.submitted !== 0 || report.validationSummary?.valid !== 0 || report.validationSummary?.rejected !== 0 ||
      report.bundleTruncation?.isTruncated !== false) throw smokeError("ci_report_schema_invalid");
  if (status.schemaVersion !== "1.0.0" || status.artifactType !== "change-trace-advisory-status" || status.outcome !== "completed_no_findings" ||
      status.host?.id !== "deterministic-public-fixture" || status.run?.runAttempt !== 1 ||
      JSON.stringify(status.counts) !== JSON.stringify({ confirmed: 0, suspected: 0, inconclusive: 0, rejected: 0, missingEvidence: 0, bundleTruncated: false }) ||
      JSON.stringify(Object.values(status.artifacts ?? {}).map((artifact) => artifact?.name).sort()) !== JSON.stringify([...CI_ARTIFACT_NAMES].sort()) ||
      !/^sha256:[a-f0-9]{64}$/u.test(status.artifacts?.markdown?.sha256 ?? "") ||
      !/^sha256:[a-f0-9]{64}$/u.test(status.artifacts?.json?.sha256 ?? "")) throw smokeError("ci_status_schema_invalid");
  return { outcome: status.outcome, artifacts: CI_ARTIFACT_NAMES.length };
}

export function validateLaunchResult(output) {
  let result;
  try {
    result = JSON.parse(output);
  } catch {
    throw smokeError("launch_result_invalid");
  }
  if (!result || result.ok !== true || !Array.isArray(result.tools)) throw smokeError("launch_result_invalid");
  const toolNames = [...result.tools].sort();
  if (JSON.stringify(toolNames) !== JSON.stringify(EXPECTED_TOOL_NAMES)) throw smokeError("launch_tools_invalid");
  if (JSON.stringify(result.fixture) !== CLEAN_INSTALL_FIXTURE) throw smokeError("launch_fixture_invalid");
  return { toolNames, fixture: CLEAN_INSTALL_FIXTURE };
}

export function validateSmokeSummary(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) throw smokeError("summary_invalid");
  const expectedKeys = ["schemaVersion", "package", "tarball", "runtime", "install", "npx", "tools", "fixture", "ci", "cleanup"];
  if (JSON.stringify(Object.keys(summary).sort()) !== JSON.stringify(expectedKeys.sort())) throw smokeError("summary_invalid");
  if (summary.schemaVersion !== "1.0.0" || summary.cleanup !== true || summary.install?.ok !== true || summary.install?.copiedPackage !== true || summary.npx?.ok !== true) throw smokeError("summary_invalid");
  if (typeof summary.package?.name !== "string" || typeof summary.package?.sourceVersion !== "string" ||
      typeof summary.tarball?.filename !== "string" || !/^[0-9a-f]{64}$/u.test(summary.tarball?.sha256 ?? "") ||
      typeof summary.tarball?.npmShasum !== "string" || typeof summary.tarball?.npmIntegrity !== "string" ||
      !Number.isSafeInteger(summary.tarball?.packedSize) || !Number.isSafeInteger(summary.tarball?.unpackedSize) || !Number.isSafeInteger(summary.tarball?.fileCount) ||
      typeof summary.runtime?.node !== "string" || typeof summary.runtime?.npm !== "string" || typeof summary.runtime?.platform !== "string" || typeof summary.runtime?.arch !== "string" ||
      summary.fixture !== CLEAN_INSTALL_FIXTURE || summary.ci?.outcome !== "completed_no_findings" || summary.ci?.artifacts !== 3) throw smokeError("summary_invalid");
  if (!Array.isArray(summary.tools) || JSON.stringify([...summary.tools].sort()) !== JSON.stringify(EXPECTED_TOOL_NAMES)) throw smokeError("summary_invalid");
  return summary;
}

async function terminateChild(child) {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    const taskkill = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });
    const taskkillSucceeded = await new Promise((resolveTaskkill) => {
      const timer = setTimeout(() => resolveTaskkill(false), TERMINATION_GRACE_MS);
      taskkill.once("close", (code) => { clearTimeout(timer); resolveTaskkill(code === 0); });
      taskkill.once("error", () => { clearTimeout(timer); resolveTaskkill(false); });
    });
    if (!taskkillSucceeded) child.kill("SIGKILL");
    return;
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  await new Promise((resolveGrace) => setTimeout(resolveGrace, TERMINATION_GRACE_MS));
  if (child.exitCode !== null || child.signalCode !== null) return;
  try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
}

export async function runBounded(command, args, { cwd, env, timeoutMs = COMMAND_TIMEOUT_MS, maxOutputBytes = MAX_OUTPUT_BYTES } = {}) {
  if (!isAbsolute(command) || !Array.isArray(args) || args.some((value) => typeof value !== "string")) throw smokeError("command_plan_invalid");
  return await new Promise((resolveRun, rejectRun) => {
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let failureCode = null;
    let termination = Promise.resolve();
    let settled = false;
    const child = spawn(command, args, {
      cwd,
      env,
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) rejectRun(error);
      else resolveRun(value);
    };
    const stop = (code) => {
      if (failureCode) return;
      failureCode = code;
      termination = terminateChild(child);
    };
    const append = (target, chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        stop("command_output_limit");
        return target;
      }
      return `${target}${chunk.toString("utf8")}`;
    };
    const timer = setTimeout(() => stop("command_timeout"), timeoutMs);
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.once("error", () => finish(smokeError("command_unavailable")));
    child.once("close", async (code) => {
      await termination;
      if (failureCode) finish(smokeError(failureCode));
      else if (code !== 0) finish(smokeError("command_failed"));
      else finish(null, { stdout, stderr });
    });
  });
}

export function resolveCliPath(name, suppliedPath, environment = process.env) {
  if (suppliedPath) {
    try {
      if (isAbsolute(suppliedPath) && lstatSync(suppliedPath).isFile()) return resolve(suppliedPath);
    } catch { /* return the fixed error below */ }
    throw smokeError("npm_cli_unavailable");
  }
  const environmentCandidate = name === "npm" ? environment.npm_execpath : undefined;
  const candidates = [
    environmentCandidate,
    join(dirname(process.execPath), "node_modules", "npm", "bin", `${name}-cli.js`),
    join(dirname(process.execPath), "..", "node_modules", "npm", "bin", `${name}-cli.js`),
    join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", `${name}-cli.js`),
    join(dirname(process.execPath), "..", "lib64", "node_modules", "npm", "bin", `${name}-cli.js`),
  ].filter(Boolean);
  try { candidates.push(require.resolve(`npm/bin/${name}-cli.js`)); } catch { /* fall through */ }
  for (const candidate of candidates) {
    if (!candidate || !isAbsolute(candidate)) continue;
    try {
      if (lstatSync(candidate).isFile()) return resolve(candidate);
    } catch { /* try the next candidate */ }
  }
  throw smokeError("npm_cli_unavailable");
}

async function assertInstalledPackage(plan, expectedPackage) {
  const installedDirectory = join(plan.consumerDirectory, "node_modules", expectedPackage.name);
  const installedStat = await lstat(installedDirectory);
  if (installedStat.isSymbolicLink()) throw smokeError("installed_package_linked");
  const installedRealPath = await realpath(installedDirectory);
  if (!isWithin(plan.consumerDirectory, installedRealPath) || isWithin(plan.repositoryRoot, installedRealPath)) throw smokeError("installed_package_location_invalid");
  const installed = JSON.parse(await readFile(join(installedDirectory, "package.json"), "utf8"));
  for (const [field, value] of Object.entries({
    name: expectedPackage.name,
    version: expectedPackage.version,
    license: "Apache-2.0",
  })) {
    if (installed[field] !== value) throw smokeError("installed_package_metadata_invalid");
  }
  if (JSON.stringify(installed.bin) !== JSON.stringify(expectedPackage.bin) ||
      JSON.stringify(installed.exports) !== JSON.stringify(expectedPackage.exports) ||
      JSON.stringify(installed.engines) !== JSON.stringify(expectedPackage.engines)) {
    throw smokeError("installed_package_metadata_invalid");
  }
  if (JSON.stringify(installed.dependencies) !== JSON.stringify(expectedPackage.dependencies)) throw smokeError("installed_package_dependencies_invalid");
  for (const path of REQUIRED_PACKED_FILES) await access(join(installedDirectory, path));
  return installedDirectory;
}

export async function withTemporaryRoot(operation) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "change-trace-clean-install-"));
  let operationResult;
  let operationError;
  try {
    operationResult = await operation(temporaryRoot);
  } catch (error) {
    operationError = error;
  }
  try {
    await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
  } catch {
    if (!operationError) throw smokeError("cleanup_failed");
  }
  if (operationError) throw operationError;
  return { result: operationResult, cleanupSuccess: true };
}

async function executeSmoke() {
  const sourcePackage = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
  if (typeof sourcePackage.name !== "string" || typeof sourcePackage.version !== "string" || !sourcePackage.engines || !sourcePackage.dependencies) throw smokeError("source_package_invalid");
  const npmCliPath = resolveCliPath("npm", process.env.CHANGE_TRACE_NPM_CLI_PATH);
  const npxCliPath = resolveCliPath("npx", process.env.CHANGE_TRACE_NPX_CLI_PATH);
  const { result, cleanupSuccess } = await withTemporaryRoot(async (temporaryRoot) => {
    const plan = createSmokePlan({ repositoryRoot, temporaryRoot, npmCliPath, npxCliPath });
    await Promise.all([mkdir(plan.artifactDirectory), mkdir(plan.cacheDirectory), mkdir(plan.consumerDirectory), mkdir(plan.npxDirectory), mkdir(plan.homeDirectory), mkdir(plan.subjectDirectory)]);
    await writeFile(plan.userConfigPath, "", { encoding: "utf8", mode: 0o600 });
    const packEnvironment = sanitizeEnvironment(process.env, { ...plan, ignoreScripts: false });
    const installEnvironment = sanitizeEnvironment(process.env, plan);
    const npmCommand = process.execPath;
    const packResult = parsePackResult(
      (await runBounded(npmCommand, [npmCliPath, "pack", "--json", "--pack-destination", plan.artifactDirectory], { cwd: repositoryRoot, env: packEnvironment })).stdout,
      sourcePackage.name,
      sourcePackage.version,
    );
    const tarballPath = join(plan.artifactDirectory, packResult.filename);
    if (!isWithin(plan.artifactDirectory, tarballPath)) throw smokeError("tarball_path_invalid");
    const tarballSha256 = createHash("sha256").update(await readFile(tarballPath)).digest("hex");
    validatePackedFiles(packResult.files);
    await writeFile(join(plan.consumerDirectory, "package.json"), JSON.stringify({ private: true, name: "change-trace-clean-consumer", version: "1.0.0" }), "utf8");
    await runBounded(npmCommand, [npmCliPath, "install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", "--cache", plan.cacheDirectory, "--userconfig", plan.userConfigPath, tarballPath], { cwd: plan.consumerDirectory, env: installEnvironment });
    const installedDirectory = await assertInstalledPackage(plan, sourcePackage);
    await runBounded(npmCommand, [npmCliPath, "ls", "--omit=dev", "--json", "--no-audit", "--no-fund", "--userconfig", plan.userConfigPath], { cwd: plan.consumerDirectory, env: installEnvironment });
    const installedLaunch = validateLaunchResult((await runBounded(process.execPath, [referenceClientPath, process.execPath, join(installedDirectory, "dist", "cli.js")], { cwd: plan.consumerDirectory, env: installEnvironment })).stdout);
    const npxLaunch = validateLaunchResult((await runBounded(process.execPath, [referenceClientPath, process.execPath, npxCliPath, "--yes", "--package", tarballPath, "--", sourcePackage.name], { cwd: plan.npxDirectory, env: installEnvironment })).stdout);
    const installedRunner = join(installedDirectory, "scripts", "ci", "advisory-runner.mjs");
    const installedFixture = join(installedDirectory, "docs", "ci", "fixtures", "deterministic-advisory-host.mjs");
    const ciRun = await runBounded(process.execPath, [installedRunner], {
      cwd: plan.subjectDirectory,
      env: {
        ...installEnvironment,
        CHANGE_TRACE_CI_COMMAND: JSON.stringify([process.execPath, installedFixture]),
        CHANGE_TRACE_CI_REPOSITORY_ROOT: plan.subjectDirectory,
        CHANGE_TRACE_CI_OUTPUT_DIRECTORY: "advisory-output",
        CHANGE_TRACE_CI_HOST_ID: "deterministic-public-fixture",
        CHANGE_TRACE_CI_RUN_ATTEMPT: "1",
      },
    });
    if (ciRun.stdout !== "change-trace-advisory outcome=completed_no_findings code=ok\n" || ciRun.stderr !== "") throw smokeError("ci_runner_output_invalid");
    const ci = await validateInstalledCiArtifacts(plan.fixtureOutputDirectory);
    const npmVersion = (await runBounded(npmCommand, [npmCliPath, "--version"], { cwd: plan.consumerDirectory, env: installEnvironment })).stdout.trim();
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(npmVersion)) throw smokeError("npm_version_invalid");
    return validateSmokeSummary({
      schemaVersion: "1.0.0",
      package: { name: sourcePackage.name, sourceVersion: sourcePackage.version },
      tarball: {
        filename: packResult.filename,
        sha256: tarballSha256,
        npmShasum: packResult.shasum,
        npmIntegrity: packResult.integrity,
        packedSize: packResult.size,
        unpackedSize: packResult.unpackedSize,
        fileCount: packResult.files.length,
      },
      runtime: { node: process.version, npm: npmVersion, platform: process.platform, arch: process.arch },
      install: { ok: true, copiedPackage: true },
      npx: { ok: true },
      tools: installedLaunch.toolNames,
      fixture: installedLaunch.fixture,
      ci,
      cleanup: true,
    });
  });
  return { ...result, cleanup: cleanupSuccess };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(await executeSmoke())}\n`);
  } catch (error) {
    const code = error instanceof SmokeError ? error.code : "smoke_failed";
    process.stderr.write(`${JSON.stringify({ schemaVersion: "1.0.0", ok: false, code })}\n`);
    process.exitCode = 1;
  }
}
