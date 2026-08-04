# M7-011 — Run the credential-free GitLab.com reference mechanics

## Assignment — coordinator owned

- Status: `ready_for_fresh_pipeline`
- Milestone: `M7 — Public beta hardening`
- Base commit: `f88fbeadacac23ffbd759908444500b40cb1113f`
- Execution owner: coordinator; this is an external hosted acceptance task,
  not a delegated implementation task.
- Repository branch/worktree: `main` in the coordinator worktree for governed
  records only; the subject uses a separate local clone.
- External project:
  `https://gitlab.com/infinty081/change-trace-gitlab-reference`
- External SSH remote:
  `git@gitlab.com:infinty081/change-trace-gitlab-reference.git`
- External document:
  `https://rcnw05c7n18f.feishu.cn/wiki/Ecm9wM0EXiH8I4kvQIfcivtUnoe`
- Objective: materialize the accepted synthetic baseline in the public GitLab
  project, run the first real GitLab-hosted credential-free mechanics
  pipeline, and record bounded pipeline/job/artifact evidence without a model
  or external-document credential.
- Dependencies: accepted M7-010 assets and Decision 39.

No worker is assigned because this task changes external coordinator-owned
state and records acceptance evidence; it does not implement product or
repository behavior. If hosted execution exposes a repository defect, create
a separate complete worker assignment before changing implementation.

## Confirmed starting facts

As verified on 2026-08-04:

- the public project page resolves and reports an empty repository;
- the project is under the personal `infinty081` namespace because the
  initially considered default group only allowed Private visibility;
- the supplied SSH remote accepts the coordinator's configured SSH identity
  when checked against the GitLab.com ED25519 host key published by GitLab;
- the Feishu Wiki document exists but contains only its title according to the
  project owner;
- `glab`, GitLab MCP, and `lark-cli` are unavailable locally;
- the affected Codex Desktop task remains unopened and Codex in-app Browser is
  not used.

The GitLab page and SSH remote establish project/repository access only. They
do not establish pipeline success, runner availability, artifact correctness,
trial entitlement, semantic compatibility, or pilot evidence.

## Authorized external mutations

The coordinator may:

1. create one separate local clone of the empty subject repository;
2. copy the accepted M7-010 `baseline/` contents into its root;
3. copy `gitlab-ci.yml.example` to `.gitlab-ci.yml` without semantic changes;
4. run dependency-free local tests and inspect the staged subject tree;
5. create one baseline commit on `main` and push it to the supplied SSH remote;
6. allow the pushed `.gitlab-ci.yml` to start its configured test and
   credential-free advisory jobs;
7. read public pipeline/job pages and download the three public advisory
   artifacts for bounded acceptance checks;
8. record URLs, IDs, commit SHA, timestamps, safe statuses, artifact names,
   sizes, hashes, and the bounded status sidecar in governed documentation.

No force-push, history rewrite, branch deletion, project/group setting change,
variable, token, schedule, runner registration, environment, approval rule,
merge gate, MR, feature overlay, retry, cancel, manual rerun, or semantic job is
authorized by this task. A failed pipeline is evidence to inspect; do not retry
until its first failure and logs are preserved and the cause is understood.

After accepted M7-012 through M7-014, the coordinator is additionally
authorized to copy the accepted
`docs/ci/gitlab-reference/gitlab-ci.yml.example` byte-for-byte over the subject
`.gitlab-ci.yml`, verify that this is the only subject diff, commit it once with
message `ci: advance Change Trace tooling pin`, and push subject `main` through
the already configured SSH remote. The resulting default-branch push pipeline
is the one fresh pipeline authorized for hosted acceptance. No manual retry,
extra pipeline, variable, setting, or other subject file change is authorized.

## Frozen subject content

The baseline commit contains exactly the materialized M7-010 subject files:

- `.gitlab-ci.yml` copied byte-for-byte from
  `docs/ci/gitlab-reference/gitlab-ci.yml.example`;
- `package.json`;
- `package-lock.json`;
- `src/service-status.mjs`;
- `test/service-status.test.mjs`;
- `docs/product-behavior.md`.

It contains no feature/follow-up overlay, Feishu template, credential, local
path, coordinator log, MCP configuration, browser state, incident data, or
generated artifact. The baseline commit message is
`feat: add operational service status baseline`.

The authorized post-defect subject commit changes only `.gitlab-ci.yml` from
historical tooling pin `aa52a1795a587cb32704018bdd60b1d33649309d` to accepted,
audited tooling pin `49a07185c2af05ee8dcffe33b23355ce1dce8353` in the exact
three fetch/checkout/verification locations. All other YAML and subject bytes
remain unchanged.

## Hosted acceptance contract

The first pipeline must be attributable to the exact pushed baseline commit.
Acceptance requires:

- GitLab-hosted `node:22-bookworm` jobs;
- `subject_test` succeeds after dependency-free `npm ci` and `npm test`;
- `change_trace_mechanics` runs after the test job and itself succeeds;
- the advisory job remains `allow_failure: true`, `retry: 0`, and bounded by
  fifteen minutes;
- no scheduled, manually retried, duplicate, waiting, or continuously running
  pipeline remains;
- the immutable tooling checkout resolves to
  `aa52a1795a587cb32704018bdd60b1d33649309d`;
- the advisory status outcome is `completed_no_findings`;
- exactly these artifacts are retained for seven days:
  - `artifacts/advisory/release-review.md`;
  - `artifacts/advisory/release-review.json`;
  - `artifacts/advisory/release-review-status.json`;
- the JSON report and status sidecar remain schema-valid and internally
  consistent, and recorded sizes/hashes match downloaded files;
- logs and artifacts contain no credential, raw browser data, or unexpected
  repository mutation.

The deterministic fixture proves GitLab orchestration, trusted-tooling
checkout, runner execution, and artifact handling only. It makes no semantic
review, Host/model, Feishu, pilot, compatibility, or release claim.

## Feishu boundary

The Feishu document URL is recorded as the future explicit-reference source.
M7-011 does not require or authorize Lark application credentials, live adapter
retrieval, search, organization-wide discovery, or semantic use. If an already
authenticated safe document client is available, the coordinator may populate
the currently empty body from the accepted
`docs/ci/gitlab-reference/feishu-product-update-template.md` after resolving
the Wiki token to its real document token. Otherwise the exact manual paste
remains a user action and does not block GitLab mechanics acceptance.

## Repository records

Coordinator-owned repository changes are limited to:

- `docs/PROJECT_DECISIONS.md`;
- `docs/ROADMAP.md`;
- `docs/evaluation/M7_GITLAB_REFERENCE_RESULTS.md`;
- this work item.

Do not change product source, tests, CI templates, dependencies, lockfile,
package metadata/version/files, workflow files, schemas, public contracts,
security policy, pilot observations/thresholds, or release state during this
task.

## Required validation

Before push in the separate subject clone:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
git diff --check --cached
git status --short
git ls-files
```

After the hosted run:

```text
verify remote main equals the local baseline commit
verify pipeline and both job statuses from public GitLab evidence
download and inspect exactly three advisory artifacts
validate release-review.json and release-review-status.json
calculate SHA-256 and byte size for each artifact
verify no active or scheduled/retried pipeline remains
git diff --check
git status --short
```

## Escalate when

- SSH authentication fails after the official GitLab host key is verified;
- the public project is no longer empty before the baseline push;
- the materialized subject differs from the accepted source assets;
- a pipeline/job fails, stalls, or requires a variable, token, permission,
  runner tag, manual retry, template change, or external setting;
- an artifact is missing, extra, malformed, inconsistent, or unsafe;
- any model, Feishu credential, semantic claim, package/release action, pilot
  claim, or M8 change appears necessary.

## Coordinator execution record

- Status: `blocked_pending_user_verification`
- Baseline commit:
  `b3f4b9ab2e7a5bf5fcab4557cff30b85597878bc`
- Pipeline URL/ID:
  `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/pipelines/2730064343`
  (`2730064343`, pipeline IID `1`, source `push`)
- Pipeline result: `failed` before job creation with GitLab failure reason
  `The pipeline failed due to the user not being verified.`
- YAML status: no YAML error reported.
- `subject_test` job URL/ID/status: no job created.
- `change_trace_mechanics` job URL/ID/status: no job created.
- Artifact verification: no artifact exists because no job was created.
- Active/scheduled pipeline check: the project lists exactly the one failed
  pipeline; anonymous status queries returned no `running`, `pending`, or
  `created` pipeline. The failed pipeline has no scheduled/manual action and
  was not retried.
- First-pipeline external-state deviation: GitLab.com identity verification was required
  before hosted CI jobs can run. No project setting, variable, runner,
  schedule, credential, retry, cancel, or additional commit was introduced.
- Second pipeline URL/ID:
  `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/pipelines/2730157298`
  (`2730157298`, pipeline IID `2`, source `web`, same baseline commit).
- Second pipeline result: `success` with warning because the advisory job is
  intentionally `allow_failure: true`; no YAML error was reported.
- `subject_test`: job `15697682695` passed on a GitLab-hosted
  `saas-linux-small-amd64` Runner in 22.47 seconds.
- `change_trace_mechanics`: job `15697682696` failed with `script_failure`
  after checking out, installing, and building immutable tooling commit
  `aa52a1795a587cb32704018bdd60b1d33649309d`. The runner reported
  `infrastructure_failure code=invalid_run_attempt` for
  `CI_JOB_ID=15697682696`.
- Artifact verification: the failed runner produced no managed artifact; the
  GitLab uploader reported all three configured paths missing.
- Active/scheduled pipeline check: the project lists exactly the preserved
  failed pipeline and the finished warning/success pipeline. Anonymous status
  queries returned no `running`, `pending`, or `created` pipeline. Pipeline
  `2730157298` has no manual or scheduled action and was not retried; no
  automatic retry was configured or observed.
- External-state deviations: the project owner completed GitLab account
  verification and manually started pipeline `2730157298`; no variable,
  project setting, runner registration, schedule, credential, retry, cancel,
  or additional commit was introduced.
- Feishu body: the project owner reports manually pasting the accepted Markdown
  template. No authenticated body retrieval occurred. `lark-cli` remains
  uninstalled and is not required for this mechanics phase; Codex in-app
  Browser was not used.

## Coordinator review

- Outcome: `ready_for_fresh_pipeline`
- Validation summary: the subject materialized byte-for-byte from the accepted
  six-file baseline, local dependency-free installation and its one test
  passed, SSH push succeeded, and remote `main` matches the baseline commit.
  GitLab account verification, hosted Runner scheduling, and subject tests are
  now proven. The real GitLab job ID exposed the runner's undocumented
  `1_000_000` ceiling, which accepted M7-012 resolves. Accepted M7-013 restores
  a zero-vulnerability production audit, and accepted M7-014 advances the
  governed reference pin. Hosted advisory and artifact acceptance now require
  the one authorized subject commit and fresh pipeline.
- Required follow-up: materialize M7-014's exact accepted `.gitlab-ci.yml` into
  one new subject commit and allow one new default-branch pipeline. Do not
  retry or rewrite pipeline `2730157298`.
- Roadmap impact: M7 remains in progress; this single synthetic project cannot
  satisfy the real multi-team, multi-week pilot gate or authorize M8/release.
