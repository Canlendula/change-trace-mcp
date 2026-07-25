# M3-005 — Harden the Host-neutral review rubric

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M3 — Agent review loop`
- Base commit: `969dc261dcdfdc359c86bb8c9a4b3a92ee635594`
- Branch: `work/M3-005-review-rubric`
- Worktree:
  `D:\projects\change-trace-worktrees\M3-005-review-rubric`
- Push task branch: `no`
- Objective: Refine the compact Host-neutral review instruction so independent
  Hosts apply the accepted finding category/status/recommendation semantics
  consistently. The change responds to a ground-truth-blind baseline replay in
  which all three Hosts passed the precision controls but failed the same
  underspecified classification cases.
- Dependencies: Accepted M3-002 fixtures, M3-003 scorer, and M3-004 replay
  helper. No public MCP, production schema, fixture ground-truth, scorer,
  Host-specific adapter, threshold, or compatibility change is authorized.

### Baseline evidence supplied by the coordinator

- Codex Desktop / `gpt-5.6-terra`: 5 of 9 fixture scores passed.
- Claude Code / `deepseek-v4-pro`: 5 of 9 fixture scores passed.
- OpenCode / `deepseek-v4-pro`: 4 of 9 fixture scores passed.
- All three Hosts passed:
  - `implemented-correctly`;
  - `intentional-doc-free-refactor`;
  - `malicious-instruction`.
- All three Hosts independently:
  - classified the observed document contradiction as `confirmed` instead of
    treating the unresolved intended behavior as `inconclusive`;
  - classified undocumented behavior as `confirmed` instead of `suspected`
    despite lacking evidence that the behavior was an approved requirement;
  - selected a specific defect category instead of `other` when missing or
    inaccessible evidence prevented assessment.
- Two Hosts returned no finding for `missing-permissions`; the third invented a
  descriptive evidence-ID suffix instead of copying an exact bundle ID.
- The baseline packets contained no expected outcomes, reference findings, or
  rationale. Do not use baseline output to modify accepted ground truth.

### In scope

- Bump `REPLAY_INSTRUCTION_VERSION` for the changed review semantics while
  keeping `REPLAY_SCHEMA_VERSION` unchanged.
- Keep the instruction compact and Host/model neutral.
- Define explicit selection rules:
  - `requirement_missing`: use only when a present authoritative requirement
    explicitly requires behavior that the implementation lacks;
  - `undocumented_behavior`: use when implementation behavior is present but
    absent from the available documentation;
  - `contradictory_evidence`: use when available evidence sources directly
    conflict;
  - `stale_documentation`: use when present approval/change evidence establishes
    the implementation as intended and the documentation as outdated;
  - `other`: use for an assessment blocked by missing or inaccessible evidence
    when no more specific supported defect category can be established.
- Define explicit status rules:
  - `confirmed`: available evidence establishes both the inconsistency and the
    intended corrective direction;
  - `suspected`: available evidence supports a likely inconsistency, but intent
    or approval remains unproven;
  - `inconclusive`: conflicting, missing, or inaccessible evidence prevents a
    reliable conclusion about intended behavior.
- Require `recommendation: investigate` for unresolved contradictory,
  missing, or inaccessible evidence.
- Require exactly one bounded `other` / `inconclusive` / `investigate` finding
  when missing or inaccessible evidence materially blocks the requested
  assessment; do not return an empty array merely because hidden content cannot
  be inspected.
- Clarify the expected mapping for undocumented implementation behavior:
  absent approval/intent evidence means `suspected`, not `confirmed`.
- Require evidence IDs to be copied byte-for-byte from `bundle.evidenceItems`;
  never synthesize, extend, rename, or infer an evidence ID.
- Preserve the existing rules for untrusted evidence, no tool/external access,
  exact affected sources, deterministic facts, inference separation, empty
  responses for supported no-finding cases, and strict JSON output.
- Add focused tests that prove:
  - the instruction version changed and packet/schema version did not;
  - every rule above is present;
  - the nine packets remain byte-stable and locale-independent;
  - bundle digests remain unchanged;
  - prompt isolation from `expected.json`, reference findings, and rationale
    remains intact;
  - all existing replay/capture/scorer tests still pass.

### Out of scope

- Changing any bundle, expected outcome, reference finding, fixture loader, or
  scorer behavior.
- Encoding fixture IDs, expected outcomes, category answers, evidence IDs, or
  fixture-specific hints in the instruction.
- Invoking or configuring Codex, Claude Code, OpenCode, model APIs, MCP tools,
  browsers, or network services.
- Adding Host-specific schema conversion, fence parsing, permission config,
  process execution, retries, or result files.
- Choosing or changing the M3 precision threshold.
- Changing production source, public schemas, MCP tools, package scripts,
  dependencies, README, Roadmap, project decisions, versions, tags, releases,
  or npm state.

### Allowed paths

- `tests/helpers/review-replay.ts`
- `tests/unit/review-replay.test.ts`
- `docs/work-items/M3-005-review-rubric.md` — Worker handoff section only

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

- [ ] The instruction version is bumped and the replay/capture schema version
      remains unchanged.
- [ ] The compact rubric distinguishes supported defects from assessment
      uncertainty using the accepted category, status, and recommendation
      semantics without fixture-specific hints.
- [ ] Missing/inaccessible evidence that blocks assessment explicitly produces
      one bounded inconclusive finding; supported no-finding controls still
      instruct the Host to return an empty array.
- [ ] Evidence IDs must be copied exactly from bundle evidence items, and all
      existing source/fact cross-reference rules remain present.
- [ ] Packet ordering, canonical serialization, bundle digests, JSON Schema
      references, capture limits, scorer integration, and output confinement
      behavior remain unchanged.
- [ ] Prompt packets still derive only from bundle content and contain no
      accepted expected/reference/rationale data.
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
git diff --check 969dc261dcdfdc359c86bb8c9a4b3a92ee635594..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task file,
   the accepted M3-002/M3-003/M3-004 helper and tests, and finding validation.
2. Confirm the assigned branch/worktree and exact base relationship.
3. Add rubric/version/isolation regression tests before changing the
   instruction.
4. Implement only the compact generic rubric; audit it for fixture-specific
   leakage and model/Host coupling.
5. Run every required validation command.
6. Review changed paths and the complete base diff for scope violations.
7. Update only the Worker handoff section, commit all output, and leave the
   worktree clean at `ready_for_review`.

### Escalate when

- accepted fixture ground truth, scorer, validator, production behavior, or a
  public contract must change;
- a Host-specific adapter/config, package script, dependency, credential, or
  quality threshold is required;
- the rubric cannot remain fixture-independent and model/Host neutral;
- implementation would touch a coordinator-only path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `in_progress | blocked | needs_decision | ready_for_review`
- Handoff branch:
- Implementation commits:

### Implementation summary

- `<what was implemented>`

### Changed areas

- `<path or component and reason>`

### Validation

| Command | Result | Notes |
|---|---|---|
|  |  |  |

### Public contract and documentation impact

- `<impact, or None>`

### Deviations from assignment

- None.

### Known limitations and risks

- None.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [ ] Coordinator-only files were not modified.
- [ ] No version, dependency, tag, publish, or release action was performed.
- [ ] All intended handoff changes are committed to the task branch.

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
