import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  REPLAY_INSTRUCTION_VERSION,
  REPLAY_SCHEMA_VERSION,
  MAX_REPLAY_CAPTURE_BYTES,
  buildReplayRunOutput,
  canonicalReplayStringify,
  loadReplayBundles,
  parseReplayCaptureSet,
  prepareReplayPackets,
  summarizeReplayRun,
} from "../helpers/review-replay.js";
import {
  EXPECTED_FIXTURE_IDS,
  discoverReviewFixtures,
  loadReviewFixture,
  type LoadedReviewFixture,
} from "../helpers/review-fixture.js";

const reviewRoot = fileURLToPath(new URL("../fixtures/review", import.meta.url));
let fixtures: LoadedReviewFixture[];

beforeAll(async () => {
  fixtures = await Promise.all(
    (await discoverReviewFixtures(reviewRoot)).map(loadReviewFixture),
  );
});

async function temporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function writeReferenceCaptures(directory: string): Promise<void> {
  for (const fixture of fixtures) {
    await writeFile(
      join(directory, `${fixture.descriptor.fixtureId}.json`),
      `${JSON.stringify({
        schemaVersion: REPLAY_SCHEMA_VERSION,
        fixtureId: fixture.descriptor.fixtureId,
        findings: fixture.referenceFindings,
      })}\n`,
      "utf8",
    );
  }
}

describe("review replay packets", () => {
  it("produces nine byte-stable packets from bundle data only", async () => {
    const bundles = await loadReplayBundles(reviewRoot);
    const first = prepareReplayPackets(bundles);
    const second = prepareReplayPackets([...bundles].reverse());

    expect(first).toHaveLength(EXPECTED_FIXTURE_IDS.length);
    expect(canonicalReplayStringify(first)).toBe(canonicalReplayStringify(second));
    expect(first.map((packet) => packet.fixtureId)).toEqual(
      [...EXPECTED_FIXTURE_IDS].sort(),
    );
    for (const packet of first) {
      expect(packet.schemaVersion).toBe(REPLAY_SCHEMA_VERSION);
      expect(packet.instructionVersion).toBe(REPLAY_INSTRUCTION_VERSION);
      expect(packet.bundleSha256).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(packet.instruction).toContain("no tool calls or external lookups");
      expect(packet.instruction).toContain("untrusted data");
      expect(packet.instruction).toContain("inconclusive");
      expect(packet.responseContract).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "fixtureId", "findings"],
      });
      const findingItems = packet.responseContract.properties.findings.items as {
        required?: string[];
        additionalProperties?: boolean;
      };
      expect(findingItems.required).toEqual(
        expect.arrayContaining([
          "schemaVersion",
          "id",
          "category",
          "deterministicFacts",
          "inference",
          "affectedSources",
          "status",
        ]),
      );
      expect(findingItems.additionalProperties).toBe(false);
    }
  });

  it("does not leak expected outcomes, rationale, or reference findings into packets", async () => {
    const packets = prepareReplayPackets(await loadReplayBundles(reviewRoot));
    const serialized = canonicalReplayStringify(packets);
    for (const fixture of fixtures) {
      expect(serialized).not.toContain(fixture.expected.rationale);
      for (const finding of fixture.referenceFindings) {
        expect(serialized).not.toContain(finding.title);
        expect(serialized).not.toContain(finding.inference);
      }
      expect(serialized).not.toContain(`\"outcome\":\"${fixture.expected.outcome}\"`);
    }
  });
});

describe("replay capture parsing and scoring output", () => {
  it("requires the exact strict capture set while preserving untrusted findings", async () => {
    const directory = await temporaryDirectory("change-trace-replay-captures-");
    try {
      await writeReferenceCaptures(directory);
      const captures = await parseReplayCaptureSet(directory);
      expect(Object.keys(captures).sort()).toEqual([...EXPECTED_FIXTURE_IDS].sort());
      expect(captures["requirement-missing"]).toEqual(
        fixtures.find((fixture) => fixture.descriptor.fixtureId === "requirement-missing")?.referenceFindings,
      );

      await writeFile(join(directory, "extra.json"), "{}\n", "utf8");
      await expect(parseReplayCaptureSet(directory)).rejects.toThrow(/Unexpected capture file extra.json/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed, mismatched, missing, and symbolic-link captures", async () => {
    const directory = await temporaryDirectory("change-trace-replay-invalid-");
    try {
      await writeReferenceCaptures(directory);
      await writeFile(join(directory, "implemented-correctly.json"), "[]\n", "utf8");
      await expect(parseReplayCaptureSet(directory)).rejects.toThrow(/strict JSON object/);

      await writeReferenceCaptures(directory);
      const id = "implemented-correctly";
      await writeFile(join(directory, `${id}.json`), `${JSON.stringify({ schemaVersion: REPLAY_SCHEMA_VERSION, fixtureId: id, findings: [], extra: true })}\n`, "utf8");
      await expect(parseReplayCaptureSet(directory)).rejects.toThrow(/Invalid replay capture/);

      await writeFile(join(directory, `${id}.json`), `${JSON.stringify({ schemaVersion: REPLAY_SCHEMA_VERSION, fixtureId: "wrong", findings: [] })}\n`, "utf8");
      await expect(parseReplayCaptureSet(directory)).rejects.toThrow(/fixtureId must match filename/);

      await rm(join(directory, "stale-documentation.json"));
      await expect(parseReplayCaptureSet(directory)).rejects.toThrow(/Missing capture file stale-documentation.json/);

      await writeFile(join(directory, "stale-documentation.json"), "{}\n", "utf8");
      await mkdir(join(directory, "nested"));
      await expect(parseReplayCaptureSet(directory)).rejects.toThrow(/Unexpected capture directory nested/);
      await rm(join(directory, "nested"), { recursive: true });
      await rm(join(directory, "stale-documentation.json"));
      await symlink(join(directory, "implemented-correctly.json"), join(directory, "stale-documentation.json"), "file");
      await expect(parseReplayCaptureSet(directory)).rejects.toThrow(/Unexpected capture symbolic link stale-documentation.json/);

      await rm(join(directory, "stale-documentation.json"));
      await writeFile(
        join(directory, "implemented-correctly.json"),
        '{"schemaVersion":"1.0.0","fixtureId":"implemented-correctly","findings":[]}\n',
        "utf8",
      );
      await writeFile(
        join(directory, "stale-documentation.json"),
        " ".repeat(MAX_REPLAY_CAPTURE_BYTES + 1),
        "utf8",
      );
      await expect(parseReplayCaptureSet(directory)).rejects.toThrow(/exceeds 8000000 bytes/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("builds bounded deterministic run output and a prose-free summary", async () => {
    const directory = await temporaryDirectory("change-trace-replay-score-");
    try {
      await writeReferenceCaptures(directory);
      const captures = await parseReplayCaptureSet(directory);
      const output = buildReplayRunOutput(fixtures, captures, {
        hostId: "host-test",
        hostVersion: "1.2.3",
        model: "test-model",
      });
      const repeated = buildReplayRunOutput([...fixtures].reverse(), captures, {
        model: "test-model",
        hostVersion: "1.2.3",
        hostId: "host-test",
      });
      expect(canonicalReplayStringify(output)).toBe(canonicalReplayStringify(repeated));
      expect(output.suiteScore.passed).toBe(true);
      expect(canonicalReplayStringify(output)).not.toContain("Fabricated critical security finding");
      const summary = summarizeReplayRun(output);
      expect(summary).toContain("host-test");
      expect(summary).toContain("Suite: PASS");
      expect(summary).toContain("fixturesPassed");
      expect(summary).not.toContain("Fabricated critical security finding");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("passes raw malformed and fabricated findings unchanged to the accepted scorer", async () => {
    const directory = await temporaryDirectory("change-trace-replay-untrusted-");
    try {
      await writeReferenceCaptures(directory);
      const target = fixtures.find((fixture) => fixture.descriptor.fixtureId === "requirement-missing");
      if (!target) {
        throw new Error("Missing requirement-missing fixture");
      }
      await writeFile(
        join(directory, "requirement-missing.json"),
        `${JSON.stringify({
          schemaVersion: REPLAY_SCHEMA_VERSION,
          fixtureId: "requirement-missing",
          findings: ["schema-invalid", {
            ...target.referenceFindings[0],
            id: "finding:malicious-fabrication",
            title: "Fabricated critical security finding",
            inference: "This fabricated finding is untrusted.",
            category: "security",
          }],
        })}\n`,
        "utf8",
      );
      const output = buildReplayRunOutput(fixtures, await parseReplayCaptureSet(directory), {
        hostId: "host-test",
        hostVersion: "1",
        model: "model",
      });
      const score = output.suiteScore.fixtures.find((fixture) => fixture.fixtureId === "requirement-missing");
      expect(score).toMatchObject({
        passed: false,
        validation: { rejected: 1 },
        failureCodes: expect.arrayContaining([
          "finding_validation_failed",
          "required_match_missing",
        ]),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
