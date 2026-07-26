import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, appendFile, chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { lstatSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const MAX_OUTPUT_BYTES = 512 * 1024;
const MAX_EXCERPT_BYTES = 64 * 1024;
const HOST_TIMEOUT_MS = 120_000;
const TERMINATION_GRACE_MS = 1_000;
const EXPECTED_HOST_VERSIONS = { codex: "26.707.3748.0", claude: "2.1.217", opencode: "1.18.4" };

export const FIXTURE_TEXT =
  '{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}';
export const EXPECTED_TOOL_NAMES = [
  "collect_external_evidence", "collect_local_evidence", "collect_runtime_evidence",
  "get_change_scope", "get_compatibility_fixture", "get_review_bundle",
  "get_server_info", "validate_findings", "write_report",
];

class HarnessError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new HarnessError(code); };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalized = (value) => value.replaceAll("\\", "/");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function isWithin(parent, candidate) {
  const value = relative(resolve(parent), resolve(candidate));
  return value === "" || (!isAbsolute(value) && value !== ".." && !value.startsWith(`..${sep}`));
}

export function createHostPlan({ repositoryRoot: sourceRoot, stateRoot, serverName }) {
  if (!/^[a-z][a-z0-9_]{5,63}$/u.test(serverName)) fail("server_name_invalid");
  if (isWithin(sourceRoot, stateRoot)) fail("state_root_invalid");
  const root = resolve(stateRoot);
  const consumer = join(root, "consumer");
  return {
    repositoryRoot: resolve(sourceRoot), stateRoot: root, serverName,
    artifactDirectory: join(root, "artifact"), cacheDirectory: join(root, "npm-cache"),
    homeDirectory: join(root, "home"), userConfigPath: join(root, "npmrc"), consumerDirectory: consumer,
    hostWorkingDirectory: join(root, "host-workspace"), probePath: join(root, "probe.mjs"),
    lifecyclePath: join(root, "lifecycle.jsonl"), manifestPath: join(root, "state.json"),
    claudeConfigPath: join(root, "claude.mcp.json"), opencodeConfigPath: join(root, "opencode.json"),
    installedCli: join(consumer, "node_modules", "change-trace-mcp", "dist", "cli.js"),
  };
}

function setInsensitive(target, key, value) {
  for (const existing of Object.keys(target)) if (existing.toUpperCase() === key.toUpperCase()) delete target[existing];
  target[key] = value;
}
export function sanitizeChildEnvironment(source, { cacheDirectory, userConfigPath, homeDirectory, ignoreScripts = true }) {
  const target = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string") continue;
    if (["PATH", "SYSTEMROOT", "COMSPEC", "PATHEXT", "WINDIR", "TEMP", "TMP", "TERM", "LANG", "LC_ALL"].includes(key.toUpperCase()) && !Object.keys(target).some((item) => item.toUpperCase() === key.toUpperCase())) setInsensitive(target, key.toUpperCase() === "PATH" ? "PATH" : key, value);
  }
  setInsensitive(target, "HOME", homeDirectory);
  setInsensitive(target, "USERPROFILE", homeDirectory);
  setInsensitive(target, "NPM_CONFIG_CACHE", cacheDirectory);
  setInsensitive(target, "NPM_CONFIG_USERCONFIG", userConfigPath);
  if (ignoreScripts) setInsensitive(target, "NPM_CONFIG_IGNORE_SCRIPTS", "true");
  setInsensitive(target, "NPM_CONFIG_AUDIT", "false");
  setInsensitive(target, "NPM_CONFIG_FUND", "false");
  setInsensitive(target, "NPM_CONFIG_PACKAGE_LOCK", "false");
  setInsensitive(target, "NO_UPDATE_NOTIFIER", "true");
  return target;
}

export function resolveCliPath(name, suppliedPath, environment = process.env) {
  if (suppliedPath) {
    try { if (isAbsolute(suppliedPath) && lstatSync(suppliedPath).isFile()) return resolve(suppliedPath); } catch { /* fixed error below */ }
    fail("npm_cli_unavailable");
  }
  const candidates = [
    name === "npm" ? environment.npm_execpath : undefined,
    join(dirname(process.execPath), "node_modules", "npm", "bin", `${name}-cli.js`),
    join(dirname(process.execPath), "..", "node_modules", "npm", "bin", `${name}-cli.js`),
    join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", `${name}-cli.js`),
  ].filter(Boolean);
  try { candidates.push(require.resolve(`npm/bin/${name}-cli.js`)); } catch { /* fixed error below */ }
  for (const candidate of candidates) {
    try { if (isAbsolute(candidate) && lstatSync(candidate).isFile()) return resolve(candidate); } catch { /* next */ }
  }
  fail("npm_cli_unavailable");
}
export function parsePack(output, sourcePackage) {
  let rows; try { rows = JSON.parse(output); } catch { fail("pack_result_invalid"); }
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0] || typeof rows[0] !== "object") fail("pack_result_invalid");
  const row = rows[0];
  if (row.name !== sourcePackage.name || row.version !== sourcePackage.version || typeof row.filename !== "string" || basename(row.filename) !== row.filename ||
    !Number.isSafeInteger(row.size) || row.size < 0 || !Number.isSafeInteger(row.unpackedSize) || row.unpackedSize < 0 ||
    !/^[0-9a-f]{40}$/u.test(row.shasum ?? "") || typeof row.integrity !== "string" || !/^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/u.test(row.integrity) ||
    !Array.isArray(row.files) || !row.files.some((file) => file?.path === "dist/cli.js")) fail("pack_result_invalid");
  return { filename: row.filename, packedSize: row.size, unpackedSize: row.unpackedSize, npmShasum: row.shasum, npmIntegrity: row.integrity, fileCount: row.files.length };
}

async function terminateChild(child) {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    const taskkill = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { shell: false, stdio: "ignore", windowsHide: true });
    const completed = await new Promise((resolveTaskkill) => {
      const timer = setTimeout(() => resolveTaskkill(false), TERMINATION_GRACE_MS);
      taskkill.once("close", (code) => { clearTimeout(timer); resolveTaskkill(code === 0); });
      taskkill.once("error", () => { clearTimeout(timer); resolveTaskkill(false); });
    });
    if (!completed) child.kill("SIGKILL");
    return;
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  await new Promise((resolveGrace) => setTimeout(resolveGrace, TERMINATION_GRACE_MS));
  if (child.exitCode !== null || child.signalCode !== null) return;
  try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
}
export async function runBounded(command, args, { cwd, env, timeoutMs = HOST_TIMEOUT_MS, maxOutputBytes = MAX_OUTPUT_BYTES } = {}) {
  if (!isAbsolute(command) || !Array.isArray(args) || args.some((arg) => typeof arg !== "string")) fail("command_plan_invalid");
  return await new Promise((resolveRun, rejectRun) => {
    let stdout = ""; let stderr = ""; let bytes = 0; let stopped = null; let settled = false; let termination = Promise.resolve();
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
    const stop = (code) => { if (stopped) return; stopped = code; termination = terminateChild(child); };
    const timer = setTimeout(() => stop("command_timeout"), timeoutMs);
    const add = (prior, chunk) => { bytes += chunk.length; if (bytes > maxOutputBytes) { stop("command_output_limit"); return prior; } return `${prior}${chunk.toString("utf8")}`; };
    child.stdout.on("data", (chunk) => { stdout = add(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = add(stderr, chunk); });
    child.once("error", () => { if (!settled) { settled = true; clearTimeout(timer); rejectRun(new HarnessError("command_unavailable")); } });
    child.once("close", async (code, signal) => { if (settled) return; await termination; settled = true; clearTimeout(timer); if (stopped) rejectRun(new HarnessError(stopped)); else resolveRun({ exitCode: code, signal, stdout, stderr }); });
  });
}

function hostPrompt(serverName) {
  return `Use only the MCP server ${serverName}. Do not read, write, edit, or inspect any repository files. Call get_compatibility_fixture exactly once with {}. Then return only its text result.`;
}
export function createHostCommand(host, plan, executable) {
  if (!isAbsolute(executable)) fail("host_executable_invalid");
  const prompt = hostPrompt(plan.serverName);
  if (host === "claude") return {
    args: ["--print", "--verbose", "--output-format", "stream-json", "--no-session-persistence", "--mcp-config", plan.claudeConfigPath, "--strict-mcp-config", "--tools", EXPECTED_TOOL_NAMES.map((tool) => `mcp__${plan.serverName}__${tool}`).join(","), "--permission-mode", "dontAsk", prompt],
    environment: { ...process.env },
  };
  if (host === "opencode") return {
    args: ["run", "--format", "json", "--dir", plan.hostWorkingDirectory, prompt],
    environment: { ...process.env, OPENCODE_CONFIG: plan.opencodeConfigPath },
  };
  fail("host_invalid");
}
export function parseHostVersion(host, output) {
  if (!(host in EXPECTED_HOST_VERSIONS) || typeof output !== "string") fail("host_version_invalid");
  const match = output.trim().match(/^(\d+\.\d+\.\d+)(?:\s+\(Claude Code\))?$/u);
  if (!match || match[1] !== EXPECTED_HOST_VERSIONS[host]) fail("host_version_invalid");
  return match[1];
}

function exactlyOne(events, type, code) {
  const matching = events.filter((event) => event?.type === type);
  if (matching.length !== 1) fail(code);
  return matching[0];
}
export function validateLifecycle(events) {
  if (!Array.isArray(events) || events[0]?.type !== "server_started") fail("lifecycle_start_missing");
  const discovery = exactlyOne(events, "tools_list", "tool_discovery_count_invalid");
  if (!Array.isArray(discovery.tools) || !same([...discovery.tools].sort(), EXPECTED_TOOL_NAMES)) fail("tool_discovery_invalid");
  const call = exactlyOne(events, "fixture_call", "fixture_call_count_invalid");
  if (!same(call.arguments, {})) fail("fixture_arguments_invalid");
  const result = exactlyOne(events, "fixture_result", "fixture_result_count_invalid");
  if (result.text !== FIXTURE_TEXT) fail("fixture_result_invalid");
  const close = exactlyOne(events, "server_closed", "lifecycle_shutdown_invalid");
  if (events.at(-1) !== close || close.code !== 0 || close.signal !== null) fail("lifecycle_shutdown_invalid");
  if (events.length !== 5) fail("lifecycle_event_count_invalid");
  return true;
}
export function latestLifecycleSession(events) {
  const session = latestSessionEvents(events);
  validateLifecycle(session);
  return session;
}
export function latestSessionEvents(events) {
  if (!Array.isArray(events)) fail("lifecycle_invalid");
  let session = [];
  for (const event of events) {
    if (event?.type === "server_started") session = [event];
    else if (session.length > 0) session.push(event);
  }
  return session;
}
export function validateAttempt(attempt, artifact) {
  if (!attempt || !["claude", "opencode"].includes(attempt.host) || attempt.hostVersion !== EXPECTED_HOST_VERSIONS[attempt.host]) fail("host_version_invalid");
  if (attempt.artifactSha256 !== artifact.sha256 || attempt.distCliSha256 !== artifact.distCliSha256) fail("artifact_binding_invalid");
  if (attempt.exitCode !== 0 || attempt.observedHostVersion !== attempt.hostVersion || !Number.isSafeInteger(attempt.durationMs) || attempt.durationMs < 0) fail("attempt_exit_invalid");
  if (!/^[0-9a-f]{64}$/u.test(attempt.excerptSha256 ?? "") || !Number.isSafeInteger(attempt.excerptBytes) || attempt.excerptBytes < 0 || attempt.excerptBytes > MAX_EXCERPT_BYTES) fail("attempt_excerpt_invalid");
  validateLifecycle(attempt.lifecycle);
  return true;
}
export function validateCodexHostHeldAttempt(attempt, artifact) {
  if (!attempt || attempt.host !== "codex" || attempt.hostVersion !== EXPECTED_HOST_VERSIONS.codex) fail("host_version_invalid");
  if (attempt.artifactSha256 !== artifact.sha256 || attempt.distCliSha256 !== artifact.distCliSha256) fail("artifact_binding_invalid");
  if (attempt.exitCode !== null || attempt.shutdownDisposition !== "host_held_explicit_cleanup" || !Number.isSafeInteger(attempt.durationMs) || attempt.durationMs < 0 || !Number.isSafeInteger(attempt.mcpDurationMs) || attempt.mcpDurationMs < 0) fail("codex_host_held_invalid");
  const events = attempt.lifecycle;
  if (!Array.isArray(events) || events[0]?.type !== "server_started" || events.some((event) => event?.type === "server_closed")) fail("codex_host_held_invalid");
  const discovery = exactlyOne(events, "tools_list", "codex_host_held_invalid");
  const call = exactlyOne(events, "fixture_call", "codex_host_held_invalid");
  const result = exactlyOne(events, "fixture_result", "codex_host_held_invalid");
  if (!Array.isArray(discovery.tools) || !same([...discovery.tools].sort(), EXPECTED_TOOL_NAMES) || !same(call.arguments, {}) || result.text !== FIXTURE_TEXT || events.length !== 4) fail("codex_host_held_invalid");
  return true;
}
export function normalizeCodexHostHeldAttempt({ threadId, durationMs, mcpDurationMs, lifecycle, artifactSha256, distCliSha256 }, artifact) {
  if (!/^[0-9a-f-]{36}$/u.test(threadId ?? "")) fail("codex_host_held_invalid");
  const attempt = { host: "codex", hostVersion: EXPECTED_HOST_VERSIONS.codex, status: "passed", threadId, artifactSha256, distCliSha256, exitCode: null, durationMs, mcpDurationMs, shutdownDisposition: "host_held_explicit_cleanup", lifecycle };
  validateCodexHostHeldAttempt(attempt, artifact);
  return attempt;
}
export function validateFinalizationState(state) {
  if (!state || !state.artifact || !Array.isArray(state.attempts)) fail("state_invalid");
  const one = (host) => {
    const attempts = state.attempts.filter((attempt) => attempt.host === host && attempt.status === "passed");
    if (attempts.length !== 1) fail("finalization_attempts_invalid");
    return attempts[0];
  };
  validateAttempt(one("claude"), state.artifact);
  validateAttempt(one("opencode"), state.artifact);
  validateCodexHostHeldAttempt(one("codex"), state.artifact);
  return true;
}
export function normalizeAttemptFailure({ host, hostVersion, code, durationMs }) {
  if (!EXPECTED_HOST_VERSIONS[host] || hostVersion !== EXPECTED_HOST_VERSIONS[host] || typeof code !== "string" || !Number.isSafeInteger(durationMs) || durationMs < 0) fail("attempt_failure_invalid");
  return { host, hostVersion, status: "failed", code, durationMs };
}
export async function cleanupStateRoot(stateRoot) { await rm(stateRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 }); }
export function classifyHostFailure(output) {
  const text = output.toLowerCase();
  if (/\b(?:log ?in|sign ?in|authenticate|authentication|2fa|two.factor|browser)\b/u.test(text)) return "authentication_required";
  if (/\btrust(?:ed|ing)?\b/u.test(text)) return "trust_confirmation_required";
  if (/\bprovider\b.*\b(?:select|choose|pick)\b|\b(?:select|choose|pick)\b.*\bprovider\b/u.test(text)) return "provider_selection_required";
  return "host_command_failed";
}

const probeSource = `import { appendFile } from "node:fs/promises"; import { spawn } from "node:child_process";
const [logPath, cliPath, cacheDirectory, userConfigPath, homeDirectory] = process.argv.slice(2);
const keep = new Set(["PATH","SYSTEMROOT","COMSPEC","PATHEXT","WINDIR","TEMP","TMP","TERM","LANG","LC_ALL"]); const env = {}; for (const [key,value] of Object.entries(process.env)) if (typeof value === "string" && keep.has(key.toUpperCase()) && !Object.keys(env).some((item) => item.toUpperCase() === key.toUpperCase())) env[key.toUpperCase()==="PATH"?"PATH":key]=value; env.HOME=homeDirectory; env.USERPROFILE=homeDirectory; env.NPM_CONFIG_CACHE=cacheDirectory; env.NPM_CONFIG_USERCONFIG=userConfigPath; env.NPM_CONFIG_IGNORE_SCRIPTS="true"; env.NPM_CONFIG_AUDIT="false"; env.NPM_CONFIG_FUND="false"; env.NPM_CONFIG_PACKAGE_LOCK="false"; env.NO_UPDATE_NOTIFIER="true";
const log = async (event) => appendFile(logPath, JSON.stringify(event)+"\\n", "utf8"); let incoming=""; let outgoing=""; const methods = new Map(); const child=spawn(process.execPath,[cliPath],{env,shell:false,windowsHide:true,stdio:["pipe","pipe","ignore"]}); await log({type:"server_started"}); process.stdin.on("data",(chunk)=>{ incoming+=chunk.toString("utf8"); let index; while((index=incoming.indexOf("\\n"))>=0){const line=incoming.slice(0,index);incoming=incoming.slice(index+1);try{const item=JSON.parse(line);if(item && typeof item.id!=="undefined" && typeof item.method==="string"){methods.set(String(item.id),item);if(item.method==="tools/call"&&item.params?.name==="get_compatibility_fixture") log({type:"fixture_call",arguments:item.params.arguments});}}catch{}} }); child.stdout.on("data",(chunk)=>{ process.stdout.write(chunk); outgoing+=chunk.toString("utf8"); let index; while((index=outgoing.indexOf("\\n"))>=0){const line=outgoing.slice(0,index);outgoing=outgoing.slice(index+1);try{const item=JSON.parse(line);const request=methods.get(String(item.id));if(request?.method==="tools/list"&&Array.isArray(item.result?.tools)) log({type:"tools_list",tools:item.result.tools.map((tool)=>tool.name).sort()});if(request?.method==="tools/call"&&request.params?.name==="get_compatibility_fixture"){const block=item.result?.content?.find((entry)=>entry?.type==="text"); log({type:"fixture_result",text:block?.text});}}catch{}} }); process.stdin.pipe(child.stdin); process.stdin.on("end",()=>child.stdin.end()); child.on("close",async(code,signal)=>{await log({type:"server_closed",code,signal});process.exitCode=code??1;}); child.on("error",async()=>{await log({type:"server_closed",code:1,signal:null});process.exitCode=1;});`;

async function writeHostConfigs(plan) {
  const command = process.execPath;
  const args = [plan.probePath, plan.lifecyclePath, plan.installedCli, plan.cacheDirectory, plan.userConfigPath, plan.homeDirectory];
  await writeFile(plan.probePath, probeSource, "utf8");
  await chmod(plan.probePath, 0o600);
  await writeFile(plan.claudeConfigPath, JSON.stringify({ mcpServers: { [plan.serverName]: { type: "stdio", command, args } } }), { encoding: "utf8", mode: 0o600 });
  await writeFile(plan.opencodeConfigPath, JSON.stringify({ $schema: "https://opencode.ai/config.json", mcp: { [plan.serverName]: { type: "local", command: [command, ...args], enabled: true, timeout: 10_000 } } }), { encoding: "utf8", mode: 0o600 });
}
async function readEvents(plan) {
  try { return (await readFile(plan.lifecyclePath, "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)); } catch { return []; }
}
async function resetLifecycle(plan) { await writeFile(plan.lifecyclePath, "", { encoding: "utf8", mode: 0o600 }); }
function assertSafeStateRoot(stateRoot) {
  const resolved = resolve(stateRoot);
  if (isWithin(repositoryRoot, resolved) || dirname(resolved) !== resolve(tmpdir()) || !basename(resolved).startsWith("change-trace-m7-real-")) fail("state_root_invalid");
  return resolved;
}
function checkpointConfigPath(root = repositoryRoot) { return join(root, ".codex", "config.toml"); }
export function checkpointContent(plan) {
  const args = [plan.probePath, plan.lifecyclePath, plan.installedCli, plan.cacheDirectory, plan.userConfigPath, plan.homeDirectory].map((value) => JSON.stringify(value)).join(", ");
  return `[mcp_servers.${plan.serverName}]\ncommand = ${JSON.stringify(process.execPath)}\nargs = [${args}]\nrequired = true\nstartup_timeout_sec = 10\ntool_timeout_sec = 60\nenabled_tools = ${JSON.stringify(EXPECTED_TOOL_NAMES)}\n`;
}
export async function finalizeState({ stateRoot, repositoryRoot: sourceRoot = repositoryRoot, configPath = checkpointConfigPath(sourceRoot) }) {
  const safeRoot = assertSafeStateRoot(stateRoot);
  if (resolve(configPath) !== resolve(checkpointConfigPath(sourceRoot))) fail("checkpoint_config_invalid");
  const state = JSON.parse(await readFile(join(safeRoot, "state.json"), "utf8"));
  const plan = createHostPlan({ repositoryRoot: sourceRoot, stateRoot: safeRoot, serverName: state.serverName });
  if (!state.artifact || !/^[0-9a-f]{64}$/u.test(state.artifact.sha256 ?? "") || !/^[0-9a-f]{64}$/u.test(state.artifact.distCliSha256 ?? "")) fail("state_invalid");
  validateFinalizationState(state);
  let config;
  try { config = await readFile(configPath, "utf8"); } catch { fail("checkpoint_config_missing"); }
  if (config !== checkpointContent(plan)) fail("checkpoint_config_mismatch");
  await rm(configPath, { force: true });
  await cleanupStateRoot(safeRoot);
  try { await access(safeRoot); fail("cleanup_failed"); } catch (error) { if (error instanceof HarnessError) throw error; }
  return { ok: true, action: "finalize", serverName: state.serverName, artifactSha256: state.artifact.sha256, cleanup: true };
}
export async function recordCodexHeld({ stateRoot, threadId, durationMs, mcpDurationMs, repositoryRoot: sourceRoot = repositoryRoot }) {
  const safeRoot = assertSafeStateRoot(stateRoot);
  const state = JSON.parse(await readFile(join(safeRoot, "state.json"), "utf8"));
  const plan = createHostPlan({ repositoryRoot: sourceRoot, stateRoot: safeRoot, serverName: state.serverName });
  if (!state.artifact || !Array.isArray(state.attempts) || state.attempts.some((attempt) => attempt.host === "codex")) fail("codex_record_invalid");
  const lifecycle = latestSessionEvents(await readEvents(plan));
  const attempt = normalizeCodexHostHeldAttempt({ threadId, durationMs, mcpDurationMs, lifecycle, artifactSha256: state.artifact.sha256, distCliSha256: state.artifact.distCliSha256 }, state.artifact);
  state.attempts.push(attempt); state.status = "codex_recorded";
  await writeFile(plan.manifestPath, JSON.stringify(state, null, 2), "utf8");
  return { ok: true, action: "record-codex-held", threadId, artifactSha256: attempt.artifactSha256, shutdownDisposition: attempt.shutdownDisposition };
}
async function prepare() {
  const sourcePackage = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
  const stateRoot = await mkdtemp(join(tmpdir(), "change-trace-m7-real-"));
  const serverName = `m7real_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const plan = createHostPlan({ repositoryRoot, stateRoot, serverName });
  const npm = resolveCliPath("npm"); const env = sanitizeChildEnvironment(process.env, plan); const packEnvironment = sanitizeChildEnvironment(process.env, { ...plan, ignoreScripts: false });
  try {
    await Promise.all([mkdir(plan.artifactDirectory), mkdir(plan.cacheDirectory), mkdir(plan.consumerDirectory), mkdir(plan.hostWorkingDirectory), mkdir(plan.homeDirectory)]);
    await writeFile(plan.userConfigPath, "", { encoding: "utf8", mode: 0o600 });
    const packed = parsePack((await runBounded(process.execPath, [npm, "pack", "--json", "--pack-destination", plan.artifactDirectory], { cwd: repositoryRoot, env: packEnvironment })).stdout, sourcePackage);
    const tarball = join(plan.artifactDirectory, packed.filename); if (!isWithin(plan.artifactDirectory, tarball)) fail("tarball_path_invalid");
    const sha256 = hash(await readFile(tarball));
    await writeFile(join(plan.consumerDirectory, "package.json"), JSON.stringify({ name: "m7-real-host-consumer", private: true, version: "1.0.0" }), "utf8");
    await runBounded(process.execPath, [npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", "--cache", plan.cacheDirectory, "--userconfig", plan.userConfigPath, tarball], { cwd: plan.consumerDirectory, env });
    await runBounded(process.execPath, [npm, "ls", "--omit=dev", "--json", "--no-audit", "--no-fund", "--userconfig", plan.userConfigPath], { cwd: plan.consumerDirectory, env });
    const installed = await lstat(join(plan.consumerDirectory, "node_modules", sourcePackage.name)); if (installed.isSymbolicLink()) fail("installed_package_linked");
    const installedReal = await realpath(join(plan.consumerDirectory, "node_modules", sourcePackage.name)); if (!isWithin(plan.consumerDirectory, installedReal) || isWithin(repositoryRoot, installedReal)) fail("installed_package_location_invalid");
    await access(plan.installedCli);
    const artifact = { package: sourcePackage.name, version: sourcePackage.version, sha256, distCliSha256: hash(await readFile(plan.installedCli)), ...packed };
    await writeHostConfigs(plan);
    const state = { schemaVersion: "1.0.0", status: "prepared", serverName, artifact, attempts: [], environmentPolicy: { npmAndMcpChild: "sanitized_allowlist", lifecycleScripts: "disabled" } };
    await writeFile(plan.manifestPath, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ ok: true, stateRoot, serverName, artifact })}\n`);
  } catch (error) { await cleanupStateRoot(stateRoot); throw error; }
}
async function runHost(host, stateRoot) {
  const state = JSON.parse(await readFile(join(stateRoot, "state.json"), "utf8")); const plan = createHostPlan({ repositoryRoot, stateRoot, serverName: state.serverName });
  const executable = host === "claude" ? process.env.CHANGE_TRACE_CLAUDE_EXECUTABLE : process.env.CHANGE_TRACE_OPENCODE_EXECUTABLE;
  if (!executable) fail("host_executable_required");
  await resetLifecycle(plan);
  const command = createHostCommand(host, plan, executable); const started = Date.now();
  let observedHostVersion;
  try { observedHostVersion = parseHostVersion(host, (await runBounded(executable, ["--version"], { cwd: plan.hostWorkingDirectory, env: command.environment, timeoutMs: 10_000, maxOutputBytes: 1024 })).stdout); } catch (error) {
    state.attempts.push(normalizeAttemptFailure({ host, hostVersion: EXPECTED_HOST_VERSIONS[host], code: error instanceof HarnessError ? error.code : "host_version_invalid", durationMs: Date.now() - started }));
    await writeFile(plan.manifestPath, JSON.stringify(state, null, 2), "utf8"); throw error;
  }
  let result; try { result = await runBounded(executable, command.args, { cwd: plan.hostWorkingDirectory, env: command.environment }); } catch (error) {
    state.attempts.push(normalizeAttemptFailure({ host, hostVersion: EXPECTED_HOST_VERSIONS[host], code: error instanceof HarnessError ? error.code : "command_failed", durationMs: Date.now() - started }));
    await writeFile(plan.manifestPath, JSON.stringify(state, null, 2), "utf8"); throw error;
  }
  const rawOutput = `${result.stdout}\n${result.stderr}`.slice(0, MAX_OUTPUT_BYTES);
  const attemptIndex = state.attempts.filter((attempt) => attempt.host === host).length + 1;
  await writeFile(join(plan.stateRoot, `${host}-attempt-${attemptIndex}.raw.log`), rawOutput, { encoding: "utf8", mode: 0o600 });
  const lifecycle = latestLifecycleSession(await readEvents(plan)); const excerpt = result.stdout.slice(0, MAX_EXCERPT_BYTES);
  const attempt = { host, hostVersion: EXPECTED_HOST_VERSIONS[host], observedHostVersion, status: "passed", artifactSha256: state.artifact.sha256, distCliSha256: state.artifact.distCliSha256, exitCode: result.exitCode, durationMs: Date.now() - started, lifecycle, excerptSha256: hash(excerpt), excerptBytes: Buffer.byteLength(excerpt) };
  try { validateAttempt(attempt, state.artifact); } catch (error) { state.attempts.push(normalizeAttemptFailure({ host, hostVersion: EXPECTED_HOST_VERSIONS[host], code: result.exitCode === 0 ? error.code ?? "evidence_invalid" : classifyHostFailure(rawOutput), durationMs: attempt.durationMs })); await writeFile(plan.manifestPath, JSON.stringify(state, null, 2), "utf8"); throw error; }
  state.attempts.push(attempt); await writeFile(plan.manifestPath, JSON.stringify(state, null, 2), "utf8"); process.stdout.write(`${JSON.stringify({ ok: true, host, artifactSha256: attempt.artifactSha256, durationMs: attempt.durationMs })}\n`);
}
async function checkpoint(stateRoot) {
  const state = JSON.parse(await readFile(join(stateRoot, "state.json"), "utf8"));
  if (!state.attempts.some((attempt) => attempt.host === "claude" && attempt.status === "passed") || !state.attempts.some((attempt) => attempt.host === "opencode" && attempt.status === "passed")) fail("checkpoint_hosts_incomplete");
  const plan = createHostPlan({ repositoryRoot, stateRoot, serverName: state.serverName });
  await resetLifecycle(plan);
  const configPath = checkpointConfigPath(); await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, checkpointContent(plan), { encoding: "utf8", mode: 0o600 });
  state.status = "codex_checkpoint"; await writeFile(plan.manifestPath, JSON.stringify(state, null, 2), "utf8"); process.stdout.write(`${JSON.stringify({ ok: true, serverName: state.serverName, pendingHost: "codex" })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [action, stateRoot] = process.argv.slice(2);
  try { if (action === "prepare") await prepare(); else if ((action === "run-claude" || action === "run-opencode") && stateRoot) await runHost(action === "run-claude" ? "claude" : "opencode", stateRoot); else if (action === "checkpoint" && stateRoot) await checkpoint(stateRoot); else if (action === "record-codex-held" && stateRoot) { const [threadId, duration, mcpDuration] = process.argv.slice(4); process.stdout.write(`${JSON.stringify(await recordCodexHeld({ stateRoot, threadId, durationMs: Number(duration), mcpDurationMs: Number(mcpDuration) }))}\n`); } else if (action === "finalize" && stateRoot) process.stdout.write(`${JSON.stringify(await finalizeState({ stateRoot }))}\n`); else fail("usage"); }
  catch (error) { process.stderr.write(`${JSON.stringify({ ok: false, code: error instanceof HarnessError ? error.code : "harness_failed" })}\n`); process.exitCode = 1; }
}
