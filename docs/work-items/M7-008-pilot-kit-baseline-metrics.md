# M7-008 — Establish the pilot kit and baseline metric schema

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `c7e6a81716aaafe01c189ea06c1b96b978f6406d`
- Branch: `codex/M7-008-pilot-kit-baseline-metrics`
- Worktree: Codex-managed isolated worktree for the assigned branch; record the
  absolute path in the Worker handoff.
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: provide a complete repository-only onboarding/offboarding kit,
  privacy-minimized observation Schema, deterministic summarizer, and
  mechanics-only fixture so real teams can later run the M7 advisory pilot
  without inventing thresholds or leaking product data.
- Dependencies: accepted M7-003 through M7-007 package/Host/CI/release
  preparation, Decisions 10, 13, 31, 35, 36, 37, and 38.

The Base commit is the implementation review base. The coordinator will create
the task branch from the subsequent coordinator-only assignment commit that
adds this contract and milestone bookkeeping. The worker must start from that
prepared task branch and must not modify the coordinator-owned assignment
delta.

## Frozen pilot qualification

The public-beta pilot target remains:

- 3 to 5 independent teams;
- at least three calendar weeks of advisory use;
- at least one team in each profile:
  - `repository_documents`;
  - `external_requirements`;
  - `runtime_staging`.

M7-008 prepares the kit only. Fixtures, local runs, existing Host evidence,
the implementing worker, and the project owner do not count as pilot teams or
weeks. Do not recruit or contact anyone, create issues/forms, send messages,
enable CI, request credentials, access Jira/Lark/staging, run a Host/model, or
claim that a pilot began or completed.

## Frozen repository-only surface

Add exactly these maintainable entry points:

1. `docs/pilot/README.md` — concise entry point and state boundary;
2. `docs/pilot/PILOT_PLAN.md` — onboarding, weekly operation, safety stops,
   disposition, offboarding, retention, and coordinator review;
3. `docs/pilot/FEEDBACK_FORM.md` — bounded questions that map exactly to the
   Schema without collecting free-form product content;
4. `docs/pilot/pilot-observation.schema.json` — Draft 2020-12 observation
   contract;
5. `docs/pilot/fixtures/mechanics-baseline.json` — synthetic multi-profile,
   multi-Host input;
6. `docs/pilot/fixtures/mechanics-summary.json` — exact expected output;
7. `scripts/pilot/summarize-pilot.mjs` — deterministic local summarizer;
8. `tests/unit/pilot-metrics.test.ts`;
9. `tests/integration/pilot-kit-package-boundary.test.ts`.

Keep all of these outside the npm package. Do not edit the package `files`
allowlist. The root README and public contribution/version documents need not
link to an unshipped maintainer kit.

## Frozen observation contract

The top-level JSON object has:

- `schemaVersion`: exact `1.0.0`;
- `pilotId`: a pseudonymous bounded ID;
- `teams`: 1 to 50 team records;
- `runs`: 1 to 10,000 run records.

No additional properties are allowed at any level.

Each team record has exactly:

- `teamId`: unique bounded pseudonymous ID;
- `profile`: `repository_documents`, `external_requirements`, or
  `runtime_staging`;
- `setupElapsedMs`: integer `0..604800000` or `null`;
- `observationWeeks`: integer `0..52`;
- `advisoryEnabledAtEnd`: boolean or `null`;
- `consentRecorded`: literal `true`.

Each run record has exactly:

- `runId`: unique bounded pseudonymous ID;
- `teamId`: reference to one existing team;
- `hostFamily`: `codex`, `claude_code`, `opencode`, or `other`;
- `hostVersion`: bounded factual version string;
- `instructionVersion`: bounded factual version string;
- `outcome`: `completed_findings`, `completed_no_findings`, `inconclusive`,
  `failed_setup`, `failed_host`, or `failed_validation`;
- `durationMs`: integer `0..86400000`;
- `contextCharacters`: integer `0..10000000`;
- `evidenceItemCount`: integer `0..10000`;
- `schemaCompatible`: boolean;
- `findings` with six integer `0..10000` fields:
  - `total`;
  - `validEvidenceReferences`;
  - `acceptedConfirmed`;
  - `dismissedFalsePositive`;
  - `inconclusive`;
  - `unreviewed`.

IDs use the existing bounded safe-ID shape and contain no organization,
repository, user, or system name. Host/instruction versions are facts, not
compatibility claims.

Cross-field validation must enforce:

- unique team and run IDs and no dangling `teamId`;
- all finding subtype counts are `<= total`;
- `acceptedConfirmed + dismissedFalsePositive + inconclusive + unreviewed`
  equals `total`;
- `validEvidenceReferences <= total`;
- `completed_no_findings` requires `total == 0`;
- `completed_findings` requires `total > 0`;
- every non-completed outcome requires all finding counts to be zero;
- `consentRecorded` is always true.

The observation has no timestamp, name, URL, path, arbitrary locator,
free-form note, raw content, or extension field. Do not add data that can carry
requirements, diffs, evidence, reports, prompts, responses, logs, secrets, or
credentials.

## Frozen summary contract

The summarizer emits one canonical single-line JSON object with:

- `schemaVersion`, `pilotId`, and `evidence: "mechanics-or-real-bounded-
  observation"`;
- `qualification`:
  - actual team count;
  - observation-week minimum across teams;
  - sorted present profiles;
  - booleans for team count, duration, profile coverage, and overall
    qualification;
- `runs`:
  - attempted/successful/failed/inconclusive counts;
  - successful-run `{ numerator, denominator, value }`;
  - successful-run duration, context-character, and evidence-item medians;
- `setup`:
  - observed and missing team counts plus median milliseconds or `null`;
- `findings`:
  - total and unreviewed counts;
  - valid-evidence, accepted/confirmed, dismissed/false-positive, and
    inconclusive `{ numerator, denominator, value }`;
  - inconclusive run count kept separately;
- `retention`:
  - enabled, disabled, and missing teams plus a ratio over decided teams;
- `crossHostSchema`:
  - eligible and compatible runs, ratio, and sorted exact Host families;
- `thresholds: { status: "unfrozen" }`.

Rules:

- successful is a completed outcome with `schemaCompatible: true`;
- failed is `failed_setup`, `failed_host`, or `failed_validation`;
- every run stays in the successful-rate denominator;
- duration/context/evidence medians use successful runs only;
- accepted/dismissed denominators use dispositioned findings:
  `acceptedConfirmed + dismissedFalsePositive + inconclusive`;
- valid-evidence and inconclusive denominators use all findings;
- retention denominator uses non-null end decisions;
- cross-Host denominator uses all runs;
- every ratio includes integer numerator and denominator; `value` is `null`
  for zero denominator and otherwise the exact JavaScript division result;
- median uses the frozen Decision 38 rule;
- array and object ordering is deterministic, with no time-dependent field.

The fixture must cover all profiles, at least three Host families, successful,
failed, no-finding, finding, inconclusive, missing setup, missing retention,
and a zero or non-zero denominator edge that proves `null` semantics in unit
tests. Fixture values prove only the math and must not make overall
qualification true unless the synthetic observation itself actually meets all
frozen conditions.

## Summarizer safety

`scripts/pilot/summarize-pilot.mjs` must:

- require exactly one explicit input-file argument;
- read at most 5 MiB and reject symlinks, directories, BOM, invalid UTF-8,
  malformed JSON, and trailing non-JSON content;
- validate the full frozen contract independently of TypeScript source or
  network access;
- use no dependency, subprocess, shell, environment credential, network,
  clock, random value, file write, or dynamic code execution;
- emit only the bounded summary JSON to stdout;
- emit a stable bounded error object to stderr and a nonzero exit on failure;
- avoid echoing input data, paths, identifiers, or raw parser messages in
  diagnostics.

## Pilot documents

The documents must be mutually consistent and cover:

- voluntary team consent and a named team-side operator;
- data classification before use and explicit exclusion of secrets/private
  product content from the shared observation;
- exact package/Host/instruction versions recorded locally;
- advisory-only operation and no default merge gate;
- setup start/end measurement and the frozen definition of first valid report;
- logging every attempted run, including failure;
- review/disposition vocabulary and denominator definitions;
- weekly collection without raw artifacts;
- immediate stop/escalation for credential exposure, unexpected write/network
  behavior, high-severity product finding, or Schema contradiction;
- team-owned raw evidence retention/deletion;
- final enabled/disabled decision without pressure;
- coordinator-only aggregation, compatibility claims, threshold decisions,
  milestone decisions, and release actions;
- explicit statement that thresholds remain unfrozen and the mechanics
  fixture is not pilot evidence.

`FEEDBACK_FORM.md` must use fixed choices/numbers that map to the JSON fields.
It may include a local team-owned notes section clearly marked “do not submit
to Change Trace”; that section must not map into the observation JSON.

## In scope

- The nine frozen repository-only files.
- Offline deterministic validation and aggregation.
- The Worker handoff section of this file.

## Out of scope

- Product source, public MCP/Schema contracts, package files, dependencies,
  lockfile, version, license, contribution/version/security/release guidance,
  hosted workflows, repository settings, registry, tags, releases, dist-tags,
  trusted publishing, telemetry, analytics upload, dashboards, issue/forms,
  notifications, adapters/converters, live systems, Host/model calls,
  recruitment, real pilot observations, thresholds, compatibility claims, or
  M7 completion.

## Allowed paths

- `docs/pilot/README.md`
- `docs/pilot/PILOT_PLAN.md`
- `docs/pilot/FEEDBACK_FORM.md`
- `docs/pilot/pilot-observation.schema.json`
- `docs/pilot/fixtures/mechanics-baseline.json`
- `docs/pilot/fixtures/mechanics-summary.json`
- `scripts/pilot/summarize-pilot.mjs`
- `tests/unit/pilot-metrics.test.ts`
- `tests/integration/pilot-kit-package-boundary.test.ts`
- the Worker handoff section of this file

## Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- the Assignment and Coordinator review sections of this file
- package metadata/surface/version, dependencies, lockfile, hosted workflows,
  repository/npm settings, credentials, registry, tags, releases,
  compatibility claims, thresholds, pilot qualification, and milestone state

## Acceptance criteria

- [ ] All nine repository-only files exist, agree with Decision 38, and stay
      outside the exact npm tarball.
- [ ] Draft 2020-12 Schema and executable validation freeze every field,
      enum, limit, additional-property, identity, reference, count, outcome,
      consent, and privacy boundary.
- [ ] The summarizer deterministically reproduces the checked expected
      summary and rejects malformed, over-limit, contradictory, duplicate-ID,
      dangling-reference, privacy-expanding, and non-file inputs.
- [ ] Metric numerators, denominators, missingness, zero-denominator `null`,
      medians, qualification, retention, and cross-Host calculations match
      Decision 38.
- [ ] Documents provide actionable onboarding, weekly observation,
      disposition, safety stop, offboarding, retention, and fixed feedback
      guidance without collecting raw product content.
- [ ] Fixture and documents make no real pilot, threshold, compatibility,
      release, or M7-completion claim.
- [ ] No source, public Schema/tool, package/dependency/lockfile/version,
      telemetry, network, credential, hosted workflow, external service,
      registry, tag, release, dist-tag, or real pilot state changes.

## Required validation

```text
npm run check
npx vitest run tests/unit/pilot-metrics.test.ts tests/integration/pilot-kit-package-boundary.test.ts
npm test
node scripts/pilot/summarize-pilot.mjs docs/pilot/fixtures/mechanics-baseline.json
npm run smoke:stdio
npm run smoke:ci
node scripts/smoke-clean-install.mjs
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

The Worker records exact focused/full test counts, the fixture summary match,
clean-install digest/file count, package exclusion, audit result, and any
skipped validation. All tests remain offline except the accepted clean-install
dependency read from the public npm registry.

## Escalate when

- the frozen fields cannot represent an actual qualifying pilot without raw
  or identifying data;
- a public package/Schema, source, dependency, workflow, setting, telemetry,
  credential, threshold, or external-state change appears necessary;
- an existing metric or Host contract contradicts Decision 38;
- a real team, credential, Host/model run, external system, hosted run, or
  release action becomes necessary;
- scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M7-008-pilot-kit-baseline-metrics`
- Implementation commits: `a514e0866adca06230b154e09578ad25d312b363`,
  `adc05178d7d0253435f0755dd7cf34643ac20bb7`
- Worktree: `C:\Users\C\.codex\worktrees\b635\agent-e2e-mcp`

### Implementation summary

- Added the repository-only pilot onboarding/offboarding/retention kit, strict
  Draft 2020-12 observation Schema, synthetic mechanics fixture and exact
  canonical summary, dependency-free deterministic local summarizer, and
  focused offline unit/package-boundary tests.
- The summarizer reads one explicit non-symlink file only, caps it at 5 MiB,
  rejects BOM/invalid UTF-8/malformed and contradictory observations, emits no
  input-derived diagnostics, and computes the Decision 38 denominators,
  missingness, null ratios, medians, qualification, retention, and cross-Host
  fields without thresholds.
- Follow-up: package-boundary packing now ignores lifecycle scripts during
  concurrent Vitest runs; the kit states the complete qualifying baseline and
  exact form arithmetic; Draft 2020-12 zero-finding clauses cover every
  no-finding and non-completed outcome that the document can express.

### Changed areas

- `docs/pilot/` — repository-only kit, frozen Schema, and synthetic mechanics
  fixtures.
- `scripts/pilot/summarize-pilot.mjs` — offline deterministic contract
  validation and canonical aggregation.
- `tests/unit/pilot-metrics.test.ts` and
  `tests/integration/pilot-kit-package-boundary.test.ts` — contract, safety,
  fixture-exactness, null semantics, Draft Schema clauses, and
  lifecycle-script-free tarball-exclusion coverage.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm ci --offline --ignore-scripts --no-audit --no-fund` | PASS | Local cache only; installed 219 packages without network. |
| `npm run check` | PASS | TypeScript strict check passed after follow-up. |
| `npx vitest run tests/unit/pilot-metrics.test.ts tests/integration/pilot-kit-package-boundary.test.ts` | PASS | 2 files, 7 tests. |
| `npm test` | Existing failure only | 43 files: 406 passed, 2 skipped, 1 failed. The only failure is `release-publishing-contract` expecting LF while the protected workflow remains CRLF. The prior concurrent `npm pack` EOF is resolved. |
| `npx vitest run --pool=forks --maxWorkers=1 --fileParallelism=false --testNamePattern="^(?!.*keeps the workflow manual, pinned, cache-free, credential-separated, and stage-guarded).*"` | PASS | Deterministic serial suite excluding only that exact existing test: 43 files, 406 passed, 3 skipped. |
| `node scripts/pilot/summarize-pilot.mjs docs/pilot/fixtures/mechanics-baseline.json` | PASS | Exact single-line match with `mechanics-summary.json`. |
| `npm run smoke:stdio` | PASS | Existing nine-tool fixture smoke passed. |
| `npm run smoke:ci` | PASS | Existing deterministic advisory fixture passed. |
| `node scripts/smoke-clean-install.mjs` | PASS | Credential-free clean install: SHA-256 `0403569a13494bcec7880a840333f183019e1610a79c07845715be14bf7eefb5`; 209 files; cleanup `true`. |
| `npm run pack:check` | PASS | 209 files; dry-run contents excluded every `docs/pilot/` and `scripts/pilot/` entry point. |
| `npm audit --omit=dev --audit-level=high` | PASS | `found 0 vulnerabilities`. |
| `git diff --check` | PASS | No whitespace errors. |
| `git status --short` | PASS before commit | Only the nine assigned repository-only paths and this worker handoff were pending. |

### Pilot-state confirmation

- [x] No team was recruited/contacted and no real observation was created.
- [x] No Host/model, hosted workflow, credential, external system, registry,
       tag, release, publish, dist-tag, or settings action occurred.
- [x] No threshold, compatibility, qualification, milestone, or release claim
       was made.

### Public contract and documentation impact

- None. All additions are intentionally excluded from the npm package and no
  public MCP/Schema/tool/package contract changed.

### Deviations from assignment

- No implementation deviation. The complete suite has one existing protected
  workflow line-ending assertion failure; all other tests pass in the recorded
  deterministic serial run.

### Known limitations and risks

- The coordinator may resolve the protected workflow CRLF assertion outside
  this assignment. No M7-008 implementation limitation remains from the prior
  pack concurrency or clean-install timeout.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No package/version/dependency/lockfile/workflow/setting/telemetry/
       threshold change was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head:
  `3e39d7731f264a64fe5a7c3e091a872ec0a2e394`
- Integration commit:
  `3e39d7731f264a64fe5a7c3e091a872ec0a2e394` (fast-forward)

### Review findings

- The first review requested lifecycle-script-free package-boundary packing,
  a self-contained qualifying-baseline/form contract, stronger expressible
  JSON Schema outcome constraints, and direct zero-denominator and duplicate
  team-ID coverage. Commit `adc0517` resolved every item.
- Independent focused validation passed both new test files at 7 of 7.
  Parallel full validation then passed 406 tests with two existing
  Windows-inapplicable POSIX skips; its only failure was the pre-existing
  M7-007 test's LF-only assertion against a CRLF checkout. A one-worker run
  excluding exactly that assertion passed all 43 files at 406 tests with
  three skips. No concurrent package EOF remained.
- Independent clean-install validation produced one 209-file tarball with
  packed/unpacked sizes `179280` / `874430`, SHA-1
  `49403bf83a9b36ad47a2e9250210f11c38e9a97a`, SHA-256
  `0403569a13494bcec7880a840333f183019e1610a79c07845715be14bf7eefb5`,
  exact nine tools, the M1 fixture, three CI artifacts, and cleanup `true`.
  The stdio/CI smokes, package dry-run, zero-vulnerability production audit,
  fixture-exact summary, and forbidden network/process/write/random/clock
  source scan also passed.

### Required follow-up

- Run the real opt-in pilot with 3 to 5 independent teams for at least three
  calendar weeks and cover all three frozen profiles. Recruitment, raw
  evidence custody, external credentials/systems, observations, and consent
  require separate team/operator coordination.
- Keep thresholds unfrozen until the complete qualifying real baseline is
  reviewed. The synthetic fixture and local validation cannot satisfy the M7
  exit gate.
- Resolve the pre-existing M7-007 LF-only workflow test as a separate bounded
  portability follow-up; it does not affect the accepted M7-008 runtime or
  repository-only pilot contracts.

### Roadmap and release impact

- M7 construction-sequence item 7 preparation is accepted. M7 remains in
  progress because no real team was contacted and no real multi-week
  observation exists.
- This work changes no package surface/version, public MCP/Schema contract,
  dependency, telemetry, hosted workflow, credential, threshold,
  compatibility, registry, tag, release, publish, or dist-tag state.
