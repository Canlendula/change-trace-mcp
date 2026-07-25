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

- Status: `ready_for_review`
- Handoff branch: `codex/M4-003-opencode-runtime`
- Implementation commits: `07445695b07e054fd520cd3632480912889e800f`

### Implementation summary

- Root cause: the custom `github_models/openai/gpt-4.1` model omitted its
  `limit`. In exact OpenCode v1.18.5 source,
  `provider.ts` initializes an omitted custom-model output limit to `0`, then
  `ProviderTransform.maxOutputTokens()` turns that value into its 32,000-token
  fallback. The GitHub Models catalog identifies `openai/gpt-4.1` as High tier,
  and the documented free High-tier per-request limit is 8,000 input and 4,000
  output tokens. The prior Host therefore asked for 32,000 output tokens. The
  live Host stopped at its exact twelve-minute direct-child cap; the upstream
  response remains intentionally unrecorded, but v1.18.5 retries retryable
  session failures without a total-attempt cap, making this configuration a
  supported explanation for the timeout.
- Declared the custom-model limit explicitly as `context: 12000`, `input:
  8000`, and `output: 4000`, so OpenCode requests stay within the documented
  free-tier request shape while retaining enough combined context for tool
  calls.
- Raised the direct OpenCode-child ceiling to thirteen minutes and derive its
  maximum from the inherited fourteen-minute runner timeout, reserving one
  minute for child termination and artifact publication. The outer generic
  runner, output policy, and non-blocking workflow remain unchanged.

### Changed areas

- `scripts/ci/opencode-advisory-host.mjs` — bounded custom-model token limits
  and runner-aware direct-child timeout budget.
- `tests/integration/advisory-host.test.ts` — deterministic regression coverage
  for the exact custom-model limits and 13-minute/14-minute timeout boundary.
- `docs/ci/README.md` — documented the runtime limits and timeout budget.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/integration/advisory-host.test.ts` | PASS | 6 deterministic Host/workflow tests passed. |
| `npm run smoke:ci` | PASS | Existing generic runner smoke passed. |
| `npm run smoke:ci:host` | PASS | Deterministic isolated Host smoke passed. |
| `npm run check` | PASS | TypeScript check passed. |
| `npm test` | PASS | 18 files, 177 tests passed. |
| `npm run smoke:stdio` | PASS | Existing stdio smoke passed. |
| `npm run pack:check` | PASS | Dry-run package check passed. |
| `actionlint@2.0.6` Node parser on `.github/workflows/m4-advisory-review.yml` | PASS | No unexpected YAML/expression diagnostics. Its sole `models` permission diagnostic is the parser's unsupported current GitHub permission scope. |
| `npm view opencode-ai@1.18.5 version dist.integrity` | PASS | Version `1.18.5`; integrity matched the accepted package metadata. |
| `git diff --check ade0adac68b0af0f8945968ca5b3978c05d93bda..HEAD` | Pending final handoff commit | Re-run after this handoff is committed. |
| `git status --short` | Pending final handoff commit | Re-run after this handoff is committed. |

### Public contract and documentation impact

- Documents internal Host runtime limits only. No MCP schema, Report/runner
  contract, production source, dependency, lockfile, version, or package export
  changed.

### Deviations from assignment

- None. No raw provider/Host output was retained or classified; the limit and
  timeout repair is based on the exact pinned source, bounded live duration,
  and an offline configuration regression.

### Known limitations and risks

- A coordinator-owned live GitHub Actions retry remains required to prove a
  valid report pair with the current GitHub Models service. GitHub's free tier
  limits are documented as subject to change; the explicit 8k/4k configuration
  should be revisited if the credential tier changes.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

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
