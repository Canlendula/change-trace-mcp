# Runtime evidence manifests

Change Trace accepts runtime results through a strict normalized
`RuntimeEvidenceManifest`. This manifest is the stable MCP input. JUnit,
Playwright, API-smoke, CI, or staging-specific conversion happens before
`collect_runtime_evidence` in Host- or CI-owned logic.

The core reads one explicit manifest. It does not discover reports, run a
converter, execute tests, launch a browser, call an API, deploy an application,
check staging reachability, inspect credentials, or access production.

## Public tool sequence

First collect the change and requirement/document identities that the runtime
records will reference:

```json
{
  "tool": "get_change_scope",
  "arguments": {
    "repositoryPath": "C:/work/example",
    "baseRef": "origin/main",
    "headRef": "HEAD"
  }
}
```

Use the returned `ChangeScope.files[].id` values as `relatedChangeIds`. Commit
IDs from the returned scope are also accepted where relevant. Then collect the
repository documents:

```json
{
  "tool": "collect_local_evidence",
  "arguments": {
    "scope": "<the complete get_change_scope structured result>",
    "documentRoots": ["docs"],
    "filePatterns": ["**/*.md"]
  }
}
```

Use retained document items such as
`LocalEvidenceCollection.evidenceItems[].id` as
`relatedEvidenceIds`. External or explicitly supplied non-runtime document
evidence retained by the bundle may also be used. Runtime records cannot point
to another runtime item, Git evidence, configuration evidence, or an unknown
ID.

The Host/CI converter writes its normalized manifest beneath the repository.
The public collection call is:

```json
{
  "tool": "collect_runtime_evidence",
  "arguments": {
    "repositoryPath": "C:/work/example",
    "manifestPath": "runtime/change-trace.manifest.json"
  }
}
```

Continue with the complete structured results:

```json
{
  "tool": "get_review_bundle",
  "arguments": {
    "changeScope": "<get_change_scope result>",
    "localEvidence": "<collect_local_evidence result>",
    "runtimeEvidenceCollections": [
      "<collect_runtime_evidence result>"
    ]
  }
}
```

Pass that bundle to `validate_findings`, then pass the same bundle and its
matching validation result to `write_report`. A bundle accepts at most 16
runtime collections.

## Manifest boundary and bounds

The collector accepts one repository-relative, forward-slash manifest path.
It rejects absolute paths, traversal, `.git`, symbolic-link segments, changing
files, non-files, and paths outside the verified Git root. It reads no more
than 4,194,304 bytes, requires fatal UTF-8, one complete JSON value, and the
strict manifest Schema.

Core manifest bounds include:

| Field | Bound |
|---|---:|
| Manifest records | 1–1,000 |
| Stable ID or producer ID | 160 characters |
| Producer name/version | 160 characters each |
| Environment name | 200 characters |
| Summary | 32,000 characters |
| Unavailable reason | 2,000 characters |
| Artifact references per record | 100 |
| Related change IDs per record | 1,000, unique |
| Related evidence IDs per record | 1,000, unique |
| Source system | 80 characters |
| Source locator | 4,096 characters |
| Source URI | 8,192 characters |
| Collected available plus unavailable outcomes | 1,000 |

Schemas also enforce stable-ID syntax, timestamps, timing order, safe integer
durations, unique manifest record IDs, truncation consistency, the
non-production environment vocabulary, and strict unknown-field rejection.
See the four examples in [`examples/`](examples/).

## Pinned offline mapping profiles

The checked-in M6 fixtures prove four fixed mapping snapshots. They are test
inputs for this repository and are not packaged converter binaries.

### JUnit-style fixture

The pinned XML snapshot keeps bounded suite, class, and case identity. It drops
`system-out`, `system-err`, failure/error bodies, stacks, logs, and
attachments.

| Pinned case shape | Normalized outcome |
|---|---|
| No `failure`, `error`, or `skipped` child | `passed` |
| `failure` child | `failed` |
| `error` child | `errored` |
| `skipped` child | `skipped` |

The profile identifies itself as `junit_xml` and
`producer:m6-junit-style-v1`.

### Playwright JSON fixture

The pinned JSON snapshot walks one nested suite/spec/test and its single final
attempt. It retains test/project identity, start/completion time, duration,
and trace/screenshot path or URI references.

| Pinned final-result status | Normalized outcome |
|---|---|
| `passed` | `passed` |
| `failed` | `failed` |
| `timedOut` | `timed_out` |
| `skipped` | `skipped` |
| `interrupted` | `cancelled` |

Stdout, stderr, errors/stacks, steps, annotations, attachment bodies, retries,
flaky semantics, and expected-failure semantics are outside this profile. The
profile identifies itself as `playwright_json` and
`producer:m6-playwright-json-v1`.

### Project API-smoke fixture

The project-owned profile maps already-produced checks to
`api_observation`. It preserves check identity, observed outcome, timing,
environment, and source. Request/response bodies, headers, cookies, tokens,
credentials, raw logs, retry commands, and active endpoint configuration are
not copied.

The profile identifies itself as `api_smoke` and
`producer:m6-api-smoke-v1`. Its test-only secret-shaped summary proves the
collector redaction boundary; the packaged example uses non-secret content.

### Project staging-summary fixture

The project-owned staging snapshot maps supplied deployment metadata to one
available `environment_metadata` record. Its normalized runtime provenance has
`null` outcome and timing. One inaccessible browser observation becomes
structured runtime missing evidence with status `inaccessible`.

| Supplied staging state | Normalized representation |
|---|---|
| Available environment metadata | `configuration`, observed metadata, null outcome/timing |
| Inaccessible observation | unavailable / not observed missing evidence |
| Successfully observed failed behavior | runtime evidence with outcome `failed` |

An unavailable observation does not become a failed runtime item or a product
finding. The fixture merely records a staging source as metadata and performs
no reachability check. The profile identifies itself as `ci_summary` and
`producer:m6-staging-summary-v1`.

## Artifact and content policy

Artifact entries are references only: bounded system, locator, and optional
URI values. The collector does not open or fetch traces, screenshots, videos,
HTML reports, attachments, or logs. Keep attachment bodies, stdout/stderr,
stacks, HTTP bodies, headers, cookies, credentials, and executable retry/probe
configuration out of normalized manifests.

Summaries and unavailable reasons are bounded and pass through common secret
redaction during collection. Final report evidence catalogs retain provenance,
outcomes, timing, relationships, and artifact references while omitting
runtime excerpts and selection reasons.

## Compatibility scope

The fixtures demonstrate the exact checked-in JUnit-style,
Playwright-JSON, project API-smoke, and project staging-summary snapshots.
They do not establish general JUnit dialect support, arbitrary Playwright
version support, vendor API compatibility, live staging compatibility, or
browser/API probing. A real converter must be separately versioned, bounded,
and tested for its declared upstream format. Unsupported or malformed source
input should remain unavailable evidence; it must not be guessed into an
observed outcome.
