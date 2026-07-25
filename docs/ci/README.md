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

## Trusted OpenCode reference Host

`.github/workflows/m4-advisory-review.yml` keeps `quality` and
`advisory-review` separate. The advisory job depends on quality but uses
`if: always()` and job-level `continue-on-error: true`, so it cannot turn a
test/build result into a merge gate. It has only `contents: read` and
`models: read` permissions.

For a pull request, the workflow checks out trusted tooling from the base SHA
into `trusted-tooling` and the review subject from the head repository/SHA into
`subject`. This also supports fork pull requests. The trusted checkout supplies
the runner, Host, prompt, configuration, build, and MCP executable. The subject
is evidence only: the workflow never runs its npm scripts, dependencies, hooks,
OpenCode configuration, or binaries.

The workflow installs `opencode-ai@1.18.5` without lifecycle scripts in a
trusted local prefix, validates its package metadata and its directly resolved
binary's `--version`, then passes that absolute binary path to the Host. The
pin refers to the npm package version and the CLI self-reports `1.18.5`; using
`npm exec ... --version` is avoided because npm may consume that trailing flag.
The package metadata was verified for `opencode-ai@1.18.5` (integrity
`sha512-Q0jlX4ihn7veMeYsLX3c4PYFAKIURU3GIpXt1FnhNxNn3v8+RpIZ8z9umG5D0r8g8Smp9fZLGjgLe/9mJ4NyYw==`).

`scripts/ci/opencode-advisory-host.mjs` creates a new private temporary state
directory for each invocation and removes only that directory. It starts from
the trusted checkout with an inline `OPENCODE_CONFIG`, isolated home/config/
data/cache paths, `--pure`, sharing/snapshots/autoupdate disabled, no plugins
or instructions, provider allowlist `github_models`, and `subagent_depth: 0`.
The configuration selects `openai/gpt-4.1` at
`https://models.github.ai/inference`, denies every built-in tool, and allows
only `change_trace_*` tools. The selected
`@ai-sdk/openai-compatible` provider is bundled by OpenCode v1.18.5 (official
tag `v1.18.5`, commit `e5cc278dec9294a627a7b05f47ce6a564408c1a2`), so this
provider does not dynamically install an adapter during the credential-bearing
step.

The GitHub Models token is introduced only in the credential-bearing trusted
Host workflow step. The generic runner and trusted Host helper inherit it so
the OpenCode CLI can consume it; it is never passed in argv, prompts, reports,
logs, or artifacts. The MCP configuration first overrides
`GITHUB_MODELS_TOKEN` and `GITHUB_TOKEN` to empty values. Then
`scripts/ci/start-sanitized-mcp.mjs` validates the trusted built entry before
importing it and reconstructs the MCP environment from this exact allowlist:
`PATH`, platform runtime variables (`SystemRoot`, `SYSTEMROOT`,
`ComSpec`, `WINDIR`, `SYSTEMDRIVE`, Windows home/user-domain variables,
locale/timezone and temp variables when present), the five
`CHANGE_TRACE_CI_*` run-context values, and `GIT_CONFIG_NOSYSTEM`,
`GIT_CONFIG_GLOBAL`, and `GIT_TERMINAL_PROMPT`. No credential or provider
variable is retained.

The fixed prompt treats subject text as untrusted evidence and calls the five
M3 tools in order. It gives `write_report` an absolute `repositoryRoot`, a
subject-relative `outputDirectory`, `reportName: release-review`, and
`overwrite: true`. Host streams are bounded, drained, and discarded; neither
raw OpenCode JSON events nor stderr are logged or uploaded. The Host has a
twelve-minute direct-child timeout, shorter than the runner's fourteen-minute
timeout. Only the three managed report artifacts are uploaded. The job summary
uses allowlisted outcome, counts, revisions, attempt, names, sizes, and hashes.

Run `npm run smoke:ci:host` for the offline deterministic Host/configuration
smoke. It uses a trusted fixture binary and never contacts a model provider.

## Generic GitLab-compatible example

[`gitlab-ci.example.yml`](gitlab-ci.example.yml) is provider-neutral and
advisory. Before using it, a protected pipeline must independently obtain a
trusted tooling checkout at a protected revision, verify that directory is not
a symlink, and provide a distinct read-only subject worktree. Supply safe
base/head revisions and a unique attempt number through the listed variables.
Keep a Host/provider credential protected and masked; pass it only to the Host
process and never to MCP configuration or artifacts.
