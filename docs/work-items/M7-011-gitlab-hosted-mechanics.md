# M7-011 — Run the credential-free GitLab.com reference mechanics

## Assignment — coordinator owned

- Status: `accepted`
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

The accepted post-fix pipeline must be attributable to the exact pushed
subject commit.
Acceptance requires:

- GitLab-hosted `node:22-bookworm` jobs;
- `subject_test` succeeds after dependency-free `npm ci` and `npm test`;
- `change_trace_mechanics` runs after the test job and itself succeeds;
- the advisory job remains `allow_failure: true`, `retry: 0`, and bounded by
  fifteen minutes;
- no scheduled, manually retried, duplicate, waiting, or continuously running
  pipeline remains;
- the immutable tooling checkout resolves to
  `49a07185c2af05ee8dcffe33b23355ce1dce8353`;
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
the document body from the accepted
`docs/ci/gitlab-reference/feishu-product-update-template.md` after resolving
the Wiki token to its real document token. The project owner has since
reported completing that exact manual paste. No authenticated body retrieval
was performed, and this reported external state does not block GitLab
mechanics acceptance.

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

- Status: `accepted`
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
- Accepted subject commit:
  `3b0461da6f18b82f1360d9b929d0ac34b630f67d`
  (`ci: advance Change Trace tooling pin`). The commit changes only the three
  immutable pin locations in `.gitlab-ci.yml`; its staged Git object matched
  the accepted template object `a78634422a9132b3ac1a5b05f3dec76b914556f8`.
- Third pipeline URL/ID:
  `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/pipelines/2730344241`
  (`2730344241`, pipeline IID `3`, source `push`, exact accepted subject
  commit).
- Third pipeline result: `success`, no YAML error, 69-second duration.
- `subject_test`: job `15698742078` passed on a GitLab-hosted Linux Runner in
  31.16 seconds.
- `change_trace_mechanics`: job `15698742079` passed on a GitLab-hosted
  `saas-linux-small-amd64` Runner using `node:22-bookworm` in 38.26 seconds;
  it retained `allow_failure: true`, zero retry, and the fifteen-minute
  timeout.
- Trusted tooling: the trace fetched, detached, and verified exact commit
  `49a07185c2af05ee8dcffe33b23355ce1dce8353`, then installed and built it
  before forwarding `CI_JOB_ID=15698742079` unchanged as the run attempt.
- Advisory result: `completed_no_findings`, with base/head revision both equal
  to the accepted subject commit, zero findings/missing evidence, and no
  truncation.
- Managed artifact archive: 1,694 bytes,
  SHA-256 `4af60f5a2b8c6cf51da260bad4009ce90fdabb2bdf17641886a8b49c06f175da`.
  It contains exactly the three authorized paths and expires at
  `2026-08-11T12:07:39.930Z`:
  - `release-review.md`: 83 bytes,
    SHA-256 `f7690fccdc185acdb296f6d0147cfcbb63147ed68e7a95439d13ac8d81ec1a41`;
  - `release-review.json`: 880 bytes,
    SHA-256 `a487f8a07224101da363dbf36e69d74558f5e4cdba865b8606eea8213d6b4c09`;
  - `release-review-status.json`: 1,071 bytes,
    SHA-256 `aa78e7eeb0ee28ea7470a97c955071f4bd8093c300560876ece1c131805dd2cf`.
- Artifact validation: the report passed the repository `reportSchema`; the
  sidecar schema, run identity, revisions, counts, file sizes, and embedded
  hashes are internally consistent. A bounded credential-pattern scan of the
  three files found no match. The downloaded evidence remains under ignored
  `artifacts/M7-011-gitlab-pipeline-2730344241/` and is not committed.
- Final external-state check: the project lists exactly three preserved
  pipelines, exactly one for the accepted subject commit, no active pipeline,
  no schedule-source pipeline, and exactly two jobs in pipeline `2730344241`
  even when retried jobs are included. No extra pipeline, retry, variable,
  project setting, runner,
  schedule, merge gate, MR, package, version, tag, release, or publication was
  created.

## Coordinator review

- Outcome: `accepted`
- Validation summary: the subject's only post-defect diff was the accepted
  three-location tooling pin, local dependency-free installation and its one
  test passed, strict SSH host-key verification and push succeeded, and remote
  `main` matches `3b0461da6f18b82f1360d9b929d0ac34b630f67d`. The single
  resulting push pipeline passed both hosted jobs, immutable audited-tooling
  checkout/build, safe-integer run-attempt forwarding, deterministic advisory
  execution, schema validation, exact three-file artifact retention, and final
  no-active/no-retry checks. Final repository validation passed `git diff
  --check`, `npm run check`, all 44 test files at 426 passed / 2 intentional
  POSIX skips, and a production audit with zero vulnerabilities.
- Required follow-up: any semantic Agent path or authenticated Feishu read is a
  separately assigned protected phase requiring an explicit Host/credential
  decision. Preserve all three pipelines and do not retry or rewrite them.
- Roadmap impact: M7 remains in progress; this single synthetic project cannot
  satisfy the real multi-team, multi-week pilot gate or authorize M8/release.
