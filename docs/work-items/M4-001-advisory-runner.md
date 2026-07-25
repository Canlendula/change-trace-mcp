# M4-001 — Implement the Host-neutral advisory CI runner

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M4 — Advisory CI integration`
- Base commit: `b3e22fbb3131beacf50f41400716ec3b8282dc5d`
- Branch: `codex/M4-001-advisory-runner`
- Worktree: Codex-managed isolated worktree
- Push task branch: `no`
- Objective: Implement a deterministic, Host/provider-neutral wrapper that
  runs one explicitly configured headless Agent command, validates the
  resulting Change Trace report pair, classifies the advisory outcome, and
  always leaves bounded artifacts for CI without failing the pipeline for a
  review finding or recoverable Host/infrastructure failure.
- Dependencies: Accepted M3 `write_report` and Report `1.0.0` contract. Do not
  change MCP tools, report schemas, finding behavior, Agent instructions, or
  provider configuration in this task.

### Coordinator-owned CI contract

- A configured Host command is an explicit JSON array of executable plus
  arguments and is spawned without a shell.
- The Host receives run context through documented environment variables and
  is responsible for writing `release-review.md` and `release-review.json`
  beneath the assigned output directory.
- A successful `release-review.json` remains the existing Report `1.0.0`
  object. The runner must not rewrite it.
- The runner writes a separate bounded `release-review-status.json` sidecar
  containing run identity, Host identity, outcome, aggregate counts, file
  names, byte sizes, and SHA-256 hashes. It must contain no report body,
  evidence excerpts, prompt, raw model response, or raw Host streams.
- Outcome precedence is:
  1. `infrastructure_failure` when the Host times out/exits nonzero or the
     expected report pair is missing, unsafe, malformed, or internally
     inconsistent;
  2. `inconclusive` when the valid Report contains an inconclusive finding,
     rejected finding, missing evidence, or bundle truncation;
  3. `completed_with_findings` when it contains one or more confirmed or
     suspected findings;
  4. `completed_no_findings` otherwise.
- A recoverable infrastructure failure still produces bounded
  `release-review.md`, `release-review.json`, and
  `release-review-status.json` failure artifacts with a distinct CI failure
  artifact type. These placeholders are not represented as core Report
  `1.0.0` objects.
- The default wrapper exit is zero after it has safely written all required
  artifacts, for every advisory outcome. Unsafe configuration, output-path
  confinement failure, or inability to write the artifact set may exit
  nonzero.
- The wrapper emits one bounded, content-free summary to stdout. It never
  forwards raw Host stdout/stderr to CI logs or artifacts.
- Reruns replace only the three exact managed artifact names and record new
  `runId`, `runAttempt`, start/completion times, base/head revisions, and
  hashes. No broad directory deletion is allowed.

### In scope

- Add one dependency-free Node.js advisory runner under `scripts/ci/`.
- Define and document the environment/CLI contract, four states, outcome
  precedence, artifact shapes, exit behavior, timeout, and rerun behavior in
  `docs/ci/README.md`.
- Accept the Host command only as a non-empty JSON string array. Reject empty
  elements, NUL characters, invalid JSON, non-string values, and oversized
  command definitions. Never use `shell: true`.
- Require an absolute repository root and a confined repository-relative
  output directory. Reject absolute output paths, traversal, `.git` paths,
  symlink escapes, unsafe existing artifact types, and managed paths outside
  the repository.
- Enforce a bounded configurable timeout with a conservative default and hard
  maximum. Terminate the direct child on timeout and do not perform broad
  process-tree or name-based termination.
- Bound captured Host stdout/stderr in memory, never echo or persist them, and
  discard them after recording a safe error code/exit code.
- Validate the minimum complete Report `1.0.0` structure needed for
  classification, including IDs, timestamps, finding arrays, rejected
  findings, missing evidence, validation summary, and bundle truncation.
- On success, verify both expected files are regular files inside the output
  directory and compute their exact size and SHA-256.
- On recoverable failure, replace only the three managed artifact paths with
  bounded Markdown/JSON/status placeholders. Sanitize the reason by
  allowlisting stable runner error codes and bounded numeric process data; do
  not include raw exception/Host text.
- Add deterministic integration tests with fixture Host processes covering:
  all four outcome states, precedence, timeout, nonzero exit, missing/malformed
  files, mismatched report summary, path confinement, symlink/file-type
  rejection where supported, command validation, redaction/non-disclosure,
  bounded output, rerun metadata, exact replacement scope, stable JSON, and
  zero advisory exit.
- Add an `npm run smoke:ci` script that runs a dependency-free deterministic
  generic CI smoke path and verifies all three artifacts.

### Out of scope

- GitHub Actions, GitLab CI, OpenCode, GitHub Models, Claude, Codex, provider
  credentials, or Host-specific prompts/configuration.
- Invoking the MCP or generating semantic findings inside the runner.
- Changing Report/Finding/ReviewBundle schemas, `write_report`, MCP tools,
  production source, public exports, or package dependencies.
- Uploading artifacts, posting comments, notifications, or merge gates.
- Enforced/blocking mode. M4 remains advisory by default.
- Recording raw Host output, model responses, prompts, evidence excerpts, or
  credentials.
- Changing package version, release state, npm state, Roadmap, project
  decisions, workflow governance, or compatibility claims.

### Allowed paths

- `scripts/ci/**`
- `tests/fixtures/ci/**`
- `tests/integration/advisory-ci.test.ts`
- `docs/ci/README.md`
- `package.json` — add only the `smoke:ci` script
- `docs/work-items/M4-001-advisory-runner.md` — Worker handoff section only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- Assignment and Coordinator review sections of this task file
- `.github/**`
- `README.md`
- `package-lock.json`
- `src/**`
- all existing tests
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The runner spawns only an explicit validated argv array with
      `shell: false`, bounded timeout, bounded capture, and no raw stream
      forwarding.
- [ ] Repository/output/artifact confinement rejects traversal, absolute
      output, `.git`, symlink escape, and unsafe existing managed paths.
- [ ] A valid Report `1.0.0` pair is preserved byte-for-byte and classified
      with the declared four-state precedence.
- [ ] Success status records stable run/Host metadata, counts, relative file
      names, exact sizes, and SHA-256 hashes without report content.
- [ ] Timeout, process failure, missing/malformed/inconsistent reports, and
      unsafe report paths produce bounded infrastructure-failure artifacts
      when safe writing remains possible.
- [ ] All four advisory outcomes return zero after safe artifact creation;
      unsafe configuration/confinement/write failures remain nonzero.
- [ ] Reruns replace only the exact managed artifact set and record distinct
      run ID/attempt/timestamps/hashes.
- [ ] Tests prove raw Host output, secrets, prompts, evidence text, exception
      text, absolute private paths, and credentials cannot enter stdout or the
      status/failure artifacts.
- [ ] `npm run smoke:ci` executes a deterministic generic runner path and
      verifies `release-review.md`, `release-review.json`, and
      `release-review-status.json`.
- [ ] No MCP/public schema, production source, dependency, lockfile, workflow,
      Roadmap, decision, version, release, or npm state changes.
- [ ] The task branch is clean and all implementation plus Worker handoff
      changes are committed.

### Required validation

```text
npx vitest run tests/integration/advisory-ci.test.ts
npm run smoke:ci
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check b3e22fbb3131beacf50f41400716ec3b8282dc5d..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task file,
   M3 Report schema/writer, server error behavior, and current package scripts.
2. Confirm the isolated branch and exact base relationship.
3. Write failing tests for the contract, confinement, non-disclosure, states,
   timeout, rerun, and smoke path before implementing.
4. Implement the smallest dependency-free runner and fixture Hosts needed to
   satisfy the contract.
5. Audit every child-process, filesystem, error, and log path for shell use,
   traversal, symlink escape, unbounded content, or secret disclosure.
6. Run every required validation command.
7. Review the complete base diff for scope and protected-file violations.
8. Update only the Worker handoff section, commit all output, and leave the
   worktree clean at `ready_for_review`.

### Escalate when

- the existing Report `1.0.0` contract or MCP tool behavior must change;
- Host/provider-specific logic is needed in the generic runner;
- a dependency, credential, network call, broad process termination, or
  blocking/enforced policy is required;
- a raw Host stream or report body would need to be logged/persisted;
- implementation would touch a coordinator-only path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M4-001-advisory-runner`
- Implementation commits: `c8bc7fc82cfd22c9b4578f05c971e91d3db7f075`,
  `da9caf6285af47eefb138369bf933246fc9f855d`,
  `a64cc28ae7d9a9ad66cc67334b58621dae4a27f3`

### Implementation summary

- Added a dependency-free, Host-neutral advisory runner with explicit JSON argv
  parsing, `shell: false`, bounded stream draining, direct-child timeout
  escalation, report validation, four-state classification, confined artifact
  publication, and redaction-safe status/failure artifacts.
- Successful Host report pairs remain byte-preserved: the runner snapshot
  checks report sizes and SHA-256 hashes before and after publishing only the
  status sidecar.
- Before every Host invocation, the runner invalidates the preceding managed
  status, Markdown, and JSON files in that order. This prevents stale reports
  or statuses from being interpreted as output from a no-op rerun.
- Added deterministic fixture Hosts and integration coverage for precedence,
  recoverable failures, path/type safety, non-disclosure, bounded output,
  reruns, revision validation, and an uncooperative direct child.

### Changed areas

- `scripts/ci/advisory-runner.mjs` — generic runner and confined artifact handling.
- `scripts/ci/smoke-advisory-ci.mjs` and `package.json` — deterministic `smoke:ci` path.
- `tests/fixtures/ci/fixture-host.mjs` and
  `tests/integration/advisory-ci.test.ts` — Host fixtures and 22 integration tests.
- `docs/ci/README.md` — environment, artifact, outcome, timeout, rerun, and
  non-disclosure contract.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/integration/advisory-ci.test.ts` | PASS | 22 tests passed. |
| `npm run smoke:ci` | PASS | Verified all three generic CI artifacts. |
| `npm run check` | PASS | TypeScript check passed. |
| `npm test` | PASS | 17 files, 171 tests passed. |
| `npm run smoke:stdio` | PASS | Existing stdio smoke passed. |
| `npm run pack:check` | PASS | Dry-run package check passed. |
| `git diff --check` | PASS | No whitespace errors before handoff commit. |
| `git status --short` | PASS | Clean before handoff record staging. |

### Public contract and documentation impact

- Added the internal CI runner environment and artifact contract in
  `docs/ci/README.md`; no MCP schema, tool, production source, dependency, or
  public package export changed.

### Deviations from assignment

- None.

### Known limitations and risks

- Failure placeholders are written Markdown, JSON, then status last. A
  mid-write filesystem failure exits nonzero; status is not treated as a fresh
  completion record. The runner intentionally does not use broad deletion or
  process-tree termination.
- Pre-run invalidation only unlinks the three exact managed regular files;
  removing status first prevents a stale completion sidecar if a later unlink
  fails before Host startup.

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
