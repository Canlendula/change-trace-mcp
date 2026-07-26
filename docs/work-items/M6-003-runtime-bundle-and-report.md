# M6-003 — Preserve runtime relationships through bundle and report

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M6 — Runtime and staging evidence`
- Base commit: `e79766548af11583fcc9de9c01ec87ff153ef970`
- Branch: `codex/M6-003-runtime-bundle-and-report`
- Worktree:
  `D:\projects\change-trace-worktrees\M6-003-runtime-bundle-and-report`
- Push task branch: `no`
- Objective: carry accepted runtime available and unavailable evidence through
  deterministic bundle construction and final JSON/Markdown reports with
  validated change/document relationships, conditional runtime-sensitive
  identity, and no legacy replay drift.
- Dependencies: accepted M6-001/M6-002, Decisions 27–29, accepted M5 external
  bundle/report provenance, and the M3 replay stability gate.

### Coordinator-owned missing-evidence contract

Move the existing generic `missingEvidenceSchema` and existing
`MissingEvidence` type to a cycle-free `src/schemas/missing-evidence.ts`
module without changing their public fields or meaning. Existing external and
legacy callers must remain strict and compatible. Re-export both names from
their prior `review-bundle.ts` module as well as the package Schema barrel so
direct module consumers do not lose the accepted symbol path.

Add strict `RuntimeUnavailableProvenance` with exactly:

- `producer`;
- `sourceFormat`;
- `manifestRecordId`;
- `kind`;
- `environment`;
- `accessStatus`: `not_found`, `inaccessible`, `unsupported`, `malformed`, or
  `truncated`;
- `relatedChangeIds`;
- `relatedEvidenceIds`.

Reuse the accepted producer/source-format/kind/environment/ID constraints.
Both relationship arrays remain bounded to 1,000 and reject duplicates.
Unavailable provenance has no outcome, timing, summary, artifact, executable,
credential, command, browser, probe, or trust fields.

Add a strict `RuntimeMissingEvidence` containing:

- the existing source, bounded reason, and normalized missing status;
- required `runtimeUnavailableProvenance`.

Enforce this exact mapping:

| Original access status | Missing status |
|---|---|
| `not_found` | `not_found` |
| `inaccessible` | `inaccessible` |
| `unsupported` | `unsupported` |
| `malformed` | `unsupported` |
| `truncated` | `truncated` |

`RuntimeEvidenceCollection.missingEvidence` must contain this runtime variant,
not anonymous generic missing records. `ReviewBundle.missingEvidence` accepts
the existing generic variant or the strict runtime variant. External evidence
collections continue to accept only the existing generic variant.

M6-002 normalization must populate unavailable provenance from the validated
manifest while preserving its redacted/bounded reason and normalized status.

### Coordinator-owned bundle input and ordering

`buildReviewBundleInputSchema` gains:

```text
runtimeEvidenceCollections: RuntimeEvidenceCollection[0..16], default []
```

Candidate ordering is:

1. local evidence;
2. external collection evidence;
3. non-runtime `additionalEvidenceItems`;
4. evidence from `runtimeEvidenceCollections` in collection/record order;
5. runtime-provenance `additionalEvidenceItems`;
6. generated Git evidence.

This preserves the relative order of every pre-M6 candidate. Runtime missing
evidence is appended after existing Git/local/external missing evidence in
runtime collection order.

### Coordinator-owned relationship validation

Apply these rules to every runtime-provenance available item, whether supplied
through a runtime collection or `additionalEvidenceItems`, and to every
runtime unavailable provenance record:

- every `relatedChangeId` must exist among the supplied `ChangeScope` commit
  and file IDs;
- every `relatedEvidenceId` must identify a supplied non-runtime
  `type: document` item from local evidence, external collections, or
  non-runtime additional evidence;
- targets with runtime provenance, Git/commit/test/configuration/other types,
  or unknown IDs are invalid;
- direct and collection paths cannot bypass the same checks.

Perform validation against the complete pre-limit static candidate set. Keep
the existing identical-ID deduplication and conflicting-ID rejection.

During limit application, retain static candidates before runtime candidates.
Before retaining a runtime item with related evidence IDs, require every
target ID to be already retained. If a target was omitted by the item or
excerpt budget, omit the dependent runtime item and account for it in bundle
truncation. Runtime items without related evidence remain eligible.

### Coordinator-owned bundle identity

Preserve the exact legacy bundle identity serialization when no retained
runtime item or structured runtime missing evidence exists.

For each retained runtime item, conditionally add to that item's existing
identity entry:

- `relatedChangeIds`;
- full `runtimeProvenance`.

Conditionally add the ordered structured runtime missing-evidence records to
bundle identity. Changes to runtime outcome, timing, environment, producer,
format, kind, artifact references, related IDs, missing status/reason/source,
or unavailable provenance must change the bundle ID. Runtime `retrievedAt`
does not enter identity.

Existing local/external/additional/Git identities and all M3 replay bundle
hashes must remain byte-identical without runtime input.

### Coordinator-owned report contract

`ReportEvidenceSource` gains optional strict `runtimeProvenance`. Its Schema
must reject coexisting external/runtime provenance and, when runtime
provenance exists, enforce the accepted runtime type, `observed_runtime`
trust, and kind/type mapping.

`ReportMissingEvidence` accepts the generic or structured runtime missing
variant. `writeReport` copies the full bounded runtime provenance variants
from retained bundle records, but still omits evidence excerpts, selection
reasons, and artifact content.

For each available runtime source, Markdown must clearly render:

- producer ID/name/version;
- source format, manifest record ID, and runtime kind;
- environment kind/name/source;
- outcome, nullable start/completion, and nullable duration;
- related requirement/document evidence IDs;
- bounded artifact source references.

For each runtime missing entry, Markdown must label the observation as
unavailable/not observed and render its original access status, producer,
format, record, kind, environment, related change IDs, and related evidence
IDs. It must not label an outage, inaccessible result, malformed input, or
unsupported source as a failed behavior.

All dynamic runtime strings and source references use the accepted Markdown
containment helpers. JSON and Markdown must not copy evidence summaries,
excerpts, selection reasons, raw artifact content, commands, credentials, or
logs.

### Compatibility and exports

- Export the new Schemas/types through `src/schemas/index.ts` and the existing
  package root chain.
- The deterministic Draft 2020-12 runtime collection, review bundle, and report
  JSON Schemas reflect the additive variants.
- Existing generic `MissingEvidence` imports/types remain available.
- Existing callers may omit `runtimeEvidenceCollections`.
- Existing M1 fixture text, nine-tool set, non-runtime bundle IDs, M3 replay
  hashes/scores, and non-runtime report JSON/Markdown remain unchanged.

## In scope

- Cycle-free generic/runtime missing-evidence Schemas and public types.
- M6-002 unavailable normalization follow-up.
- Runtime collection bundle input, candidate/missing ordering, relationship
  validation, limit behavior, and conditional identity.
- Final-report Schema, JSON catalog, and safe Markdown runtime provenance.
- Small MCP description/schema expectation updates caused by the additive
  bundle input.
- Focused unit/integration tests and worker handoff.

## Out of scope

- JUnit/XML, Playwright, API-smoke, CI, browser-MCP, or vendor converters and
  fixtures; report discovery; live staging/network/browser/API access.
- Subject execution, artifact reads, screenshots/traces/log content,
  deployment, credentials, commands, retries, caching, or telemetry.
- New Finding categories/statuses, automated semantic judgment, review
  instruction changes, CI workflow changes, or milestone exit evidence.
- Changing available runtime vocabularies, production support, dependencies,
  package/lock metadata, versions, Roadmap, decisions, governance, release,
  tags, npm state, or GitHub state.

## Allowed paths

- `src/schemas/missing-evidence.ts`
- `src/schemas/runtime-provenance.ts`
- `src/schemas/runtime-evidence.ts`
- `src/schemas/review-bundle.ts`
- `src/schemas/external-evidence.ts` — import/refactor compatibility only
- `src/schemas/report.ts`
- `src/schemas/index.ts`
- `src/schemas/json-schema.ts` — only if required for deterministic exports
- `src/evidence/runtime/collect-runtime-evidence.ts`
- `src/evidence/bundle/build-review-bundle.ts`
- `src/reports/write-report.ts`
- `src/server.ts` — bundle tool description only
- `tests/unit/runtime-evidence-schema.test.ts`
- `tests/unit/runtime-evidence-collector.test.ts`
- `tests/unit/review-bundle.test.ts`
- `tests/unit/report-schema.test.ts`
- `tests/unit/report-write.test.ts`
- `tests/unit/json-schema.test.ts`
- `tests/unit/review-replay.test.ts`
- `tests/integration/runtime-evidence-stdio.test.ts`
- `tests/integration/stdio.test.ts` — only if additive input discovery requires
  an assertion
- `docs/work-items/M6-003-runtime-bundle-and-report.md` — worker handoff only

Reading other files is allowed. Writing outside this list is not.

## Coordinator-only paths

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- assignment/acceptance-criteria/coordinator-review sections of this file
- `src/git/**`
- `src/security/**`
- `src/evidence/external/**`
- `src/evidence/local/**`
- `src/findings/**`
- `tests/fixtures/**`
- `tests/helpers/**`
- `.github/**`
- package metadata, lockfile, dependencies, versions, release, and npm state

## Acceptance criteria

- [ ] Generic missing evidence remains strict and compatible; runtime
      collections/bundles/reports require and preserve the assigned structured
      unavailable provenance with exact status mapping.
- [ ] Runtime available and unavailable change/document relations reject
      unknown, runtime, non-document, and bypass-path targets.
- [ ] Candidate/missing ordering is deterministic and preserves pre-M6
      relative order.
- [ ] A retained runtime item cannot reference a static document omitted by
      bundle limits; dependent omission is reflected in truncation.
- [ ] Conditional bundle identity changes for every assigned runtime available
      or missing provenance/relationship change and excludes retrieval time.
- [ ] All legacy non-runtime bundle IDs, M3 replay hashes/scores, tool fixture,
      and report outputs remain unchanged.
- [ ] Report JSON and Markdown distinguish observed runtime outcomes from
      unavailable/not-observed records and preserve all assigned bounded
      provenance without copying excerpts/artifact content.
- [ ] Report Schemas reject dual provenance and wrong runtime
      type/trust/kind mapping.
- [ ] JSON Schema exports remain deterministic and expose the new strict
      variants.
- [ ] Focused tests, type checking, two consecutive full suites, stdio smoke,
      package dry-run, base diff, and clean-worktree checks pass.
- [ ] No converter, live access, execution, artifact read, Finding, review
      instruction, CI, dependency, version, governance, release, npm, or
      GitHub change occurs.

## Required validation

```text
npx vitest run tests/unit/runtime-evidence-schema.test.ts tests/unit/runtime-evidence-collector.test.ts tests/unit/review-bundle.test.ts tests/unit/report-schema.test.ts tests/unit/report-write.test.ts tests/unit/json-schema.test.ts tests/unit/review-replay.test.ts tests/integration/runtime-evidence-stdio.test.ts tests/integration/stdio.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run pack:check
git diff --check e79766548af11583fcc9de9c01ec87ff153ef970..HEAD
git status --short
```

The worker must report exact test-first failure evidence, final command
results, relationship/identity/legacy cases exercised, known limitations,
deviations, and decision requests.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this full task,
   Decisions 27–29, the M6 Roadmap section, accepted M6-001/M6-002 code/tests,
   current missing/external/review/report Schemas, bundle builder, report
   writer, JSON Schema exports, stdio integration, and M3 replay stability
   tests.
2. Confirm the isolated branch/worktree, assigned base, assignment commit, and
   clean status.
3. Write failing tests first for runtime unavailable provenance, both
   relationship paths, limit-dependent omission, identity changes/stability,
   JSON/Markdown rendering/containment, strict report variants, and legacy
   replay hashes.
4. Refactor the generic missing Schema without changing its public shape, then
   implement the smallest runtime Schema/normalizer/bundle/report changes.
5. Audit for circular imports, permissive unions, anonymous runtime missing
   records, status mismatch, relationship bypass, dangling retained IDs,
   ordering/hash drift, retrieval-time identity, dual provenance, report
   excerpt/artifact-content leakage, Markdown injection, and out-of-scope
   writes.
6. Run every required validation, update only the worker handoff, commit all
   output, and leave the worktree clean.

## Escalate when

- Decisions 27–29 or an accepted available runtime vocabulary must change;
- cycle-free strict variants or legacy public compatibility cannot be
  maintained inside the allowed paths;
- relationship validation or conditional identity would alter a pre-M6 replay
  hash;
- a dependency, credential, network/browser/process/artifact access, new
  Finding, converter, CI, version, release, or protected path is required;
- a new product/security decision is required.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M6-003-runtime-bundle-and-report`
- Implementation commits:
  - `3855b33511dff752999eccc0df0a134b5c78ac29`

### Implementation summary

- Moved the legacy generic missing-evidence contract into a cycle-free module,
  retained its former `review-bundle` export path, and added strict structured
  runtime unavailable provenance with exact access-status normalization.
- Carried runtime collection evidence through bundle construction with bounded
  input, assigned ordering, complete pre-limit relationship validation,
  dependent omission when a static document target is not retained, and
  conditional runtime identity fields.
- Preserved available and unavailable runtime provenance in report JSON and
  safely rendered observed outcomes separately from unavailable/not-observed
  records in Markdown.
- Added deterministic JSON Schema coverage and kept the nine-tool stdio
  surface, M1 fixture, non-runtime bundle identity, and M3 replay digests
  stable.

### Changed areas

- `src/schemas/missing-evidence.ts`,
  `src/schemas/runtime-provenance.ts`,
  `src/schemas/runtime-evidence.ts`, `src/schemas/review-bundle.ts`,
  `src/schemas/report.ts`, and export/compatibility seams: strict generic and
  runtime missing variants, report source variants, and deterministic public
  Schema exports.
- `src/evidence/runtime/collect-runtime-evidence.ts`: structured unavailable
  normalization retaining the manifest producer, format, record, kind,
  environment, original access status, and relationships.
- `src/evidence/bundle/build-review-bundle.ts`: runtime collections, ordering,
  relationship validation, limit-dependent omission, missing ordering, and
  conditional identity.
- `src/reports/write-report.ts` and `src/server.ts`: bounded JSON/Markdown
  provenance and additive bundle-tool discovery text.
- Focused Schema, collector, bundle, report, JSON Schema, replay, and stdio
  tests under the assigned test paths.

### Validation

| Command | Result | Notes |
|---|---|---|
| Test-first focused command from the assignment | Expected failure | Before implementation: 9 files, 144 tests; 19 failed and 125 passed. Thirteen failures directly exposed missing runtime unavailable provenance, collection input, relationships/identity, and report variants. Six stdio connections closed because the new worktree had not yet built `dist`; subsequent final focused runs used the built implementation and passed. |
| `npx vitest run tests/unit/runtime-evidence-schema.test.ts tests/unit/runtime-evidence-collector.test.ts tests/unit/review-bundle.test.ts tests/unit/report-schema.test.ts tests/unit/report-write.test.ts tests/unit/json-schema.test.ts tests/unit/review-replay.test.ts tests/integration/runtime-evidence-stdio.test.ts tests/integration/stdio.test.ts` | Pass | Final committed implementation: 9 files, 144 tests passed. |
| `npm run check` | Pass | Strict TypeScript check completed with no diagnostics. |
| `npm test` | Pass | First final consecutive run: 30 files, 332 tests passed. |
| `npm test` | Pass | Second final consecutive run: 30 files, 332 tests passed. |
| `npm run smoke:stdio` | Pass | Returned `ok: true`, the unchanged nine-tool set, and the byte-stable M1 compatibility fixture. |
| `npm run pack:check` | Pass | Dry-run package contained 181 files; 132.7 kB packed and 725.1 kB unpacked. No publish occurred. |
| `git diff --check e79766548af11583fcc9de9c01ec87ff153ef970..HEAD` | Pass | No whitespace errors. |
| `git status --short` | Pass | Clean before the handoff-only update; clean again after its commit. |

Relationship coverage includes available runtime collection input, direct
runtime additional input, and unavailable runtime records. Tests reject
unknown change IDs, unknown evidence IDs, runtime targets, and non-document
targets. A separate budget case removes a static document target and verifies
that its dependent runtime item is omitted and counted in truncation.

Identity coverage varies related change/evidence IDs, producer, source format,
manifest record, runtime kind, environment, outcome, start/completion,
duration, artifact references, missing source/reason/status, and unavailable
provenance. Runtime retrieval time remains identity-neutral. The accepted
legacy bundle ID and all nine frozen M3 replay digests remain unchanged.

### Public contract and documentation impact

- Public Schema exports add `RuntimeUnavailableProvenance`,
  `RuntimeMissingEvidence`, and the review missing union while retaining
  `MissingEvidence` from both the package Schema barrel and the former direct
  `review-bundle` module.
- `BuildReviewBundleInput` accepts an optional, default-empty array of up to 16
  runtime evidence collections.
- Report JSON Schema contains a strict runtime source variant requiring
  runtime provenance, runtime-compatible evidence types,
  `observed_runtime` trust, and structurally forbidden external provenance.
  Zod runtime validation additionally enforces the kind/type mapping.
- No Roadmap, decision, global documentation, package metadata, version, or
  release state was changed.

### Deviations from assignment

- None.

### Known limitations and risks

- As with the accepted core runtime EvidenceItem contract, the generated JSON
  Schema structurally represents the runtime report variant while the
  kind-to-type cross-field rule remains a Zod refinement. All MCP and library
  parsing paths enforce that refinement.
- Converter formats, active runtime access, artifact reads, and M6 exit
  fixtures remain intentionally outside this task.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

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
  a release.
