import { readFile } from "node:fs/promises";

import {
  loadReplayBundles,
  prepareReplayPackets,
} from "../helpers/review-replay.js";
import { discoverReviewFixtures, loadReviewFixture } from "../helpers/review-fixture.js";
import { scoreReviewFixture } from "../helpers/review-score.js";

function fail(): never {
  throw new Error("invalid_quality_spike_evaluator_input");
}

async function packet(fixturesDirectory: string, fixtureId: string): Promise<void> {
  const value = prepareReplayPackets(await loadReplayBundles(fixturesDirectory)).find(
    (candidate) => candidate.fixtureId === fixtureId,
  );
  if (!value) fail();
  process.stdout.write(JSON.stringify(value));
}

async function score(fixturesDirectory: string, fixtureId: string, capturePath: string): Promise<void> {
  const fixture = (await Promise.all((await discoverReviewFixtures(fixturesDirectory)).map(loadReviewFixture))).find(
    (candidate) => candidate.descriptor.fixtureId === fixtureId,
  );
  if (!fixture) fail();
  const capture: unknown = JSON.parse(await readFile(capturePath, "utf8"));
  if (!capture || typeof capture !== "object" || Array.isArray(capture)) fail();
  const value = capture as { schemaVersion?: unknown; fixtureId?: unknown; findings?: unknown };
  if (value.schemaVersion !== "1.0.0" || value.fixtureId !== fixtureId || !Array.isArray(value.findings)) fail();
  const result = scoreReviewFixture(fixture, value.findings);
  process.stdout.write(JSON.stringify({
    fixtureId: result.fixtureId,
    passed: result.passed,
    validation: result.validation,
    failureCodes: result.failureCodes,
  }));
}

const [command, fixturesDirectory, fixtureId, capturePath] = process.argv.slice(2);
if (command === "packet" && fixturesDirectory && fixtureId && capturePath === undefined) {
  void packet(fixturesDirectory, fixtureId);
} else if (command === "score" && fixturesDirectory && fixtureId && capturePath) {
  void score(fixturesDirectory, fixtureId, capturePath);
} else {
  fail();
}
