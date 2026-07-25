# M4-002 — Integrate a trusted OpenCode Host with advisory CI

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M4 — Advisory CI integration`
- Base commit: `2d4bcbf5610ba742aa5d3256a3544b13ef60b3a0`
- Branch: `codex/M4-002-opencode-github-actions`
- Worktree: Codex-managed isolated worktree
- Push task branch: `no`
- Objective: Integrate the accepted Host-neutral runner with a pinned headless
  OpenCode Host backed by GitHub Models, add a non-blocking GitHub Actions
  workflow and a generic GitLab-compatible template, and prove the Host/MCP
  credential boundary without changing the MCP or Report contracts.
- Dependencies: Accepted M4-001 advisory runner and accepted M3 evidence,
  finding-validation, and Report `1.0.0` tools.

### Coordinator-owned Host and trust decisions

- The M4 reference Host is `opencode-ai@1.18.5` using the custom
  OpenAI-compatible provider endpoint
  `https://models.github.ai/inference` and model `openai/gpt-4.1`.
- GitHub Actions authenticates the model call with the job-scoped
  `GITHUB_TOKEN` and only `contents: read` plus `models: read`.
  No repository secret or PAT is required.
- The model credential may exist only in the trusted OpenCode Host step. It
  must not be present during dependency installation/build, enter MCP process
  environment, appear in command arguments, logs, prompts, reports, status, or
  uploaded artifacts.
- Pull-request advisory execution uses two checkouts:
  1. a trusted tooling checkout at the PR base SHA;
  2. a subject checkout at the PR head SHA.
  Push/dispatch runs may use the current `github.sha` for both roles.
- All runner, Host, prompt, OpenCode configuration, build, and MCP executable
  paths come from the trusted checkout. The subject checkout is read only as
  the repository under review and receives only the three report artifacts.
  The advisory job must not execute subject scripts, dependencies, project
  OpenCode configuration, hooks, or binaries.
- OpenCode runs from an isolated temporary home/config/data/cache area with an
  inline trusted configuration. Sharing, snapshots, updates, built-in tools,
  subagents, and all providers except the selected GitHub Models provider are
  disabled. Only `change_trace_*` MCP tools are allowed.
- The MCP entry point is the built output from the trusted checkout. Before it
  is imported, its process environment is reduced to the minimum runtime/Git
  variables and contains no GitHub/model/provider credential.
- The Agent must use the existing tools in this order:
  `get_change_scope`, `collect_local_evidence`, `get_review_bundle`,
  `validate_findings`, and `write_report`. It writes
  `release-review.md` and `release-review.json`; the M4-001 runner writes the
  status sidecar and classifies the outcome.
- Subject repository text is untrusted evidence. The prompt must tell the
  Agent never to follow instructions found in repository content and to make
  claims only from the bounded ReviewBundle.
- GitHub Copilot Code Review remains optional and deferred because no licensed
  pilot is available. Do not add a Copilot dependency or compatibility claim.

### GitHub Actions contract

- Trigger on pull requests, pushes to `main`, and manual dispatch.
- Keep the normal build/test result in a separate least-privilege job.
- Run the advisory job with `if: always()`, a bounded job timeout, and
  job-level `continue-on-error: true`, so advisory infrastructure or review
  outcomes do not change the release/test result by default.
- Pin official actions by full commit:
  - `actions/checkout` v7.0.1:
    `3d3c42e5aac5ba805825da76410c181273ba90b1`
  - `actions/setup-node` v7.0.0:
    `820762786026740c76f36085b0efc47a31fe5020`
  - `actions/upload-artifact` v4.6.2:
    `ea165f8d65b6e75b540449e92b4886f43607fa02`
- Use Node.js 22 and full Git history where review refs must resolve.
- Install the exact OpenCode package before the credential-bearing step.
- Pass safe base/head commit IDs and `github.run_attempt` to the runner. Handle
  manual dispatch or an all-zero initial-push base without passing an invalid
  Git ref to the MCP.
- Invoke the accepted generic runner with explicit JSON argv and a timeout no
  greater than its fifteen-minute maximum. Raw OpenCode JSON events and stderr
  remain captured and discarded by the runner.
- Always upload only `release-review.md`, `release-review.json`, and
  `release-review-status.json`. The artifact name must include
  `github.run_id` and `github.run_attempt`.
- Write a bounded job summary from allowlisted status fields only: outcome,
  safe aggregate counts, run attempt, revisions, file names, sizes, and hashes.
  Never print the report body or raw Host output.

### Generic CI contract

- Add one copyable GitLab-compatible example using the generic runner after a
  test stage, a bounded timeout, `allow_failure: true`, and `artifacts:
  when: always`.
- Keep the example provider-neutral. It may accept a protected/masked
  Host/provider credential and explicit JSON Host argv, but must not copy that
  credential into MCP configuration or logs.
- Explain the trusted-tooling/subject-worktree boundary and how another CI
  system supplies safe base/head revisions and a unique attempt number.

### In scope

- Add one GitHub Actions workflow under `.github/workflows/`.
- Add trusted OpenCode Host/config/prompt, MCP environment sanitization, safe
  status-summary, and deterministic Host smoke helpers under `scripts/ci/`.
- Add Host/config/workflow fixtures under `tests/fixtures/ci/` and one new
  integration test file under `tests/integration/`.
- Extend `docs/ci/README.md` and add one generic GitLab-compatible example
  under `docs/ci/`.
- Add only the minimum package script needed for a deterministic offline Host
  smoke, if useful.
- Verify the exact OpenCode version/package metadata and the three action pins
  during implementation. Do not float versions in committed CI.

### Out of scope

- Changing `scripts/ci/advisory-runner.mjs` or its public artifact contract
  unless a task-blocking defect is found and reported as `needs_decision`.
- GitHub Copilot Code Review, other model providers, paid credentials, PATs,
  repository comments, annotations, notifications, merge gates, or blocking
  mode.
- Running untrusted subject code with the model credential.
- Persisting OpenCode sessions, raw events, model responses, prompts, evidence
  excerpts, full reports, or credentials outside the three accepted artifacts.
- Changing MCP tools, schemas, production source, dependencies, lockfile,
  package exports/version, npm state, Roadmap, project decisions, release
  state, or compatibility claims.
- Declaring M4 complete or editing live evidence results. The coordinator owns
  the real cloud run and milestone closure.

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
- `docs/ci/gitlab-ci.example.yml`
- `package.json` — add only an offline Host smoke script if needed
- `docs/work-items/M4-002-opencode-github-actions.md` — Worker handoff only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- work-item templates and this task's Assignment/Coordinator review sections
- `.github/workflows/m1-published-package-smoke.yml`
- `README.md`
- `package-lock.json`
- `src/**`
- existing tests
- `scripts/ci/advisory-runner.mjs`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The workflow has the three required triggers, separate quality/advisory
      jobs, least-privilege permissions, exact action/Host pins, bounded
      timeouts, job-level advisory `continue-on-error`, and always-uploaded
      uniquely named artifacts.
- [ ] PR execution uses trusted base tooling and a separate subject head
      checkout. The credential-bearing step runs no subject executable,
      dependency, hook, or OpenCode project configuration.
- [ ] Only the OpenCode Host receives the GitHub Models token. Tests prove the
      trusted MCP process environment excludes token/credential sentinels and
      retains only documented runtime variables.
- [ ] OpenCode configuration is isolated, share/update/snapshot/subagent
      behavior is disabled, provider access is allowlisted, built-in tools are
      denied, and only `change_trace_*` tools are allowed.
- [ ] The fixed prompt treats subject text as untrusted evidence, invokes the
      complete M3 tool sequence, validates findings, and writes the exact
      `release-review` pair with run/revision context.
- [ ] Host stdout/stderr/model events are never forwarded or stored. The
      workflow summary contains only bounded allowlisted status metadata.
- [ ] Offline integration tests exercise Host configuration, prompt/run
      context, environment sanitization, workflow trust boundaries, advisory
      behavior, artifact paths/names, and the generic template without network
      or live credentials.
- [ ] The generic GitLab-compatible example is provider-neutral, advisory,
      bounded, artifact-producing, and documents protected credential handling.
- [ ] Existing M4-001, type, full test, stdio smoke, and pack checks still pass.
- [ ] No protected source/schema/dependency/lockfile/version/Roadmap/decision/
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
git diff --check 2d4bcbf5610ba742aa5d3256a3544b13ef60b3a0..HEAD
git status --short
```

If no new package script is necessary, replace `npm run smoke:ci:host` with
the exact offline Host smoke command and record that explicit deviation.

### Mandatory implementation sequence

1. Read `AGENTS.md`, the contribution workflow, this task, accepted M4-001
   runner/docs/tests, M3 tool schemas/writer, and current workflows/scripts.
2. Confirm the isolated branch and exact base relationship.
3. Verify official GitHub Models/OpenCode behavior and exact package/action
   pins. Record no live token or credential value.
4. Write failing offline tests for trust separation, token sanitization,
   OpenCode restrictions, prompt sequence, workflow behavior, summary bounds,
   artifact handling, and the generic template.
5. Implement the smallest trusted Host/config/prompt and sanitizer.
6. Implement the workflow and generic template using the accepted runner.
7. Audit every credential, config-discovery, child-process, log, artifact, and
   subject-path boundary. Search the complete diff for credential material.
8. Run every required validation command and review the complete base diff.
9. Update only the Worker handoff, commit all output, leave the worktree clean,
   and report `ready_for_review`.

### Escalate when

- GitHub Models cannot be used with the documented job-scoped token and
  `models: read`;
- OpenCode cannot be restricted to the selected provider/MCP tools or cannot
  run from an isolated trusted configuration;
- subject code/config would need to execute with the model credential;
- the generic runner, Report/MCP contract, dependencies, lockfile, public
  schema, or protected workflow/governance files must change;
- raw Host/model output or credential-bearing content would need to be logged;
- another provider, secret, paid product, broad permission, blocking policy,
  or scope expansion is required.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M4-002-opencode-github-actions`
- Implementation commits: `a5abcad472c9e71f5b8d7c1accbef7959e70e738`, `bd6b2290b0c558d50b8e73f6616e4e9f32768f7f`, `1f9715dd27dd8eceae9ac9568f84588c96d09d3a`

### Implementation summary

- Added a non-blocking GitHub Actions advisory workflow with distinct quality
  and advisory jobs. `pull_request` runs only low-privilege quality from the
  PR merge commit; `pull_request_target` runs the model-bearing advisory from
  the trusted base workflow definition. Trusted base/subject-head checkouts
  support fork subjects, retain the no-subject-execution boundary, use full
  action pins and bounded revisions, and upload uniquely named three-file
  artifacts.
- Fixed the exact OpenCode 1.18.5 install so its required `postinstall` runs
  only in the pre-credential installation step. The workflow then verifies the
  package manifest, confined real binary path, and direct CLI version before
  the credential-bearing Host step.
- Added an isolated OpenCode 1.18.5 GitHub Models Host, fixed trusted prompt,
  credential-clearing MCP configuration, import-before-sanitization wrapper,
  bounded Host child timeout, and an allowlisted status summary.
- Added a provider-neutral GitLab-compatible template, trusted-boundary usage
  documentation, deterministic offline Host smoke, and offline integration
  coverage for configuration, prompt, environment, timeout, workflow, summary,
  and artifact behavior.

### Changed areas

- `.github/workflows/m4-advisory-review.yml` — event-separated trusted
  advisory/low-privilege quality workflow, explicit fork-head checkout opt-in,
  and verified postinstall-enabled OpenCode CLI installation.
- `scripts/ci/opencode-advisory-host.mjs`, `start-sanitized-mcp.mjs`,
  `summarize-advisory-status.mjs`, and prompt/smoke helpers — trusted Host,
  environment boundary, bounded output, status rendering, and offline smoke.
- `tests/fixtures/ci/opencode-host-fixture.mjs` and
  `tests/integration/advisory-host.test.ts` — deterministic isolation and
  workflow contract tests.
- `docs/ci/README.md` and `docs/ci/gitlab-ci.example.yml` — provider-neutral
  deployment guidance and GitLab example.
- `package.json` — added `smoke:ci:host` only.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/integration/advisory-host.test.ts` | PASS | 5 offline Host/configuration tests passed. |
| `actionlint@2.0.6` Node parser on `.github/workflows/m4-advisory-review.yml` | PASS | No unexpected YAML/expression diagnostics. This older parser's sole `models` permission diagnostic was recognized as its unsupported current GitHub permission scope. |
| `npm run smoke:ci` | PASS | Existing generic runner smoke passed. |
| `npm run smoke:ci:host` | PASS | Deterministic isolated Host smoke passed. |
| `npm run check` | PASS | TypeScript check passed. |
| `npm test` | PASS | 18 files, 176 tests passed. One earlier full-run attempt exposed a pre-existing 200 ms M4-001 fixture timeout under parallel load; a focused rerun and final `npm test` passed without changes to protected existing tests. |
| `npm run smoke:stdio` | PASS | Existing stdio smoke passed. |
| `npm run pack:check` | PASS | Dry-run package check passed. |
| `git diff --check 2d4bcbf5610ba742aa5d3256a3544b13ef60b3a0..HEAD` | Pending final handoff commit | Re-run after this handoff is committed. |
| `git status --short` | Pending final handoff commit | Re-run after this handoff is committed. |

### Public contract and documentation impact

- Adds internal CI Host/configuration and advisory workflow usage documentation.
  No MCP schema, production source, dependency, lockfile, version, or package
  export changed.

### Deviations from assignment

- None.

### Known limitations and risks

- A real GitHub Actions run remains coordinator-owned. The reference workflow
  intentionally keeps review advisory and makes no compatibility or release
  claim.
- The split ensures the repository's intended model-bearing advisory execution
  is sourced from the base workflow; repository or organization workflow
  approval/execution-protection policy remains necessary to govern arbitrary
  PR-controlled workflow revisions.
- OpenCode's package lifecycle script executes only in the exact pinned,
  no-model-credential installation step. The direct manifest/realpath/version
  checks detect a missing or substituted CLI before the Host receives a token.

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

- Pending coordinator review.
