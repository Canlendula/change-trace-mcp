import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

// @ts-expect-error -- repository-only JavaScript helper intentionally has no declaration file.
import { summarizeObservation, validateObservation } from "../../scripts/pilot/summarize-pilot.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const script = join(root, "scripts", "pilot", "summarize-pilot.mjs");
const fixture = join(root, "docs", "pilot", "fixtures", "mechanics-baseline.json");
const expected = join(root, "docs", "pilot", "fixtures", "mechanics-summary.json");

async function fixtureObservation(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(fixture, "utf8")) as Record<string, unknown>;
}

async function run(...arguments_: string[]): Promise<{ stdout: string; stderr: string }> {
  return await execFileAsync(process.execPath, [script, ...arguments_], { cwd: root });
}

describe("pilot baseline metrics", () => {
  it("reproduces the canonical mechanics summary exactly", async () => {
    const [actual, expectedText] = await Promise.all([run(fixture), readFile(expected, "utf8")]);
    expect(actual.stderr).toBe("");
    expect(actual.stdout).toBe(`${expectedText.trim()}\n`);
    expect(summarizeObservation(await fixtureObservation())).toEqual(JSON.parse(expectedText));
  });

  it("uses deterministic medians, all-attempt success denominators, and unfrozen qualification", async () => {
    const summary = summarizeObservation(await fixtureObservation());
    expect(summary.qualification).toMatchObject({ teamCount: 3, observationWeekMinimum: 2, qualified: false });
    expect(summary.runs).toMatchObject({ attempted: 6, successful: 2, failed: 2, inconclusive: 1, successfulRate: { numerator: 2, denominator: 6 } });
    expect(summary.runs.successfulDurationMedianMs).toBe(150);
    expect(summary.findings).toMatchObject({ total: 6, unreviewed: 3, inconclusiveRuns: 1 });
    expect(summary.thresholds).toEqual({ status: "unfrozen" });
  });

  it("uses null ratios and medians when their frozen denominators have no values", async () => {
    const observation = await fixtureObservation();
    const teams = observation.teams as Array<Record<string, unknown>>;
    const runs = observation.runs as Array<Record<string, unknown>>;
    for (const team of teams) {
      team.setupElapsedMs = null;
      team.advisoryEnabledAtEnd = null;
    }
    for (const run of runs) {
      run.outcome = "completed_no_findings";
      run.schemaCompatible = false;
      run.findings = { total: 0, validEvidenceReferences: 0, acceptedConfirmed: 0, dismissedFalsePositive: 0, inconclusive: 0, unreviewed: 0 };
    }
    const summary = summarizeObservation(observation);
    expect(summary.runs.successfulRate).toEqual({ numerator: 0, denominator: 6, value: 0 });
    expect(summary.runs.successfulDurationMedianMs).toBeNull();
    expect(summary.setup).toEqual({ observedTeams: 0, missingTeams: 3, medianMs: null });
    expect(summary.findings.validEvidenceReferencesRate).toEqual({ numerator: 0, denominator: 0, value: null });
    expect(summary.retention.enabledRate).toEqual({ numerator: 0, denominator: 0, value: null });
  });

  it("rejects duplicate identities, dangling team references, privacy expansion, contradictions, and consent changes", async () => {
    const duplicate = await fixtureObservation();
    (duplicate.runs as Array<Record<string, unknown>>)[1]!.runId = "run-001";
    expect(() => validateObservation(duplicate)).toThrow("observation_invalid");
    const dangling = await fixtureObservation();
    (dangling.runs as Array<Record<string, unknown>>)[0]!.teamId = "team-missing";
    expect(() => validateObservation(dangling)).toThrow("observation_invalid");
    const privacy = await fixtureObservation();
    (privacy.teams as Array<Record<string, unknown>>)[0]!.note = "confidential-product-content";
    expect(() => validateObservation(privacy)).toThrow("observation_invalid");
    const contradictory = await fixtureObservation();
    ((contradictory.runs as Array<Record<string, unknown>>)[0]!.findings as Record<string, unknown>).total = 0;
    expect(() => validateObservation(contradictory)).toThrow("observation_invalid");
    const consent = await fixtureObservation();
    (consent.teams as Array<Record<string, unknown>>)[0]!.consentRecorded = false;
    expect(() => validateObservation(consent)).toThrow("observation_invalid");
  });

  it("keeps the Draft 2020-12 document strict and aligned with the fixed vocabulary", async () => {
    const schema = JSON.parse(await readFile(join(root, "docs", "pilot", "pilot-observation.schema.json"), "utf8")) as Record<string, unknown>;
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.additionalProperties).toBe(false);
    const definitions = schema.$defs as Record<string, Record<string, unknown>>;
    expect(definitions.safeId).toMatchObject({ minLength: 1, maxLength: 160, pattern: "^[A-Za-z0-9][A-Za-z0-9._:/-]*$" });
    expect((definitions.team! as Record<string, unknown>).properties).toMatchObject({ consentRecorded: { const: true } });
    expect((definitions.run! as Record<string, unknown>).properties).toMatchObject({ hostFamily: { enum: ["codex", "claude_code", "opencode", "other"] } });
  });

  it("requires exactly one safe file and does not disclose supplied content in errors", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "change-trace-pilot-metrics-"));
    try {
      const malformed = join(temporary, "confidential-product-content.json");
      await writeFile(malformed, "{bad", "utf8");
      const trailing = join(temporary, "trailing.json");
      await writeFile(trailing, "{} trailing", "utf8");
      await expect(run()).rejects.toMatchObject({ stderr: expect.stringContaining('"usage_invalid"') });
      await expect(run(malformed, fixture)).rejects.toMatchObject({ stderr: expect.stringContaining('"usage_invalid"') });
      await expect(run(malformed)).rejects.toMatchObject({ stderr: expect.stringContaining('"input_json_invalid"') });
      await expect(run(trailing)).rejects.toMatchObject({ stderr: expect.stringContaining('"input_json_invalid"') });
      try { await run(malformed); } catch (error) {
        const result = error as { stderr?: string };
        expect(result.stderr).not.toContain("confidential-product-content");
        expect(result.stderr).not.toContain(malformed);
      }
      const bom = join(temporary, "bom.json");
      await writeFile(bom, Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]));
      await expect(run(bom)).rejects.toMatchObject({ stderr: expect.stringContaining('"input_unsafe"') });
      const invalidUtf8 = join(temporary, "invalid.json");
      await writeFile(invalidUtf8, Buffer.from([0xc3, 0x28]));
      await expect(run(invalidUtf8)).rejects.toMatchObject({ stderr: expect.stringContaining('"input_encoding_invalid"') });
      const oversized = join(temporary, "oversized.json");
      await writeFile(oversized, Buffer.alloc(5 * 1024 * 1024 + 1));
      await expect(run(oversized)).rejects.toMatchObject({ stderr: expect.stringContaining('"input_unsafe"') });
      const directory = join(temporary, "directory");
      await mkdir(directory);
      await expect(run(directory)).rejects.toMatchObject({ stderr: expect.stringContaining('"input_unsafe"') });
      const link = join(temporary, "link.json");
      await symlink(fixture, link, "file");
      await expect(run(link)).rejects.toMatchObject({ stderr: expect.stringContaining('"input_unsafe"') });
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
