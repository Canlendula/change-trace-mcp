# M7-013 — Refresh vulnerable production transitive locks

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `42f7df162bf3c2e8426cb88fdf10efda9b96ce32`
- Branch: `codex/M7-013-production-audit-refresh`
- Worktree: `D:\projects\change-trace-worktrees\M7-013-production-audit-refresh`
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: restore a zero-vulnerability production audit through the
  smallest reviewable lockfile-only refresh admitted by the existing direct
  dependency constraints.
- Dependencies: accepted M7-012, blocked M7-011, and Decision 40.

The Base commit is the implementation review base. The coordinator creates the
task branch from the subsequent coordinator-only assignment commit containing
this contract. The worker must not modify the coordinator-owned assignment
delta.

### Reproduced audit state

`npm audit --omit=dev` on accepted M7-012 reports three vulnerable production
packages and exits non-zero:

| Installed | Severity | Required patched floor | Dependency path |
|---|---|---|---|
| `fast-uri@3.1.4` | high | `3.1.5` | SDK -> `ajv` -> `fast-uri` |
| `hono@4.12.31` | moderate | `4.12.34` | SDK / `@hono/node-server` -> `hono` |
| `ip-address@10.2.0` | high | `10.3.1` or later | SDK -> `express-rate-limit` -> `ip-address` |

The current dependency ranges admit patched versions. Registry metadata on
2026-08-04 confirms patched `fast-uri@3.1.5` in the admitted 3.x line plus
compatible `hono@4.13.0` and `ip-address@10.4.0`; the worker should prefer the
smallest lock delta that clears all advisories and stays inside the existing
ranges.

### In scope

- Refresh only the vulnerable transitive resolutions and unavoidable lockfile
  metadata/integrities within the current `package.json` constraints.
- Prove the resolved versions are outside every recorded vulnerable range.
- Reinstall from the exact resulting lockfile and run all required gates.
- Record the exact package versions, dependency paths, and audit result.

### Out of scope

- Any `package.json` change, direct dependency/override change, dependency
  range widening, package version change, new package, or public contract
  change.
- Source, test, Schema, CI template/workflow, Roadmap, Decision, security
  policy, or evaluation-document changes.
- GitLab/Feishu mutation, pipeline execution, credential use, semantic Agent,
  pilot claim, M8, npm publication, tag, release, or dist-tag action.

### Allowed paths

- `package-lock.json`
- `docs/work-items/M7-013-production-audit-refresh.md` (Worker handoff section
  only)

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- `package.json`
- package version, release, tag, and publishing metadata

### Acceptance criteria

- [ ] `package.json` is byte-identical to the base commit.
- [ ] The lockfile refresh is limited to `fast-uri`, `hono`, `ip-address`, and
  unavoidable integrity/lock metadata; unrelated transitive packages do not
  change.
- [ ] Resolved production versions are at least `fast-uri@3.1.5`,
  `hono@4.12.34`, and `ip-address@10.3.1`.
- [ ] A fresh script-disabled `npm ci` succeeds from the exact lockfile.
- [ ] `npm audit --omit=dev` reports zero vulnerabilities.
- [ ] `npm ls --omit=dev --all` reports a valid production tree.
- [ ] Full tests, deterministic CI smoke, and clean-install/package validation
  pass without a source or public-contract change.
- [ ] No external, version, publish, tag, release, dist-tag, or credential state
  changes.

### Required validation

```text
git diff --exit-code 42f7df162bf3c2e8426cb88fdf10efda9b96ce32 -- package.json
npm ci --ignore-scripts --no-audit --no-fund
npm ls fast-uri hono ip-address --omit=dev --all
npm audit --omit=dev
npm run check
npm run smoke:ci
npm test
node scripts/smoke-clean-install.mjs
git diff --check
git status --short
```

### Escalate when

- clearing the audit requires a `package.json`, direct dependency, override,
  source, test, or public contract change;
- npm resolves an unrelated package change that cannot be excluded;
- any required validation fails for a reason beyond the three recorded locks;
- a credential, external mutation, or new permission is required;
- implementation would touch a coordinator-only or non-allowed path.

## Worker handoff — worker owned

- Status: `in_progress`
- Handoff branch: `codex/M7-013-production-audit-refresh`
- Implementation commits:

### Implementation summary

- Pending.

### Changed areas

- Pending.

### Validation

| Command | Result | Notes |
|---|---|---|
| Pending | Pending | Pending |

### Public contract and documentation impact

- None expected; lockfile-only transitive patch refresh.

### Deviations from assignment

- None.

### Known limitations and risks

- None identified at assignment.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [ ] Coordinator-only files were not modified.
- [ ] No version, tag, publish, or release action was performed.
- [ ] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending`
- Reviewed branch head:
- Integration commit:

### Review findings

- Pending.

### Required follow-up

- Materialize and run a fresh M7-011 GitLab reference baseline only after this
  task is accepted.

### Roadmap and release impact

- M7 remains in progress. M7-011, the real multi-team pilot, M8, and all
  release actions remain incomplete or unauthorized.
