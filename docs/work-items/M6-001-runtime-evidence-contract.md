# M6-001 — Define the normalized runtime-evidence contract

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M6 — Runtime and staging evidence`
- Base commit: `2cadae39073e8b1bcafc714259a1ff1d0583b110`
- Branch: `codex/M6-001-runtime-evidence-contract`
- Worktree:
  `D:\projects\change-trace-worktrees\M6-001-runtime-evidence-contract`
- Push task branch: `no`
- Objective: define the strict, provider-neutral manifest, provenance, and
  normalized collection Schemas for pre-produced runtime evidence without
  reading files, executing subject code, adding an MCP tool, or changing
  bundle/report behavior.
- Dependencies: accepted M2 evidence contracts, accepted M5 final-report
  provenance, Decision 22, Decision 27, and the evidence recorded in
  `docs/evaluation/M6_RUNTIME_FORMAT_LANDSCAPE.md`.

### Coordinator-owned public contract

M6-001 adds a normalized producer boundary. It does not parse a complete
JUnit, Playwright, CI-platform, browser-MCP, or other vendor-private report
object.

The public vocabularies are:

- source format: `junit_xml`, `playwright_json`, `playwright_blob`,
  `api_smoke`, `browser_mcp`, `ci_summary`, `generic_json`, or `other`;
- runtime kind: `test_run`, `test_case`, `api_observation`,
  `browser_observation`, `environment_metadata`, or `other`;
- executed outcome: `passed`, `failed`, `skipped`, `timed_out`, `cancelled`,
  or `errored`;
- unavailable access status: `not_found`, `inaccessible`, `unsupported`,
  `malformed`, or `truncated`;
- environment kind: `local`, `ci`, `staging`, or `other`.

`production` is deliberately absent. Adding it requires the later security
decision reserved by Decision 27.

### Manifest contract

`RuntimeEvidenceManifest` is a strict, versioned object containing:

- one producer identity with stable ID, bounded name, and bounded version;
- one declared source format;
- 1–1,000 records with unique stable `recordId` values.

Each record carries a strict runtime kind, exact `SourceReference`, exact
non-production environment, at most 1,000 related Git change IDs, and at most
1,000 related requirement/document evidence IDs.

An available behavioral record (`test_run`, `test_case`, `api_observation`,
`browser_observation`, or `other`) additionally requires:

- `accessStatus: available`;
- one executed outcome;
- nullable start and completion timestamps;
- nullable nonnegative duration in milliseconds;
- a summary bounded by the existing evidence-excerpt limit;
- at most 100 artifact `SourceReference` entries;
- consistent evidence truncation metadata.

An available `environment_metadata` record carries the bounded summary,
artifact references, and truncation but has no execution outcome or timing
fields.

An unavailable record carries its non-available access status and one bounded
reason. It cannot carry summary content, outcome/timing, artifact references,
or truncation. A later normalizer will map these records to `MissingEvidence`;
it will not create failed runtime observations from them.

Manifest records cannot supply a core evidence ID, content hash, trust level,
redaction result, external/runtime provenance object, executable, argv,
working directory, environment-variable name/value, credential, command,
browser action, or active probe configuration.

### Normalized provenance and collection contract

Add a strict optional `runtimeProvenance` field to the existing
`EvidenceItem`. Its exact fields are:

- producer identity;
- source format;
- manifest record ID;
- runtime kind;
- exact environment;
- nullable outcome;
- nullable start/completion timestamps;
- nullable duration milliseconds;
- bounded artifact references;
- bounded related requirement/document evidence IDs.

Cross-field rules:

- `environment_metadata` provenance has null outcome and null execution
  timing;
- every other kind has a non-null outcome;
- when start and completion are both present, completion cannot precede
  start.

`RuntimeEvidenceCollection` is a strict, versioned object with one producer,
runtime evidence items, and missing evidence. It enforces:

- no more than 1,000 combined evidence and missing outcomes;
- every evidence item has matching runtime producer provenance;
- every runtime item uses `observed_runtime`;
- runtime types are limited to `test_result`, `runtime_observation`, and
  `configuration`;
- `test_run` and `test_case` map to `test_result`;
- API/browser/other observations map to `runtime_observation`;
- `environment_metadata` maps to `configuration`;
- runtime and external provenance cannot coexist;
- evidence IDs within the collection are unique.

The generic `EvidenceItem` remains valid without runtime provenance. Existing
Git, repository, external-document, and M3 replay inputs must remain valid.

### Bounds and refinements

- Producer ID uses `stableIdSchema`; producer name/version are 1–160
  characters.
- Environment is a strict object containing only `kind`, a 1–200 character
  nullable name, and one exact `SourceReference`.
- Runtime summary uses `MAX_EVIDENCE_EXCERPT_CHARACTERS`.
- Artifact references: at most 100.
- Related change IDs and related evidence IDs: at most 1,000 each.
- Manifest records and collection outcomes: at most 1,000.
- Duration uses a nonnegative safe integer.
- All IDs inside each related-ID array are unique.
- Truncation rules match the accepted external-result semantics:
  retained characters equal summary length; truncated content has a known
  original size no smaller than retained content; non-truncated known original
  size equals retained size.

### Deterministic exports

Export the new Zod Schemas and inferred types through `src/schemas/index.ts`.
Add deterministic Draft 2020-12 exports named:

- `runtimeEvidenceManifest`;
- `runtimeEvidenceCollection`.

Use the existing provisional core schema version and these IDs:

- `urn:change-trace-mcp:schema:runtime-evidence-manifest:1.0.0`;
- `urn:change-trace-mcp:schema:runtime-evidence-collection:1.0.0`.

## In scope

- Add strict runtime producer, environment, manifest-record, provenance,
  manifest, runtime-item, and collection Schemas/types.
- Add the optional core `EvidenceItem.runtimeProvenance`.
- Add the two deterministic JSON Schema exports.
- Add focused positive, negative, exact-object, enum, union, bound,
  uniqueness, timestamp, timing-order, type/provenance, truncation,
  injection-shaped-data, and deterministic-export tests.
- Update only the worker-owned handoff section of this file.

## Out of scope

- File or XML parsing, manifest loading, path confinement, process execution,
  test execution, browser control, network access, API probing, deployment,
  credentials, converters, MCP tools, server registration, bundle merge,
  bundle identity, reports, CI workflow, or live staging/vendor access.
- Adding `runtime_mismatch` or any Finding enum.
- Adding dependencies or changing package/version/release/npm state.
- Modifying Roadmap, decisions, evaluation evidence, workflow/governance, or
  another work item.

## Allowed paths

- `src/schemas/runtime-provenance.ts`
- `src/schemas/runtime-evidence.ts`
- `src/schemas/evidence.ts`
- `src/schemas/index.ts`
- `src/schemas/json-schema.ts`
- `tests/unit/runtime-evidence-schema.test.ts`
- `tests/unit/core-schemas.test.ts` — only the smallest compatibility/export
  assertion if the focused file cannot cover it cleanly
- `docs/work-items/M6-001-runtime-evidence-contract.md` — worker handoff only

Reading other files is allowed. Writing outside this list is not.

## Coordinator-only paths

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- assignment/acceptance-criteria/coordinator-review sections of this file
- `src/server.ts`
- `src/evidence/**`
- `src/reports/**`
- `.github/**`
- package metadata, lockfile, dependencies, versions, release, and npm state

## Acceptance criteria

- [ ] Manifest, provenance, runtime-item, and collection Schemas implement the
      exact vocabularies, strict shapes, bounds, and refinements above.
- [ ] Available behavioral, available environment-metadata, and unavailable
      record variants reject fields belonging to the other variants.
- [ ] A staging outage/unavailable record cannot masquerade as a failed
      observation, and a parsed failed result remains an available record with
      outcome `failed`.
- [ ] Manifest input cannot choose core identity/trust/redaction/provenance or
      executable/credential/active-probe configuration.
- [ ] Runtime items remain distinct from Git/local/external evidence through
      allowed type, `observed_runtime`, provenance, type-kind mapping, and
      no-coexisting-external-provenance refinements.
- [ ] Environment metadata is non-executed configuration evidence with null
      outcome/timing; executed kinds require outcomes.
- [ ] Producer consistency, unique record/evidence IDs, unique relationship
      IDs, timing order, safe duration, truncation, and combined bounds pass
      boundary tests.
- [ ] Existing non-runtime evidence and exported Schema behavior remain
      compatible except for the intentional optional `runtimeProvenance`
      addition.
- [ ] `runtimeEvidenceManifest` and `runtimeEvidenceCollection` export
      deterministically as Draft 2020-12 with the assigned IDs.
- [ ] Focused tests, type checking, two consecutive full suites, stdio smoke,
      package dry-run, base diff, and clean-worktree checks pass.
- [ ] No dependency, collector, MCP, bundle, report, workflow, governance,
      version, release, or npm-state change occurs.

## Required validation

```text
npx vitest run tests/unit/runtime-evidence-schema.test.ts tests/unit/core-schemas.test.ts tests/unit/json-schema.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 2cadae39073e8b1bcafc714259a1ff1d0583b110..HEAD
git status --short
```

The worker must report exact test-first failure evidence, final command
results, cases exercised, known limitations, deviations, and any decision
request.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this full task,
   Decisions 22 and 27, the M6 format evidence, all existing evidence,
   external-provenance, external-adapter-result, collection, and JSON Schema
   definitions/tests.
2. Confirm the isolated branch/worktree, assigned base, assignment commit, and
   clean status.
3. Write failing focused tests for all three manifest variants, forbidden
   fields, runtime-item refinements, bounds, and deterministic exports before
   implementation.
4. Implement the smallest strict Schema-only change satisfying the frozen
   contract.
5. Audit for circular imports, permissive union branches, unsafe integer/time
   handling, accidental vendor object retention, existing-schema breakage,
   and out-of-scope paths.
6. Run all required gates, update only the worker handoff, commit everything,
   and leave the worktree clean.

## Escalate when

- the contract requires a dependency, collector, parser, MCP, bundle, report,
  Finding, version, or governance change;
- an exact public field/vocabulary above cannot be implemented without
  materially changing the contract;
- schema composition introduces a cycle that cannot be resolved within the
  two assigned runtime schema files and `evidence.ts`;
- existing non-runtime evidence cannot remain compatible.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Implementation commit(s):
  - `0b6844311305328fbfcce22d7f9ee526a7c03f95`
  - `b693094a3163134e9566d9410e40b6649dbefdbf`
  - `f03d9433694d16a59eff7222c171259600b8f73d`
- Branch head: resolve from Git; do not self-reference this handoff commit.

### Implementation summary

- Added strict, provider-neutral runtime producer, source-format, kind,
  outcome, non-production environment, provenance, manifest-record, manifest,
  runtime-item, and normalized collection Schemas and inferred types.
- Added the optional `EvidenceItem.runtimeProvenance` and a core invariant
  preventing external and runtime provenance from coexisting. Following
  coordinator review, the core EvidenceItem invariant also enforces
  `observed_runtime` trust and the exact runtime kind/type mapping whenever
  runtime provenance is present, so direct review-bundle inputs cannot bypass
  the normalized collection.
- Defined normalized runtime items with `safeExtend`, making their three
  allowed evidence types, `observed_runtime` trust, and runtime provenance
  structurally required in both inferred TypeScript and exported JSON Schema
  while preserving the core cross-field refinements.
- Enforced the three manifest variants, runtime type/trust/kind mapping,
  producer consistency, unique IDs, relationship and outcome bounds, safe
  duration, timestamp order, truncation consistency, and unavailable-source
  separation.
- Exported all new Zod contracts through `src/schemas/index.ts` and added the
  assigned deterministic Draft 2020-12 manifest and collection documents.
- Added focused tests covering positive cases, strict-object and injection
  rejection, inert injection-shaped summaries, exact vocabularies, all
  boundaries and refinements, existing generic/external evidence
  compatibility, and deterministic JSON Schema export.

### Validation

- Test-first prerequisite:
  - Initial focused invocation could not load `vitest` because the isolated
    worktree had no `node_modules`; it failed at startup with
    `ERR_MODULE_NOT_FOUND`. `npm ci` installed the already-locked dependencies
    into the ignored worktree directory, changed no package metadata, and
    reported 0 vulnerabilities.
- Test-first contract failure:
  - `npx vitest run tests/unit/runtime-evidence-schema.test.ts tests/unit/core-schemas.test.ts tests/unit/json-schema.test.ts`
  - Failed as intended: 1 failed / 2 passed files, 13 failed / 7 passed tests.
    All 13 new tests reached missing runtime Schema/export behavior; existing
    core and JSON Schema tests remained green.
- Final focused validation:
  - `npx vitest run tests/unit/runtime-evidence-schema.test.ts tests/unit/core-schemas.test.ts tests/unit/json-schema.test.ts`
  - Passed: 3 files, 23 tests.
- Coordinator changes-requested regression:
  - The coordinator demonstrated that the first implementation allowed an
    `EvidenceItem` with `runtimeProvenance.kind: test_case`,
    `type: document`, and `trustLevel: trusted_repository` when parsed outside
    `RuntimeEvidenceCollection`.
  - The new direct EvidenceItem regression initially failed as intended:
    1 failed / 22 passed tests; the malformed runtime item was accepted.
  - After commit `b693094a3163134e9566d9410e40b6649dbefdbf`,
    the core Schema rejects wrong runtime trust, wrong runtime type, wrong
    kind/type mapping, and dual provenance while accepting a correctly mapped
    runtime item. `runtimeEvidenceItemSchema` now adds only the required
    provenance-presence rule.
- Final post-review focused validation:
  - `npx vitest run tests/unit/runtime-evidence-schema.test.ts tests/unit/core-schemas.test.ts tests/unit/json-schema.test.ts`
  - Passed after the identity fix: 3 files, 23 tests.
- Public-type and JSON-Schema follow-up:
  - Before structural narrowing, the new focused runtime item test failed as
    intended: 1 failed / 23 passed tests because the JSON Schema omitted
    required runtime provenance. `npm run check` also failed because inferred
    runtime provenance was optional and runtime type/trust retained the generic
    EvidenceItem unions.
  - After `f03d9433694d16a59eff7222c171259600b8f73d`, the inferred
    `RuntimeEvidenceItem` requires runtime provenance, narrows type to
    `test_result | runtime_observation | configuration`, and narrows trust to
    `observed_runtime`. Direct JSON Schema tests confirm the required field,
    type enum, and trust const.
  - Final focused result: 3 files, 24 tests passed.
- `npm run check`
  - Passed with no TypeScript errors.
- First final `npm test`
  - Passed: 28 files, 282 tests.
- Second consecutive final `npm test`
  - Passed: 28 files, 282 tests.
- `npm run smoke:stdio`
  - Passed; server advertised the existing eight tools and returned the
    expected M1 compatibility fixture.
- `npm run pack:check`
  - Passed; dry-run tarball contained 165 files, including the compiled runtime
    Schema declarations and modules.
- `git diff --check 2cadae39073e8b1bcafc714259a1ff1d0583b110..HEAD`
  - Passed with no whitespace errors.
- `git status --short`
  - Passed after the handoff commit; no output.

### Deviations from assignment

- None.

### Known limitations and risks

- This slice defines and validates Schemas only. It does not parse vendor
  formats, read manifests, normalize records, collect evidence, register an MCP
  tool, or modify bundle/report behavior.
- Zod `superRefine` rules such as timestamp ordering, producer equality,
  cross-array combined bounds, and relationship uniqueness are enforced by the
  executable Zod Schemas. JSON Schema export is deterministic and carries the
  structural constraints, but Draft 2020-12 cannot express every executable
  cross-field rule emitted by these refinements.
- No live vendor, staging, production, POSIX, or network compatibility claim is
  made by this Schema-only task.

### Decisions or questions for coordinator

- None. The frozen public fields and vocabularies were implementable without a
  dependency, circular import, or contract change.

### Protected-file confirmation

- [x] Only allowed paths changed.
- [x] No dependency, collector, MCP, bundle, report, workflow, governance,
      version, release, or npm-state change was performed.
- [x] All intended handoff changes are committed and the worktree is clean.

## Coordinator review — coordinator owned

- Outcome: `pending`
- Reviewed branch head:
- Integration commits:

### Review findings

- Pending.

### Required follow-up

- Pending review.

### Roadmap and release impact

- M6 is in progress. This task cannot complete the milestone or authorize a
  release.
