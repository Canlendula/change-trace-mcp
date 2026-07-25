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
that path. Reruns replace only the three managed names; no directory deletion
or process tree termination is performed. Failure placeholders publish
Markdown, then JSON, then status last. If an intermediate write fails, the
wrapper exits nonzero and the status sidecar is not treated as a fresh success
record. Each run generates a fresh `runId` and records the supplied attempt
and revisions.

## Smoke test

Run `npm run smoke:ci`. It uses the repository's deterministic generic fixture
Host and verifies all three artifacts below `artifacts/advisory-ci-smoke`.
