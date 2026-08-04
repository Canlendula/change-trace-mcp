# M7-012 — Accept real GitLab job IDs as advisory run-attempt metadata

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `dd806abbc593ac203466b0960a778ace7a5c7435`
- Branch: `codex/M7-012-gitlab-run-attempt-portability`
- Worktree: `D:\projects\change-trace-worktrees\M7-012-gitlab-run-attempt-portability`
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: make the documented positive-integer advisory run-attempt input
  accept real GitLab instance-wide job IDs while preserving strict bounded
  numeric validation and the existing three-artifact/security contract.
- Dependencies: accepted M7-005 and M7-010 CI mechanics, blocked M7-011 hosted
  execution, and Decision 39.

The Base commit is the implementation review base. The coordinator creates the
task branch from the subsequent coordinator-only assignment commit containing
this contract and current hosted evidence. The worker must not modify the
coordinator-owned assignment delta.

### Reproduced defect

GitLab pipeline `2730157298` ran the unchanged reference baseline at commit
`b3f4b9ab2e7a5bf5fcab4557cff30b85597878bc`. `subject_test` passed. Advisory
job `15697682696` checked out, installed, and built exact trusted tooling commit
`aa52a1795a587cb32704018bdd60b1d33649309d`, then failed with:

```text
change-trace-advisory outcome=infrastructure_failure code=invalid_run_attempt
```

The template supplied `CI_JOB_ID=15697682696`. GitLab defines `CI_JOB_ID` as
an integer ID unique across all jobs in the GitLab instance. The public Change
Trace input contract says positive integer, but `advisory-runner.mjs` imposes
an undocumented maximum of `1_000_000`.

### In scope

- Replace the arbitrary run-attempt ceiling with the maximum positive integer
  that can be represented and round-tripped safely by JavaScript/JSON.
- Preserve strict decimal-string parsing and the positive-integer default of
  `1`.
- Add regression coverage using the exact observed GitLab job ID
  `15697682696` and safe-integer boundary coverage.
- Prove the accepted value reaches the Host environment and status sidecar
  unchanged.
- Clarify the existing CI input documentation with the exact safe upper bound.

### Out of scope

- Changing the GitLab templates away from `CI_JOB_ID`.
- Changing artifact names, status/report Schema shape, output confinement,
  timeout, retry, advisory-only behavior, Host selection, credentials, or
  package dependencies.
- Modifying the GitLab subject project, starting/retrying a pipeline, or
  installing/configuring GitLab MCP, `glab`, `lark-cli`, or any credential.
- Semantic Agent execution, Feishu retrieval, pilot claims, M8, package
  version, npm publication, tag, release, or dist-tag changes.

### Allowed paths

- `scripts/ci/advisory-runner.mjs`
- `tests/integration/advisory-ci.test.ts`
- `tests/integration/gitlab-reference.test.ts`
- `docs/ci/README.md`
- `docs/work-items/M7-012-gitlab-run-attempt-portability.md` (Worker handoff
  section only)

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- package version, release, tag, and publishing metadata

### Acceptance criteria

- [ ] `CHANGE_TRACE_CI_RUN_ATTEMPT=15697682696` completes the deterministic
  advisory path and is recorded unchanged in the status sidecar.
- [ ] Decimal values from `1` through `Number.MAX_SAFE_INTEGER` are accepted.
- [ ] Empty/undefined input still defaults to `1`.
- [ ] Zero, negative, signed, fractional, exponent, whitespace-padded,
  non-decimal, and greater-than-safe-integer inputs still fail closed with
  `invalid_run_attempt` before the Host runs.
- [ ] Timeout validation retains its existing independent fifteen-minute cap.
- [ ] Existing output confinement, managed-artifact invalidation, failure
  normalization, and exact three-artifact behavior remain unchanged.
- [ ] CI documentation states the exact accepted run-attempt range.
- [ ] No dependency, package metadata/version, release, external object, or
  credential state changes.

### Required validation

```text
npm run check
npx vitest run tests/integration/advisory-ci.test.ts tests/integration/gitlab-reference.test.ts
npm run smoke:ci
npm test
npm audit --omit=dev
git diff --check
git status --short
```

### Escalate when

- the fix requires a non-integer/string run identifier or status/report Schema
  shape change;
- a GitLab template change becomes necessary;
- a dependency, credential, external mutation, or new permission is required;
- implementation would touch a coordinator-only or non-allowed path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M7-012-gitlab-run-attempt-portability`
- Implementation commits:
  - `10a979b fix(ci): accept safe GitLab job IDs`

### Implementation summary

- Replaced the arbitrary run-attempt ceiling with `Number.MAX_SAFE_INTEGER`
  while retaining strict decimal parsing, positive-integer validation, and the
  separate fifteen-minute timeout ceiling.
- Added regression coverage for GitLab job `15697682696`, Host-environment
  forwarding, the safe-integer boundary, defaulting, and rejected formats.

### Changed areas

- `scripts/ci/advisory-runner.mjs`: accepts positive decimal run attempts
  through `9007199254740991`.
- `tests/integration/advisory-ci.test.ts`: verifies Host/status round-trip,
  accepted boundaries/defaults, and pre-Host rejections.
- `tests/integration/gitlab-reference.test.ts`: runs the reference fixture
  with the observed GitLab job ID and checks its status sidecar.
- `docs/ci/README.md`: states the exact accepted range.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm run check` | Passed | TypeScript completed with no errors. |
| `npx vitest run tests/integration/advisory-ci.test.ts tests/integration/gitlab-reference.test.ts` | Passed | 2 files, 63 tests passed. |
| `npm run smoke:ci` | Passed | Deterministic advisory smoke completed with `completed_no_findings`. |
| `npm test` | Passed | 44 files passed; 426 tests passed and 2 skipped. |
| `npm audit --omit=dev` | Failed | Existing audit result: 3 production dependency vulnerabilities (2 high, 1 moderate); no dependency change is permitted in this task. |
| `git diff --check` | Passed | No whitespace errors; Git emitted only configured LF-to-CRLF warnings. |
| `git status --short` | Passed | Clean after the handoff commit. |

### Public contract and documentation impact

- `CHANGE_TRACE_CI_RUN_ATTEMPT` now documents and implements the decimal
  positive-integer range `1` through `9007199254740991`
  (`Number.MAX_SAFE_INTEGER`). The value remains a JSON-safe number in the
  status sidecar and is forwarded to the Host as its canonical decimal string.

### Deviations from assignment

- None.

### Known limitations and risks

- `npm audit --omit=dev` reports existing vulnerabilities in `fast-uri`,
  `hono`, and `ip-address`; resolving them would require an out-of-scope
  dependency change.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head:
  `42f7df162bf3c2e8426cb88fdf10efda9b96ce32`
- Integration commit:
  `42f7df162bf3c2e8426cb88fdf10efda9b96ce32` (fast-forward)

### Review findings

- No implementation finding. The change replaces only the undocumented
  `1_000_000` ceiling with `Number.MAX_SAFE_INTEGER`; strict decimal parsing,
  positivity, timeout bounds, output confinement, Host isolation, failure
  normalization, and artifact behavior remain intact.
- Tests cover the exact GitLab job ID in both the generic runner and packaged
  GitLab reference path. The forwarding test observes the canonical decimal
  string inside the Host and the numeric value in the status sidecar. Invalid
  values fail before the output directory or Host is created.
- Independent coordinator validation passed `npm run check`, 63 focused tests,
  deterministic CI smoke, and the full 44-file suite at 426 passed with the two
  existing Windows-inapplicable POSIX skips. Diff/status and allowed-path checks
  were clean.
- `npm audit --omit=dev` independently reproduced the worker's non-zero result:
  three vulnerabilities (two high, one moderate) in unchanged transitive
  dependencies. `package.json` and `package-lock.json` are byte-identical to
  the review base for this task, so the result is not introduced by M7-012.

### Required follow-up

- Complete M7-013's lockfile-only production-audit refresh before materializing
  a fresh tooling commit or rerunning M7-011.

### Roadmap and release impact

- M7-012 is accepted. M7 remains in progress; M7-011, M7-013, and the real
  multi-team, multi-week pilot remain incomplete. M8 and all release actions
  stay unauthorized.
