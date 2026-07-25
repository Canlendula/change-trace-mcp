# M3-007 — Add review precision guards

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M3 — Agent review loop`
- Base commit: `14563241f3e8d64eaf9dc6c8d7bec77406501f9e`
- Branch: `work/M3-007-precision-guards`
- Worktree:
  `D:\projects\change-trace-worktrees\M3-007-precision-guards`
- Push task branch: `no`
- Objective: Add the final generic precision and field-level guards to the
  compact Host-neutral instruction. The change responds to instruction `1.2.0`
  replay evidence showing one unsupported test-gap finding, one confusion
  between deterministic-fact IDs and evidence-item IDs, and a repeated empty
  response for access-denied evidence that was directly referenced by the
  behavior under review.
- Dependencies: Accepted M3-002 fixtures, M3-003 scorer, M3-004 replay helper,
  M3-005 semantic rubric, and M3-006 precedence rubric. No public MCP,
  production schema, fixture ground-truth, scorer, Host adapter, threshold, or
  compatibility change is authorized.

### Replay evidence supplied by the coordinator

- Replay schema: `1.0.0`; instruction: `1.2.0`; all nine accepted bundle
  digests remained unchanged.
- Codex Desktop / `gpt-5.6-terra`: 9 of 9 fixture scores passed with zero
  rejected findings.
- Claude Code / `deepseek-v4-pro`: 7 of 9 fixture scores passed.
  - One supported implementation generated a `test_gap` because more negative
    tests could be useful, although no evidence explicitly required that
    coverage.
  - One semantically correct requirement finding copied valid evidence-item
    IDs but also placed `bundle.deterministicFacts[].id` values in
    `finding.evidenceIds`, causing validation rejection.
- OpenCode / `deepseek-v4-pro`: 8 of 9 fixture scores passed.
  - It again returned no finding for access-denied evidence, treating agreement
    between visible code and documentation as sufficient even though both
    directly referenced the inaccessible source.
- OpenCode ran with all tools disabled and produced no `tool_use` event.
- The accepted no-finding, exact-ID, and missing-evidence ground truth is
  unchanged. Do not modify fixtures or scorer behavior in response.

### In scope

- Bump only `REPLAY_INSTRUCTION_VERSION`; keep `REPLAY_SCHEMA_VERSION`,
  packet/capture shapes, response contract, and bundle hashes unchanged.
- Keep the instruction compact, ordered, fixture-independent, and Host/model
  neutral.
- Define materially blocking missing evidence structurally:
  - a non-empty `bundle.missingEvidence` entry is material when its source is
    directly referenced by available requirements, implementation, facts, or
    the requested behavior assessment;
  - visible code/document agreement does not remove that uncertainty;
  - retain the existing exactly-one
    `other` / `inconclusive` / `investigate` outcome.
- Add a precision guard for `test_gap`:
  - do not report a test gap merely because more tests or edge cases could be
    useful;
  - require available authoritative evidence to explicitly require coverage
    that is absent.
- Clarify field-level ID provenance:
  - every value in `finding.evidenceIds` and every nested
    `deterministicFacts[].evidenceIds` must equal an
    `bundle.evidenceItems[].id` value byte-for-byte;
  - never place `bundle.deterministicFacts[].id`, change/file IDs, or any other
    identifier in evidence-ID fields.
- Preserve all accepted precedence, category/status/recommendation,
  supported-no-finding, exact-source, fact/inference, untrusted-data, no-tool,
  and strict-output rules.
- Add focused tests proving the new version and all three guards are present
  without fixture IDs, concrete values, expected/reference/rationale data,
  Host names, or model names.
- Keep the nine bundle digests and all existing replay/scorer behavior stable.

### Out of scope

- Changing bundles, expected outcomes, reference findings, fixture loader,
  validator, JSON Schema, response contract, or scorer behavior.
- Encoding fixture IDs, expected files, concrete values, accepted evidence IDs,
  or fixture-specific answers in the instruction.
- Invoking/configuring Hosts, models, tools, permissions, retries, or result
  files.
- Choosing or changing the M3 quality threshold.
- Changing production source, public schemas, package scripts, dependencies,
  README, Roadmap, project decisions, versions, tags, releases, or npm state.

### Allowed paths

- `tests/helpers/review-replay.ts`
- `tests/unit/review-replay.test.ts`
- `docs/work-items/M3-007-precision-guards.md` — Worker handoff section only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- Assignment and Coordinator review sections of this task file
- `tests/helpers/review-fixture.ts`
- `tests/helpers/review-score.ts`
- `tests/fixtures/review/**`
- `tests/evaluation/review-replay-cli.ts`
- all existing tests outside `tests/unit/review-replay.test.ts`
- `src/**`
- `scripts/**`
- `README.md`
- `package.json`
- `package-lock.json`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The instruction version is bumped and replay/capture schema plus response
      contract remain unchanged.
- [ ] Material missing evidence has a structural, Host-neutral definition that
      preserves the required bounded inconclusive outcome.
- [ ] Optional additional coverage cannot create a `test_gap` without explicit
      authoritative coverage requirements.
- [ ] Evidence-ID fields are explicitly restricted to exact
      `bundle.evidenceItems[].id` values and exclude deterministic-fact/change
      identifiers.
- [ ] All accepted M3-005/M3-006 semantic, precedence, precision, reference, and
      output rules remain present.
- [ ] Packet ordering, canonical serialization, bundle digests, JSON Schema
      references, capture limits, scorer integration, and output confinement
      behavior remain unchanged.
- [ ] No fixture, scorer, production/public contract, dependency, package
      metadata, Host result, threshold, or release state is changed.
- [ ] The task branch is clean and all implementation plus Worker handoff
      changes are committed.

### Required validation

```text
npx vitest run tests/unit/review-replay.test.ts tests/integration/review-replay-cli.test.ts tests/unit/review-score.test.ts tests/unit/review-fixture.test.ts
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 14563241f3e8d64eaf9dc6c8d7bec77406501f9e..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task file,
   the accepted M3-002 through M3-006 helper/tests, and finding validation.
2. Confirm the assigned branch/worktree and exact base relationship.
3. Add version/materiality/test-gap/ID-provenance/isolation tests before
   changing the instruction.
4. Implement only the compact generic guards; audit them for fixture leakage
   and Host/model coupling.
5. Run every required validation command.
6. Review changed paths and the complete base diff for scope violations.
7. Update only the Worker handoff section, commit all output, and leave the
   worktree clean at `ready_for_review`.

### Escalate when

- accepted fixture ground truth, scorer, validator, response contract,
  production behavior, or a public contract must change;
- a Host-specific adapter/config, package script, dependency, credential, or
  quality threshold is required;
- a guard cannot remain fixture-independent and Host/model neutral;
- implementation would touch a coordinator-only path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M3-007-precision-guards`
- Implementation commits:
  - `403cf87` — test: add review precision guards

### Implementation summary

- Bumped only the replay instruction version to `1.3.0`; the replay schema,
  packet and capture shapes, response contract, canonical serialization, and
  bundle digest inputs remain unchanged.
- Added compact, Host-neutral instruction guards for structurally material
  missing evidence, authoritative test-gap requirements, and evidence-ID field
  provenance.
- Added focused regression coverage for the version, each guard, bundle digest
  stability, and instruction isolation from fixture-specific, reference, and
  Host-specific data.

### Changed areas

- `tests/helpers/review-replay.ts` — instruction version and compact precision
  guards.
- `tests/unit/review-replay.test.ts` — focused guard, version, stability, and
  leakage regression tests.
- `docs/work-items/M3-007-precision-guards.md` — this Worker handoff only.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/unit/review-replay.test.ts tests/integration/review-replay-cli.test.ts tests/unit/review-score.test.ts tests/unit/review-fixture.test.ts` | PASS | 4 files, 59 tests passed. |
| `npm run check` | PASS | TypeScript no-emit check completed. |
| `npm test` | PASS | 16 files, 146 tests passed. |
| `npm run smoke:stdio` | PASS | Build and stdio smoke completed. |
| `npm run pack:check` | PASS | Dry-run package check completed. |
| `git diff --check 14563241f3e8d64eaf9dc6c8d7bec77406501f9e..HEAD` | PASS | No whitespace errors. |
| `git status --short` | PASS | Clean after the handoff commit. |

### Public contract and documentation impact

- None. This is a test-only replay-instruction update; no production or public
  contract changed.

### Deviations from assignment

- This Codex worktree started detached while the assigned `work/` branch was
  attached to its designated external worktree. The implementation is attached
  to `codex/M3-007-precision-guards` and descends from the assigned commit;
  the shared task branch was not changed.
- Installed the existing lockfile dependencies with `npm ci` because this
  worktree initially had no local `node_modules`; package metadata and lockfile
  were unchanged.

### Known limitations and risks

- The guards improve replay guidance only. Existing finding validation remains
  the authority for submitted output validity.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending | accepted | changes_requested | rejected`
- Reviewed branch head:
- Integration commit:

### Review findings

- `<finding, or None>`

### Required follow-up

- `<follow-up, or None>`

### Roadmap and release impact

- `<coordinator assessment>`
