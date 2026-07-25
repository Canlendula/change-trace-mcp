# M5-006 — Guard the CI report catalog contract

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M5 — External documentation adapters`
- Base commit: `54e609e03b486f9e75267aa04cdbaaf65c7105f5`
- Branch: `codex/M5-006-ci-report-schema-guard`
- Worktree:
  `D:\projects\change-trace-worktrees\M5-006-ci-report-schema-guard`
- Push task branch: `no`
- Objective: make the deterministic CI fixture and advisory validation path
  honor Decision 26's required final-report `evidenceSources` catalog.
- Dependency: accepted M5-004/M5-005 and failed artifact audit of GitHub run
  `30171504267`.

### Coordinator-owned failure evidence

GitHub run `30171504267` completed both jobs successfully at reviewed commit
`54e609e03b486f9e75267aa04cdbaaf65c7105f5`. Ubuntu passed 27 files / 242
tests and uploaded exactly three bounded artifacts with no annotations.

The downloaded `release-review.json` was not valid under the current required
`Report` contract: it omitted `evidenceSources`. Its SHA-256 was
`7877667753bee67ff1e327658e56772e6cde2f9ac8a0be4d083dd5b63f2bbef1`.
The run therefore proves orchestration and tests, but fails the M5 artifact
contract.

Root cause:

- `tests/fixtures/ci/fixture-host.mjs` hand-builds the old M4 report shape;
- `scripts/ci/advisory-runner.mjs` performs a portable manual report check that
  was not extended for Decision 26;
- `scripts/ci/smoke-advisory-ci.mjs` checks files/status/revisions but not the
  current report catalog.

### Coordinator-owned fix contract

- Add `evidenceSources: []` to the deterministic CI fixture report.
- Extend the standalone advisory runner's successful-report validation to
  require a bounded `evidenceSources` array.
- Validate each catalog entry against the Decision 26 projection fields:
  evidence ID/type, exact source reference, retrieval time, nullable SHA-256
  hash, related change IDs, trust level, bounded redaction records, and
  optional exact external provenance.
- Reject unknown fields inside a catalog entry and its nested source,
  redaction, adapter, and provenance objects.
- Enforce the Report bounds used by the catalog: 10,000 entries, 1,000 related
  change IDs, and 100 redaction records.
- Require `evidenceCoverage.totalEvidenceItems` to equal the catalog length.
- Keep the runner standalone and dependency-free; do not import built output or
  add dependencies.
- Add a fixture behavior that omits `evidenceSources` and prove the advisory
  runner classifies it as bounded `infrastructure_failure` with
  `report_inconsistent`.
- Extend the deterministic smoke to read `release-review.json`, require
  `evidenceSources`, and require the zero-evidence fixture to emit `[]`.
- Parse the clean fixture report with the actual `reportSchema` in TypeScript
  integration tests so future schema additions cannot silently bypass this
  fixture.
- Preserve all existing advisory outcome, artifact, mutation/race, secrecy,
  revision, and rerun tests.

This task updates the deterministic validation fixture and the generic
advisory runner. It does not change MCP report generation, Report Schema, CI
workflow YAML, or Decision 26.

## In scope

- Fix the deterministic CI report fixture.
- Extend standalone runner validation for the evidence-source catalog.
- Strengthen local smoke and integration regression tests.
- Update only the worker-owned handoff section of this file.

## Out of scope

- Report Schema/writer changes, MCP changes, external adapters, Roadmap,
  decisions, workflow YAML, action pins, dependencies, versions, releases, or
  npm state.
- Retrofitting the standalone runner into a full Zod implementation for every
  legacy Report field; only the Decision 26 catalog and its coverage count are
  added to the existing portable validation boundary.
- Rerunning GitHub Actions; the coordinator owns the final cloud execution and
  artifact audit.

## Allowed paths

- `tests/fixtures/ci/fixture-host.mjs`
- `scripts/ci/advisory-runner.mjs`
- `scripts/ci/smoke-advisory-ci.mjs`
- `tests/integration/advisory-ci.test.ts`
- `tests/integration/provider-neutral-ci.test.ts`
- `docs/work-items/M5-006-ci-report-schema-guard.md`, worker handoff only

Reading other files is allowed. Writing outside this list is not.

## Coordinator-only paths

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- assignment/acceptance criteria and coordinator-review sections of this file
- `src/**`
- `.github/**`
- package metadata, lockfile, release, and npm state

## Acceptance criteria

- [ ] The clean deterministic fixture parses with the current `reportSchema`
      and contains `evidenceSources: []`.
- [ ] The standalone runner rejects a missing, oversized, malformed,
      unknown-field, or coverage-count-mismatched evidence-source catalog as
      `report_inconsistent`.
- [ ] Valid core and external catalog entries pass the standalone validation
      and preserve existing outcome classification.
- [ ] Catalog/nested bounds, enums, exact keys, timestamps, hashes, stable IDs,
      source references, redactions, and optional external provenance are
      checked without dependencies.
- [ ] `smoke:ci` fails if the deterministic report lacks the catalog and passes
      only with `evidenceSources: []`.
- [ ] Existing failure artifact, advisory outcome, secrecy, mutation/race,
      revision, rerun, and managed-artifact tests remain green.
- [ ] Focused tests, type checking, two consecutive full suites, stdio smoke,
      deterministic CI smoke, package dry-run, diff, and clean checks pass.
- [ ] No source, schema, workflow, dependency, version, governance, release, or
      npm state changes.

## Required validation

```text
npx vitest run tests/integration/advisory-ci.test.ts tests/integration/provider-neutral-ci.test.ts tests/unit/report-schema.test.ts tests/unit/report-write.test.ts tests/integration/external-source-fixtures.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run smoke:ci
npm run pack:check
git diff --check 54e609e03b486f9e75267aa04cdbaaf65c7105f5..HEAD
git status --short
```

The worker must report exact expected-failure evidence, final commands/results,
and the catalog cases exercised. Do not omit transient failures.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this full task, Decision
   26, the report/evidence/provenance schemas, all allowed files, and the
   relevant M4 advisory tests.
2. Confirm the isolated branch/worktree, exact base, and clean status.
3. Write failing tests for the clean fixture's real `reportSchema`, missing
   catalog, malformed/unknown/bounds/coverage cases, and smoke guard before
   changing fixture/runner/smoke production scripts.
4. Implement the smallest dependency-free validation helpers and fixture/smoke
   updates satisfying the frozen contract.
5. Audit for unsafe content projection, overly permissive objects, accidental
   full-schema divergence, changed outcome precedence, and out-of-scope paths.
6. Run all required gates; update only the worker handoff; commit everything
   and leave the worktree clean.

## Escalate when

- compliance requires a new dependency, Report Schema change, source/MCP
  change, or workflow change;
- existing outcome precedence or failure artifacts must change;
- the clean fixture cannot satisfy `reportSchema` without broad M4 rewrites;
- another public-contract mismatch is discovered.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Implementation commit(s):
  - `3ab269321db69ccacfb92292e128c19ace0147fc`
  - `7796054e8404e03b439bc3038cd9a8c581914d91`
- Branch head: resolve the current
  `codex/M5-006-ci-report-schema-guard` head after the handoff commit; the
  handoff commit is intentionally not self-referenced.

### Implementation summary

- Added the required empty `evidenceSources` catalog to the deterministic
  report fixture and schema-valid core/external catalog behaviors.
- Extended the dependency-free advisory runner with exact, bounded validation
  for catalog entries, source references, redactions, optional external
  provenance, and catalog/coverage count agreement.
- Added deterministic invalid fixture behaviors and integration coverage for
  missing/malformed catalogs, primitive/nested validation, unknown fields, all
  three catalog array bounds, and mismatched coverage.
- Extended the deterministic smoke to parse `release-review.json` and require
  the zero-evidence fixture's catalog to be exactly `[]`.

### Validation

- Test-first expected failure:
  - the first focused command could not start because this isolated worktree
    had no `node_modules`; it exited 1 while resolving `vitest/config`;
  - an ignored local junction to the coordinator worktree's installed
    dependencies restored the test prerequisite;
  - `npx vitest run tests/integration/advisory-ci.test.ts
    tests/integration/provider-neutral-ci.test.ts` then exited 1 with 16 failed
    / 24 passed: the clean report failed the real `reportSchema`, invalid
    catalog cases were accepted, and the smoke lacked the catalog guard.
- Transitional failures, all fixed:
  - after the first implementation, the same two-file command had 11 failures
    / 29 passes because the new tests looked for `status.reasonCode`; the
    existing bounded failure sidecar correctly stores the stable code at
    `status.error.code`, so the assertions were corrected without changing the
    runner output contract;
  - the first five-file required run had 1 failure / 88 passes because
    `dist/cli.js` had not been built in the isolated worktree; `npm run build`
    restored the documented prerequisite and the rerun passed 89/89.
- A final Zod-parity audit changed the invalid timestamp to February 30 and
  the invalid redaction count to an unsafe integer. The targeted command
  initially exited 1 with both cases accepted, proving that `Date.parse` and
  `Number.isInteger` were too permissive. Explicit Gregorian calendar checks
  and `Number.isSafeInteger` closed both gaps; the targeted rerun passed 2/2.
- Final required focused command: 5 files, 97 tests passed.
- `npm run check`: passed.
- Final first consecutive `npm test`: 27 files, 265 tests passed.
- Final second consecutive `npm test`: 27 files, 265 tests passed.
- `npm run smoke:stdio`: passed; all eight tools and the unchanged M1
  compatibility fixture were reported.
- `npm run smoke:ci`: passed with
  `outcome=completed_no_findings code=ok` and `smoke=ok`.
- `npm run pack:check`: passed; dry-run tarball contained 157 files.
- `git diff --check
  54e609e03b486f9e75267aa04cdbaaf65c7105f5..HEAD`: passed after the
  handoff commit.
- `git status --short`: clean after the handoff commit.

### Catalog validation and cloud-failure closure

- The clean fixture now contains `evidenceSources: []`, parses with the current
  public `reportSchema`, and retains `completed_no_findings`.
- Positive cases cover a redacted core Git diff with
  `trusted_repository` and an external document with exact adapter/provenance
  fields and `untrusted_external`.
- Negative cases cover invalid evidence/type/trust enums, stable IDs,
  calendar dates/timestamps, SHA-256 hashes, source references, related change
  IDs, safe redaction counts/values, and external provenance values.
- Exact-key rejection is exercised at catalog-entry, source, redaction,
  adapter, and provenance levels.
- Bounds are exercised at 10,001 catalog entries, 1,001 related change IDs,
  and 101 redactions. A catalog/coverage count mismatch is also rejected.
- Omitting the catalog now produces the existing bounded infrastructure
  artifact and sidecar with `outcome: infrastructure_failure` and
  `error.code: report_inconsistent`. This directly closes the validation gap
  that allowed GitHub run `30171504267` to upload an invalid success report.

### Deviations from assignment

- None reported.

### Known limitations and risks

- The standalone runner intentionally validates the Decision 26 projection and
  coverage count within its existing portable boundary; it remains a manual
  validator rather than a duplicate full Zod Report implementation.
- No GitHub Actions rerun or cloud artifact audit was performed. The
  coordinator owns that final evidence.

### Decisions or questions for coordinator

- None reported.

### Protected-file confirmation

- [x] Only allowed paths changed.
- [x] No source, schema, workflow, dependency, version, governance, release, or
      npm-state change was performed.
- [x] All intended handoff changes are committed and the worktree is clean.

## Coordinator review — coordinator owned

- Outcome: `pending`
- Reviewed branch head:
- Integration commit:

### Review findings

- Pending.

### Required follow-up

- Pending review.

### Roadmap and release impact

- M5 remains in progress until this guard is accepted and a new Ubuntu run
  uploads a report that satisfies Decision 26.
