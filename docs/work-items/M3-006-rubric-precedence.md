# M3-006 — Stabilize review-rubric precedence

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M3 — Agent review loop`
- Base commit: `b1769e34ebd25784799560ae0016892689f1bd8c`
- Branch: `work/M3-006-rubric-precedence`
- Worktree:
  `D:\projects\change-trace-worktrees\M3-006-rubric-precedence`
- Push task branch: `no`
- Objective: Make the compact, Host-neutral review instruction apply the
  accepted missing-evidence, contradictory-evidence, and undocumented-behavior
  rules with explicit precedence. The change responds to a ground-truth-blind
  instruction `1.1.0` replay in which every output finding was schema-valid and
  every no-finding precision control passed, but OpenCode still returned no
  finding for an assessment blocked by inaccessible evidence.
- Dependencies: Accepted M3-002 fixtures, M3-003 scorer, M3-004 replay helper,
  and M3-005 rubric. No public MCP, production schema, fixture ground-truth,
  scorer, Host-specific adapter, threshold, or compatibility change is
  authorized.

### Replay evidence supplied by the coordinator

- Replay schema: `1.0.0`; instruction: `1.1.0`; all nine accepted bundle
  digests remained unchanged.
- Codex Desktop / `gpt-5.6-terra`: 8 of 9 fixture scores passed.
  - The only miss used `investigate` for an undocumented implementation
    behavior whose accepted disposition is to update documentation.
- Claude Code / `deepseek-v4-pro`: 8 of 9 fixture scores passed.
  - The only miss treated directly conflicting documents as a confirmed
    documentation correction instead of an unresolved contradiction.
  - One structured-output attempt for inaccessible evidence exhausted retries;
    a declared recovery attempt then returned a valid inconclusive finding.
- OpenCode / `deepseek-v4-pro`: 6 of 9 fixture scores passed.
  - It returned an empty finding array when inaccessible evidence materially
    blocked assessment.
  - It marked directly conflicting evidence as `suspected` rather than
    `inconclusive`.
  - It used `investigate` for undocumented behavior despite correctly selecting
    `undocumented_behavior` and `suspected`.
- All three Hosts passed the three accepted no-finding controls and the general
  insufficient-evidence control.
- All submitted findings were schema-valid, used accepted evidence/source
  references, and produced zero scorer rejections.
- OpenCode ran with all tools disabled; no `tool_use` event occurred.
- The packets contained no expected outcomes, reference findings, or rationale.
  Do not use replay output to modify accepted ground truth.

### In scope

- Bump only `REPLAY_INSTRUCTION_VERSION` for the revised semantics while keeping
  `REPLAY_SCHEMA_VERSION` and the packet/capture shape unchanged.
- Replace prose that leaves rule priority implicit with a compact, ordered,
  Host/model-neutral decision rubric.
- State that blocked assessment takes precedence over the no-finding rule:
  missing or inaccessible evidence that materially blocks the requested
  assessment must produce exactly one bounded
  `other` / `inconclusive` / `investigate` finding.
- State that direct unresolved evidence conflict maps to
  `contradictory_evidence` / `inconclusive` / `investigate`; matching one side
  of the conflict does not establish the intended corrective direction.
- State that implementation behavior absent from documentation and lacking
  approval/intent evidence maps to
  `undocumented_behavior` / `suspected` / `update_documentation`.
- Keep `confirmed` reserved for cases where both the inconsistency and intended
  corrective direction are established.
- Preserve the accepted mappings for requirement missing, stale documentation,
  supported no-finding responses, exact evidence IDs, exact affected sources,
  deterministic facts/inference separation, untrusted evidence, no tools, and
  strict JSON output.
- Add focused regression tests proving:
  - the instruction version changed while replay schema and all bundle digests
    did not;
  - precedence and all three explicit mappings above are present;
  - the instruction remains fixture-independent and Host/model neutral;
  - packets remain byte-stable and isolated from expected/reference/rationale
    data;
  - all replay/capture/scorer tests remain unchanged and pass.

### Out of scope

- Changing any bundle, expected outcome, reference finding, fixture loader,
  validator, response schema, or scorer behavior.
- Encoding fixture IDs, expected files, concrete values, accepted evidence IDs,
  or fixture-specific answers in the instruction.
- Invoking or configuring Codex, Claude Code, OpenCode, model APIs, MCP tools,
  browsers, network services, permissions, retries, or result files.
- Choosing or changing the M3 quality threshold.
- Changing production source, public schemas, package scripts, dependencies,
  README, Roadmap, project decisions, versions, tags, releases, or npm state.

### Allowed paths

- `tests/helpers/review-replay.ts`
- `tests/unit/review-replay.test.ts`
- `docs/work-items/M3-006-rubric-precedence.md` — Worker handoff section only

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
- [ ] The decision rubric gives blocked assessment and unresolved contradiction
      explicit priority over empty, confirmed, or suspected outcomes.
- [ ] Undocumented behavior without approval/intent evidence has the explicit
      accepted category/status/disposition mapping.
- [ ] The rubric remains compact, fixture-independent, and Host/model neutral.
- [ ] Evidence-ID, source-reference, fact/inference, no-tool, untrusted-data,
      supported no-finding, and strict-output rules remain present.
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
git diff --check b1769e34ebd25784799560ae0016892689f1bd8c..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task file,
   the accepted M3-002/M3-003/M3-004/M3-005 helper and tests, and finding
   validation.
2. Confirm the assigned branch/worktree and exact base relationship.
3. Add version/precedence/mapping/isolation regression tests before changing the
   instruction.
4. Implement only the compact generic decision rubric; audit it for
   fixture-specific leakage and Host/model coupling.
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

- Status: `ready_for_review`
- Handoff branch: `codex/M3-006-rubric-precedence`
- Implementation commits:
  - `9ea1303` — test: clarify review rubric precedence

### Implementation summary

- Bumped only `REPLAY_INSTRUCTION_VERSION` to `1.2.0`; the replay schema,
  packet and capture shapes, response contract, canonical serialization, and
  bundle digests remain unchanged.
- Replaced the implicit-priority prose with a compact ordered rubric: blocked
  assessment precedes empty, confirmed, and suspected outcomes; unresolved
  direct conflict maps to `contradictory_evidence` / `inconclusive` /
  `investigate`; undocumented behavior without approval or intent maps to
  `undocumented_behavior` / `suspected` / `update_documentation`.
- Retained the established requirement-missing, stale-documentation,
  evidence-ID, exact-source, fact/inference, untrusted-data, no-tool,
  supported-no-finding, and strict-output rules.
- Added regression coverage for instruction versioning, ordered precedence,
  the three generic mappings, fixed bundle digests, byte-stable packet
  preparation, and fixture/Host/model/ground-truth isolation.

### Changed areas

- `tests/helpers/review-replay.ts` — revised only the versioned generic review
  instruction.
- `tests/unit/review-replay.test.ts` — added precedence, mapping, version,
  digest, and isolation regressions.
- `docs/work-items/M3-006-rubric-precedence.md` — this Worker handoff only.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/unit/review-replay.test.ts tests/integration/review-replay-cli.test.ts tests/unit/review-score.test.ts tests/unit/review-fixture.test.ts` | Passed | 4 files, 55 tests passed. |
| `npm run check` | Passed | TypeScript no-emit check. |
| `npm test` | Passed | 16 files, 142 tests passed. |
| `npm run smoke:stdio` | Passed | Existing stdio smoke check returned `ok: true`. |
| `npm run pack:check` | Passed | Dry-run package build completed. |
| `git diff --check b1769e34ebd25784799560ae0016892689f1bd8c..HEAD` | Passed | No whitespace errors. |
| `git status --short` | Passed | Clean after implementation commit; rechecked after the handoff commit. |

### Public contract and documentation impact

- None. The change is confined to test-only replay tooling and this work-item
  handoff.

### Deviations from assignment

- The provided worktree was detached at assignment commit `9398f76`, so this
  worker created `codex/M3-006-rubric-precedence` from that commit. No assigned
  `work/` branch was modified.

### Known limitations and risks

- The rubric does not invoke or configure any Host or model; replay execution
  and quality-threshold decisions remain outside this task.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head:
  `0c7b492fc693168b687bd2620ff735fde686152a`
- Integration commit: fast-forwarded to `main`; acceptance record pending in this
  commit.

### Review findings

- None.

### Required follow-up

- Re-run the unchanged nine-fixture suite through Codex, Claude Code, and
  OpenCode with instruction version `1.2.0`, then evaluate the declared M3
  quality gate without changing accepted ground truth.

### Roadmap and release impact

- The ordered Host-neutral rubric is accepted. M3 completion remains contingent
  on the final cross-Host replay, recorded quality threshold, and durable result
  evidence.
