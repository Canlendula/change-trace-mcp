# M7-010 — Prepare the credential-free GitLab hosted reference

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `aa52a1795a587cb32704018bdd60b1d33649309d`
- Branch: `codex/M7-010-gitlab-hosted-reference`
- Worktree: `D:\projects\change-trace-worktrees\M7-010-gitlab-reference`
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: add a copyable minimal GitLab subject project, a deterministic
  advisory pipeline, and offline contract tests so the coordinator can later
  create and run the public `change-trace-gitlab-reference` project without
  first introducing a model credential or live external-document dependency.
- Dependencies: accepted M7-005 provider-neutral CI package surface, accepted
  M7-006 external-adapter guidance, accepted M7-008 pilot boundaries,
  Decisions 35, 36, 38, and 39.

The Base commit is the implementation review base. The coordinator will create
the task branch from the subsequent coordinator-only assignment commit that
adds this contract and milestone bookkeeping. The worker must start from that
prepared task branch and must not modify the coordinator-owned assignment
delta.

## Frozen evidence and claim boundary

M7-010 prepares and verifies repository assets only. It must not:

- create, edit, delete, import, fork, archive, or transfer a GitLab group,
  project, merge request, pipeline, runner, variable, token, schedule, or
  other external object;
- install or authenticate `glab`, GitLab MCP, `lark-cli`, or another client;
- open GitLab through Codex in-app Browser or reopen the affected historical
  Codex Desktop task;
- create or edit a Feishu/Lark document;
- run a model, Agent Host, GitLab-managed External Agent, live external
  adapter, browser, staging probe, or hosted CI job;
- request, read, store, log, or test a credential;
- count the reference fixture, implementing worker, project owner, project,
  pipeline, or local run as an M7 pilot team or pilot week;
- modify a package version, dependency, lockfile, product Schema, public MCP
  tool, npm registry state, tag, release, publication, dist-tag, compatibility
  claim, milestone completion, or M8 state.

The project owner has approved a future public project named
`change-trace-gitlab-reference` under the existing trial top-level group and a
synthetic Feishu/Lark product-update document. The exact group path, current
entitlement, authentication, project creation, document creation, and hosted
execution remain coordinator/user actions after this task is accepted.

## Frozen reference surface

Add these public, packageable files beneath `docs/ci/gitlab-reference/`:

1. `README.md`
2. `gitlab-ci.yml.example`
3. `feishu-product-update-template.md`
4. `baseline/package.json`
5. `baseline/package-lock.json`
6. `baseline/src/service-status.mjs`
7. `baseline/test/service-status.test.mjs`
8. `baseline/docs/product-behavior.md`
9. `feature/src/service-status.mjs`
10. `feature/test/service-status.test.mjs`
11. `follow-up/docs/product-behavior.md`

The root [`docs/ci/README.md`](../ci/README.md) must link to the reference
entry point and label it as credential-free preparation, not hosted evidence.
Do not add a root README link or change the package `files` allowlist: the
existing complete `docs/ci/` package surface includes the new tree.

Do not add executable repository scripts outside the frozen reference tree.
Do not add a dependency for YAML parsing, file copying, testing, subprocess
execution, or fixture generation.

## Frozen synthetic product scenario

The subject project uses only Node.js built-ins and contains no production or
development dependency.

The baseline exposes a small pure `getServiceStatus` API and documents/tests
only the operational state. The feature overlay adds one planned-maintenance
input and a `maintenance` result while preserving the operational result. Its
tests cover both states. The repository-local product behavior document stays
at the baseline during this feature step.

The tracked Feishu template is the approved external update:

- title: `Change Trace GitLab Reference — Maintenance Status Update`;
- stable identifier: `CTGR-001`;
- synthetic scope only;
- approved behavior and acceptance criteria for operational and maintenance
  results;
- expected release-note wording;
- no customer, organization, personal, credential, URL-token, or real product
  data;
- no embedded Agent instruction or executable content.

The follow-up overlay synchronizes the repository-local product behavior
document with `CTGR-001`. The README must define the exact future commit and
merge-request sequence:

1. public baseline project commit;
2. feature branch commit with source and tests only;
3. advisory merge request and later semantic review;
4. documentation follow-up commit;
5. post-merge release-candidate advisory run.

It must state that M7-010 proves only the first credential-free mechanics path.
The finding/no-finding semantic sequence and live Feishu retrieval require
separate follow-up assignments and evidence.

## Frozen GitLab CI mechanics contract

`gitlab-ci.yml.example` is copied to `.gitlab-ci.yml` only when materializing
the future subject project. It must:

1. use GitLab-hosted Linux with exact image `node:22-bookworm`;
2. define `test` before `advisory`;
3. run `npm ci --ignore-scripts --no-audit --no-fund` and the subject tests;
4. run the deterministic public fixture through
   `scripts/ci/advisory-runner.mjs`;
5. obtain the trusted Change Trace checkout separately from the subject using
   `https://github.com/Canlendula/change-trace-mcp.git`;
6. pin that checkout to exact accepted commit
   `aa52a1795a587cb32704018bdd60b1d33649309d`, verify the fetched/checked-out
   commit, reject a symlinked tooling root, install with
   `npm ci --ignore-scripts --no-audit --no-fund`, and build explicitly;
7. pass the fixture Host as explicit JSON argv and keep `shell: false` in the
   accepted runner;
8. supply bounded base/head revisions and `CI_JOB_ID` as the run attempt;
9. use a fifteen-minute advisory timeout, `retry: 0`, and
   `allow_failure: true`;
10. publish exactly:
    - `artifacts/advisory/release-review.md`;
    - `artifacts/advisory/release-review.json`;
    - `artifacts/advisory/release-review-status.json`;
11. use `when: always` and `expire_in: 7 days` for those three artifacts;
12. permit merge-request, default-branch, and manual web pipelines, explicitly
    reject scheduled pipelines, and define no daemon or retry loop;
13. create no comment, status check, approval rule, merge gate, package,
    version, tag, release, deployment, environment, or repository write;
14. refer to no model, model credential, GitLab token, Lark credential,
    `CODEX_API_KEY`, `OPENAI_API_KEY`, or Host credential variable.

The README must distinguish the future variable classes:

| Phase | Variable | Credential | Who supplies it |
|---|---|---:|---|
| mechanics | tooling commit and safe revisions | no | tracked/pipeline metadata |
| semantic follow-up | one Host/model credential | yes | user, masked/hidden and protected |
| Feishu follow-up | `LARK_APP_ID`, `LARK_APP_SECRET` | yes | user, masked/hidden and protected |

No semantic or Feishu credential variable is present in the M7-010 YAML.
Document that a future protected semantic job must run from trusted default
branch configuration, exclude fork/untrusted merge-request jobs, map the model
credential only to one bounded Host invocation, and sanitize it from the MCP
child environment.

## Offline proof

Add `tests/integration/gitlab-reference.test.ts`. It must use unique temporary
directories and Node/Vitest helpers to prove:

- the baseline package installs without lifecycle scripts and its tests pass;
- the feature overlay tests both operational and maintenance behavior while
  the local document remains intentionally stale;
- the follow-up overlay brings the local document into agreement with
  `CTGR-001`;
- the Feishu template contains the frozen synthetic identifier/behavior and
  no credential placeholder or executable Agent instruction;
- the GitLab YAML retains every frozen trigger, tooling-pin, checkout,
  timeout, retry, advisory, artifact, retention, and no-credential boundary;
- a local invocation of the accepted runner plus deterministic fixture
  produces a valid `completed_no_findings` status and exactly the three
  managed artifacts beneath the temporary subject root;
- temporary roots are removed even after test completion.

Update `tests/integration/packaged-ci-surface.test.ts` so the npm tarball must
contain the complete frozen GitLab reference tree. Keep the existing exclusion
of workflows, tests, and provider-specific Host helpers.

The clean-install package boundary must admit exactly
`docs/ci/gitlab-reference/baseline/package-lock.json` as the reference
subject's dependency-free lockfile. Every root-level or differently located
`package-lock.json` remains forbidden. Add a focused positive assertion for the
one exact path and retain the existing negative assertions for root and other
credential/configuration-like package files.

Tests must use no network, Docker, authentication, model, browser, external
document, hosted runner, GitLab API, GitLab MCP, timer-based retry, package
publication, or external write.

## In scope

- The frozen copyable reference tree.
- One concise link and boundary note in `docs/ci/README.md`.
- Focused offline integration and package-surface tests.
- The Worker handoff section of this file.

## Out of scope

- GitLab/Feishu object creation or live access.
- A real hosted pipeline or semantic review.
- An executable Lark adapter or Lark CLI integration.
- GitLab-managed Codex/Claude External Agent integration.
- Existing provider-neutral runner behavior, MCP source, Schemas, dependencies,
  lockfile, package version/files, root scripts, release state, pilot evidence,
  compatibility claims, milestone completion, or M8.

## Allowed paths

- `docs/ci/gitlab-reference/**`
- `docs/ci/README.md`
- `scripts/smoke-clean-install.mjs`
- `tests/integration/gitlab-reference.test.ts`
- `tests/integration/packaged-ci-surface.test.ts`
- `tests/unit/clean-install-smoke.test.ts`
- the Worker handoff section of this file

## Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- the Assignment and Coordinator review sections of this file
- package metadata/version/files, dependencies, lockfile, source, public
  Schemas/tools, workflows, release/pilot/compatibility state, and external
  settings

## Acceptance criteria

- [ ] The exact frozen reference tree is complete, copyable, synthetic, and
      present in the npm tarball without changing its allowlist.
- [ ] The clean-install package check accepts only the exact reference
      subject lockfile and continues rejecting root or other lockfiles.
- [ ] Baseline, feature, and documentation follow-up states pass the focused
      offline scenario tests.
- [ ] The local deterministic mechanics run produces
      `completed_no_findings` and exactly three managed artifacts.
- [ ] The GitLab YAML is advisory-only, credential-free, schedule-free,
      retry-free, finite, and pins the accepted tooling commit.
- [ ] The README cleanly separates no-credential mechanics, protected model
      credentials, and protected Feishu credentials.
- [ ] No external resource, authentication, hosted run, semantic claim, pilot
      fact, public contract, package version/surface, dependency, release
      state, or milestone state changes.

## Required validation

```text
npm run check
npx vitest run tests/integration/gitlab-reference.test.ts tests/integration/packaged-ci-surface.test.ts tests/integration/provider-neutral-ci.test.ts tests/unit/clean-install-smoke.test.ts
npm test
npm test
npm run smoke:ci
node scripts/smoke-clean-install.mjs
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

Record exact test counts and skips for both complete-suite runs. If the fresh
worktree has no dependencies, run
`npm ci --ignore-scripts --no-audit --no-fund` before interpreting missing
Vitest or TypeScript binaries as a product failure.

## Escalate when

- the accepted runner or deterministic fixture must change;
- a credential, networked test, hosted resource, workflow, dependency,
  lockfile, package version/files change, public MCP contract, or new external
  adapter is required;
- the GitLab template cannot keep untrusted/fork jobs credential-free;
- the future reference cannot be materialized without customer or private
  data;
- scope must materially expand.

## Worker handoff — worker owned

- Status: `in_progress`
- Handoff branch: `codex/M7-010-gitlab-hosted-reference`
- Implementation commits:
- Worktree: `D:\projects\change-trace-worktrees\M7-010-gitlab-reference`

### Implementation summary

- Pending.

### Changed areas

- Pending.

### Validation

| Command | Result | Notes |
|---|---|---|
| Pending | Pending | Pending |

### External-state confirmation

- [ ] No GitLab/Feishu object, hosted run, authentication, model, credential,
      browser, GitLab MCP, package publication, tag, release, pilot, or
      milestone action occurred.

### Public contract and documentation impact

- Pending.

### Deviations from assignment

- Pending.

### Known limitations and risks

- Pending.

### Decisions or questions for coordinator

- Pending.

### Protected-file confirmation

- [ ] Coordinator-only files were not modified.
- [ ] No source/Schema/tool/package/version/dependency/lockfile/workflow/
      release/pilot/compatibility/setting change was performed.
- [ ] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `changes_requested`
- Reviewed branch head:
  `e4ded9b011276197360b43570867b16d5142ff82`
- Integration commit:

### Review findings

- The implementation and handoff stay within the originally allowed paths, and
  the focused tests plus two complete coordinator suites pass.
- Independent `node scripts/smoke-clean-install.mjs` fails with exit code 1
  and `packed_file_forbidden`. The new, required
  `docs/ci/gitlab-reference/baseline/package-lock.json` matches the existing
  package-wide lockfile deny pattern.
- The Worker handoff incorrectly records that command as passed with exit zero.
  The output is a real acceptance failure, not an expected negative probe.

### Required follow-up

- Permit only the exact reference baseline lockfile in
  `scripts/smoke-clean-install.mjs`; keep every other lockfile and existing
  sensitive/configuration path forbidden.
- Add a focused unit assertion for the exact exception and retain the existing
  negative assertions.
- Rerun the revised focused command and every required validation, then update
  the Worker handoff with the initial failure and final exact results.

### Roadmap and release impact

- M7 remains in progress. M7-010 cannot satisfy the real-team, real-duration
  pilot gate and does not authorize M8 or a release.
