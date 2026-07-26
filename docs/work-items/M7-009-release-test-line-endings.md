# M7-009 — Make the release contract test line-ending independent

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `a91ee2a0ae5b4df03d9f77048ce7677a8b7b6ff2`
- Branch: `codex/M7-009-release-test-line-endings`
- Worktree: Codex-managed isolated worktree for the assigned branch; record
  the absolute path in the Worker handoff.
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: restore the complete Windows worktree test suite by making the
  M7-007 repository-text assertions insensitive to Git checkout line endings
  without weakening any workflow safety assertion or changing the workflow.
- Dependencies: accepted M7-007 and M7-008, especially the coordinator review
  evidence that the same committed workflow is LF in Git and CRLF in a fresh
  Windows worktree.

The coordinator has already reproduced the failure from a clean Codex
worktree: the first M7-007 workflow contract assertion compares an LF literal
with CRLF checkout text. The workflow parses on GitHub and all substantive
manual-trigger, permission, pin, credential, guard, and stage-only assertions
remain valid.

## Frozen fix

Update the repository-file test helper in
`tests/unit/release-publishing-contract.test.ts` to normalize CRLF sequences to
LF before contract assertions. Keep every existing assertion byte-for-byte
unless the normalization helper itself requires a focused assertion.

The fix must:

- accept both committed LF text and an ordinary Windows CRLF checkout;
- preserve all non-line-ending characters and line order;
- leave lone LF unchanged;
- avoid trimming, whitespace collapsing, YAML parsing, broad regex
  relaxation, or snapshot replacement;
- avoid changing `.gitattributes`, Git configuration, the workflow, release
  helper/guidance, package files, dependencies, or runtime source;
- introduce no environment, network, subprocess, file-write, timing, or
  platform branch into the test helper.

## In scope

- One bounded test-helper normalization in the existing release publishing
  contract test.
- The Worker handoff section of this file.

## Out of scope

- Workflow behavior or formatting, release authorization, hosted runs, npm
  staging/publishing, package/version/dependency/lockfile changes,
  `.gitattributes`, Git settings, product code, public contracts, pilot
  observations, thresholds, compatibility, telemetry, registry, tag, release,
  publish, or dist-tag state.

## Allowed paths

- `tests/unit/release-publishing-contract.test.ts`
- the Worker handoff section of this file

## Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- the Assignment and Coordinator review sections of this file
- workflows, package metadata/version, dependencies, lockfile, source,
  release/pilot/threshold/compatibility state, and external settings

## Acceptance criteria

- [ ] The focused M7-007 release contract test passes from the assigned fresh
      Windows worktree.
- [ ] The complete suite passes at 409 tests with only the two existing
      Windows-inapplicable POSIX skips.
- [ ] Every existing workflow safety assertion remains in place and no
      production, workflow, package, public-contract, or external state
      changes.
- [ ] The helper performs only CRLF-to-LF normalization and does not trim,
      collapse, parse, rewrite, or write repository content.

## Required validation

```text
npm run check
npx vitest run tests/unit/release-publishing-contract.test.ts
npm test
npm test
npm run smoke:stdio
npm run smoke:ci
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

The Worker records exact test counts for both complete-suite runs and all
skips. If a concurrent pack EOF reappears, rerun once with one worker to
distinguish test-helper correctness from an unrelated package-test race and
report both results.

## Escalate when

- the full suite has a failure other than the frozen line-ending assertion or
  an already documented Windows-inapplicable POSIX skip;
- passing requires weakening/removing a workflow safety assertion;
- `.gitattributes`, workflow, production, package, dependency, lockfile,
  public-contract, release, pilot, threshold, or external state must change;
- scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M7-009-release-test-line-endings`
- Implementation commits: `120f528c38a97aff6721e1647ed86810f7eebc09` (`test: normalize release contract repository text`)
- Worktree: `C:\Users\C\.codex\worktrees\52a8\agent-e2e-mcp`

### Implementation summary

- Normalized CRLF repository-file text to LF in the release publishing contract
  test helper before its existing contract assertions run.
- Kept every workflow safety assertion unchanged.

### Changed areas

- `tests/unit/release-publishing-contract.test.ts`: normalize only `\r\n` to
  `\n` after repository-file reads so LF and ordinary Windows CRLF checkouts
  satisfy the same frozen contract assertions.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | Passed | Installed 219 ignored local development packages after the initial required commands found no `node_modules`; no lockfile change. |
| `npm run check` | Passed | `tsc -p tsconfig.json --noEmit`. |
| `npx vitest run tests/unit/release-publishing-contract.test.ts` | Passed | 1 file, 6 passed tests. |
| `npm test` (run 1) | Passed | 43 files; 407 passed, 2 skipped, 409 total. Skips: Windows-inapplicable `clean-install-smoke` SIGTERM/SIGKILL process-group test and `smoke-real-hosts` SIGTERM/SIGKILL process-group test. |
| `npm test` (run 2) | Passed | 43 files; 407 passed, 2 skipped, 409 total; same two Windows-inapplicable skips. |
| `npm run smoke:stdio` | Passed | Built the project and returned the expected local stdio smoke result. |
| `npm run smoke:ci` | Passed | `change-trace-advisory outcome=completed_no_findings code=ok`; local smoke only. |
| `npm run pack:check` | Passed | `npm pack --dry-run` completed after its local prepack build. |
| `npm audit --omit=dev --audit-level=high` | Passed | `found 0 vulnerabilities`. |
| `git diff --check` | Passed | No whitespace errors. |
| `git status --short` | Passed | Before this handoff update, only the expected test-file modification was present. |

### External-state confirmation

- [x] No hosted workflow, authentication, npm stage/publish/approval, registry,
      tag, release, dist-tag, settings, Host/model, pilot, or threshold action
      occurred.

### Public contract and documentation impact

- None.

### Deviations from assignment

- None.

### Known limitations and risks

- None.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No workflow/package/version/dependency/lockfile/source/public-contract/
      release/pilot/threshold/setting change was performed.
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
