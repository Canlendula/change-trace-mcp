import { readFile } from "node:fs/promises";

const MAX_INPUT_BYTES = 64 * 1024;
const MAX_SOURCE_BYTES = 64 * 1024;
const MAX_RELATIONSHIPS = 1_000;
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u;
const FIXED_FAILURE = "m6_runtime_fixture_failed\n";
const REQUEST_FIELDS = [
  "fixtureId",
  "relatedChangeIds",
  "relatedEvidenceIds",
  "schemaVersion",
];

const fixtureSources = {
  "m6-junit": new URL("./m6-junit-report.xml", import.meta.url),
  "m6-playwright-json": new URL(
    "./m6-playwright-report.json",
    import.meta.url,
  ),
  "m6-api-smoke": new URL(
    "./m6-api-smoke-report.json",
    import.meta.url,
  ),
  "m6-staging": new URL(
    "./m6-staging-observation.json",
    import.meta.url,
  ),
};

const producers = {
  "m6-junit": {
    id: "producer:m6-junit-style-v1",
    name: "M6 pinned JUnit-style fixture",
    version: "profile-1.0.0",
  },
  "m6-playwright-json": {
    id: "producer:m6-playwright-json-v1",
    name: "M6 pinned Playwright JSON fixture",
    version: "profile-1.0.0",
  },
  "m6-api-smoke": {
    id: "producer:m6-api-smoke-v1",
    name: "M6 project API-smoke fixture",
    version: "profile-1.0.0",
  },
  "m6-staging": {
    id: "producer:m6-staging-summary-v1",
    name: "M6 project staging-summary fixture",
    version: "profile-1.0.0",
  },
};

const sourceFormats = {
  "m6-junit": "junit_xml",
  "m6-playwright-json": "playwright_json",
  "m6-api-smoke": "api_smoke",
  "m6-staging": "ci_summary",
};

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function validStableIds(value) {
  return (
    Array.isArray(value) &&
    value.length <= MAX_RELATIONSHIPS &&
    value.every(
      (entry) =>
        typeof entry === "string" &&
        entry.length >= 1 &&
        entry.length <= 160 &&
        STABLE_ID_PATTERN.test(entry),
    ) &&
    new Set(value).size === value.length
  );
}

function parseRequest(text) {
  const request = JSON.parse(text);
  if (!isPlainObject(request)) {
    throw new Error("invalid request");
  }
  const fields = Object.keys(request).sort();
  if (
    fields.length !== REQUEST_FIELDS.length ||
    fields.some((field, index) => field !== REQUEST_FIELDS[index])
  ) {
    throw new Error("invalid request");
  }
  if (
    request.schemaVersion !== "1.0.0" ||
    !Object.hasOwn(fixtureSources, request.fixtureId) ||
    !validStableIds(request.relatedChangeIds) ||
    !validStableIds(request.relatedEvidenceIds)
  ) {
    throw new Error("invalid request");
  }
  return request;
}

async function readBoundedStdin() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_INPUT_BYTES) {
      throw new Error("input too large");
    }
    chunks.push(buffer);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Buffer.concat(chunks),
  );
}

async function readFixedSource(fixtureId) {
  const bytes = await readFile(fixtureSources[fixtureId]);
  if (bytes.byteLength === 0 || bytes.byteLength >= MAX_SOURCE_BYTES) {
    throw new Error("invalid fixed fixture");
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function completedAt(startedAt, durationMilliseconds) {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) {
    throw new Error("invalid fixed timestamp");
  }
  return new Date(start + durationMilliseconds).toISOString();
}

function truncation(summary) {
  return {
    isTruncated: false,
    originalCharacters: summary.length,
    retainedCharacters: summary.length,
  };
}

function environment(kind, name, source) {
  return { kind, name, source };
}

function relationships(request) {
  return {
    relatedChangeIds: [...request.relatedChangeIds],
    relatedEvidenceIds: [...request.relatedEvidenceIds],
  };
}

function mapPinnedJunit(source, request) {
  if (
    !source.includes('<testsuites name="m6-junit-style-v1">') ||
    !source.includes('<testsuite name="release-suite"')
  ) {
    throw new Error("unexpected fixed JUnit profile");
  }
  const cases = [];
  const casePattern =
    /<testcase name="([^"]+)" classname="([^"]+)" time="([^"]+)" timestamp="([^"]+)">([\s\S]*?)<\/testcase>/gu;
  for (const match of source.matchAll(casePattern)) {
    const [, name, className, secondsText, startedAt, body] = match;
    const durationMilliseconds = Math.round(
      Number(secondsText) * 1_000,
    );
    if (
      typeof name !== "string" ||
      typeof className !== "string" ||
      typeof startedAt !== "string" ||
      typeof body !== "string" ||
      !Number.isSafeInteger(durationMilliseconds) ||
      durationMilliseconds < 0
    ) {
      throw new Error("unexpected fixed JUnit case");
    }
    let outcome = "passed";
    if (body.includes("<failure ")) {
      outcome = "failed";
    } else if (body.includes("<error ")) {
      outcome = "errored";
    } else if (body.includes("<skipped ")) {
      outcome = "skipped";
    }
    const summary = `${className}.${name} ${outcome}.`;
    cases.push({
      recordId: `record:junit:release-suite:${name}`,
      kind: "test_case",
      source: {
        system: "junit",
        locator: `suite:release-suite/class:${className}/case:${name}`,
        uri: null,
      },
      environment: environment("ci", "junit-fixture-job", {
        system: "ci",
        locator: "jobs/junit/42",
        uri: "https://ci.example.test/jobs/junit/42",
      }),
      ...relationships(request),
      accessStatus: "available",
      outcome,
      startedAt,
      completedAt: completedAt(startedAt, durationMilliseconds),
      durationMilliseconds,
      summary,
      artifactReferences: [],
      truncation: truncation(summary),
    });
  }
  const expectedCases = [
    "record:junit:release-suite:passes",
    "record:junit:release-suite:fails",
    "record:junit:release-suite:errors",
    "record:junit:release-suite:skips",
  ];
  if (
    cases.length !== expectedCases.length ||
    cases.some(
      ({ recordId }, index) => recordId !== expectedCases[index],
    )
  ) {
    throw new Error("unexpected fixed JUnit cases");
  }
  return cases;
}

function parseFixedJson(source, profile) {
  const value = JSON.parse(source);
  if (!isPlainObject(value) || value.profile !== profile) {
    throw new Error("unexpected fixed JSON profile");
  }
  return value;
}

function requireString(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("unexpected fixed string");
  }
  return value;
}

function requireSafeDuration(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error("unexpected fixed duration");
  }
  return value;
}

function mapPinnedPlaywright(source, request) {
  const report = parseFixedJson(
    source,
    "m6-playwright-json-v1",
  );
  if (!Array.isArray(report.suites) || report.suites.length !== 1) {
    throw new Error("unexpected fixed Playwright suites");
  }
  const statusMap = {
    passed: "passed",
    failed: "failed",
    timedOut: "timed_out",
    skipped: "skipped",
    interrupted: "cancelled",
  };
  const records = [];
  for (const suite of report.suites) {
    if (!isPlainObject(suite) || !Array.isArray(suite.specs)) {
      throw new Error("unexpected fixed Playwright suite");
    }
    const suiteTitle = requireString(suite.title);
    for (const spec of suite.specs) {
      if (
        !isPlainObject(spec) ||
        !Array.isArray(spec.tests) ||
        spec.tests.length !== 1
      ) {
        throw new Error("unexpected fixed Playwright spec");
      }
      const specTitle = requireString(spec.title);
      const file = requireString(spec.file);
      const line = requireSafeDuration(spec.line);
      const column = requireSafeDuration(spec.column);
      const test = spec.tests[0];
      if (
        !isPlainObject(test) ||
        !Array.isArray(test.results) ||
        test.results.length !== 1
      ) {
        throw new Error("unexpected fixed Playwright test");
      }
      const projectName = requireString(test.projectName);
      const result = test.results[0];
      if (!isPlainObject(result)) {
        throw new Error("unexpected fixed Playwright result");
      }
      const status = requireString(result.status);
      if (!Object.hasOwn(statusMap, status)) {
        throw new Error("unexpected fixed Playwright status");
      }
      const outcome = statusMap[status];
      const startedAt = requireString(result.startTime);
      const durationMilliseconds = requireSafeDuration(
        result.duration,
      );
      const artifactReferences = [];
      if (!Array.isArray(result.attachments)) {
        throw new Error("unexpected fixed Playwright attachments");
      }
      for (const attachment of result.attachments) {
        if (
          !isPlainObject(attachment) ||
          (attachment.name !== "trace" &&
            attachment.name !== "screenshot") ||
          typeof attachment.path !== "string"
        ) {
          continue;
        }
        artifactReferences.push({
          system: "playwright",
          locator: attachment.path,
          uri:
            typeof attachment.uri === "string"
              ? attachment.uri
              : null,
        });
      }
      const summary = `${projectName} ${suiteTitle}/${specTitle} ${outcome}.`;
      records.push({
        recordId: `record:playwright:${suiteTitle}:${projectName}:${specTitle}`,
        kind: "test_case",
        source: {
          system: "playwright",
          locator:
            `suite:${suiteTitle}/spec:${specTitle}/project:${projectName}` +
            `/test:${file}:${line}:${column}`,
          uri: null,
        },
        environment: environment("ci", "playwright-fixture-job", {
          system: "ci",
          locator: "jobs/playwright/42",
          uri: "https://ci.example.test/jobs/playwright/42",
        }),
        ...relationships(request),
        accessStatus: "available",
        outcome,
        startedAt,
        completedAt: completedAt(startedAt, durationMilliseconds),
        durationMilliseconds,
        summary,
        artifactReferences,
        truncation: truncation(summary),
      });
    }
  }
  const expectedRecords = [
    "record:playwright:release-flow:chromium:passes",
    "record:playwright:release-flow:chromium:fails",
    "record:playwright:release-flow:firefox:times-out",
    "record:playwright:release-flow:webkit:skips",
    "record:playwright:release-flow:webkit:interrupts",
  ];
  if (
    records.length !== expectedRecords.length ||
    records.some(
      ({ recordId }, index) => recordId !== expectedRecords[index],
    )
  ) {
    throw new Error("unexpected fixed Playwright records");
  }
  return records;
}

function sourceReference(value) {
  if (
    !isPlainObject(value) ||
    typeof value.system !== "string" ||
    typeof value.locator !== "string" ||
    !(
      value.uri === null ||
      typeof value.uri === "string"
    )
  ) {
    throw new Error("unexpected fixed source reference");
  }
  return {
    system: value.system,
    locator: value.locator,
    uri: value.uri,
  };
}

function runtimeEnvironment(value) {
  if (!isPlainObject(value)) {
    throw new Error("unexpected fixed environment");
  }
  return environment(
    requireString(value.kind),
    value.name === null ? null : requireString(value.name),
    sourceReference(value.source),
  );
}

function mapPinnedApi(source, request) {
  const report = parseFixedJson(source, "m6-api-smoke-v1");
  if (!Array.isArray(report.checks) || report.checks.length !== 2) {
    throw new Error("unexpected fixed API checks");
  }
  const mappedEnvironment = runtimeEnvironment(report.environment);
  const records = report.checks.map((check) => {
    if (!isPlainObject(check)) {
      throw new Error("unexpected fixed API check");
    }
    const id = requireString(check.id);
    const outcome = requireString(check.outcome);
    if (outcome !== "passed" && outcome !== "failed") {
      throw new Error("unexpected fixed API outcome");
    }
    const startedAt = requireString(check.startedAt);
    const completed = requireString(check.completedAt);
    const durationMilliseconds = requireSafeDuration(
      check.durationMilliseconds,
    );
    const summary = requireString(check.summary);
    return {
      recordId: `record:api:${id}`,
      kind: "api_observation",
      source: sourceReference(check.source),
      environment: mappedEnvironment,
      ...relationships(request),
      accessStatus: "available",
      outcome,
      startedAt,
      completedAt: completed,
      durationMilliseconds,
      summary,
      artifactReferences: [],
      truncation: truncation(summary),
    };
  });
  if (
    records[0]?.recordId !== "record:api:health" ||
    records[1]?.recordId !== "record:api:contract"
  ) {
    throw new Error("unexpected fixed API record IDs");
  }
  return records;
}

function mapPinnedStaging(source, request) {
  const report = parseFixedJson(
    source,
    "m6-staging-summary-v1",
  );
  if (
    !Array.isArray(report.records) ||
    report.records.length !== 2
  ) {
    throw new Error("unexpected fixed staging records");
  }
  const mappedEnvironment = runtimeEnvironment(report.environment);
  const [metadata, unavailable] = report.records;
  if (
    !isPlainObject(metadata) ||
    metadata.id !== "environment" ||
    metadata.kind !== "environment_metadata" ||
    metadata.accessStatus !== "available"
  ) {
    throw new Error("unexpected fixed staging metadata");
  }
  if (
    !isPlainObject(unavailable) ||
    unavailable.id !== "observation" ||
    unavailable.kind !== "browser_observation" ||
    unavailable.accessStatus !== "inaccessible"
  ) {
    throw new Error("unexpected fixed staging observation");
  }
  const summary = requireString(metadata.summary);
  return [
    {
      recordId: "record:staging:environment",
      kind: "environment_metadata",
      source: sourceReference(metadata.source),
      environment: mappedEnvironment,
      ...relationships(request),
      accessStatus: "available",
      summary,
      artifactReferences: [],
      truncation: truncation(summary),
    },
    {
      recordId: "record:staging:observation",
      kind: "browser_observation",
      source: sourceReference(unavailable.source),
      environment: mappedEnvironment,
      ...relationships(request),
      accessStatus: "inaccessible",
      reason: requireString(unavailable.reason),
    },
  ];
}

function mapFixture(fixtureId, source, request) {
  if (fixtureId === "m6-junit") {
    return mapPinnedJunit(source, request);
  }
  if (fixtureId === "m6-playwright-json") {
    return mapPinnedPlaywright(source, request);
  }
  if (fixtureId === "m6-api-smoke") {
    return mapPinnedApi(source, request);
  }
  if (fixtureId === "m6-staging") {
    return mapPinnedStaging(source, request);
  }
  throw new Error("unsupported fixture");
}

async function main() {
  const input = await readBoundedStdin();
  const request = parseRequest(input);
  const source = await readFixedSource(request.fixtureId);
  const manifest = {
    schemaVersion: "1.0.0",
    producer: producers[request.fixtureId],
    sourceFormat: sourceFormats[request.fixtureId],
    records: mapFixture(request.fixtureId, source, request),
  };
  process.stdout.write(JSON.stringify(manifest));
}

try {
  await main();
} catch {
  process.stderr.write(FIXED_FAILURE);
  process.exitCode = 2;
}
