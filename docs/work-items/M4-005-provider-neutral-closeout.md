# M4-005 — Close M4 with a provider-neutral CI reference

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M4 — Advisory CI integration`
- Base commit: `d786521ee47c69ac166064374ad2f883134a1836`
- Branch: `codex/M4-005-provider-neutral-closeout`
- Worktree:
  `D:\projects\change-trace-worktrees\M4-005-provider-neutral-closeout`
- Push task branch: `no`
- Objective: replace the rejected free GitHub Models/OpenCode reference path
  with a manual-only deterministic GitHub orchestration smoke, add a copyable
  provider-neutral GitHub Actions example for a caller-supplied Host, and leave
  the historical provider failure evidence intact.
- Dependencies: accepted M4-001 runner, accepted M4-002 trust boundaries,
  rejected M4-003 provider path, accepted M4-004 quality evidence, and
  Decisions 21–22.

### Coordinator-owned closeout contract

- Change Trace supplies a deterministic advisory runner and report/artifact
  contract. The consumer supplies and quality-qualifies its Agent Host/model.
- The repository's live M4 workflow becomes `workflow_dispatch` only. It uses
  the deterministic fixture Host to prove runner execution, three-artifact
  upload, advisory behavior, bounded summary, revisions, and
  `github.run_attempt` propagation without a model credential.
- The deterministic smoke is orchestration evidence only. It must label itself
  clearly and cannot create a semantic Host/model compatibility claim.
- The rejected GitHub Models/OpenCode code and the manual GPT-4.1 quality-spike
  workflow may remain as historical engineering evidence, but no active M4
  reference workflow may install OpenCode, request `models: read`, expose a
  GitHub Models credential, or offer a switch that resumes inference.
- The copyable GitHub example accepts an explicit JSON argv Host command from
  protected repository/organization configuration. It is provider- and
  CLI-neutral, advisory by default, uploads only the three managed artifacts,
  and explains that the selected Host must prevent its provider credential
  from entering MCP child processes, arguments, logs, prompts, reports, or
  artifacts.
- Model-vendor Actions such as Codex or Claude, platform-native Agents, PR
  comments, and checks may be documented as outer integration options. They
  are not implemented or certified by this task.

### In scope

- Convert `.github/workflows/m4-advisory-review.yml` into the manual-only
  deterministic provider-neutral orchestration smoke described above.
- Add `docs/ci/github-actions.example.yml` as a copyable provider-neutral
  caller-supplied Host example.
- Update `docs/ci/README.md` to make the selected architecture, deterministic
  smoke boundary, generic GitHub/GitLab usage, credential ownership, and
  historical rejected path unambiguous.
- Update the focused CI integration tests, or add one focused test file, to
  enforce the workflow trigger, permission, credential, artifact, summary,
  run-attempt, and provider-neutral example contracts.
- Make the smallest smoke-helper change needed to accept safe run/revision
  metadata from GitHub Actions. Do not change the generic runner contract.

### Out of scope

- Any live GitHub Actions dispatch, rerun, push, platform comment, check, or
  release action. The coordinator owns live evidence and publication.
- Calling a model, adding a provider credential, purchasing a service,
  selecting or tuning a model, or making a semantic compatibility claim.
- Implementing Codex Action, Claude Code Action, GitLab External Agents,
  Bitbucket Agentic Pipelines, Copilot, or another platform-native Agent.
- Changing MCP tools, source schemas, Report/Finding/ReviewBundle contracts,
  the accepted generic runner behavior, production source, dependencies,
  lockfile, package version, exports, npm state, Roadmap, project decisions,
  global workflow governance, or release state.
- Deleting or rewriting
  `docs/evaluation/M4_GPT41_RESULTS.md`,
  `docs/evaluation/M4_CI_AGENT_LANDSCAPE.md`, or the historical quality-spike
  harness.

### Allowed paths

- `.github/workflows/m4-advisory-review.yml`
- `docs/ci/README.md`
- `docs/ci/github-actions.example.yml`
- `scripts/ci/smoke-advisory-ci.mjs`
- `tests/integration/advisory-host.test.ts`
- `tests/integration/gpt41-quality-spike.test.ts` — update only the obsolete
  assertion that required the active M4 workflow to retain the rejected
  OpenCode inference switch; preserve all historical quality-spike behavior
  and evidence assertions
- `tests/integration/provider-neutral-ci.test.ts`
- `docs/work-items/M4-005-provider-neutral-closeout.md` — Worker handoff only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- this task's Assignment and Coordinator review sections
- `.github/workflows/m4-gpt41-quality-spike.yml`
- `scripts/ci/advisory-runner.mjs`
- `src/**`
- `package.json`
- `package-lock.json`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The live M4 reference workflow has only a manual trigger and cannot run
      on push, pull request, `pull_request_target`, schedule, or reusable
      invocation.
- [ ] It requests no model permission or model/provider credential and contains
      no OpenCode installation or inference path.
- [ ] Its quality and advisory responsibilities remain separate; the advisory
      job is bounded and non-blocking by default.
- [ ] Its deterministic Host runs through the accepted generic runner and
      creates a valid `completed_no_findings` report pair plus status sidecar.
- [ ] The workflow forwards safe base/head revisions and
      `github.run_attempt`, uploads exactly the three managed artifacts with a
      run/attempt-qualified name, and publishes only an allowlisted bounded
      summary.
- [ ] The deterministic workflow and documentation state explicitly that this
      proves orchestration, artifact, and rerun behavior only.
- [ ] The GitHub example is provider-neutral, uses an explicit JSON argv Host
      command, stays advisory, bounds runtime, and uploads exactly the three
      managed artifacts.
- [ ] The GitHub and GitLab guidance assign provider credential sanitization to
      the configured Host and do not imply that environment masking alone
      prevents a credential from reaching an MCP child.
- [ ] Existing manual GPT-4.1 evidence remains historical and automatic model
      inference stays impossible.
- [ ] Focused tests, generic CI smoke, type checking, the full suite, stdio
      smoke, package dry-run, diff checks, and clean worktree checks pass.
- [ ] No public MCP/schema/source/dependency/lockfile/version/governance/
      release/npm state or compatibility claim changes.

### Required validation

```text
npx vitest run tests/integration/advisory-host.test.ts tests/integration/provider-neutral-ci.test.ts
npm run smoke:ci
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check d786521ee47c69ac166064374ad2f883134a1836..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task,
   Decisions 20–22, the M4 evidence records, M4-001 through M4-004, the
   accepted runner, current workflow, CI guide, and focused tests.
2. Confirm the isolated worktree, assigned branch, and exact base relationship.
3. Write or update failing focused tests for manual-only triggers, absence of
   model capability, deterministic runner execution, run metadata, exact
   artifacts, bounded summary, and provider-neutral example behavior.
4. Implement the smallest workflow, helper, example, and documentation changes
   that satisfy the closeout contract.
5. Audit the complete diff for automatic triggers, model/provider references,
   credential flow, subject-code execution, uncontrolled output, timeout,
   artifact scope, and accidental compatibility claims.
6. Run every required validation command and review the complete base diff.
7. Update only the Worker handoff section, commit all output, leave the
   worktree clean, and report `ready_for_review`.

### Escalate when

- the generic runner contract, MCP/report schema, production source,
  dependency, lockfile, package metadata, or coordinator-only file must change;
- a model/provider credential or network inference is needed;
- the provider-neutral example cannot avoid a fixed Agent vendor;
- raw Host output, prompts, report bodies, or credentials would need to enter
  logs, summaries, or artifacts;
- a public compatibility claim or material task expansion is required.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M4-005-provider-neutral-closeout`
- Implementation commits:
  `6c94dfaf654a26f04eb6060f98b008dfafff8334`

### Implementation summary

- Replaced the active M4 workflow with a `workflow_dispatch`-only,
  credential-free deterministic orchestration smoke. Quality and advisory jobs
  remain separate; the advisory job is timeout-bounded, non-blocking, and
  uploads only the three managed artifacts under a run/attempt-qualified name.
- Forwarded safe workflow revision and run-attempt metadata through the
  deterministic smoke helper, verified the resulting
  `completed_no_findings` status, and retained the accepted generic runner
  contract unchanged.
- Added a provider-neutral GitHub Actions example that reads an explicit JSON
  argv Host command from protected configuration, confines the optional
  credential to the Host step, and documents the Host-owned MCP child
  sanitization boundary.
- Reframed the CI guide around the caller-supplied Host architecture while
  keeping the rejected OpenCode/GitHub Models path and manual quality spike
  clearly historical.

### Changed areas

- `.github/workflows/m4-advisory-review.yml` — manual deterministic workflow,
  job separation, safe metadata, exact artifact upload, and bounded summary.
- `scripts/ci/smoke-advisory-ci.mjs` — forwarded and verified revision/attempt
  metadata without changing the runner.
- `docs/ci/README.md` and `docs/ci/github-actions.example.yml` — selected
  architecture, GitHub/GitLab credential ownership, copyable Host example, and
  historical-path boundary.
- `tests/integration/provider-neutral-ci.test.ts`,
  `tests/integration/advisory-host.test.ts`, and
  `tests/integration/gpt41-quality-spike.test.ts` — active workflow,
  deterministic smoke, provider neutrality, exact artifacts, and obsolete
  historical assertion coverage.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/integration/advisory-host.test.ts tests/integration/provider-neutral-ci.test.ts` | PASS | 2 files, 8 tests passed. |
| `npm run smoke:ci` | PASS | Produced and verified `completed_no_findings` plus all three artifacts. |
| `npm run check` | PASS | TypeScript check passed. |
| `npx vitest run tests/integration/advisory-ci.test.ts` | PASS | Existing generic runner suite passed, 22 tests. |
| `npm test` | PASS | Final run passed 20 files and 185 tests. Two earlier full runs reproduced the previously recorded 200 ms parallel-load fixture timeout in `advisory-ci.test.ts`; the focused runner suite and final full run passed without changes to that protected test or runner. |
| `npm run smoke:stdio` | PASS | Existing stdio tool smoke passed. |
| `npm run pack:check` | PASS | Package dry-run passed. |
| `git diff --check d786521ee47c69ac166064374ad2f883134a1836..HEAD` | PASS | No whitespace errors after the implementation commit. |
| `git status --short` | PASS | Clean after the implementation commit. |

### Public contract and documentation impact

- Added internal CI deployment guidance and a copyable provider-neutral
  workflow example. No MCP tool, Report/Finding/ReviewBundle schema, generic
  runner contract, production source, dependency, lockfile, package version,
  export, npm state, or semantic compatibility claim changed.

### Deviations from assignment

- The full suite exposed one obsolete M4-004 assertion that required the
  active workflow to retain the rejected OpenCode inference switch. The
  coordinator expanded the task allowlist in `aa97e43` and authorized only
  replacing that assertion with the new manual/no-model boundary; all other
  historical quality-spike assertions remain unchanged.

### Known limitations and risks

- A coordinator-owned live manual dispatch and rerun are still required to
  record GitHub orchestration evidence. The deterministic fixture proves
  orchestration, artifacts, advisory containment, and rerun metadata only; it
  makes no semantic Host/model compatibility claim.
- The existing 200 ms generic-runner fixture can time out under full-suite
  parallel load. Its focused 22-test run and the final 185-test suite passed;
  this task did not change that protected runner/test contract.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified by the worker.
- [x] No version, dependency, tag, publish, model call, live workflow, or
      release action was performed.
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

- M4 remains in progress until this closeout passes review and its
  coordinator-owned live orchestration evidence is recorded.
