# Advisory CI runner

`scripts/ci/advisory-runner.mjs` is a provider-neutral wrapper for one
configured headless Host process. It is advisory: once it safely creates its
three managed artifacts, it exits zero for every review and recoverable
infrastructure outcome.

## Configuration

The wrapper reads these environment variables:

| Variable | Required | Meaning |
|---|---:|---|
| `CHANGE_TRACE_CI_COMMAND` | Yes | JSON array containing the executable followed by its arguments. It is limited to 64 non-empty strings and 8 KiB. |
| `CHANGE_TRACE_CI_REPOSITORY_ROOT` | Yes | Existing absolute repository root. |
| `CHANGE_TRACE_CI_OUTPUT_DIRECTORY` | Yes | Non-empty repository-relative output directory. |
| `CHANGE_TRACE_CI_HOST_ID` | No | Stable safe Host label; defaults to `configured-host`. |
| `CHANGE_TRACE_CI_BASE_REVISION` | No | Nullable base revision: `HEAD`, 7–64 lowercase hex characters, or a safe full `refs/heads/`, `refs/tags/`, or `refs/remotes/` name. |
| `CHANGE_TRACE_CI_HEAD_REVISION` | No | Nullable head revision using the same bounded safe revision form. |
| `CHANGE_TRACE_CI_RUN_ATTEMPT` | No | Positive integer, default `1`. |
| `CHANGE_TRACE_CI_TIMEOUT_MS` | No | Positive timeout in milliseconds, default five minutes and maximum fifteen minutes. |

The command is parsed as explicit argv and launched with `shell: false`. The
Host inherits the documented run context and receives the resolved repository
root plus absolute confined output directory through the corresponding
`CHANGE_TRACE_CI_*` variables. It must write `release-review.md` and
`release-review.json` there.

Missing or empty revisions are recorded as JSON `null`. Paths, credential-like
values containing whitespace, unsupported ref forms, and values over 160
characters are rejected before the Host is started, so untrusted revision text
cannot enter the sidecar or logs.

The wrapper rejects absolute output paths, traversal, `.git` segments,
symlinked output ancestors, output escapes, and existing managed paths that
are not regular files. On timeout it sends a soft termination to the direct
Host child, then a direct-child `SIGKILL` after 250 ms, and settles after at
most one additional 250 ms grace interval. It does not terminate a process
tree or target processes by name.
Host stdout and stderr are drained into a 64 KiB in-memory cap, never relayed,
written, or reported.

## Artifacts and outcomes

The managed files are exactly:

- `release-review.md`
- `release-review.json`
- `release-review-status.json`

When the Host exits successfully, the first two are required regular files.
The JSON file must be a complete internally consistent Report `1.0.0` object;
the runner does not rewrite either successful report file. The status sidecar
uses stable JSON key ordering and records run ID/attempt/timestamps/revisions,
safe Host ID, outcome, aggregate counts, report file names, exact sizes, and
SHA-256 hashes. The status entry names itself but omits a self-hash to avoid a
self-referential artifact. It never stores report bodies, prompts, evidence,
raw Host streams, or exception text.

Outcome precedence is:

1. `infrastructure_failure`: timeout, nonzero Host exit, absent/unsafe,
   malformed, oversized, or internally inconsistent report pair.
2. `inconclusive`: valid report contains inconclusive or rejected findings,
   missing evidence, or bundle truncation.
3. `completed_with_findings`: valid report contains confirmed or suspected
   findings.
4. `completed_no_findings`: otherwise.

A recoverable infrastructure failure replaces the exact three managed paths
with bounded placeholders. Its JSON and status use artifact type
`change-trace-advisory-infrastructure-failure`; error details contain only a
stable runner code and, for a nonzero process exit, a bounded numeric exit
code. Unsafe configuration, confinement failure, or artifact-write failure
exit nonzero.

Successful reports are snapshot-checked by size and SHA-256 immediately before
and after status publication; the runner writes only the status sidecar on
that path. Before each Host start, a rerun safely invalidates the previous
managed set by removing status first, then only the exact Markdown and JSON
managed files. Each file must already be a regular non-symlink; `ENOENT` is
acceptable, and any unlink failure stops before the Host starts. No directory
deletion or process tree termination is performed. Failure placeholders publish
Markdown, then JSON, then status last. If an intermediate write fails, the
wrapper exits nonzero and the status sidecar is not treated as a fresh success
record. Each run generates a fresh `runId` and records the supplied attempt
and revisions.

## Smoke test

Run `npm run smoke:ci`. It uses the repository's deterministic generic fixture
Host and verifies all three artifacts below `artifacts/advisory-ci-smoke`.
Optional `CHANGE_TRACE_CI_BASE_REVISION`, `CHANGE_TRACE_CI_HEAD_REVISION`, and
`CHANGE_TRACE_CI_RUN_ATTEMPT` values are forwarded through the runner and
verified against the status sidecar.

## Selected M4 architecture

Change Trace supplies the deterministic runner, bounded evidence, validation,
outcome classification, and the three-file artifact contract. The consumer
supplies an Agent Host and model that it has quality-qualified for its own
review policy. Repository platforms own triggers, trusted execution,
credentials, retention, comments or checks, and merge-policy wiring.

The live `.github/workflows/m4-advisory-review.yml` is `workflow_dispatch`
only. It keeps normal quality checks in one job and a non-blocking deterministic
advisory smoke in another. The smoke runs the fixture Host through the accepted
generic runner, produces a valid `completed_no_findings` report pair and status
sidecar, forwards the selected revision plus `github.run_attempt`, uploads the
three exact managed files under a run/attempt-qualified artifact name, and
renders a summary from allowlisted status fields.

The smoke proves orchestration, artifact, and rerun behavior only.
It does not establish semantic Host/model compatibility. It has no model
permission, provider credential, inference step, or switch that can enable
inference.

## Public deterministic fixture

[`fixtures/deterministic-advisory-host.mjs`](fixtures/deterministic-advisory-host.mjs)
is a mechanics-only runner orchestration and artifact-evidence fixture. It
writes a fixed schema-valid no-findings report pair to the configured output
directory. It performs no inference, network access, Git command, credential
access, or subject-repository mutation. It is not a reviewer and supplies no
semantic Host or model compatibility evidence.

## Caller-supplied Host on GitHub

[`github-actions.example.yml`](github-actions.example.yml) is a copyable,
provider-neutral starting point. Configure a protected GitHub environment
named `change-trace-advisory` with required reviewers where appropriate. Store:

- `CHANGE_TRACE_TOOLING_REF` as an immutable trusted Change Trace commit in an
  environment variable;
- `CHANGE_TRACE_HOST_COMMAND` as explicit JSON argv in an environment variable,
  for example `["trusted-host","review"]`;
- an optional `CHANGE_TRACE_HOST_CREDENTIAL` environment secret, mapped to the
  credential name expected by the selected Host.

The Host command must be installed by a pinned trusted step or already exist on
the runner. Do not construct the argv with shell parsing, put credentials in
argv, or execute scripts, dependencies, hooks, configuration, or binaries from
the subject checkout. Adapt the manual trigger to a protected repository event
only after defining the platform-specific trusted-tooling and subject-revision
policy.

The runner starts the configured Host with the credential-bearing step
environment. GitHub environment masking redacts matching log text; environment
masking does not remove a credential from inherited child-process
environments. The configured Host owns the critical boundary: before launching
the Change Trace MCP child, it must build a sanitized allowlist environment
that excludes every provider credential. The Host must also keep credentials
out of child arguments, logs, prompts, reports, status, and uploaded artifacts.

The example remains advisory with `continue-on-error: true`, a fifteen-minute
job limit, a fourteen-minute runner limit, exactly three uploaded artifacts,
and the bounded status renderer. Vendor Actions, platform-native Agents, and
PR comments or checks may wrap this flow, but they are outer integration
options and are not implemented or certified here.

## Generic GitLab-compatible example

[`gitlab-ci.example.yml`](gitlab-ci.example.yml) is provider-neutral and
advisory. Before using it, a protected pipeline must independently obtain a
trusted tooling checkout at the immutable full commit recorded in
`CHANGE_TRACE_TOOLING_REF`, verify that directory is not
a symlink, and provide a distinct read-only subject worktree. Supply safe
base/head revisions and a unique attempt number through the listed variables.
Keep a Host/provider credential protected and masked; pass it only to the Host
process and never to MCP configuration or artifacts. GitLab masking likewise
does not remove variables from a child environment. The caller-supplied Host
must sanitize the MCP child environment and keep the credential out of
arguments, logs, prompts, reports, and artifacts.

## Portable CI mapping

[`portable-advisory.sh.example`](portable-advisory.sh.example) gives a POSIX
shell mapping for Gitee Go, Jenkins, Bitbucket Pipelines, Azure Pipelines,
Forgejo, and similar systems. It uses an exact package version, explicit JSON
argv, separate trusted tooling and subject roots, Host-only credentials, MCP
child-environment sanitization, advisory execution, and the exact three
artifact paths. It is mapping guidance only: it does not certify vendor
authentication, native Agents, triggers, retention, comments/checks, or merge
policy.

## Historical rejected provider path

The OpenCode/GitHub Models Host helpers and `npm run smoke:ci:host` remain as
historical engineering evidence. The pinned free path first exceeded its
request capacity with the five MCP tool definitions. The separate manual
GPT-4.1 quality spike then failed its frozen quality gate after the second
fixture returned an invalid response. The evidence is preserved in
`docs/evaluation/M4_GPT41_RESULTS.md` and
`docs/evaluation/M4_CI_AGENT_LANDSCAPE.md`.

`.github/workflows/m4-gpt41-quality-spike.yml` remains a historical,
manual-only harness. It cannot run on push, pull request, schedule, or reusable
invocation. The active M4 reference workflow does not install OpenCode, request
model permissions, expose a provider credential, or provide an inference
switch. No semantic compatibility claim is made for the rejected path.
