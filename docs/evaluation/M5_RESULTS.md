# M5 external-document adapter exit evidence

> Evidence date: 2026-07-26 (Asia/Hong_Kong)
> Coordinator exit revision: `65954cff60369dce07102d10833b19e8405c1109`

## Scope and decision boundary

M5 proves a provider-neutral, explicit-reference path for external document
evidence. A Host configures a bounded read-only command adapter; the MCP caller
selects that adapter and supplies exact source references. Change Trace
validates the protocol, forces external content to `untrusted_external`,
redacts secrets, records missing access, merges retained evidence into the
review bundle, and emits a source catalog in the final JSON and Markdown
reports.

The governing decisions are:

| Decision | Durable rule | Decision commit |
| --- | --- | --- |
| 23 | Commands and credentials are Host-owned; MCP input contains only a configured adapter ID and explicit references. | `750e1fae4e54a3eadb9c657b2c6e6df6dd43a6b8` |
| 24 | Normalized external evidence retains strict adapter/source provenance and is always `untrusted_external`. | `3b94c78fde7ef14a0c021042f4d9d0464b6aac3d` |
| 25 | The stdio entry point loads one bounded, fatal-UTF-8, non-symlink Host configuration file at startup. | `e4b2fd1c8b677596578c8ef3e84c525137c69eea` |
| 26 | Final reports contain a required bounded evidence-source catalog without copying evidence excerpts. | `13167b918017c9be37488e1d9472ffa0907beeac` |

Discovery, organization-wide search, inferred Jira keys, indexing, and live
vendor compatibility claims remain outside this milestone.

## Accepted work items

| Work item | Accepted result | Main implementation / acceptance |
| --- | --- | --- |
| M5-001 | Strict request, response, source-type, adapter-identity, and deterministic JSON Schema contracts. | `411ad21f87fa5076d782acf8de3db61a49269aad` / `de74f7f6caa1670227cdbc1aff454c47646d89a7` |
| M5-002 | Bounded no-shell command execution, minimal child environment, fatal UTF-8, safe failures, normalization, redaction, hashing, and direct-child timeout handling. | `d791cad0f94d9ca3ccd316487a84653bca015bfb`, `255aa50497cf7b71a8aa2806742bef41185063e0` / `f08ea5a74726c6c45514c5f2ec74afed91beb0aa` |
| M5-003 | Strict startup configuration, `collect_external_evidence`, library registration, and deterministic review-bundle merge. | `a78982e7c827fd15d92c6d9a965cdf3ed01e32c9` / `4ac1c751e76a258720824b8153616fd466472322` |
| M5-004 | Lark and Jira/Confluence command fixtures plus source-preserving JSON/Markdown reports. | `b11c197b51fa20e59f483b507842935094c60698` / `54e609e03b486f9e75267aa04cdbaaf65c7105f5` |
| M5-005 | Reliable timeout-process test while preserving the direct-child termination contract. | `8e355a06b206700e22754fa21c1200e162c6a918` / `54e609e03b486f9e75267aa04cdbaaf65c7105f5` |
| M5-006 | Standalone CI validation and smoke guards for the Decision 26 report catalog. | `fad13afc9ed56a82846a56a1098eaebcdeafc567`, `a21d832323b02d207f2a5823762cfd7747ae0c1f` / `65954cff60369dce07102d10833b19e8405c1109` |

The detailed assignments, worker handoffs, coordinator findings, and exact
validation histories remain in `docs/work-items/M5-001` through `M5-006`.

## Source-specific fixture proof

The public stdio integration test runs two separately registered command
fixtures through `collect_external_evidence`, `get_review_bundle`,
`validate_findings`, and `write_report`.

The Lark fixture proves:

- an explicit document/block locator and canonical URI;
- retrieval time `2026-07-26T11:00:00.000Z` and source update time
  `2026-07-25T09:30:00.000Z`;
- structured adapter identity, document source type, and
  `untrusted_external`;
- injection-shaped text remains inert evidence data;
- a secret-shaped value is redacted before leaving the normalizer;
- the final report retains the source catalog and omits the evidence excerpt.

The Jira/Confluence fixture proves:

- an explicit Jira issue and linked Confluence page become separate retained
  evidence items;
- source URIs, retrieval times, update times, titles, and adapter provenance
  survive into the final report;
- an explicit Confluence comment permission failure becomes bounded
  `inaccessible` missing evidence;
- secret-shaped text in the permission message is redacted in collections,
  bundles, logs, JSON, and Markdown;
- repeated report writes from identical inputs are byte-identical.

These are deterministic protocol/security fixtures with no network access.
They establish the shared adapter contract, not compatibility with current
Lark, Jira, or Confluence APIs.

## Local exit gates

The coordinator reviewed M5-006 at branch head
`22b1c103f08ebff2cc9e0d35f59a53411de3b0e5` and reran the gates after
integration on `main`:

- focused M5/CI/report suite: 5 files, 97 tests passed;
- TypeScript check: passed;
- two consecutive full suites: 27 files, 265 tests passed in each run;
- stdio smoke: passed with all eight tools and the unchanged M1 compatibility
  fixture;
- deterministic CI smoke: `completed_no_findings`, `smoke=ok`;
- package dry-run: passed with 157 files;
- diff and clean-worktree checks: passed.

No dependency, package version, tag, npm dist-tag, or release state changed.

## Cloud artifact evidence

### Green jobs with an invalid M5 artifact

[GitHub run 30171504267](https://github.com/Canlendula/change-trace-mcp/actions/runs/30171504267)
used revision `54e609e03b486f9e75267aa04cdbaaf65c7105f5`. Both jobs succeeded,
Ubuntu passed 27 files / 242 tests, both job annotation lists were empty, and
exactly three managed files were uploaded.

The downloaded `release-review.json` had SHA-256
`7877667753bee67ff1e327658e56772e6cde2f9ac8a0be4d083dd5b63f2bbef1`
but omitted the required `evidenceSources` field. The run therefore counts as
successful orchestration and a failed M5 artifact-contract audit. It led to
M5-006; it is not accepted exit evidence.

### Replacement run

[GitHub run 30172390638](https://github.com/Canlendula/change-trace-mcp/actions/runs/30172390638)
used exact revision `65954cff60369dce07102d10833b19e8405c1109`.

- `quality`: success; Ubuntu passed 27 files / 265 tests, including the
  external-source fixture, adapter timeout, and CI report-catalog tests.
- `advisory-smoke`: success; outcome `completed_no_findings`.
- Both job annotation endpoints returned `[]`.
- Artifact count: one archive containing exactly the three managed files.
- Artifact name:
  `change-trace-orchestration-smoke-30172390638-1`
- Artifact ID: `8623274439`
- Artifact size: 1,302 bytes
- Artifact digest:
  `sha256:4730a7ecbe53805e3419bc2c4964d130f19bf6022368ee3eaad637d957ae14b5`

Downloaded file evidence:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `release-review-status.json` | 1,072 | `7f5827d89d86871fee688481f2543bf095150e70f99b247a41585191f5cbe118` |
| `release-review.json` | 834 | `7dad69824bb61402ec14f93a6606e0d108579f2cff1a73d6220ce4b9b72ab710` |
| `release-review.md` | 17 | `38b4a657b06fa22da5325f63d54a063c07936de7427a5673543d89029bd62b71` |

The sidecar-recorded JSON/Markdown sizes and hashes match the downloaded
files. It records attempt 1 and the exact revision as both base and head. The
downloaded report parses with the current `reportSchema`, contains
`evidenceSources: []`, and records
`evidenceCoverage.totalEvidenceItems: 0`. No Actions run remained queued or in
progress after the audit.

## Exit assessment and limitations

All M5 exit criteria pass for the deterministic explicit-reference contract:
Lark and Jira/Confluence-shaped inputs share one normalized contract, missing
permissions remain safe, no broad search access is required, and source URLs
and timestamps survive into final reports.

Remaining limitations are intentional:

- vendor API/OAuth behavior and credentialed access require later live pilots;
- discovery, inferred references, pagination policy, and organization search
  are deferred;
- process termination covers the configured direct child, not an arbitrary
  descendant tree;
- Windows and Ubuntu/POSIX paths are covered, but other operating systems are
  not claimed;
- schemas remain provisional until the M8 compatibility freeze.
