# M7-014 — Advance the GitLab reference tooling pin

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `8e82ee4a64e8f8ed027db8278f646cdbe9b6b5d0`
- Branch: `codex/M7-014-gitlab-reference-tooling-pin`
- Worktree: `D:\projects\change-trace-worktrees\M7-014-gitlab-reference-tooling-pin`
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: update only the copyable GitLab reference's immutable Change
  Trace tooling pin and its contract assertion to the coordinator-prepared
  accepted-main commit that contains M7-012 and M7-013.
- Dependencies: accepted M7-012 and M7-013, blocked M7-011, Decisions 39 and
  40.

The Base commit is the implementation review base. The coordinator creates the
task branch after committing this assignment and M7-013 acceptance. The task
branch's prepared starting commit is the exact tooling commit to pin. The
worker must resolve that commit from Git, record it in the handoff, and must
not select another revision or modify the coordinator-owned assignment delta.

### In scope

- Replace all three occurrences of historical tooling commit
  `aa52a1795a587cb32704018bdd60b1d33649309d` in the GitLab reference YAML with
  the exact prepared task-branch starting commit.
- Update the integration assertion to require that exact commit.
- Prove the YAML still has one matching fetch, checkout, and equality check,
  plus every existing credential-free/advisory/artifact bound.

### Out of scope

- Any other YAML, subject baseline/feature/follow-up file, runner behavior,
  package/dependency/lock state, source, public Schema/tool contract, or
  security-policy change.
- Modifying or pushing the GitLab subject repository, creating/retrying a
  pipeline, or touching GitLab/Feishu settings or credentials.
- Semantic Agent, external-document retrieval, pilot claim, M8, package
  version, npm publication, tag, release, or dist-tag action.

### Allowed paths

- `docs/ci/gitlab-reference/gitlab-ci.yml.example`
- `tests/integration/gitlab-reference.test.ts`
- `docs/work-items/M7-014-gitlab-reference-tooling-pin.md` (Worker handoff
  section only)

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- package/dependency/version, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The reference YAML contains exactly three copies of the prepared
  starting commit and no copy of `aa52a1795a587cb32704018bdd60b1d33649309d`.
- [ ] Fetch, detached checkout, and exact `rev-parse HEAD` verification all use
  the same immutable commit.
- [ ] The integration test requires the exact new pin and every existing
  runner, schedule, secret-absence, timeout, retry, advisory, and exact
  three-artifact bound still passes.
- [ ] The deterministic reference fixture runs locally with the real GitLab job
  ID and exactly three managed artifacts.
- [ ] Production audit remains zero and clean-install/package validation passes
  after the packaged CI example changes.
- [ ] No external, package version, publish, tag, release, dist-tag, or
  credential state changes.

### Required validation

```text
npm run check
npx vitest run tests/integration/gitlab-reference.test.ts tests/integration/advisory-ci.test.ts
npm run smoke:ci
npm audit --omit=dev
npm test
node scripts/smoke-clean-install.mjs
git diff --check
git status --short
```

### Escalate when

- the prepared starting commit does not contain accepted M7-012/M7-013 state;
- any YAML behavior beyond the three immutable pin occurrences must change;
- a dependency, credential, external mutation, or new permission is required;
- implementation would touch a coordinator-only or non-allowed path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M7-014-gitlab-reference-tooling-pin`
- Implementation commits:

- `c1c6de14040954532c778d28641a74d874e94b9f` — `docs(ci): advance GitLab
  tooling pin`
- `0a8292b19d8ea7fda15d170923b94144923ded1d` — `test(ci): harden GitLab
  tooling pin contract`

### Implementation summary

- Advanced the copyable GitLab reference pin from
  `aa52a1795a587cb32704018bdd60b1d33649309d` to the coordinator-prepared,
  immutable task starting commit
  `49a07185c2af05ee8dcffe33b23355ce1dce8353`.
- Confirmed `49a07185c2af05ee8dcffe33b23355ce1dce8353` descends from the
  assigned base and includes accepted M7-012 and M7-013 state in its history.
- Coordinator review follow-up: replaced the weak pin-presence assertion with
  exact new-pin and historical-pin occurrence counts plus exact fetch,
  detached-checkout, and `rev-parse HEAD` equality-line assertions, all using
  the same immutable pin constant.

### Changed areas

- `docs/ci/gitlab-reference/gitlab-ci.yml.example`: changed only the three
  immutable commit values used by the shallow fetch, detached checkout, and
  `rev-parse HEAD` equality check. The resulting YAML has the new pin exactly
  three times, the historical pin zero times, and one of each operation.
- `tests/integration/gitlab-reference.test.ts`: updated only the assertion that
  requires the immutable tooling pin, then hardened it during coordinator
  review to prove the exact pin counts and exact pin-bearing command lines.
  All existing mechanics, security, advisory, runner, and artifact assertions
  remain in place.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm run check` | passed | TypeScript no-emit check passed after restoring the worktree dependencies with `npm ci --ignore-scripts --no-audit --no-fund`. |
| `npx vitest run tests/integration/gitlab-reference.test.ts tests/integration/advisory-ci.test.ts` | passed | 2 files, 63 tests passed. This includes the local deterministic fixture with real GitLab job ID and exactly three managed artifacts. |
| `npm run smoke:ci` | passed | Deterministic advisory outcome `completed_no_findings`; smoke check passed. |
| `npm audit --omit=dev` | passed | `found 0 vulnerabilities`. |
| `npm test` | passed | 44 files passed; 426 tests passed and 2 skipped. |
| `node scripts/smoke-clean-install.mjs` | passed | Clean package install and npx checks passed; deterministic CI outcome `completed_no_findings`, three artifacts, cleanup `true`. |
| `git diff --check` | passed | Re-run after all validation; no whitespace errors. |
| `git status --short` | passed | Before the handoff edit, only the two intended implementation files were modified; the coordinator-observed `.change-trace-gpt41-quality-Q6nFQE/` fixture was absent after tests. |
| `npm run check` (review follow-up) | passed | Re-run after the TypeScript assertion hardening. |
| `npx vitest run tests/integration/gitlab-reference.test.ts tests/integration/advisory-ci.test.ts` (review follow-up) | passed | 2 files, 63 tests passed with the hardened exact-pin contract. |
| `git diff --check` and `git status --short` (review follow-up) | passed | Re-run after the review follow-up; only the intended handoff record remained before this final commit. |

The initial `npm run check` attempt could not find `tsc` because this fresh
worktree had no installed dependencies. It was rerun successfully after the
documented dependency restore above.

### Public contract and documentation impact

- The copyable GitLab reference now pins the accepted-main tooling revision.
  No public Schema, tool, dependency, package version, or release contract
  changed.

### Deviations from assignment

- None.

### Known limitations and risks

- None identified at assignment.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, tag, publish, or release action was performed.
- [x] No external GitLab/Feishu state was modified.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending`
- Reviewed branch head:
- Integration commit:

### Review findings

- Pending.

### Required follow-up

- After acceptance, the coordinator may materialize the exact YAML into one
  subject commit and allow one new default-branch mechanics pipeline.

### Roadmap and release impact

- M7 remains in progress. M7-011, the real multi-team pilot, M8, and all
  release actions remain incomplete or unauthorized.
