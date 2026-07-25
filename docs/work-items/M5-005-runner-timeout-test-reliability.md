# M5-005 — Remove the timeout-test startup race

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M5 — External documentation adapters`
- Base commit: `e5cab4ff482557edce911e346011a4079427fd89`
- Branch: `codex/M5-005-runner-timeout-test-reliability`
- Worktree:
  `D:\projects\change-trace-worktrees\M5-005-runner-timeout-test-reliability`
- Push task branch: `no`
- Objective: make the existing direct-child timeout test reliable under
  concurrent Windows test load without weakening its runtime or secrecy
  assertions.
- Dependency: M5-004 is integrated for combined-gate validation.

### Coordinator-owned test contract

The observed failure is a test startup race. The runner starts its timeout when
`spawn` returns, but the 100-millisecond fixture allowance can expire before a
new Windows Node process executes `writeFileSync(pidPath, process.pid)`.
Reading `pid.txt` then raises `ENOENT`, although the runner correctly returned
the expected safe `timeout` error.

Fix only the test timing budget:

- give the fixture process a 2,000-millisecond runner timeout;
- give the Vitest case an explicit 10,000-millisecond test timeout if needed;
- keep the fixture PID write, the exact `timeout` error assertion, null exit
  code, forbidden-value checks, PID read, and direct-child exit confirmation;
- do not add retry loops, arbitrary post-failure sleeps, conditional skips,
  platform skips, or `ENOENT` suppression;
- do not change production runner behavior, the fixture process, public
  limits, or other tests.

The larger value is a test startup allowance, not a product timeout default.
The test still proves that the configured timeout terminates the direct child
and returns only the stable safe error.

## In scope

- Adjust only the existing timeout test's configured milliseconds and explicit
  Vitest case timeout.
- Repeatedly stress the complete runner test file.
- Run two consecutive full suites on the combined M5 implementation.
- Update only the worker-owned handoff section of this file.

## Out of scope

- Production runner, schemas, adapters, fixtures, report code, documentation,
  dependencies, versions, CI, releases, or npm state.
- Process-tree termination or descendant-child hardening.
- Removing or weakening the PID/direct-child termination proof.

## Allowed paths

- `tests/integration/external-adapter-runner.test.ts`
- `docs/work-items/M5-005-runner-timeout-test-reliability.md`, worker handoff
  only

Reading other files is allowed. Writing outside this list is not.

## Coordinator-only paths

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- assignment/acceptance criteria and coordinator-review sections of this file
- production source and fixture files
- `.github/**`
- `package.json`, `package-lock.json`, and all release/npm state

## Acceptance criteria

- [ ] The timeout case allows 2,000 milliseconds for child startup and has a
      sufficient explicit Vitest timeout.
- [ ] The exact safe `timeout` code, null exit code, forbidden-value checks,
      PID read, and direct-child exit assertion remain present.
- [ ] No retry, skip, sleep-based suppression, platform conditional, or
      production/fixture change is introduced.
- [ ] Ten consecutive focused runner-file executions pass.
- [ ] Type checking and two consecutive full suites pass with 27 files / 242
      tests.
- [ ] Diff checks and clean-worktree checks pass.
- [ ] No file outside the allowlist changes.

## Required validation

```text
1..10 | ForEach-Object { npx vitest run tests/integration/external-adapter-runner.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
npm run check
npm test
npm test
git diff --check e5cab4ff482557edce911e346011a4079427fd89..HEAD
git status --short
```

The worker must report every command and result. If the race persists at 2,000
milliseconds, stop and report `needs_decision` instead of increasing the value
again or weakening assertions.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task, the
   runner test, fixture `hang` mode, and production timeout path.
2. Confirm the isolated branch/worktree, exact base, and clean status.
3. Confirm the existing 100-millisecond assertion and preserve a copy of the
   pre-change failure evidence from M5-003/M5-004 handoffs.
4. Apply the smallest test-only timing change.
5. Audit the diff for any weakened or removed assertion and any out-of-scope
   change.
6. Run the required stress and integration gates.
7. Update only the worker handoff, commit all changes, and report
   `ready_for_review`, `blocked`, or `needs_decision`.

## Escalate when

- 2,000 milliseconds still races;
- a production/fixture change or retry/suppression is required;
- the direct-child exit assertion cannot be retained;
- any unrelated full-suite failure appears repeatedly.

## Worker handoff — worker owned

- Status: `in_progress`
- Implementation commit(s):
- Branch head:

### Implementation summary

- Pending.

### Validation

- Pending.

### Assertion-preservation audit

- Pending.

### Deviations from assignment

- None reported.

### Known limitations and risks

- Pending.

### Decisions or questions for coordinator

- None reported.

### Protected-file confirmation

- [ ] Only allowed paths changed.
- [ ] No production, fixture, dependency, version, CI, release, or npm state
      changed.
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

- This task removes test-reliability debt only. M5 completion still requires
  the coordinator's final local/Ubuntu exit evidence and Roadmap update.
