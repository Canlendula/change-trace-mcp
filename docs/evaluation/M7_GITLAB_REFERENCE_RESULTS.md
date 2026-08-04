# M7 GitLab.com reference results

> Status: credential-free GitLab-hosted mechanics accepted; semantic and real-pilot evidence remain
> Evidence date: 2026-08-04
> Scope: public synthetic project and credential-free deterministic mechanics

## Claim boundary

This record covers the materialization and push of the accepted M7-010 GitLab
reference baseline plus its first three real GitLab.com pipelines. It preserves
the initial account-verification failure, the hosted-runner execution that
exposed a bounded runner-input defect, and the successful post-fix mechanics
run from an audited immutable tooling pin.

It proves GitLab-hosted Linux Runner execution, baseline subject tests,
immutable tooling checkout/build, safe-integer run-attempt portability,
deterministic Change Trace mechanics, and the exact three-artifact contract.
It does not prove semantic review, Host/model compatibility, authenticated
Feishu retrieval, a pilot team/week, M7 completion, M8 readiness, or a release.

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
through its current public status record. At this evidence point the project
listed exactly these two preserved pipelines; dedicated anonymous queries
returned no `running`, `pending`, or `created` pipeline.

## Third hosted pipeline

After M7-012 corrected the documented positive-integer run-attempt contract,
M7-013 refreshed the three newly vulnerable transitive locks, and M7-014
advanced the copyable YAML to their accepted audited tooling state, the
coordinator changed only the subject's three immutable pin locations.

Accepted subject commit:

```text
3b0461da6f18b82f1360d9b929d0ac34b630f67d
ci: advance Change Trace tooling pin
```

Its staged Git object matched the accepted template object
`a78634422a9132b3ac1a5b05f3dec76b914556f8`. Local dependency-free
`npm ci --ignore-scripts --no-audit --no-fund` and the one subject test passed.
The commit was pushed through SSH with strict verification against GitLab's
published ED25519 key; remote `main` resolved to the exact local commit.

| Field | Evidence |
|---|---|
| Pipeline | `2730344241` (IID `3`) |
| URL | `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/pipelines/2730344241` |
| Source | `push` |
| Commit | `3b0461da6f18b82f1360d9b929d0ac34b630f67d` |
| Created / finished | `2026-08-04T12:06:29.289Z` / `2026-08-04T12:07:42.979Z` |
| Pipeline status / duration | `success` / 69 seconds |
| YAML error | none reported |
| `subject_test` | job `15698742078`, passed, 31.16 seconds |
| `change_trace_mechanics` | job `15698742079`, passed, 38.26 seconds, `allow_failure: true` |
| Runner | GitLab-hosted `saas-linux-small-amd64`, Docker executor, `node:22-bookworm` |
| Retry | `0`; the `include_retried` job list contains only the two expected jobs |
| Outcome | `completed_no_findings` |
| Artifact expiry | `2026-08-11T12:07:39.930Z` |

The mechanics trace fetched, detached, and verified audited tooling commit
`49a07185c2af05ee8dcffe33b23355ce1dce8353`, installed 146 packages with
scripts/audit/funding disabled, built the TypeScript package, and passed real
`CI_JOB_ID=15698742079` unchanged to the advisory runner. The runner returned
`completed_no_findings`; GitLab then found and uploaded each of the three
configured artifact paths.

The public 1,694-byte artifact archive has SHA-256
`4af60f5a2b8c6cf51da260bad4009ce90fdabb2bdf17641886a8b49c06f175da`
and contains exactly:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `release-review.md` | 83 | `f7690fccdc185acdb296f6d0147cfcbb63147ed68e7a95439d13ac8d81ec1a41` |
| `release-review.json` | 880 | `a487f8a07224101da363dbf36e69d74558f5e4cdba865b8606eea8213d6b4c09` |
| `release-review-status.json` | 1,071 | `aa78e7eeb0ee28ea7470a97c955071f4bd8093c300560876ece1c131805dd2cf` |

The report passes the repository `reportSchema`. The sidecar records run
attempt `15698742079`, base/head revision equal to the subject commit, zero
findings and missing evidence, and no truncation. Its Markdown/JSON sizes and
hashes match the downloaded bytes. The archive has no extra path, and a
bounded credential-pattern scan of all three files found no match. The
downloaded copy remains under ignored
`artifacts/M7-011-gitlab-pipeline-2730344241/`.

The final public list contains exactly three preserved pipelines and exactly
one for the accepted subject commit. None is active or schedule-sourced.
Pipeline `2730344241` contains exactly its two non-retried jobs; no duplicate,
manual retry, cancel, variable, project setting, schedule, or extra commit was
introduced.

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
transitive resolutions and a zero-vulnerability production audit. M7-014 is
accepted at `9bdc91fbf1ce58401a7c37ff92107b459ef6343a`; its YAML pins audited
tooling commit `49a07185c2af05ee8dcffe33b23355ce1dce8353`.

Pipeline `2730344241` now accepts that exact combined path, so M7-011 is
complete. Preserve all three pipelines without retry, cancel, delete, or
history rewrite. Any semantic Agent run or authenticated Feishu read requires
a separate protected work item and explicit Host/credential decision. This
single synthetic project remains outside the real pilot count.

## Accepted-main package recheck after M7-013

After the packaged Roadmap, Decision, and work-item acceptance records were
committed, coordinator commit
`84c24180955f46ca892fd7c8b9e237956e0f7406` was rechecked through the
credential-free clean-install harness. The result is the final package evidence
for the audited state before M7-014:

| Field | Evidence |
|---|---|
| Source version | `0.0.0-dev.1` |
| Tarball | `change-trace-mcp-0.0.0-dev.1.tgz` |
| SHA-256 | `d66cdbcf03170834577f81b7cb07949869ece333ce131909a550649ec169333d` |
| npm shasum | `e8b26b9b1ef4e859428bb725270de45c59ed3f35` |
| npm integrity | `sha512-IxQ/oA4aWvwnlAHW9hwfWUuYIZ9SphLMyozUMe1CxSm/IV5MdOTzIyX51fk5Ee9YMZNpVtjRNw3vtb1lE2lv7w==` |
| Packed / unpacked bytes | `187332` / `895017` |
| File count | `220` |
| Runtime | Node `v24.0.0`, npm `11.3.0`, Windows x64 |
| Installed tools | exact frozen nine-tool surface |
| Fixture | byte-identical M1 compatibility fixture |
| CI smoke | `completed_no_findings`, exactly three artifacts |
| Cleanup | `true` |
| Production audit | zero vulnerabilities |

The harness installed a copied package, passed the pinned local-tarball `npx`
path, and removed its temporary state. No tarball, cache, credential, or
consumer project was retained in the repository.

After M7-014 and its packaged acceptance records were integrated, coordinator
commit `f1b99c167150cab9bfb87a865b4798438635f620` received the same final
clean-install recheck. It retained 220 files, the frozen nine-tool surface,
byte-identical M1 fixture, `completed_no_findings`, exactly three CI artifacts,
successful copied-package and `npx` paths, cleanup `true`, and a zero-finding
production audit. Its final tarball evidence is:

- SHA-256: `6dad912effbd6d72509fcc40ab3889e146137ae176550d71467da0483a46dabf`;
- npm shasum: `10f9a5057fc0552668d8b65e6d5801d40d19cb80`;
- npm integrity:
  `sha512-Scrif5nkMCuREqaqBurv1tVSGGOPkDEsImFN/Cy1ybS8kAehlQjfMgIBKKqbbL1wDJgPy7CMsHtXGcr6SHZGcQ==`;
- packed/unpacked bytes: `187805` / `896277`.

## Security and external-state confirmation

- No model, Host, GitLab API token, GitLab MCP, Lark credential, CI variable,
  browser storage, Cookie, or incident log was used.
- No Codex in-app Browser page or affected historical task was opened.
- No project/group setting, runner registration, schedule, merge gate,
  environment, MR, feature overlay, retry, cancel, package version, npm
  publication, tag, release, or dist-tag changed.
- Public anonymous GitLab GET endpoints were used only to read project,
  pipeline, job, and bounded raw-trace evidence.
- The successful public artifact archive was downloaded only for bounded
  schema/hash inspection under the repository's ignored `artifacts/` path.
- Strict SSH host-key checking used GitLab's published ED25519 key. The
  one-purpose local known-hosts file was removed after remote commit
  verification.
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
- `https://gitlab.com/api/v4/projects/85104200/pipelines/2730344241`
- `https://gitlab.com/api/v4/projects/85104200/pipelines/2730344241/jobs?include_retried=true&per_page=100`
- `https://gitlab.com/infinty081/change-trace-gitlab-reference/-/jobs/15698742079/raw`
- `https://gitlab.com/api/v4/projects/85104200/jobs/15698742079/artifacts`
