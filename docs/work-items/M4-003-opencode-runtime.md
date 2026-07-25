# M4-003 — Repair the live OpenCode advisory runtime

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M4 — Advisory CI integration`
- Base commit: `ade0adac68b0af0f8945968ca5b3978c05d93bda`
- Branch: `codex/M4-003-opencode-runtime`
- Worktree: Codex-managed isolated worktree
- Push task branch: `no`
- Objective: Diagnose and repair the trusted OpenCode Host after the first
  live GitHub Actions execution timed out without a valid advisory report,
  while preserving the accepted credential, trust, output, and artifact
  boundaries.
- Dependencies: Accepted M4-001 runner and M4-002 Host/workflow.

### Live failure evidence

- GitHub Actions run:
  `https://github.com/Canlendula/change-trace-mcp/actions/runs/30157035299`
- Event/head/attempt: `push`,
  `ade0adac68b0af0f8945968ca5b3978c05d93bda`, attempt `1`.
- Quality and advisory jobs completed successfully because advisory execution
  is intentionally non-blocking.
- The credential-bearing Host step ran from
  `2026-07-25T11:54:58.294Z` to `2026-07-25T12:06:58.553Z`.
- The generic runner classified the Host result as
  `infrastructure_failure` / `host_nonzero_exit`, exit code `1`.
- The uploaded three-file artifact contained bounded failure files only; no
  raw OpenCode output or credential was emitted.

### In scope

- Determine why `opencode-ai@1.18.5` does not complete in the accepted GitHub
  Models workflow.
- Inspect the exact OpenCode `v1.18.5` implementation and official provider,
  configuration, CLI, event, and permission behavior as needed.
- Make the smallest Host, prompt, configuration, or workflow correction that
  permits one bounded advisory run to call the required MCP sequence and
  produce a valid report pair.
- Add deterministic offline regression coverage for the root cause and any
  safe diagnostic classification.
- Safe diagnostics may classify allowlisted error categories or use distinct
  exit codes. They must never retain or print prompts, model responses, raw
  JSON events, stderr, evidence content, report bodies, tokens, headers, URLs
  containing credentials, or other uncontrolled text.

### Out of scope

- Weakening the trusted-tooling/subject-worktree split, credential isolation,
  non-blocking policy, tool allowlist, output-discarding policy, artifact
  allowlist, or bounded timeout.
- Adding another provider, paid credential, PAT, repository secret, Copilot
  dependency, workflow write permission, PR comments, or blocking checks.
- Changing the MCP, Report, runner public contract, production source,
  dependencies, lockfile, package version, exports, npm state, Roadmap,
  project decisions, release state, or compatibility claims.
- Running live GitHub Actions, rerunning a workflow, pushing a branch, or
  declaring M4 complete. The coordinator owns those actions.

### Allowed paths

- `.github/workflows/m4-advisory-review.yml`
- `scripts/ci/opencode-advisory-host.mjs`
- `scripts/ci/start-sanitized-mcp.mjs`
- `scripts/ci/summarize-advisory-status.mjs`
- `scripts/ci/smoke-opencode-advisory.mjs`
- `scripts/ci/opencode-advisory-prompt.md`
- `tests/fixtures/ci/opencode-host-fixture.mjs`
- `tests/integration/advisory-host.test.ts`
- `docs/ci/README.md`
- `docs/work-items/M4-003-opencode-runtime.md` — Worker handoff only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- work-item templates and this task's Assignment/Coordinator review sections
- `.github/workflows/m1-published-package-smoke.yml`
- `README.md`
- `package.json`
- `package-lock.json`
- `src/**`
- existing tests outside the allowed integration test
- `scripts/ci/advisory-runner.mjs`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The documented root cause is supported by the exact pinned OpenCode
      implementation, a deterministic reproduction, or bounded live evidence.
- [ ] The Host has a bounded path to a valid `write_report` result under the
      accepted GitHub Models workflow and retains the required five-tool
      sequence.
- [ ] The GitHub Models token remains confined to the trusted Host process and
      absent from MCP environment, arguments, logs, prompts, reports, status,
      summaries, and artifacts.
- [ ] Subject code/configuration remains unexecuted. The workflow still uses
      trusted Host/tooling code and a separate evidence-only subject checkout.
- [ ] Raw Host/model output remains discarded. Any new failure diagnostics are
      fixed, allowlisted, bounded, and covered by tests.
- [ ] Advisory behavior remains non-blocking, timeout-bounded, and restricted
      to the same three artifacts.
- [ ] Focused Host/workflow tests, both CI smokes, type checking, the full test
      suite, stdio smoke, package dry-run, and diff checks pass.
- [ ] No protected contract/source/dependency/lockfile/version/governance/
      release/npm state changed, and the task branch is committed and clean.

### Required validation

```text
npx vitest run tests/integration/advisory-host.test.ts
npm run smoke:ci
npm run smoke:ci:host
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check ade0adac68b0af0f8945968ca5b3978c05d93bda..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, the contribution workflow, this task, M4-001, M4-002,
   the live failure evidence above, and the accepted Host/workflow/tests.
2. Create the assigned branch at the exact base and confirm isolation.
3. Inspect the exact OpenCode `v1.18.5` implementation and reproduce the
   failure mode without exposing or inventing a credential.
4. Write a failing offline regression for the supported root cause or bounded
   diagnostic behavior.
5. Implement the smallest repair while retaining every accepted trust and
   output boundary.
6. Audit the complete diff for credential flow, uncontrolled output, subject
   execution, timeout behavior, and artifact scope.
7. Run every required validation command and review the complete base diff.
8. Update only the Worker handoff, commit all output, leave the worktree clean,
   and report `ready_for_review`.

### Escalate when

- the fix requires a different model provider, repository secret, PAT, paid
  service, broader GitHub permission, or new dependency;
- raw Host/model output or credential-bearing content must be logged or stored
  to diagnose the problem;
- subject code/configuration would need to execute with the model credential;
- the generic runner, MCP/Report contract, dependency/lockfile, public schema,
  or coordinator-only file must change;
- the failure cannot be classified or repaired without a product/security
  decision or material scope expansion.

## Worker handoff — worker owned

- Status: `in_progress`
- Handoff branch: `codex/M4-003-opencode-runtime`
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

- Pending.

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

- Outcome: `pending`
- Reviewed branch head:
- Integration commit:

### Review findings

- Pending.

### Required follow-up

- Pending.

### Roadmap and release impact

- M4 remains in progress until a successful live run and rerun produce valid
  advisory artifacts with distinct attempt metadata.
