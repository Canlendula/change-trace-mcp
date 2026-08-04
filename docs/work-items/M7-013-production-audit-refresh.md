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

- Status: `ready_for_review`
- Handoff branch: `codex/M7-013-production-audit-refresh`
- Implementation commits: `be093129eb1cfffa43f5ba208ba0ab89d7c758f4`

### Implementation summary

- Refreshed only the three audited production transitive lock resolutions to
  their lowest patched versions admitted by their existing ranges:
  `fast-uri@3.1.5`, `hono@4.12.34`, and `ip-address@10.3.1`.
- Each updated lock entry changes only its version, registry tarball URL, and
  integrity. No `package.json` or dependency declaration changed.

### Changed areas

- `package-lock.json`: the `fast-uri` resolution used by `ajv`; the `hono`
  resolution used by `@modelcontextprotocol/sdk` and `@hono/node-server`; and
  the `ip-address` resolution used by `express-rate-limit`.
- `docs/work-items/M7-013-production-audit-refresh.md`: this Worker handoff
  only.

### Validation

| Command | Result | Notes |
|---|---|---|
| `git diff --exit-code 42f7df162bf3c2e8426cb88fdf10efda9b96ce32 -- package.json` | Passed | `package.json` remains byte-identical to the implementation review base. |
| `npm ci --ignore-scripts --no-audit --no-fund` | Passed | Fresh install completed: 219 packages added. |
| `npm ls fast-uri hono ip-address --omit=dev --all` | Passed | SDK production tree resolves `fast-uri@3.1.5` through `ajv`, `hono@4.12.34` through SDK and `@hono/node-server`, and `ip-address@10.3.1` through `express-rate-limit`. |
| `npm audit --omit=dev` | Passed | `found 0 vulnerabilities`. |
| `npm run check` | Passed | TypeScript no-emit check succeeded. |
| `npm run smoke:ci` | Passed | Deterministic advisory CI smoke reported `completed_no_findings` and `smoke=ok`. |
| `npm test` | Passed | Build succeeded; Vitest: 44 files passed, 426 tests passed, 2 skipped. |
| `node scripts/smoke-clean-install.mjs` | Passed | Packed clean-install smoke completed with `install.ok=true`, `npx.ok=true`, and `cleanup=true`. |
| `git diff --check` | Passed | No whitespace errors. |
| `git status --short` | Passed before handoff commit | Only the intended lockfile change was present before it was committed. |

### Public contract and documentation impact

- None. This is a lockfile-only transitive patch refresh; public contracts and
  dependency declarations are unchanged.

### Deviations from assignment

- None.

### Known limitations and risks

- No known limitations. Validation used Node `v24.0.0` and npm `11.3.0`; the
  clean-install smoke also completed in that environment.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head:
  `8e82ee4a64e8f8ed027db8278f646cdbe9b6b5d0`
- Integration commit:
  `8e82ee4a64e8f8ed027db8278f646cdbe9b6b5d0` (fast-forward)

### Review findings

- No implementation finding. The lock delta contains exactly the three target
  package entries. Each changes only version, registry tarball URL, and
  integrity; no unrelated package or lock metadata changed.
- `package.json` is byte-identical to the review base. The direct SDK/Zod
  versions and `@hono/node-server` override remain unchanged.
- Independent coordinator validation passed fresh script-disabled `npm ci`,
  the exact production tree at `fast-uri@3.1.5`, `hono@4.12.34`, and
  `ip-address@10.3.1`, production audit with zero vulnerabilities, type
  checking, deterministic CI smoke, all 426 tests with two existing
  Windows-inapplicable POSIX skips, the 220-file clean-install smoke, and
  diff/status checks.

### Required follow-up

- Accept M7-014's exact reference-pin update before materializing and running a
  fresh M7-011 subject pipeline.

### Roadmap and release impact

- M7-013 is accepted. M7 remains in progress; M7-011, M7-014, and the real
  multi-team pilot remain incomplete. M8 and all release actions remain
  unauthorized.
