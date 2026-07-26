# M6-004 — Prove pinned runtime-source fixtures and the M6 exit path

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M6 — Runtime and staging evidence`
- Base commit: `41ecdbd22bfe1c9a86c6e3391ee3e8de1f9afe3a`
- Branch: `codex/M6-004-runtime-source-fixtures-and-exit`
- Worktree:
  `D:\projects\change-trace-worktrees\M6-004-runtime-source-fixtures-and-exit`
- Push task branch: `no`
- Objective: complete the M6 implementation proof with deterministic offline
  JUnit-style, Playwright JSON, API-smoke, and staging fixture profiles that
  traverse the public stdio collection, bundle, validation, and report path
  without broad parser, live-access, or compatibility claims.
- Dependencies: accepted M6-001 through M6-003 and Decisions 27–30.

### Coordinator-owned fixture-producer contract

Add one test-only local fixture producer. It reads one bounded JSON request
from stdin and writes one strict `RuntimeEvidenceManifest` JSON value to
stdout. The request is a strict object with exactly:

- `schemaVersion: "1.0.0"`;
- `fixtureId`: `m6-junit`, `m6-playwright-json`, `m6-api-smoke`, or
  `m6-staging`;
- `relatedChangeIds`: 0–1,000 accepted stable IDs;
- `relatedEvidenceIds`: 0–1,000 accepted stable IDs.

Both relationship arrays reject duplicates. Unknown fields, fixture IDs,
malformed JSON, invalid IDs, or oversized input fail with a fixed non-secret
stderr token and nonzero exit. No raw path, report content, command,
environment variable, URL, credential, trust level, producer override, or
output path is caller-controlled.

The producer may read only the four fixed adjacent checked-in source fixtures
selected by `fixtureId`, each under 64 KiB:

- one pinned JUnit-style XML profile;
- one pinned Playwright JSON reporter profile;
- one project-owned API-smoke JSON profile;
- one project-owned staging-observation JSON profile.

It must not read a subject repository or caller path, fetch a URL, execute a
test/API/browser/deployment, discover artifacts, inspect process
environment/credentials, or launch another child process. Output order,
producer identity/version, record IDs, sources, timestamps, summaries,
artifacts, and truncation fields are fixed by the selected profile. Repeating
the same request is byte-identical.

The fixture process is an offline mapping proof. It is not a package binary,
public converter API, arbitrary XML/JSON parser, or vendor compatibility
claim.

### Coordinator-owned mapping profiles

The JUnit-style fixture:

- declares `sourceFormat: "junit_xml"`;
- emits `test_case` records for otherwise successful, `failure`, `error`, and
  `skipped` cases;
- maps them to `passed`, `failed`, `errored`, and `skipped`;
- preserves bounded suite/class/case identity in source locators and summaries;
- contains no system-out/system-err, stack, raw log, or attachment content.

The Playwright fixture:

- declares `sourceFormat: "playwright_json"`;
- represents the pinned nested suite/spec/test/result shape;
- covers ordinary final attempts whose statuses map from `passed`, `failed`,
  `timedOut`, `skipped`, and `interrupted` to `passed`, `failed`,
  `timed_out`, `skipped`, and `cancelled`;
- preserves test/project identity, start time, duration, and bounded path/URI
  references for trace/screenshot artifacts;
- drops stdout, stderr, errors/stacks, steps, annotations, and attachment
  bodies.

The API-smoke fixture:

- declares `sourceFormat: "api_smoke"` and emits bounded `api_observation`
  records;
- preserves check identity, observed outcome, timing, environment, and source;
- contains no request/response body, header, cookie, token, credential, raw
  log, retry command, or active endpoint invocation;
- includes one secret-shaped summary value so the accepted collector
  redaction boundary is exercised.

The staging fixture:

- declares `sourceFormat: "ci_summary"`;
- emits one available `environment_metadata` record with null
  outcome/timing and one unavailable staging observation;
- maps inaccessible staging evidence to structured runtime missing evidence,
  never to a failed observed behavior;
- includes one secret-shaped missing reason so missing-evidence redaction is
  exercised;
- records its staging source as metadata only and performs no reachability
  check.

Every record receives the request's relationship arrays. Each producer
identity/version uniquely names its pinned mapping profile. Inputs outside the
assigned profiles fail; the fixture process does not guess.

### Coordinator-owned end-to-end proof

Add one built-stdio integration test that:

1. materializes a deterministic Git change fixture;
2. calls `get_change_scope` and `collect_local_evidence`;
3. chooses one supplied file/change ID and one retained requirement/document
   evidence ID;
4. invokes every fixed fixture producer with those relationships and verifies
   deterministic strict manifest output;
5. writes only the produced normalized manifests beneath the temporary
   repository;
6. calls `collect_runtime_evidence` once per manifest;
7. builds one bundle with all four runtime collections;
8. validates an empty deterministic finding submission;
9. writes final JSON and Markdown reports twice after removing the first pair.

The test must prove:

- all fixture outputs parse as `RuntimeEvidenceManifest`;
- all collected results parse as `RuntimeEvidenceCollection`;
- observed outcomes, timing, environment, producer, format, source, and
  artifact references survive collection, bundle, JSON, and Markdown;
- available and unavailable records preserve the exact change/document
  relationships;
- the inaccessible staging observation is labelled unavailable/not observed
  and never appears as a failed evidence item;
- the API summary and staging reason secret sentinels are absent from
  collection output, bundle, reports, and captured server stderr;
- Playwright attachment bodies/stdout/stderr/stacks, JUnit raw output, and API
  bodies/headers never appear downstream;
- report JSON/Markdown omit runtime excerpts and selection reasons while
  preserving the accepted evidence-source catalog;
- the two report pairs are byte-identical;
- an unsupported fixture request fails safely without changing the nine-tool
  MCP surface.

### Coordinator-owned documentation contract

Add a packaged `docs/runtime-evidence/` guide and strict normalized manifest
examples for the four profiles. The guide must explain:

- the normalized manifest is the stable MCP input;
- conversion occurs before `collect_runtime_evidence` in Host/CI-owned logic;
- how to obtain and assign change and requirement/document evidence IDs;
- the 4 MiB confined collector boundary and core record/string/reference
  bounds;
- the pinned JUnit/Playwright/API/staging mapping tables;
- unavailable access versus observed failed behavior;
- reference-only artifact handling and prohibited content;
- no active probe, test execution, browser, deployment, credential, or
  production access;
- fixture-profile proof versus general format/vendor compatibility;
- a copyable public-tool call sequence.

Each packaged example must parse with `runtimeEvidenceManifestSchema`, use
non-secret example values, and remain below collector limits. Update the README
tool flow/status/guide link and include `docs/runtime-evidence` in the npm
package without changing package version, dependencies, scripts, engines, or
release state.

## In scope

- Four fixed source-shape fixtures and one deterministic test-only producer.
- Producer protocol/security/determinism unit tests.
- One complete built-stdio runtime-source fixture test.
- Runtime guide, strict examples, README integration, and package inclusion.
- Focused compatibility assertions in existing runtime/replay/stdio tests only
  if necessary.
- Worker handoff.

## Out of scope

- General JUnit XML, Playwright, API, CI, browser-MCP, or vendor converters.
- Public converter APIs, new MCP tools, report discovery, report-directory
  scanning, or arbitrary input files.
- Live network, staging, API, browser, deployment, credential, production, or
  subject-test execution.
- Reading screenshots, traces, videos, HTML, logs, request/response bodies,
  attachment bodies, stdout/stderr, stacks, or arbitrary artifacts.
- Runtime/core Schema, collector, bundle, report, Finding, review instruction,
  Git, local/external evidence, security, or server behavior changes.
- New dependencies, lockfile changes, scripts, package version, CI workflow,
  Roadmap, decisions, evaluation result, release, tag, npm, or GitHub changes.

## Allowed paths

- `tests/fixtures/runtime/m6-runtime-fixture-producer.mjs`
- `tests/fixtures/runtime/m6-junit-report.xml`
- `tests/fixtures/runtime/m6-playwright-report.json`
- `tests/fixtures/runtime/m6-api-smoke-report.json`
- `tests/fixtures/runtime/m6-staging-observation.json`
- `tests/unit/runtime-fixture-producer.test.ts`
- `tests/integration/runtime-source-fixtures.test.ts`
- `tests/unit/runtime-evidence-schema.test.ts` — packaged examples only if
  needed
- `tests/unit/review-replay.test.ts` — compatibility assertion only if needed
- `tests/integration/stdio.test.ts` — nine-tool/fixture compatibility only if
  needed
- `docs/runtime-evidence/README.md`
- `docs/runtime-evidence/examples/junit.manifest.json`
- `docs/runtime-evidence/examples/playwright.manifest.json`
- `docs/runtime-evidence/examples/api-smoke.manifest.json`
- `docs/runtime-evidence/examples/staging.manifest.json`
- `README.md`
- `package.json` — only add `docs/runtime-evidence` to `files`
- `docs/work-items/M6-004-runtime-source-fixtures-and-exit.md` — worker
  handoff only

Reading other source, test, fixture, documentation, and package files is
allowed. Writing outside this list is not.

## Coordinator-only paths

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- assignment, acceptance-criteria, and coordinator-review sections of this
  file
- `src/**`
- `tests/helpers/**`
- `.github/**`
- `package-lock.json`
- package dependencies, scripts, engines, versions, release, tag, npm, and
  GitHub state

## Acceptance criteria

- [ ] The strict fixture producer supports exactly four fixed profiles, has
      deterministic byte output, bounded input, and safe fixed failures.
- [ ] The producer reads only its fixed adjacent fixtures and cannot perform
      caller-selected file/process/network/browser/API/deployment access.
- [ ] JUnit-style and Playwright mapping tables produce every assigned outcome
      without importing raw output/log/body fields.
- [ ] API-smoke and staging profiles preserve bounded observed/environment
      metadata while omitting secrets and active-probe configuration.
- [ ] All fixture outputs parse as strict manifests and all public collector
      results parse as strict runtime collections.
- [ ] Runtime change/document relationships, outcome/timing/environment,
      producer/format/source, unavailable provenance, and artifact references
      survive the complete stdio bundle/report path.
- [ ] Inaccessible staging evidence remains unavailable/not observed and never
      becomes a failed runtime evidence item or product finding.
- [ ] Secret sentinels and forbidden JUnit/Playwright/API content are absent
      from MCP output, bundle, JSON, Markdown, and server stderr.
- [ ] Repeated identical report writes are byte-identical; the nine-tool set,
      M1 fixture, non-runtime bundle identity, and nine M3 replay digests remain
      unchanged.
- [ ] The packaged guide/examples parse, stay bounded, accurately state the
      offline normalized boundary, and make no general/live compatibility
      claim.
- [ ] Focused tests, type checking, two consecutive full suites, stdio and CI
      smoke, package dry-run, base diff, and clean-worktree checks pass.
- [ ] No source/core contract, dependency, lockfile, script, engine, version,
      CI workflow, governance, evaluation result, release, npm, or GitHub state
      changes.

## Required validation

```text
npx vitest run tests/unit/runtime-fixture-producer.test.ts tests/integration/runtime-source-fixtures.test.ts tests/unit/runtime-evidence-schema.test.ts tests/unit/runtime-evidence-collector.test.ts tests/unit/review-bundle.test.ts tests/unit/report-schema.test.ts tests/unit/report-write.test.ts tests/unit/review-replay.test.ts tests/integration/runtime-evidence-stdio.test.ts tests/integration/stdio.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run smoke:ci
npm run pack:check
git diff --check 41ecdbd22bfe1c9a86c6e3391ee3e8de1f9afe3a..HEAD
git status --short
```

The worker must report exact test-first failure evidence, final command
results, fixture/profile inventory, output/secret/forbidden-field audit,
package inventory, known limitations, deviations, and decision requests.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task,
   Decisions 27–30, the M6 Roadmap and format landscape, accepted M6 code/tests,
   stdio helpers, M5 source-fixture precedent, README, and package metadata.
2. Confirm the isolated branch/worktree, exact assigned base and assignment
   commit, and clean status.
3. Write failing producer protocol/determinism, example-Schema, full-pipeline,
   secret/forbidden-content, report-stability, and package assertions first.
4. Implement the smallest fixed fixtures, fixture producer, integration proof,
   and documentation satisfying the frozen contract.
5. Audit for arbitrary input/path/process/network access, environment or
   credential reads, XML/JSON overclaim, raw content leakage, nondeterministic
   time/order, relationship drift, artifact reads, staging failure
   misclassification, public-contract drift, and out-of-scope files.
6. Run every required validation, update only the worker handoff, commit all
   output, and leave the worktree clean.

## Escalate when

- any runtime/core Schema, collector, bundle, report, server, Finding, Git,
  local/external evidence, or security behavior must change;
- a parser/dependency/lockfile, arbitrary caller file, command, network,
  browser, API, deployment, credential, or active staging access is required;
- the pinned profiles cannot be represented by the accepted normalized
  manifest without guessing unsupported semantics;
- a secret/body/log/stack/attachment-content sentinel survives an assigned
  boundary;
- a legacy bundle/replay hash, M1 fixture, tool set, or non-runtime report
  changes;
- a coordinator-only or unlisted path must change.

## Worker handoff — worker owned

- Status: `pending`
- Implementation commits:

### Implementation summary

- Pending.

### Changed areas

- Pending.

### Validation

- Pending.

### Fixture and end-to-end evidence

- Pending.

### Public contract and documentation impact

- Pending.

### Deviations from assignment

- Pending.

### Known limitations and risks

- Pending.

### Decisions or questions for coordinator

- Pending.

### Protected-file confirmation

- [ ] Coordinator-only files were not modified.
- [ ] No dependency, lockfile, version, CI, release, npm, or GitHub action was
      performed.
- [ ] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending`
- Reviewed branch head:
- Integration commits:

### Review findings

- Pending.

### Required follow-up

- Pending review.

### Roadmap and release impact

- M6 remains in progress. This task cannot complete the milestone or authorize
  a version, release, or compatibility claim before coordinator review and
  exit-evidence recording.
