import { lstat, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_ID_LENGTH = 160;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u;
const PROFILES = ["repository_documents", "external_requirements", "runtime_staging"];
const HOST_FAMILIES = ["codex", "claude_code", "opencode", "other"];
const OUTCOMES = ["completed_findings", "completed_no_findings", "inconclusive", "failed_setup", "failed_host", "failed_validation"];
const COMPLETED = new Set(["completed_findings", "completed_no_findings"]);
const FAILED = new Set(["failed_setup", "failed_host", "failed_validation"]);

class PilotError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new PilotError(code);
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("observation_invalid");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail("observation_invalid");
}

function boundedId(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= MAX_ID_LENGTH && SAFE_ID.test(value);
}

function boundedVersion(value) {
  return boundedId(value);
}

function integerInRange(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function ratio(numerator, denominator) {
  return { numerator, denominator, value: denominator === 0 ? null : numerator / denominator };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function validateFindings(findings) {
  exactKeys(findings, ["total", "validEvidenceReferences", "acceptedConfirmed", "dismissedFalsePositive", "inconclusive", "unreviewed"]);
  for (const value of Object.values(findings)) if (!integerInRange(value, 0, 10_000)) fail("observation_invalid");
  const { total, validEvidenceReferences, acceptedConfirmed, dismissedFalsePositive, inconclusive, unreviewed } = findings;
  if (validEvidenceReferences > total || acceptedConfirmed > total || dismissedFalsePositive > total || inconclusive > total || unreviewed > total) fail("observation_invalid");
  if (acceptedConfirmed + dismissedFalsePositive + inconclusive + unreviewed !== total) fail("observation_invalid");
}

export function validateObservation(observation) {
  exactKeys(observation, ["schemaVersion", "pilotId", "teams", "runs"]);
  if (observation.schemaVersion !== "1.0.0" || !boundedId(observation.pilotId) || !Array.isArray(observation.teams) || !Array.isArray(observation.runs) || observation.teams.length < 1 || observation.teams.length > 50 || observation.runs.length < 1 || observation.runs.length > 10_000) fail("observation_invalid");
  const teamIds = new Set();
  for (const team of observation.teams) {
    exactKeys(team, ["teamId", "profile", "setupElapsedMs", "observationWeeks", "advisoryEnabledAtEnd", "consentRecorded"]);
    if (!boundedId(team.teamId) || teamIds.has(team.teamId) || !PROFILES.includes(team.profile) || !(team.setupElapsedMs === null || integerInRange(team.setupElapsedMs, 0, 604_800_000)) || !integerInRange(team.observationWeeks, 0, 52) || !(typeof team.advisoryEnabledAtEnd === "boolean" || team.advisoryEnabledAtEnd === null) || team.consentRecorded !== true) fail("observation_invalid");
    teamIds.add(team.teamId);
  }
  const runIds = new Set();
  for (const run of observation.runs) {
    exactKeys(run, ["runId", "teamId", "hostFamily", "hostVersion", "instructionVersion", "outcome", "durationMs", "contextCharacters", "evidenceItemCount", "schemaCompatible", "findings"]);
    if (!boundedId(run.runId) || runIds.has(run.runId) || !teamIds.has(run.teamId) || !HOST_FAMILIES.includes(run.hostFamily) || !boundedVersion(run.hostVersion) || !boundedVersion(run.instructionVersion) || !OUTCOMES.includes(run.outcome) || !integerInRange(run.durationMs, 0, 86_400_000) || !integerInRange(run.contextCharacters, 0, 10_000_000) || !integerInRange(run.evidenceItemCount, 0, 10_000) || typeof run.schemaCompatible !== "boolean") fail("observation_invalid");
    validateFindings(run.findings);
    if ((run.outcome === "completed_no_findings" && run.findings.total !== 0) || (run.outcome === "completed_findings" && run.findings.total === 0) || (!COMPLETED.has(run.outcome) && run.findings.total !== 0)) fail("observation_invalid");
    runIds.add(run.runId);
  }
  return observation;
}

export function summarizeObservation(input) {
  const observation = validateObservation(input);
  const teams = observation.teams;
  const runs = observation.runs;
  const successful = runs.filter((run) => COMPLETED.has(run.outcome) && run.schemaCompatible);
  const failed = runs.filter((run) => FAILED.has(run.outcome));
  const inconclusiveRuns = runs.filter((run) => run.outcome === "inconclusive");
  const setupValues = teams.flatMap((team) => team.setupElapsedMs === null ? [] : [team.setupElapsedMs]);
  const profiles = [...new Set(teams.map((team) => team.profile))].sort();
  const totalFindings = runs.reduce((total, run) => total + run.findings.total, 0);
  const validEvidenceReferences = runs.reduce((total, run) => total + run.findings.validEvidenceReferences, 0);
  const acceptedConfirmed = runs.reduce((total, run) => total + run.findings.acceptedConfirmed, 0);
  const dismissedFalsePositive = runs.reduce((total, run) => total + run.findings.dismissedFalsePositive, 0);
  const inconclusiveFindings = runs.reduce((total, run) => total + run.findings.inconclusive, 0);
  const unreviewed = runs.reduce((total, run) => total + run.findings.unreviewed, 0);
  const dispositioned = acceptedConfirmed + dismissedFalsePositive + inconclusiveFindings;
  const enabledTeams = teams.filter((team) => team.advisoryEnabledAtEnd === true).length;
  const disabledTeams = teams.filter((team) => team.advisoryEnabledAtEnd === false).length;
  const missingTeams = teams.length - enabledTeams - disabledTeams;
  const compatibleRuns = runs.filter((run) => run.schemaCompatible).length;
  const durationMinimum = Math.min(...teams.map((team) => team.observationWeeks));
  const teamCountQualified = teams.length >= 3 && teams.length <= 5;
  const durationQualified = durationMinimum >= 3;
  const profileCoverageQualified = PROFILES.every((profile) => profiles.includes(profile));
  return {
    schemaVersion: "1.0.0",
    pilotId: observation.pilotId,
    evidence: "mechanics-or-real-bounded-observation",
    qualification: {
      teamCount: teams.length,
      observationWeekMinimum: durationMinimum,
      presentProfiles: profiles,
      teamCountQualified,
      durationQualified,
      profileCoverageQualified,
      qualified: teamCountQualified && durationQualified && profileCoverageQualified,
    },
    runs: {
      attempted: runs.length,
      successful: successful.length,
      failed: failed.length,
      inconclusive: inconclusiveRuns.length,
      successfulRate: ratio(successful.length, runs.length),
      successfulDurationMedianMs: median(successful.map((run) => run.durationMs)),
      successfulContextCharactersMedian: median(successful.map((run) => run.contextCharacters)),
      successfulEvidenceItemCountMedian: median(successful.map((run) => run.evidenceItemCount)),
    },
    setup: { observedTeams: setupValues.length, missingTeams: teams.length - setupValues.length, medianMs: median(setupValues) },
    findings: {
      total: totalFindings,
      unreviewed,
      validEvidenceReferencesRate: ratio(validEvidenceReferences, totalFindings),
      acceptedConfirmedRate: ratio(acceptedConfirmed, dispositioned),
      dismissedFalsePositiveRate: ratio(dismissedFalsePositive, dispositioned),
      inconclusiveRate: ratio(inconclusiveFindings, totalFindings),
      inconclusiveRuns: inconclusiveRuns.length,
    },
    retention: { enabledTeams, disabledTeams, missingTeams, enabledRate: ratio(enabledTeams, enabledTeams + disabledTeams) },
    crossHostSchema: { eligibleRuns: runs.length, compatibleRuns, compatibilityRate: ratio(compatibleRuns, runs.length), hostFamilies: [...new Set(runs.map((run) => run.hostFamily))].sort() },
    thresholds: { status: "unfrozen" },
  };
}

async function readObservation(path) {
  let stat;
  try { stat = await lstat(path); } catch { fail("input_unavailable"); }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_INPUT_BYTES) fail("input_unsafe");
  let bytes;
  try { bytes = await readFile(path); } catch { fail("input_unavailable"); }
  if (bytes.length > MAX_INPUT_BYTES || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) fail("input_unsafe");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); } catch { fail("input_encoding_invalid"); }
  try { return JSON.parse(text); } catch { fail("input_json_invalid"); }
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length !== 1 || arguments_[0] === undefined) fail("usage_invalid");
  process.stdout.write(`${JSON.stringify(summarizeObservation(await readObservation(arguments_[0])))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = error instanceof PilotError ? error.code : "summary_failed";
    process.stderr.write(`${JSON.stringify({ schemaVersion: "1.0.0", ok: false, code })}\n`);
    process.exitCode = 1;
  });
}
