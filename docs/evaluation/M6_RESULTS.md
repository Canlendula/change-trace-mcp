# M6 runtime and staging evidence exit record

> Evidence date: 2026-07-26 (Asia/Hong_Kong)
> Coordinator-accepted implementation revision:
> `0c41f6b19d5050e4519c1b26642b2305b8c83bad`

## Scope and decision boundary

M6 adds optional pre-produced runtime evidence to the existing deterministic
change/document review path. The stable boundary is one strict normalized
manifest beneath a verified Git repository. Change Trace validates and
normalizes that manifest, preserves runtime relationships and provenance in
the review bundle and reports, and keeps unavailable observations separate
from observed failed behavior.

The governing decisions are:

| Decision | Durable rule | Decision commit |
| --- | --- | --- |
| 27 | Runtime evidence enters through a strict format-neutral manifest; the core performs no test, browser, API, deployment, or artifact execution. | `2cadae39073e8b1bcafc714259a1ff1d0583b110` |
| 28 | Collection reads one explicit repository-confined manifest under fatal UTF-8, JSON, Schema, identity, and 4 MiB bounds. | `3d8ae6ef279ef41f2178617e6404c935e3d65114` |
| 29 | Available/unavailable relationships, conditional identity, and bounded provenance survive bundle and report construction. | `e79766548af11583fcc9de9c01ec87ff153ef970` |
| 30 | Milestone proof uses pinned offline JUnit-style, Playwright JSON, API-smoke, and staging mapping fixtures without general/live compatibility claims. | `41ecdbd22bfe1c9a86c6e3391ee3e8de1f9afe3a` |

The upstream format evidence and the reason for the normalized boundary are in
[`M6_RUNTIME_FORMAT_LANDSCAPE.md`](M6_RUNTIME_FORMAT_LANDSCAPE.md).

## Accepted work items

| Work item | Accepted result | Main implementation / acceptance |
| --- | --- | --- |
| M6-001 | Strict runtime manifest, available provenance, normalized collection, runtime evidence identity, and deterministic JSON Schema exports. | `2b7b98e`, `30265f0`, `51d7e72` / `4f35b59` |
| M6-002 | Confined explicit-manifest reader, redaction/normalization, safe errors, library exports, and the ninth MCP tool. | `aa1392f`, `80a9a5d` / `b81e052` |
| M6-003 | Structured unavailable provenance, relationship validation, limit-safe bundle ordering, runtime-sensitive identity, and JSON/Markdown report preservation. | `ad760b5` / `512f574` |
| M6-004 | Four pinned offline mapping profiles, complete built-stdio proof, packaged guide/examples, and compatibility/security regression gates. | `db3eb55` / `0c41f6b` |

Detailed assignments, worker handoffs, coordinator review findings, and exact
validation histories remain in
[`docs/work-items/M6-001-runtime-evidence-contract.md`](../work-items/M6-001-runtime-evidence-contract.md)
through
[`docs/work-items/M6-004-runtime-source-fixtures-and-exit.md`](../work-items/M6-004-runtime-source-fixtures-and-exit.md).

## Normalized contract proof

The accepted contract distinguishes:

- available behavioral records for test cases/runs, API observations, browser
  observations, and other bounded runtime results;
- available environment metadata with null execution outcome and timing;
- unavailable `not_found`, `inaccessible`, `unsupported`, `malformed`, or
  `truncated` source records;
- normalized missing status from original unavailable access status;
- local, CI, staging, or other explicitly non-production environments;
- producer, input format, record, source, outcome, timing, artifact-reference,
  change-link, and requirement/document-link identity.

Available observations normalize to `test_result`, `runtime_observation`, or
`configuration` evidence with `observed_runtime` trust. They cannot also claim
external-document provenance. Unavailable observations carry structured
runtime provenance and cannot carry an execution outcome.

Bundle construction checks every available and unavailable relationship
against the supplied `ChangeScope` and non-runtime document candidates. A
runtime item is omitted if an excerpt/item limit removes its related document.
Runtime outcome, timing, environment, producer, format, kind, artifact
references, and relationships affect bundle identity; collection time does
not. With no runtime input, the accepted non-runtime bundle identity and all
nine frozen M3 replay digests remain unchanged.

Final JSON and Markdown report catalogs preserve bounded runtime provenance,
relationships, outcomes, timing, environments, and artifact references.
Runtime excerpts, selection reasons, attachment bodies, logs, commands, and
credentials are omitted. Markdown labels unavailable observations as
unavailable/not observed and does not present a staging access problem as a
failed product behavior.

## Confined collection boundary

`collect_runtime_evidence` accepts one verified Git root and one
repository-relative manifest path. The implementation:

- rejects absolute, traversal, backslash, empty-segment, control-character,
  `.git`, symbolic-link, junction, changing-identity, and non-regular-file
  paths;
- reads at most 4,194,304 bytes with a limit-plus-one check;
- uses fatal UTF-8, one complete JSON value, and the strict manifest Schema;
- re-inspects every path segment and the opened descriptor around the read;
- derives stable evidence IDs, content hashes, truncation, redaction, trust,
  and provenance without opening artifact references;
- exposes only bounded stable error codes at the MCP boundary.

The tool remains read-only, non-destructive, `openWorldHint: false`, and
launches no subject process, converter, test, browser, API probe, deployment,
or arbitrary command.

## Pinned source-profile proof

The M6-004 fixture producer is test-only. It accepts one of four fixed fixture
IDs plus supplied change/document relationships, reads only the selected
adjacent fixture, and emits byte-identical strict manifest output.

The JUnit-style fixture proves:

- suite/class/case identity and timing;
- `passed`, `failed`, `errored`, and `skipped` mapping;
- omission of system output/error and failure/error body/stack sentinels.

The Playwright JSON fixture proves:

- nested suite/spec/test/project identity and final-attempt timing;
- `passed`, `failed`, `timed_out`, `skipped`, and `cancelled` mapping;
- path/URI-only trace and screenshot references;
- omission of stdout, stderr, errors/stacks, steps, annotations, and attachment
  bodies.

The API-smoke fixture proves:

- two already-produced API observations with passed/failed outcomes;
- bounded timing, CI environment, and source identity;
- omission of request/response bodies, headers, cookies, tokens, retry
  commands, and raw logs;
- secret-shaped summary redaction before collection output.

The staging fixture proves:

- one available environment-metadata record with null outcome/timing;
- one inaccessible browser observation represented only as structured runtime
  missing evidence;
- exact change/document links on both variants;
- secret-shaped missing-reason redaction;
- no reachability check, active probe, browser launch, or failed product
  finding.

The complete built-stdio test collects all four manifests, retains 12 available
runtime evidence sources and one unavailable staging entry, builds one
relationship-valid bundle, validates an empty finding submission, and writes
two byte-identical JSON/Markdown report pairs. All raw-content and secret
sentinels are absent from collections, bundle, reports, and captured server
stderr.

## Local exit gates

The worker handed off M6-004 at
`46e1c4831d02d44875178c45811d05e9cfa1f3e7`. The coordinator independently
reviewed the complete base-to-head diff and ran:

- focused runtime fixture/core/replay/stdio suite: 10 files, 150 tests passed;
- TypeScript check: passed;
- two consecutive full suites: 32 files, 340 tests passed in each;
- stdio smoke: passed with exactly nine tools and the unchanged M1 fixture;
- advisory CI smoke: `completed_no_findings`, `smoke=ok`;
- package dry-run: 186 files, including the runtime guide and all four strict
  examples;
- base-diff whitespace, allowed-path, temporary-file, and clean-worktree
  checks: passed.

After integration, `main` again passed 32 files / 340 tests and stdio smoke
with the same nine-tool and M1 fixture result.

No GitHub Actions run was created for M6. The milestone does not make a
cloud-orchestration or live-provider claim, so local deterministic gates are
the relevant evidence and no hosted CI quota was consumed.

No dependency, lockfile, package version, tag, npm dist-tag, package publish,
or release state changed.

## Exit assessment

All M6 exit criteria pass for the pinned offline normalized-runtime contract:

| Exit criterion | Evidence |
| --- | --- |
| Runtime evidence links to requirement and change IDs | Every available and unavailable fixture record retains one real ChangeScope file ID and one retained local requirement document ID through bundle and report output. |
| Reports identify observed and unexercised behavior | Twelve available runtime sources render observed outcomes; the inaccessible staging entry renders unavailable/not observed with original access provenance. |
| Staging outages do not become false implementation findings | The inaccessible staging record creates no runtime evidence item, has no failed outcome, and the final validation/report contains zero findings. |
| Artifact size remains bounded | Collector input is capped at 4 MiB, records/strings/references have strict bounds, and Playwright artifacts remain references without body reads. |

## Intentional limitations

- The checked-in profiles are mapping/security proofs, not general JUnit,
  arbitrary Playwright-version, vendor API, browser, CI, or live staging
  compatibility.
- Conversion remains Host/CI-owned preprocessing. The MCP server accepts only
  the normalized manifest and does not execute a converter.
- Expected-failure/flaky/retry semantics, vendor-private report fields, and
  unsupported dialects need separately versioned converter profiles.
- Artifact references are not fetched or interpreted.
- Credentialed/live pilots, converter authoring guidance, and compatibility
  matrices remain M7 work.
- The v1 Schema remains provisional until the M8 compatibility freeze.
