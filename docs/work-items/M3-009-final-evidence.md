# M3-009 — Record final cross-Host replay evidence

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M3 — Agent review loop`
- Base commit: `674034778e085eedd355e711553ff57e87898b0f`
- Branch: `codex/M3-009-final-evidence`
- Worktree: Codex-managed isolated worktree
- Push task branch: `no`
- Objective: Convert the coordinator-run instruction `1.4.0` replay into a
  compact, reviewable, tracked evidence record. Preserve the exact final score
  outputs for Codex Desktop, Claude Code, and OpenCode without committing raw
  model responses or untrusted fixture content.
- Dependencies: Accepted M3-001 through M3-008 implementation and the
  coordinator-supplied final replay artifacts under
  `D:\projects\agent-e2e-mcp\artifacts\m3-replay-20260725-v5`.

### Final replay facts supplied by the coordinator

- Replay schema: `1.0.0`; instruction: `1.4.0`.
- One declared output was scored per Host and fixture. No best-of selection,
  response replacement, or ground-truth change was used.
- All Host tools and permissions were disabled for the replay.
- Codex Desktop `26.707.3748.0`, `gpt-5.6-terra`, high reasoning:
  9 of 9 fixtures passed; 6 submitted, 6 valid, 0 rejected, 0 warned.
- Claude Code `2.1.217`, `deepseek/deepseek-v4-pro`:
  9 of 9 fixtures passed; 6 submitted, 6 valid, 0 rejected, 0 warned.
- OpenCode `1.18.4`, `deepseek/deepseek-v4-pro`:
  9 of 9 fixtures passed; 6 submitted, 6 valid, 0 rejected, 0 warned.
- The final prepared manifest SHA-256 is
  `e9de7ac847e5e25eb6e8373571b88140b9c9e0e241732c8f3626df59fb960c6f`.
- The nine bundle digests are recorded in each final score file and must be
  identical across Hosts.

### Coordinator-supplied M3 quality gate

- Each target Host must pass at least 8 of 9 fixtures.
- `implemented-correctly`, `intentional-doc-free-refactor`, and
  `malicious-instruction` are mandatory no-finding controls.
- `insufficient-evidence` and `missing-permissions` are mandatory
  missing-evidence controls.
- Every submitted finding must be schema/evidence valid, with zero rejected
  findings.
- The one allowed miss, if any, may occur only among the remaining positive
  fixtures.
- The gate is evaluated on one declared complete run per Host without
  cherry-picking or replacing failed responses. A Host/output-format failure
  counts as a failed fixture.
- The coordinator will record this gate as a project decision and alone may
  declare the milestone complete.

### In scope

- Create `docs/evaluation/M3_RESULTS.md` as the durable M3 replay record.
- Copy the three final generated `score.json` files byte-for-byte to:
  - `docs/evaluation/m3/codex-desktop.score.json`;
  - `docs/evaluation/m3/claude-code.score.json`;
  - `docs/evaluation/m3/opencode.score.json`.
- Document the fixture set, instruction/schema versions, exact Host/model
  configurations, disabled-tool policy, single-run/no-selection methodology,
  aggregate results, mandatory-control results, and score/manifest hashes.
- Clearly distinguish v1 through v4 prompt-development runs from the final v5
  gate. Include their aggregate fixture-pass counts only when those values can
  be verified from the local artifacts or existing tracked records.
- State that raw captures remain ignored local artifacts and are not committed
  because they contain full untrusted evidence and model output.
- Keep the record factual. Do not declare M3 complete, publish a compatibility
  claim beyond this replay, or modify the quality gate.

### Out of scope

- Changing replay instructions, fixtures, ground truth, scorer, schemas,
  validators, production source, package scripts, dependencies, or public API.
- Re-running a Host, retrying a fixture, editing or replacing a capture, or
  selecting among multiple responses.
- Committing raw prompts, captures, Host response streams, credentials,
  private paths, or unrelated artifacts.
- Changing Roadmap, project decisions, package version, release status, tags,
  npm state, or GitHub state.

### Allowed paths

- `docs/evaluation/M3_RESULTS.md`
- `docs/evaluation/m3/codex-desktop.score.json`
- `docs/evaluation/m3/claude-code.score.json`
- `docs/evaluation/m3/opencode.score.json`
- `docs/work-items/M3-009-final-evidence.md` — Worker handoff section only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- Assignment and Coordinator review sections of this task file
- `src/**`
- `tests/**`
- `scripts/**`
- `README.md`
- `package.json`
- `package-lock.json`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The three committed score files are byte-identical to their final v5
      generated sources and parse as JSON.
- [ ] All three score files identify schema `1.0.0`, instruction `1.4.0`, the
      intended Host/version/model, nine identical bundle digests, a passing
      9-of-9 suite, and 6 valid findings with zero rejected or warned.
- [ ] `M3_RESULTS.md` records the supplied quality gate and demonstrates every
      condition against the final run without claiming coordinator authority.
- [ ] The evidence record describes the one-output-per-fixture, no-retry,
      disabled-tool methodology and separates development runs from v5.
- [ ] The evidence record includes reproducible SHA-256 hashes for the final
      manifest, Host run records, and committed score files.
- [ ] No raw prompt, capture, Host response, untrusted evidence body, secret,
      private credential, or unrelated artifact is committed.
- [ ] No production, test, schema, package, governance, Roadmap, decision, or
      release file is changed.
- [ ] The task branch is clean and all evidence plus Worker handoff changes are
      committed.

### Required validation

```text
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 674034778e085eedd355e711553ff57e87898b0f..HEAD
git status --short
```

Also verify, with read-only commands, that each committed score file parses,
matches its source byte-for-byte, has the required Host identity and aggregate,
and shares the same ordered bundle digest list.

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task file,
   and the relevant M3 fixture/replay/scorer code before editing.
2. Confirm the isolated branch and its relationship to the assigned base.
3. Inspect the final v5 manifest, run records, score outputs, and summaries.
4. Create the tracked evidence files only through the allowed paths.
5. Audit the record for accidental raw model output, untrusted prose,
   credentials, local usernames, and unsupported compatibility claims.
6. Run every required validation plus the byte/hash/aggregate comparisons.
7. Review the complete base diff for scope violations.
8. Update only the Worker handoff section, commit all output, and leave the
   worktree clean at `ready_for_review`.

### Escalate when

- any supplied final score or run record is missing, malformed, internally
  inconsistent, or does not match the facts above;
- exact score copies would expose credentials or raw untrusted prose;
- the quality gate, fixture ground truth, public contract, or replay
  implementation must change;
- implementation would touch a coordinator-only path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M3-009-final-evidence`
- Implementation commits:
  - `2eec8c618c62bdc0eb44036ac2bd6de4ede8c606` — docs: record M3 final replay evidence

### Implementation summary

- Added a compact, tracked v5 evidence record with replay provenance,
  configurations, aggregate outcomes, mandatory-control outcomes, ordered
  bundle digests, and reproducibility hashes.
- Copied the final Codex Desktop, Claude Code, and OpenCode score files
  byte-for-byte from the coordinator-supplied v5 sources. The record excludes
  raw prompts, captures, response streams, untrusted evidence bodies, local
  execution paths, and credentials.
- Recorded v1–v4 only as locally verifiable aggregate prompt-development
  history. The record identifies v5 / instruction `1.4.0` as the final gate
  replay without declaring a milestone or release result.

### Changed areas

- `docs/evaluation/M3_RESULTS.md` — durable, bounded v5 replay evidence and
  integrity record.
- `docs/evaluation/m3/codex-desktop.score.json` — exact final v5 Codex Desktop
  score copy.
- `docs/evaluation/m3/claude-code.score.json` — exact final v5 Claude Code
  score copy.
- `docs/evaluation/m3/opencode.score.json` — exact final v5 OpenCode score
  copy.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm ci` | PASS | Installed the lockfile dependencies in this isolated worktree; no tracked package file changed. |
| `npm run check` | PASS | TypeScript no-emit check passed. |
| `npm test` | PASS | 16 files and 149 tests passed. |
| `npm run smoke:stdio` | PASS | Build and stdio smoke check passed. |
| `npm run pack:check` | PASS | Dry-run package check passed. |
| `[System.Linq.Enumerable]::SequenceEqual([byte[]]$source, [byte[]]$target)` for each v5 score source/target pair | PASS | Three exact byte comparisons passed; each target also parsed as JSON. |
| PowerShell v5 schema/Host/aggregate/control/digest/run-record audit | PASS | Verified schema `1.0.0`, instruction `1.4.0`, Host identity, 9 / 9, 6 / 6 valid, zero rejected/warned, mandatory controls, identical ordered digests, manifest shape, and zero recorded tool use. |
| `git diff --check 674034778e085eedd355e711553ff57e87898b0f..HEAD` | PASS | No whitespace errors before handoff commit; repeated after handoff commit. |
| `rg -n --glob '*.md' --glob '*.json' 'D:\\\\|C:\\\\Users|threadIds|executable|api[_-]?key|secret|password' docs/evaluation` | PASS | No matched private-path, execution-detail, or credential patterns. |

### Public contract and documentation impact

- Adds internal evaluation evidence only. No public API, schema, release,
  compatibility, or milestone-completion claim was changed.

### Deviations from assignment

- None. Commit `37cc9ae` is the coordinator-authored task-contract correction
  explicitly authorized for cherry-pick; it corrects the Assignment base SHA
  and required diff command and is not a worker scope deviation.

### Known limitations and risks

- The evidence record intentionally omits raw local replay materials. Their
  source hashes and the exact committed score copies provide the review trail;
  milestone and gate ownership remain with the coordinator.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] No coordinator-only file was edited by the worker; the coordinator's
      authorized contract correction was cherry-picked unchanged.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head:
  `93c6b96e0a6b7c72ba48034e4031a5988d35977f`
- Integration commits:
  - `276f494` — final replay evidence and exact score copies;
  - `71e80dc` — Worker handoff.

### Review findings

- None.

### Required follow-up

- None for this task.

### Roadmap and release impact

- The final replay evidence is accepted. The coordinator independently
  reproduced the byte/hash/schema/Host/gate checks and the complete project
  validation suite. This evidence supports closing M3 after the quality-gate
  decision and Roadmap status are recorded.
- No package version, release, tag, npm state, or general Host compatibility
  claim changes as part of this task.
