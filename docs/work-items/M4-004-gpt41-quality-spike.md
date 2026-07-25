# M4-004 — Evaluate GPT-4.1 advisory review quality

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M4 — Advisory CI integration`
- Base commit: `2c26ec6e4e8288135994eab91f0170ae45de36a6`
- Branch: `codex/M4-004-gpt41-quality-spike`
- Worktree: Codex-managed isolated worktree
- Push task branch: `no`
- Objective: Build a manual, quota-bounded GitHub Models quality spike that
  sends the accepted nine M3 ReviewPackets directly to
  `openai/gpt-4.1`, scores each single declared response with the accepted M3
  scorer, and stops as soon as the declared M4 quality gate can no longer
  pass.
- Dependencies: Accepted M3 fixture, packet, scorer, and replay contracts;
  accepted M4-002 credential isolation; official GitHub Models inference API.

### Coordinator-supplied quality gate

- Use the exact accepted M3 fixture bundles, ReplayPacket schema, instruction
  version `1.4.0`, response contract, and scorer without changing ground truth.
- The model sees one prepared ReviewPacket and no MCP tool schemas, repository
  checkout, tools, permissions, expected answers, reference findings, or
  previous fixture responses.
- Capture exactly one response for each attempted fixture. Do not retry,
  replace, repair, select, or use best-of responses. An API, output-format,
  response-schema, or scoring failure counts as a failed attempted fixture.
- Evaluate mandatory fixtures first:
  `implemented-correctly`, `intentional-doc-free-refactor`,
  `malicious-instruction`, `insufficient-evidence`, and
  `missing-permissions`.
- Stop immediately when:
  - a mandatory fixture fails;
  - any submitted finding is rejected;
  - two fixtures have failed, making the required `8 / 9` impossible;
  - a request or infrastructure failure prevents a declared response.
- A complete first run passes only with at least `8 / 9`, all five mandatory
  fixtures passing, zero rejected findings, and no response selection.
- Only after a complete first-run pass may the coordinator trigger one complete
  rerun with the same configuration to assess stability.

### In scope

- Add a manual-only GitHub Actions quality-spike workflow using the built-in
  `GITHUB_TOKEN` with only `contents: read` and `models: read`.
- Pause automatic execution of the unresolved OpenCode advisory model job while
  preserving its code and non-model quality checks.
- Add a trusted, bounded direct-inference harness for the official GitHub Models
  chat-completions endpoint and model `openai/gpt-4.1`.
- Send the accepted packet as a single user message and request its exact
  structured JSON response contract when supported by the official API.
- Parse and score responses in memory or ephemeral storage. Keep raw prompts,
  model responses, evidence bodies, API bodies, and credentials out of logs,
  summaries, committed files, and uploaded artifacts.
- Emit only bounded score metadata needed to audit the gate: run identity,
  fixed model/configuration, request count, stop reason, fixture IDs and packet
  digests, fixture pass/fail and failure codes, validation counts, and aggregate
  gate outcome.
- Add deterministic offline tests with a credential-free fake transport for
  success, mandatory-fixture failure, rejection, malformed/API failure,
  ordering, no retry, bounded output, and credential/log isolation.
- Document the manual spike, early-stop policy, artifact boundary, and the fact
  that it tests model quality independently from MCP schema capacity.

### Out of scope

- Running or rerunning GitHub Actions, pushing a branch, accepting results, or
  declaring M4 complete. The coordinator owns those actions.
- Changing M3 fixtures, ground truth, review instruction, response schema,
  scorer, thresholds, or accepted M3 evidence.
- Changing the public MCP, Report, runner, or package contract; production
  source; dependencies or lockfile; package version; exports; npm state;
  Roadmap; project decisions; release state; or compatibility claims.
- Adding OpenCode, another model/provider, a PAT, repository secret, paid
  credential, Copilot dependency, write permission, PR comment, blocking check,
  response repair, retry, or prompt tuning.
- Uploading raw captures, prompts, evidence, model/API output, headers, tokens,
  or full API errors.
- Deleting the accepted OpenCode workflow or M4-003 branch.

### Allowed paths

- `.github/workflows/m4-advisory-review.yml`
- `.github/workflows/m4-gpt41-quality-spike.yml`
- `scripts/ci/gpt41-quality-spike.mjs`
- `scripts/ci/summarize-gpt41-quality-spike.mjs`
- `tests/evaluation/gpt41-quality-spike.ts`
- `tests/fixtures/ci/gpt41-quality-transport.mjs`
- `tests/integration/gpt41-quality-spike.test.ts`
- `docs/ci/README.md`
- `docs/work-items/M4-004-gpt41-quality-spike.md` — Worker handoff only

The worker may choose the smallest subset of the new harness paths above. Any
additional path requires coordinator approval.

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- work-item templates and this task's Assignment/Coordinator review sections
- `docs/evaluation/M3_RESULTS.md`
- `tests/fixtures/review/**`
- `tests/helpers/review-fixture.ts`
- `tests/helpers/review-replay.ts`
- `tests/helpers/review-score.ts`
- existing M3 scorer/replay tests
- `package.json`
- `package-lock.json`
- `src/**`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The workflow is `workflow_dispatch` only and cannot consume model quota
      on push, pull request, schedule, or reusable-workflow invocation.
- [ ] The unresolved OpenCode advisory model job cannot run automatically after
      this task reaches `main`; existing non-model quality checks remain intact.
- [ ] The harness attempts fixtures in the declared order, makes at most one
      inference request per attempted fixture, and implements every early-stop
      condition exactly.
- [ ] Each request uses the exact accepted packet and response contract for that
      fixture, with no tools and no access to expected/reference answers.
- [ ] The request is bounded, non-streaming, and fixed to
      `openai/gpt-4.1`; transport timeout and output limits are explicit.
- [ ] The built-in GitHub token reaches only the trusted inference process and
      never appears in child environment, arguments, output, artifacts, or
      summaries.
- [ ] Raw prompt/model/API content is discarded after in-memory or ephemeral
      scoring. Only allowlisted bounded metadata can be written or uploaded.
- [ ] Offline tests prove ordering, exact one-shot behavior, early stopping,
      scoring, malformed/API failure handling, fixed model/configuration,
      bounded metadata, and absence of credential/raw-content sentinels.
- [ ] Focused tests, type checking, the full test suite, both CI smokes, stdio
      smoke, package dry-run, and diff checks pass.
- [ ] No protected contract/source/dependency/lockfile/version/governance/
      release/npm state changed, and the task branch is committed and clean.

### Required validation

```text
npx vitest run tests/integration/gpt41-quality-spike.test.ts
npx vitest run tests/integration/advisory-host.test.ts
npm run smoke:ci
npm run smoke:ci:host
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 2c26ec6e4e8288135994eab91f0170ae45de36a6..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, the contribution workflow, this task, M3-002 through
   M3-009, M4-002, M4-003, the accepted replay/scorer code, and the current
   workflow/Host trust boundaries.
2. Verify the exact request and structured-response fields against official
   GitHub Models documentation. Do not add a dependency for the API call.
3. Create the assigned branch at the exact base and confirm worktree isolation.
4. Write failing offline tests for one-shot ordering, gate-based early stop,
   bounded output, and credential/raw-content isolation.
5. Implement the smallest trusted direct-inference spike and manual workflow.
6. Audit the complete diff for automatic triggers, credential flow,
   uncontrolled output, retries, accidental ground-truth exposure, timeouts,
   and artifact scope.
7. Run every required validation command and review the complete base diff.
8. Update only the Worker handoff, commit all output, leave the worktree clean,
   and report `ready_for_review`.

### Escalate when

- official GitHub Models behavior cannot provide one bounded structured response
  without a retry or response-repair step;
- the exact accepted packet cannot fit the free-tier request limit;
- a PAT, secret, paid tier, write permission, dependency, or broader trigger is
  required;
- raw Host/model/API output must be logged or uploaded to diagnose a failure;
- the accepted fixture, instruction, response schema, scorer, quality gate,
  public contract, or coordinator-only file must change;
- implementation would materially expand beyond a disposable quality
  feasibility spike.

## Worker handoff — worker owned

- Status: `in_progress`
- Handoff branch: `codex/M4-004-gpt41-quality-spike`
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

- M4 remains in progress. This spike decides whether free GitHub Models
  GPT-4.1 is semantically adequate for the advisory reference path before any
  capacity-adapter design is accepted.
