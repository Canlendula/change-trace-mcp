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

- Status: `ready_for_review`
- Handoff branch: `codex/M4-004-gpt41-quality-spike`
- Implementation commits:
  - `eb6a0b7` — feat(ci): add manual GPT-4.1 quality spike

### Implementation summary

- Added a `workflow_dispatch`-only GitHub Models quality-spike workflow with
  `contents: read` and `models: read`, a direct `openai/gpt-4.1` inference
  harness, bounded metadata artifact, and allowlisted job summary.
- The harness prepares the accepted M3 packets through the accepted replay
  helper, sends one non-streaming JSON-schema response request per attempted
  fixture, fixes output to 4,000 tokens, applies a 30-second transport timeout,
  and gives the credential-free evaluator subprocess its own 30-second bound.
- Mandatory fixtures run first in the declared order. The harness immediately
  stops on mandatory failure, a rejected finding, two failures, or a request,
  response, or scoring failure. It uses the accepted scorer without changing
  M3 fixtures, instruction `1.4.0`, response contract, or ground truth.
- Raw prompts, model/API responses, temporary captures, and credentials remain
  in memory or a removed private temporary directory. The persisted score is
  limited to run/configuration identifiers, packet digests, pass/fail and
  bounded failure codes, validation counts, stop reason, and aggregate gate
  metadata.
- Paused the credential-bearing OpenCode inference step and summary unless a
  maintainer explicitly manually dispatches the existing workflow with
  `run_opencode_advisory` enabled. Existing automatic non-model quality checks
  and trusted OpenCode setup remain unchanged.

### Changed areas

- `.github/workflows/m4-gpt41-quality-spike.yml` — Manual-only GPT-4.1 spike,
  least-privilege permissions, metadata-only artifact upload, and summary.
- `.github/workflows/m4-advisory-review.yml` — Manual guard for the
  credential-bearing OpenCode model invocation and summary.
- `scripts/ci/gpt41-quality-spike.mjs` and
  `scripts/ci/summarize-gpt41-quality-spike.mjs` — One-shot transport,
  early-stop gate, bounded score writer, and summary renderer.
- `tests/evaluation/gpt41-quality-spike.ts` — Credential-free adapter to the
  accepted M3 replay packet preparation and scorer.
- `tests/fixtures/ci/gpt41-quality-transport.mjs` and
  `tests/integration/gpt41-quality-spike.test.ts` — Deterministic fake
  transport and offline tests for order, one-shot behavior, failures,
  configuration, metadata bounds, and isolation.
- `docs/ci/README.md` — Manual spike, early stop, artifact, and MCP-capacity
  boundary documentation.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/integration/gpt41-quality-spike.test.ts` | PASS | 6 tests passed; fake transport covers success, ordering, mandatory failure, rejected findings, malformed/API failure, bounded metadata, manual trigger, and paused model step. |
| `npx vitest run tests/integration/advisory-host.test.ts` | PASS | 5 tests passed. |
| `npm run smoke:ci` | PASS | Generic advisory wrapper smoke passed. |
| `npm run smoke:ci:host` | PASS | Offline trusted OpenCode Host smoke passed. |
| `npm run check` | PASS | TypeScript strict check passed. |
| `npm test` | PASS | 19 test files and 182 tests passed. |
| `npm run smoke:stdio` | PASS | Build and stdio tool smoke passed. |
| `npm run pack:check` | PASS | `npm pack --dry-run` passed. |
| `git diff --check 2c26ec6e4e8288135994eab91f0170ae45de36a6..HEAD` | PASS before handoff commit | No whitespace errors in the base comparison at validation time. |
| `git status --short` | PASS before handoff commit | Only the worker-owned handoff update remained to commit. |

### Public contract and documentation impact

- No public MCP, package, source, schema, fixture, scorer, or dependency
  contract changed. The CI guide documents a manual internal feasibility spike.

### Deviations from assignment

- The legacy OpenCode workflow job still performs its non-credential setup on
  its existing automatic paths to preserve current trusted workflow checks; its
  only credential-bearing inference invocation and status summary are now
  manual-input guarded, so it cannot automatically consume model quota.

### Known limitations and risks

- The spike has intentionally not been run against GitHub Models. Semantic
  adequacy, quota availability, and complete-run stability remain for the
  coordinator to assess through a manual dispatch.
- The GitHub Models API may reject a request or structured response. Per the
  assigned policy this is recorded as a failed attempted fixture with no retry
  or raw diagnostic capture.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
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
