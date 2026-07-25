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

- Status: `in_progress | blocked | needs_decision | ready_for_review`
- Handoff branch:
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
- [ ] No version, tag, publish, or release action was performed.
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

- M4 remains in progress until this closeout passes review and its
  coordinator-owned live orchestration evidence is recorded.
