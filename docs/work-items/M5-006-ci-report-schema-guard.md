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

- Status: `in_progress`
- Implementation commit(s):
- Branch head:

### Implementation summary

- Pending.

### Validation

- Pending.

### Catalog validation and cloud-failure closure

- Pending.

### Deviations from assignment

- None reported.

### Known limitations and risks

- Pending.

### Decisions or questions for coordinator

- None reported.

### Protected-file confirmation

- [ ] Only allowed paths changed.
- [ ] No source, schema, workflow, dependency, version, governance, release, or
      npm-state change was performed.
- [ ] All intended handoff changes are committed and the worktree is clean.

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
