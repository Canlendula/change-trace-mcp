# Change Trace MCP

Change Trace MCP is a local-first, model-neutral MCP server for collecting
and normalizing change-scoped release evidence. The user's existing Agent makes
semantic judgments; this package keeps evidence preparation deterministic and
reviewable.

M1–M5 are complete. The M6 runtime path accepts strict, pre-produced manifests
through one confined repository file read. Pinned offline JUnit-style,
Playwright-JSON, API-smoke, and staging-summary fixtures exercise that path
without claiming general format support or live compatibility. The
external-adapter path continues to accept explicit references through bounded
Host-configured commands. The currently exposed MCP tools are:

- `get_server_info` reports process and runtime metadata;
- `get_compatibility_fixture` returns a byte-stable fixture for Host smoke tests;
- `get_change_scope` returns a deterministic, bounded Git change summary for an
  explicit repository root and two refs;
- `collect_local_evidence` returns bounded, provenance-rich excerpts from
  configured repository document roots;
- `collect_external_evidence` returns normalized, redacted, and
  `untrusted_external` evidence for explicit references through one exact
  Host-configured adapter;
- `collect_runtime_evidence` normalizes one explicit, pre-produced runtime
  manifest beneath the verified Git root without executing tests, browsers,
  probes, deployments, or artifact fetches;
- `get_review_bundle` combines change and document evidence into a bounded,
  indexed bundle with deterministic facts, external/runtime collections, and
  missing-evidence records;
- `validate_findings` validates Agent output against the shared schema and the
  bundle's evidence/source indexes;
- `write_report` renders validated findings and a complete retained
  evidence-source catalog as a deterministic Markdown and JSON report pair
  inside a repository-relative output directory.

## Requirements

- Node.js 22 or newer.

## Local development

```sh
npm install
npm run check
npm test
```

Run the stdio server from a local checkout:

```sh
npm run build
node dist/cli.js
```

The server reserves stdout for MCP JSON-RPC messages. Structured operational
logs are emitted to stderr.

### `write_report` usage

`write_report` accepts a validated `ReviewBundle`, a `FindingValidationResult`,
reviewer metadata, and a repository-relative output path. It renders a
deterministic Markdown report and a structured JSON report as a pair of files:

- `<reportName>.md` — human-readable Markdown with safe code fences, escaped
  HTML, and bounded structure;
- `<reportName>.json` — machine-readable report conforming to the versioned
  `Report` JSON Schema.

The tool requires:

- `repositoryRoot` — an absolute path to the repository working directory;
- `outputDirectory` — a path relative to `repositoryRoot`. Absolute paths,
  `..` traversal, `.git` metadata paths, and symlink escapes are rejected;
- `reportName` — a safe basename (`[A-Za-z0-9][A-Za-z0-9._-]{0,127}`) that
  determines the output filenames;
- `bundle` — a validated `ReviewBundle` from `get_review_bundle`;
- `validationResult` — the matching `FindingValidationResult` from
  `validate_findings`. The validation result's `bundleId` must equal the
  bundle's ID;
- `reviewMeta` — caller-supplied reviewer identity, required `createdAt`
  timestamp (ISO 8601), optional tool version, notes, and declared limitations;
  identical inputs including `createdAt` produce byte-identical reports;

Optional parameters:

- `overwrite` — when `true`, existing report files are replaced. The default
  (`false`) refuses the write if either report file exists;
- `maxReportSizeBytes` — an output size bound. The default is 10 MiB; the
  absolute hard maximum is 100 MiB. The write fails instead of silently
  truncating findings.

The tool returns a structured result with `reportId`, absolute paths to the
written files, and their byte sizes. Error responses are bounded and do not
expose report content.

Example MCP call flow:

```
get_change_scope ─┬→ collect_local_evidence ───────────────┐
                  └→ collect_external_evidence (optional) ├→
                     collect_runtime_evidence (optional) ─┤
                     get_review_bundle → validate_findings → write_report
```

External adapters are registered by the Host through
`CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE`; executable configuration and
credentials are never MCP tool input. See the packaged
[external-adapter guide](docs/external-adapters/README.md) and
[copyable configuration](docs/external-adapters/config.json.example).
Runtime conversion remains Host/CI-owned. See the packaged
[runtime-evidence guide](docs/runtime-evidence/README.md) and its strict
[normalized manifest examples](docs/runtime-evidence/examples/).

## Security and privacy

This pre-beta package is a local stdio server and does not provide a sandbox.
Read the [Security Policy](SECURITY.md), [security documentation index](docs/security/README.md),
[threat model](docs/security/THREAT_MODEL.md), [privacy and telemetry statement](docs/security/PRIVACY.md),
and [executable control inventory](docs/security/control-inventory.json) before
using it with sensitive repositories, adapters, models, or CI artifacts.

## Contribution workflow

This repository uses a coordinator/worker model with isolated worktrees,
tracked task assignments, and coordinator-owned Roadmap and release decisions.
See [`docs/CONTRIBUTING_WORKFLOW.md`](docs/CONTRIBUTING_WORKFLOW.md) before
starting delegated implementation work.

## Versioned schemas

The package exports strict Zod schemas and deterministic Draft 2020-12 JSON
Schema documents for `EvidenceItem`, `ChangeScope`, `LocalEvidenceCollection`,
`ExternalAdapterRequest`, `ExternalAdapterResponse`,
`ExternalEvidenceCollection`, `ReviewBundle`, `Finding`,
`RuntimeEvidenceManifest`, `RuntimeEvidenceCollection`,
`FindingValidationResult`, and `Report`:

```ts
import {
  evidenceItemSchema,
  exportCoreJsonSchemas,
} from "change-trace-mcp";

const evidence = evidenceItemSchema.parse(input);
const jsonSchemas = exportCoreJsonSchemas();
```

Host-specific setup and the current compatibility matrix live in
[`docs/smoke-tests/`](docs/smoke-tests/README.md).

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for milestone scope and
[`docs/PROJECT_DECISIONS.md`](docs/PROJECT_DECISIONS.md) for accepted product
and architecture decisions.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
