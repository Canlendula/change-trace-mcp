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

- [x] The strict fixture producer supports exactly four fixed profiles, has
      deterministic byte output, bounded input, and safe fixed failures.
- [x] The producer reads only its fixed adjacent fixtures and cannot perform
      caller-selected file/process/network/browser/API/deployment access.
- [x] JUnit-style and Playwright mapping tables produce every assigned outcome
      without importing raw output/log/body fields.
- [x] API-smoke and staging profiles preserve bounded observed/environment
      metadata while omitting secrets and active-probe configuration.
- [x] All fixture outputs parse as strict manifests and all public collector
      results parse as strict runtime collections.
- [x] Runtime change/document relationships, outcome/timing/environment,
      producer/format/source, unavailable provenance, and artifact references
      survive the complete stdio bundle/report path.
- [x] Inaccessible staging evidence remains unavailable/not observed and never
      becomes a failed runtime evidence item or product finding.
- [x] Secret sentinels and forbidden JUnit/Playwright/API content are absent
      from MCP output, bundle, JSON, Markdown, and server stderr.
- [x] Repeated identical report writes are byte-identical; the nine-tool set,
      M1 fixture, non-runtime bundle identity, and nine M3 replay digests remain
      unchanged.
- [x] The packaged guide/examples parse, stay bounded, accurately state the
      offline normalized boundary, and make no general/live compatibility
      claim.
- [x] Focused tests, type checking, two consecutive full suites, stdio and CI
      smoke, package dry-run, base diff, and clean-worktree checks pass.
- [x] No source/core contract, dependency, lockfile, script, engine, version,
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

- Status: `ready_for_review`
- Implementation commits:
  - `9c4c9b0a5a65f71f6093a35a6107712edca3b9c1`

### Implementation summary

- Added one strict, bounded, test-only fixture producer with exactly four
  caller-selectable fixture IDs. It reads only the four fixed adjacent
  checked-in sources, accepts only relationship IDs, emits byte-identical
  strict manifests, and projects every handled failure to
  `m6_runtime_fixture_failed`.
- Added fixed JUnit-style, Playwright JSON, project API-smoke, and project
  staging-summary source snapshots. Their mappings cover all assigned observed
  outcomes, one available environment-metadata record, and one inaccessible
  staging observation without preserving prohibited source content.
- Added a built-stdio end-to-end proof covering Git scope, local requirement
  evidence, all four producer profiles, confined collection, relationship-valid
  bundle construction, empty finding validation, two byte-identical final
  report pairs, the nine-tool surface, and the M1 fixture.
- Added the packaged runtime-evidence guide and four strict non-secret manifest
  examples, then linked the guide/tool flow from the README and added only
  `docs/runtime-evidence` to the package file inventory.

### Changed areas

- `tests/fixtures/runtime/`: four source-shape snapshots and the fixed offline
  producer.
- `tests/unit/runtime-fixture-producer.test.ts`: strict request, unknown-field,
  relationship-bound, safe-error, deterministic-output, fixed-source,
  prohibited-capability, mapping, and package assertions.
- `tests/integration/runtime-source-fixtures.test.ts`: complete built-stdio
  public-tool proof and downstream secret/forbidden-content/report-stability
  audit.
- `tests/unit/runtime-evidence-schema.test.ts`: packaged example parsing,
  non-secret content, record bound, and collector-size assertions.
- `docs/runtime-evidence/**`, `README.md`, `package.json`: stable normalized
  boundary, IDs and public call sequence, collector/core bounds, pinned mapping
  tables, unavailable semantics, reference-only artifacts, compatibility
  limits, examples, README integration, and package inclusion.

### Validation

- Test-first environment attempt:
  - `npx vitest run tests/unit/runtime-fixture-producer.test.ts
    tests/integration/runtime-source-fixtures.test.ts
    tests/unit/runtime-evidence-schema.test.ts`: Vitest did not start because
    the isolated worktree had no `node_modules`. No package installation or
    network access was performed; an ignored local junction to the primary
    checkout's existing `node_modules` was used for validation.
- Test-first expected product failures after dependency resolution:
  - the same three-file command: exit 1, 3 files failed, 8 failed / 20 passed
    out of 28. The producer, four fixed source files, four packaged examples,
    package entry, and built worktree server were absent as intended.
- First implementation pass:
  - `npm run build; npx vitest run
    tests/unit/runtime-fixture-producer.test.ts
    tests/unit/runtime-evidence-schema.test.ts
    tests/integration/runtime-source-fixtures.test.ts`: build passed; 3 files,
    28/28 tests passed.
- Final required focused command:
  - `npx vitest run tests/unit/runtime-fixture-producer.test.ts
    tests/integration/runtime-source-fixtures.test.ts
    tests/unit/runtime-evidence-schema.test.ts
    tests/unit/runtime-evidence-collector.test.ts
    tests/unit/review-bundle.test.ts tests/unit/report-schema.test.ts
    tests/unit/report-write.test.ts tests/unit/review-replay.test.ts
    tests/integration/runtime-evidence-stdio.test.ts
    tests/integration/stdio.test.ts`: 10 files, 150/150 tests passed.
  - `npm run check`: passed.
- Consecutive full suites on the final implementation:
  - `npm test`: 32 files, 340/340 tests passed.
  - `npm test`: 32 files, 340/340 tests passed.
- Remaining required gates:
  - `npm run smoke:stdio`: passed; exactly nine tools were listed and the full
    M1 compatibility fixture remained byte-compatible.
  - `npm run smoke:ci`: passed with
    `outcome=completed_no_findings code=ok` and `smoke=ok`.
  - `npm run pack:check`: passed; 186 files, including the runtime guide and
    all four examples.
  - `git diff --check
    41ecdbd22bfe1c9a86c6e3391ee3e8de1f9afe3a..HEAD`: passed after
    the handoff commit.
  - `git status --short`: clean after the handoff commit.

### Fixture and end-to-end evidence

- `m6-junit`: `producer:m6-junit-style-v1`, `junit_xml`, 4 available
  `test_case` records, 3,056-byte normalized output. The fixed cases map to
  `passed`, `failed`, `errored`, and `skipped`; suite/class/case locators and
  timing survive. System output/error and failure/error stack sentinels never
  enter the manifest or downstream values.
- `m6-playwright-json`: `producer:m6-playwright-json-v1`,
  `playwright_json`, 5 available `test_case` records, 4,403-byte normalized
  output. Final statuses map to `passed`, `failed`, `timed_out`, `skipped`, and
  `cancelled`. Test/project identity, timing, trace path, and screenshot
  path/URI survive. Stdout, stderr, stack, step, annotation, and attachment-body
  sentinels are absent from the manifest and downstream values.
- `m6-api-smoke`: `producer:m6-api-smoke-v1`, `api_smoke`, 2 available
  `api_observation` records, 1,589-byte normalized output. Check identity,
  passed/failed observed outcomes, timing, CI environment, and source survive.
  Request/response body, header, cookie, token, retry-command, and raw-log
  sentinels never enter the manifest. The assigned secret-shaped summary enters
  only the raw manifest and is redacted before collection output.
- `m6-staging`: `producer:m6-staging-summary-v1`, `ci_summary`, 2 records,
  1,393-byte normalized output: one available `environment_metadata` record
  and one inaccessible `browser_observation`. The available record becomes
  configuration evidence with null outcome/timing. The inaccessible record
  becomes structured runtime missing evidence labelled unavailable/not
  observed, retains exact change/document links, and never becomes a failed
  runtime item or finding. Its secret-shaped reason is redacted at collection.
- The E2E uses one materialized Git fixture and one retained local requirement
  ID. Every available and unavailable runtime record retains those exact IDs
  through collection, bundle, report JSON, and Markdown. It proves 12
  available runtime evidence sources plus one runtime missing entry.
- Runtime producer, source format, manifest record, kind, source,
  environment, observed outcome, start/completion/duration, artifact
  references, and relationships survive the final report catalog. Runtime
  excerpts and selection reasons do not enter either report.
- All API/staging secret sentinels and all assigned forbidden raw-content
  sentinels are absent from collection results, bundle, final JSON, final
  Markdown, and captured server stderr. Removing the first report pair and
  repeating the same public `write_report` call produces byte-identical files.
- Unsupported producer input emits only the fixed failure token and leaves the
  nine-tool MCP surface unchanged.

### Public contract and documentation impact

- No `src/**`, public Schema, collector, bundle, report, Finding, server, Git,
  local/external evidence, security, or MCP tool behavior changed.
- The fixture producer is test-only and is not a package binary or public
  converter API. The guide presents the normalized manifest as the stable MCP
  input and keeps conversion in Host/CI-owned preprocessing.
- The README now lists `collect_runtime_evidence`, its optional call-flow
  branch, the runtime Schemas, and the packaged guide/examples. Package metadata
  changed only by adding `docs/runtime-evidence` to `files`; version,
  dependencies, scripts, engines, and release state are unchanged.

### Deviations from assignment

- No product or scope deviation. The isolated worktree initially lacked
  dependencies, so validation used a local ignored junction to the existing
  primary-checkout `node_modules`. No install, dependency, lockfile, or network
  action occurred.

### Known limitations and risks

- The producer proves exactly four checked-in mapping snapshots. It is not an
  arbitrary XML/JSON parser and establishes no general JUnit, Playwright,
  vendor API, browser, CI, or live staging compatibility.
- No test, API, browser, deployment, staging-reachability, production,
  credential, or artifact-content access is performed. Real converters remain
  separately versioned Host/CI responsibilities.
- Artifact coverage is reference-only. The proof never opens trace,
  screenshot, attachment, log, or report-body content.

### Decisions or questions for coordinator

- None. The accepted M6 contracts represented every assigned profile without a
  public/core change, dependency, or additional product/security decision.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No dependency, lockfile, version, CI, release, npm, or GitHub action was
      performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head:
  `46e1c4831d02d44875178c45811d05e9cfa1f3e7`
- Integration commits:
  - `db3eb55` — fixed offline profiles, complete stdio proof, packaged guide,
    examples, and regression tests
  - `8b47d00` — worker handoff

### Review findings

- The reviewed base-to-head diff stayed inside the assigned fixture, test,
  runtime-guide, README, package-file, and worker-handoff paths. No `src/**`,
  dependency, lockfile, script, engine, version, CI workflow, governance,
  release, npm, or GitHub state changed.
- The fixture producer accepts exactly four IDs plus bounded unique
  relationships, reads only the selected fixed adjacent fixture, and emits one
  deterministic strict manifest. Invalid, unknown, forbidden-field, invalid-ID,
  duplicate-ID, and oversized requests return only the fixed failure token.
- Static review found no environment-variable, arbitrary path, subject
  artifact, child-process, network, browser, API, deployment, credential, or
  active-probe capability in the producer. JUnit output/error/stack fields,
  Playwright stdout/stderr/error/step/annotation/attachment bodies, and API
  bodies/headers/cookies/tokens/logs are discarded before manifest output.
- The built-stdio proof links all available and unavailable runtime records to
  one supplied change ID and one retained requirement document ID. Twelve
  available runtime sources and one structured unavailable staging record
  survive collection, bundle, JSON, and Markdown with the assigned provenance,
  timing, outcomes, environments, and reference-only artifacts.
- Inaccessible staging evidence remains missing evidence labelled
  unavailable/not observed. It never becomes a failed runtime item or finding.
  API-summary and staging-reason secrets are redacted before collection output,
  and all assigned secret/raw-content sentinels are absent from bundle,
  reports, and server stderr.
- The packaged guide and four examples parse under the accepted strict
  manifest Schema, stay below the 4 MiB collector limit, and clearly restrict
  compatibility to the checked-in offline profiles.
- Independent coordinator validation passed:
  - focused runtime fixture/core/replay/stdio suite: 10 files, 150 tests;
  - TypeScript check;
  - two consecutive full suites: 32 files, 340 tests each;
  - stdio smoke with exactly nine tools and the byte-stable M1 fixture;
  - advisory CI smoke with `completed_no_findings`;
  - package dry-run with 186 files and all five runtime guide/example files;
  - base-diff whitespace, allowed-path, temporary-junction, and clean-worktree
    checks.
- After integration on `main`, the full suite again passed 32 files / 340
  tests and stdio smoke retained the exact nine-tool/M1 fixture result.

### Required follow-up

- General converters, upstream-version compatibility matrices, credentialed or
  live staging pilots, active browser/API probing, and converter authoring
  guidance remain M7 extension and pilot work.
- M8 must freeze the provisional v1 Schema/JSON Schema snapshots and document
  compatibility policy before a stable release.

### Roadmap and release impact

- M6-004 is accepted and all M6 exit criteria pass for the pinned offline
  normalized-runtime contract. The coordinator must record the final M6
  evidence and Roadmap status; this acceptance does not authorize a package
  version, tag, publish, or broader format/live compatibility claim.
