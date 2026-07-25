# M3-003 — Implement deterministic semantic fixture scoring

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M3 — Agent review loop`
- Base commit: `0dc4e71028f36a78f6f321766cf554bacba9d05f`
- Branch: `work/M3-003-evaluation-scorer`
- Worktree:
  `D:\projects\change-trace-worktrees\M3-003-evaluation-scorer`
- Push task branch: `no`
- Objective: Implement a deterministic, test-only scorer that validates raw
  Agent findings and measures them against the semantic constraints in the
  nine M3 review fixtures. This task fixes the scoring contract before any
  cross-Host replay is executed.
- Dependencies: The accepted M3-002 fixture corpus and loader, plus the existing
  public `validateFindings` behavior. No public MCP, package, or schema change is
  authorized.

### In scope

- Add `tests/helpers/review-score.ts` with pure scoring functions for:
  - one loaded review fixture plus a raw `unknown[]` findings response;
  - a complete suite containing exactly one explicit response for each of the
    nine loaded fixture IDs.
- Validate raw Agent output through the existing `validateFindings` function
  before semantic scoring.
- Treat any rejected finding as a fixture failure. Preserve validation summary
  counts in the score. Safe enum-normalization warnings remain visible but do
  not independently fail a fixture because the existing validator accepts
  those normalized findings.
- Score only machine-readable semantics already present in `expected.json`:
  - minimum and maximum valid finding counts;
  - required category/status/recommendation matches;
  - complete required evidence-ID sets on each individual matched finding;
  - configured minimum match counts;
  - forbidden categories and statuses.
- Produce JSON-serializable, versioned score objects with deterministic ordering
  and no raw finding prose. A fixture score must include:
  - `schemaVersion`, `fixtureId`, and `passed`;
  - validation summary counts and validation `ok`;
  - the accepted valid-finding count;
  - count-bound results;
  - one result for every required semantic match;
  - one result for every configured forbidden category/status;
  - bounded, stable machine-readable failure codes.
- Use these fixture failure codes where applicable:
  - `finding_validation_failed`;
  - `finding_count_below_min`;
  - `finding_count_above_max`;
  - `required_match_missing`;
  - `forbidden_category_present`;
  - `forbidden_status_present`.
- Produce a suite score in lexicographic fixture-ID order with aggregate counts
  for fixtures passed/failed and findings submitted/valid/rejected/warned.
- Require the suite input to contain exactly the loaded fixture IDs. Missing and
  unexpected result keys are input errors; an explicit empty array remains a
  valid Host response for a no-findings fixture.
- Add `tests/unit/review-score.test.ts` covering:
  - all nine reference answers pass individually and as a suite;
  - all three no-findings precision controls accept explicit empty responses;
  - missing required findings fail;
  - schema-invalid raw findings fail even when other findings match;
  - an otherwise matching finding with an incomplete required evidence set
    fails its semantic match;
  - forbidden category and forbidden status failures;
  - malicious-instruction fabricated findings fail while the empty reference
    response passes;
  - safe enum normalization is counted as warnings but remains scoreable;
  - missing and unexpected suite keys are rejected distinctly from an explicit
    empty response;
  - result ordering and canonical serialization remain identical across
    different suite-map insertion orders and finding orders.

### Out of scope

- Calling Codex, Claude Code, OpenCode, or another model/Host.
- Defining Host prompts, captured-response files, a replay CLI, CI integration,
  or report publication.
- Choosing an acceptable precision threshold or declaring M3 complete.
- Comparing titles, explanations, confidence, severity, or other prose-like
  fields for exact equality.
- Changing fixture ground truth, fixture bundle content, production source,
  public schemas, MCP tools, package scripts, dependencies, README, Roadmap,
  project decisions, versions, tags, releases, or npm state.

### Allowed paths

- `tests/helpers/review-score.ts`
- `tests/unit/review-score.test.ts`
- `docs/work-items/M3-003-evaluation-scorer.md` — Worker handoff section only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- Assignment and Coordinator review sections of this task file
- `tests/helpers/review-fixture.ts`
- `tests/unit/review-fixture.test.ts`
- `tests/fixtures/review/**`
- `src/**`
- `scripts/**`
- `README.md`
- `package.json`
- `package-lock.json`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The scorer accepts raw untrusted finding arrays and always runs the
      existing `validateFindings` contract before semantic evaluation.
- [ ] Rejected findings deterministically fail the fixture; accepted
      normalization warnings remain visible without independently failing it.
- [ ] Count bounds, complete per-finding semantic matches, configured
      `minCount`, forbidden categories, and forbidden statuses are all scored.
- [ ] All score objects are bounded, JSON-serializable, versioned, and contain
      no raw Agent title, explanation, inference, or other finding prose.
- [ ] Fixture and suite score ordering is locale-independent and deterministic.
- [ ] Suite scoring distinguishes an explicit empty findings array from a
      missing result and rejects missing or unexpected fixture keys.
- [ ] Every accepted M3-002 reference answer passes, including the three empty
      precision controls and both inconclusive scenarios.
- [ ] Negative tests prove invalid, missing, incomplete-evidence, forbidden,
      and malicious fabricated outputs fail for the expected reason.
- [ ] No production source, public contract, package metadata, dependency,
      coordinator-only file, Host result, quality threshold, or release state
      is changed.
- [ ] The task branch is clean and all implementation plus Worker handoff
      changes are committed.

### Required validation

```text
npx vitest run tests/unit/review-score.test.ts tests/unit/review-fixture.test.ts
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 0dc4e71028f36a78f6f321766cf554bacba9d05f..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task file,
   the accepted M3-002 helper/tests, and `validateFindings`.
2. Confirm the assigned branch/worktree and exact base relationship.
3. Write negative scorer tests before implementing the scorer.
4. Implement single-fixture scoring and pass its positive/negative tests.
5. Implement exact-suite input validation, aggregate scoring, deterministic
   ordering, and permutation tests.
6. Run every required validation command.
7. Review changed paths and the complete base diff for scope violations.
8. Update only the Worker handoff section, commit all output, and leave the
   worktree clean at `ready_for_review`.

### Escalate when

- fixture ground truth or the accepted `expected.json` contract must change;
- `validateFindings` behavior must change;
- a production/public schema, CLI, MCP tool, package script, or dependency is
  required;
- a quality threshold, Host prompt, or captured-response format must be chosen;
- implementation would touch a coordinator-only path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M3-003-evaluation-scorer`
- Branch deviation: `work/M3-003-evaluation-scorer` was already checked out by
  an external coordinator worktree, so this worker created the authorized
  isolated branch from assignment commit `5b6b60c` instead.
- Implementation commits:
  - `1f9f58b test: add deterministic review fixture scorer`

### Implementation summary

- Added a versioned, deterministic test-only scorer that first validates raw
  findings with `validateFindings`, then evaluates valid-finding count bounds,
  required semantic matches with complete per-finding evidence sets, and
  configured forbidden categories and statuses.
- Added exact suite-key validation, stable code-unit ordering, aggregate
  validation counts, bounded failure codes, and score output that excludes raw
  finding prose.
- Added reference, negative, normalization, malicious-instruction, exact-suite,
  and permutation coverage for the accepted M3-002 fixture corpus.

### Changed areas

- `tests/helpers/review-score.ts` — pure fixture and suite scoring functions
  plus JSON-serializable score types.
- `tests/unit/review-score.test.ts` — 11 scorer tests covering all assigned
  acceptance cases.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/unit/review-score.test.ts tests/unit/review-fixture.test.ts` | Passed | 2 files, 41 tests. |
| `npm run check` | Passed | TypeScript no-emit check. |
| `npm test` | Passed | 14 files, 128 tests. |
| `npm run smoke:stdio` | Passed | stdio tool smoke check completed. |
| `npm run pack:check` | Passed | `npm pack --dry-run` completed. |
| `git diff --check 0dc4e71028f36a78f6f321766cf554bacba9d05f..HEAD` | Passed | No whitespace errors. |
| `git status --short` | Passed | Clean before this handoff edit; rechecked after committing it. |

### Public contract and documentation impact

- None. This task adds test-only evaluation infrastructure and does not change
  production source or public contracts.

### Deviations from assignment

- Used `codex/M3-003-evaluation-scorer` because the assigned
  `work/M3-003-evaluation-scorer` branch was occupied by another worktree.
  No scope or behavior deviation.

### Known limitations and risks

- The scorer remains test-only and intentionally does not define Host prompts,
  captured-response storage, quality thresholds, replay execution, or CI
  integration.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending`
- Reviewed branch head:
- Integration commit:

### Review findings

- Pending.

### Required follow-up

- Pending.

### Roadmap and release impact

- M3 remains in progress. No replay, Host quality, compatibility, milestone, or
  release claim is authorized by assigning this task.
