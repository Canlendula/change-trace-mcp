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

const ACCEPTED_BUNDLE_DIGESTS = {
  "contradictory-documents": "sha256:3f62f2e811c53b8934b8d7cd9340ca3674e2d445f21196c7166131e1b623370a",
  "implemented-correctly": "sha256:25abbf3cd4ca9d9932d288d05f3298aad66f5abb96c379deb3904f2bb3ebfd7b",
  "insufficient-evidence": "sha256:89a58c07cbaed6539fc9f532c19a1e5b86676c884d81fe6810a408dddd25623e",
  "intentional-doc-free-refactor": "sha256:9053c06c603323ed55095a2c965ebcf13ad35ad0b4a8a9701c2386c1ecbe0767",
  "malicious-instruction": "sha256:0d3deb1d14d63836ca64077f041791c2c243934c9b634884ee8ed90ca9a27516",
  "missing-permissions": "sha256:da33cc91b9ecffd645d0d64507fe94ca47b4b2fb17863cc3c08adddb5820a9aa",
  "requirement-missing": "sha256:37fcc16b8673bee01c2e4039481353ce52400f362fcaa5112e5bf6c73360c2cf",
  "stale-documentation": "sha256:69f1677fef783e5457b6d0148fa39875b3a6a6da362b3d77923adfa37b9a16bb",
  "undocumented-behavior": "sha256:68f28f1f45f8d3a821311ccf50b4b6754a6e7a1de28614e77c086780f2c0b06c",
} as const;

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
  it("uses the precedence rubric without changing the replay schema or bundles", async () => {
    const packets = prepareReplayPackets(await loadReplayBundles(reviewRoot));

    expect(REPLAY_SCHEMA_VERSION).toBe("1.0.0");
    expect(REPLAY_INSTRUCTION_VERSION).toBe("1.2.0");
    expect(Object.fromEntries(
      packets.map(({ fixtureId, bundleSha256 }) => [fixtureId, bundleSha256]),
    )).toEqual(ACCEPTED_BUNDLE_DIGESTS);
  });

  it("orders blocked assessments and unresolved conflicts before other outcomes", async () => {
    const [packet] = prepareReplayPackets(await loadReplayBundles(reviewRoot));
    if (!packet) {
      throw new Error("Expected replay packet");
    }

    expect(packet.instruction).toContain("Apply these decision rules in order.");
    expect(packet.instruction).toContain("If missing or inaccessible evidence materially blocks the requested assessment, return exactly one bounded other/inconclusive/investigate finding. This takes precedence over returning no findings or a confirmed or suspected finding.");
    expect(packet.instruction).toContain("If directly conflicting evidence remains unresolved, return contradictory_evidence/inconclusive/investigate. Agreement with one side does not establish the intended corrective direction.");
    expect(packet.instruction).toContain("If implementation behavior is absent from available documentation and approval or intent evidence is absent, return undocumented_behavior/suspected/update_documentation.");
    expect(packet.instruction).toContain("Use requirement_missing only when a present authoritative requirement explicitly requires behavior that implementation lacks.");
    expect(packet.instruction).toContain("Use stale_documentation only when present approval or change evidence establishes implementation as intended and documentation as outdated.");
    expect(packet.instruction).toContain("Use confirmed only when available evidence establishes both the inconsistency and intended corrective direction.");
  });

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
      expect(packet.instruction).toContain("Apply these decision rules in order.");
      expect(packet.instruction).toContain("Use suspected when available evidence supports a likely inconsistency but intent or approval remains unproven.");
      expect(packet.instruction).toContain("Use inconclusive when conflicting, missing, or inaccessible evidence prevents a reliable conclusion about intended behavior.");
      expect(packet.instruction).toContain("Copy evidence IDs byte-for-byte from bundle.evidenceItems; never synthesize, extend, rename, or infer an evidence ID");
      expect(packet.instruction).toContain("Cite only exact bundle evidence IDs and exact bundle affected sources.");
      expect(packet.instruction).toContain("confirmed or suspected finding must cite at least one bundle evidence ID");
      expect(packet.instruction).toContain("deterministicFacts evidenceIds value must also appear");
      expect(packet.instruction).toContain("affectedSources entry must match a source present in bundle evidence or missingEvidence");
      expect(packet.responseContract).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "fixtureId", "findings"],
      });
      const responseContract = packet.responseContract as {
        properties?: { findings?: { items?: unknown; maxItems?: number } };
        $defs?: Record<string, unknown>;
      };
      const findingReference = responseContract.properties?.findings?.items as {
        $ref?: string;
      };
      const findingDefinitionKey = /^#\/\$defs\/(.+)$/u.exec(
        findingReference.$ref ?? "",
      )?.[1];
      expect(findingDefinitionKey).toBeTruthy();
      const findingItems = responseContract.$defs?.[findingDefinitionKey ?? ""] as {
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
      expect(responseContract.properties?.findings?.maxItems).toBe(1_000);

      const localDefinitionReferences = new Set<string>();
      const collectReferences = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(collectReferences);
        } else if (value !== null && typeof value === "object") {
          for (const [key, child] of Object.entries(value)) {
            if (key === "$ref" && typeof child === "string") {
              const match = /^#\/\$defs\/(.+)$/u.exec(child);
              if (match?.[1]) {
                localDefinitionReferences.add(match[1]);
              }
            }
            collectReferences(child);
          }
        }
      };
      collectReferences(responseContract);
      expect(localDefinitionReferences.size).toBeGreaterThan(0);
      for (const definition of localDefinitionReferences) {
        expect(responseContract.$defs).toHaveProperty(definition);
      }
    }
  });

  it("does not leak expected outcomes, rationale, or reference findings into packets", async () => {
    const packets = prepareReplayPackets(await loadReplayBundles(reviewRoot));
    const serialized = canonicalReplayStringify(packets);
    for (const fixture of fixtures) {
      const instruction = packets.find(
        (packet) => packet.fixtureId === fixture.descriptor.fixtureId,
      )?.instruction;
      expect(instruction).toBeTruthy();
      expect(instruction).not.toContain(fixture.descriptor.fixtureId);
      expect(instruction).not.toMatch(/\b(expected|reference|rationale|host|model)\b/iu);
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
