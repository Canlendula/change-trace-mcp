# M7 GitLab.com reference results

> Status: hosted subject test passed; mechanics blocked on run-attempt portability
> Evidence date: 2026-08-04
> Scope: public synthetic project and credential-free deterministic mechanics

## Claim boundary

This record covers the materialization and push of the accepted M7-010 GitLab
reference baseline plus its first two real GitLab.com pipelines. It preserves
the initial account-verification failure and the subsequent hosted-runner
execution that exposed a bounded runner-input defect.

It proves GitLab-hosted Linux Runner execution, baseline subject tests, and the
immutable tooling checkout/build. It does not prove successful Change Trace
mechanics, the three-artifact contract, semantic review, Host/model
compatibility, Feishu retrieval, a pilot team/week, M7 completion, M8
readiness, or a release.

## External resources

- Project: `https://gitlab.com/infinty081/change-trace-gitlab-reference`
- Project ID: `85104200`
- Namespace: personal user namespace `infinty081`
- Visibility: `public`
- Default branch: `main`
- Feishu Wiki explicit reference:
  `https://rcnw05c7n18f.feishu.cn/wiki/Ecm9wM0EXiH8I4kvQIfcivtUnoe`
- Feishu state at this evidence point: the project owner reports manually
  pasting the accepted Markdown template; no body retrieval occurred.

The personal namespace is intentional. The project owner found that the
initially considered default group allowed only Private projects, so it could
not satisfy the approved public-reference boundary.

## Baseline materialization

The empty GitLab repository was cloned through SSH after validating the
GitLab.com ED25519 host key published by GitLab. The accepted M7-010 baseline
and CI example were copied without semantic changes into a separate subject
repository.

Remote baseline commit:

```text
b3f4b9ab2e7a5bf5fcab4557cff30b85597878bc
feat: add operational service status baseline
```

The commit contains exactly:

- `.gitlab-ci.yml`;
- `docs/product-behavior.md`;
- `package-lock.json`;
- `package.json`;
- `src/service-status.mjs`;
- `test/service-status.test.mjs`.

Each materialized file matched its accepted source SHA-256 before commit. Local
`npm ci --ignore-scripts --no-audit --no-fund` completed without dependencies,
and `npm test` passed one test with no failure or skip. Remote `main` resolved
to the exact local commit after push.

## First hosted pipeline

| Field | Evidence |
|---|---|
| Pipeline | `2730064343` (IID `1`) |
| URL | `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/pipelines/2730064343` |
| Source | `push` |
| Commit | `b3f4b9ab2e7a5bf5fcab4557cff30b85597878bc` |
| Created | `2026-08-04T10:54:02.694Z` |
| Status | `failed` |
| YAML error | none reported |
| GitLab failure reason | `The pipeline failed due to the user not being verified.` |
| Jobs | `0` |
| Retries | `0` |
| Logs | none; no job was created |
| Artifacts | none; no job was created |

The pipeline finished before runner scheduling. Public pipeline JSON reported
no stage, manual action, scheduled action, duration, or retriable build. A
subsequent project query listed exactly this one failed pipeline and no
`running`, `pending`, or `created` pipeline.

## Second hosted pipeline

After completing GitLab account verification, the project owner deliberately
created one new web pipeline for the unchanged baseline.

| Field | Evidence |
|---|---|
| Pipeline | `2730157298` (IID `2`) |
| URL | `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/pipelines/2730157298` |
| Source | `web` |
| Commit | `b3f4b9ab2e7a5bf5fcab4557cff30b85597878bc` |
| Created | `2026-08-04T11:22:00.947Z` |
| Finished | `2026-08-04T11:23:06.736Z` |
| Pipeline status | `success` with warning |
| YAML error | none reported |
| `subject_test` | job `15697682695`, passed, 22.47 seconds |
| `change_trace_mechanics` | job `15697682696`, failed but allowed to fail, 37.85 seconds |
| Runner | GitLab-hosted `saas-linux-small-amd64`, Docker executor, `node:22-bookworm` |
| Retry | `0`; no retried job |
| Managed artifacts | none |

The mechanics trace confirms that the job cloned the public trusted tooling
repository, fetched and checked out exact commit
`aa52a1795a587cb32704018bdd60b1d33649309d`, installed 146 packages with
scripts/audit/funding disabled, and completed the TypeScript build. The next
command passed `CI_JOB_ID=15697682696` as `CHANGE_TRACE_CI_RUN_ATTEMPT`; the
runner immediately returned
`infrastructure_failure code=invalid_run_attempt`. The artifact uploader then
reported all three configured files missing, so no artifact archive exists.

The completed pipeline has no manual or scheduled action and is not retriable
through its current public status record. The project lists exactly these two
preserved pipelines; dedicated anonymous queries returned no `running`,
`pending`, or `created` pipeline.

## Diagnosis and next action

GitLab documents this exact GitLab.com Free hosted-runner failure as an account
identity-verification requirement used to protect free compute. Depending on
GitLab's risk decision, the account holder may need to verify email, phone, or
a payment method.

The account-verification blocker is resolved. GitLab documents `CI_JOB_ID` as
an integer ID unique across all jobs in the GitLab instance. The accepted
template intentionally uses it as positive run-attempt metadata, while the
runner currently rejects values greater than `1_000_000` despite documenting
only a positive-integer requirement. The real value `15697682696` therefore
exposed a repository portability defect.

M7-012 is accepted at commit
`42f7df162bf3c2e8426cb88fdf10efda9b96ce32`. It retains strict decimal
validation, accepts the full positive JavaScript safe-integer range, and proves
that the observed GitLab job ID is forwarded and recorded unchanged. Its
required production audit also detected three newly published transitive
advisories in the unchanged lockfile. M7-013 is accepted at
`8e82ee4a64e8f8ed027db8278f646cdbe9b6b5d0` with only the three minimum patched
transitive resolutions and a zero-vulnerability production audit. M7-014 must
advance the governed reference template to the final accepted main state
before that exact YAML is materialized into a fresh subject commit and one
deliberate pipeline is created. Preserve both existing pipelines and do not
retry, cancel, delete, or rewrite them.

## Security and external-state confirmation

- No model, Host, GitLab API token, GitLab MCP, Lark credential, CI variable,
  browser storage, Cookie, or incident log was used.
- No Codex in-app Browser page or affected historical task was opened.
- No project/group setting, runner registration, schedule, merge gate,
  environment, MR, feature overlay, retry, cancel, package version, npm
  publication, tag, release, or dist-tag changed.
- Public anonymous GitLab GET endpoints were used only to read project,
  pipeline, job, and bounded raw-trace evidence.
- `lark-cli` was not installed. The user-performed Feishu paste is recorded as
  reported external state and is not treated as authenticated retrieval proof.

## Primary references

- `https://docs.gitlab.com/ci/debugging/#error-identity-verification-is-required-in-order-to-run-ci-jobs`
- `https://docs.gitlab.com/user/gitlab_com/#ssh-host-keys-fingerprints`
- `https://gitlab.com/api/v4/projects/85104200`
- `https://gitlab.com/api/v4/projects/85104200/pipelines/2730064343`
- `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/pipelines/2730064343.json`
- `https://docs.gitlab.com/ci/variables/predefined_variables/`
- `https://gitlab.com/api/v4/projects/85104200/pipelines/2730157298`
- `https://gitlab.com/api/v4/projects/85104200/pipelines/2730157298/jobs?include_retried=true&per_page=100`
- `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/pipelines/2730157298.json`
- `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/jobs/15697682696/raw`
