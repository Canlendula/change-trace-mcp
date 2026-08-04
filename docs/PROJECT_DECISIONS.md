# Change Trace MCP Project Decisions

> Status: accepted baseline
> Last updated: 2026-07-25
> Purpose: record stable, public product and architecture decisions for contributors

## 1. Project definition

Change Trace MCP is a free and open-source, local-first, model-neutral MCP package that helps an existing Agent evaluate whether a software change is consistent with its requirements, documentation, and optional runtime evidence.

The package collects, filters, and normalizes evidence. The user's Agent performs semantic judgment. The result is an evidence-linked release-consistency report that can be reviewed locally or attached to CI.

## 2. Target workflow

```text
Git change
  -> determine change scope
  -> collect related requirements and documentation
  -> include optional CI/runtime evidence
  -> build a bounded review bundle
  -> user's Agent evaluates consistency
  -> validate evidence references and finding schema
  -> write Markdown and JSON reports
  -> CI or developer decides what to do next
```

The default integration is advisory. Teams may later promote selected outcomes to release gates after measuring accuracy in their own environment.

## 3. Distribution and runtime

### Decision

- Publish the core as a lightweight package that can be started through `npx`.
- Use MCP `stdio` as the baseline transport.
- Do not require Docker, a daemon, or a hosted service for normal use.
- Keep the implementation compatible with local Agent Hosts and headless CI Hosts.

### Rationale

Teams already use different Agents, models, CI systems, and document platforms. A local stdio package reduces installation and infrastructure requirements while MCP provides a common tool contract.

## 4. Model and Agent neutrality

### Decision

The MCP core will not contain:

- an LLM provider configuration layer;
- model selection;
- a model API gateway;
- proprietary reasoning orchestration;
- a hosted Agent service.

The user's Agent Host supplies the model and performs semantic comparison.

### Supported operating patterns

| Context | Agent Host | MCP execution |
|---|---|---|
| Local development | Codex, Claude Code, OpenCode, Cursor, or another compatible Host | Local `npx`/stdio process |
| GitHub pull request | GitHub Actions with a headless Host; optionally GitHub Copilot Code Review when entitlement is available | Ephemeral cloud environment |
| Generic CI | A headless Host such as Codex, Claude Code, or OpenCode CLI | MCP process started inside the CI job |

MCP does not trigger itself. CI events, scheduling, and Agent invocation remain the responsibility of the Host and CI platform.

## 5. Responsibility boundaries

### MCP core

The core is responsible for:

- deterministic Git change scoping;
- evidence collection and normalization;
- source metadata, freshness, and provenance;
- configurable source adapters;
- review-bundle construction and size controls;
- finding-schema and evidence-reference validation;
- Markdown and JSON report rendering;
- redaction, timeout, and output-path controls.

### Agent Host

The Host is responsible for:

- model credentials and model choice;
- tool orchestration;
- semantic comparison and judgment;
- generating findings, confidence, severity, and recommendations;
- optional follow-up actions explicitly permitted by the user.

### CI platform

The CI platform is responsible for:

- triggers and scheduling;
- runner isolation and secrets;
- report artifact upload;
- PR/MR comments and external notifications;
- required-check and merge-gate policy.

## 6. Evidence model

Every material conclusion should be traceable to evidence.

Evidence items are expected to carry:

- a stable ID;
- evidence type;
- source system and locator;
- retrieval timestamp;
- content hash when available;
- relation to the current change;
- selected excerpt or artifact reference;
- selection reason;
- trust classification;
- truncation and redaction metadata.

Reports must distinguish deterministic facts from Agent inference. Missing or inaccessible evidence should result in an explicit `inconclusive` state when a reliable conclusion cannot be reached.

## 7. Documentation sources

### Decision

The project will work with a team's existing documentation and requirement systems. It will not require migration to a new specification format.

Planned source order:

1. repository-local Markdown and text;
2. generic command adapter;
3. Lark/Feishu documents and project data;
4. Jira issues and Confluence pages;
5. DingTalk and additional systems based on demonstrated demand.

External sources are read-only by default and their content is treated as untrusted input.

## 8. Runtime evidence

Runtime and staging evidence is optional.

The initial implementation should ingest evidence from existing systems, including:

- CI test summaries;
- machine-readable test reports;
- Playwright result metadata and artifact links;
- API smoke-test output;
- explicitly provided staging environment metadata;
- evidence obtained through a user's existing browser or Playwright MCP.

The project will not implement a complete browser automation platform in v1.

## 9. Report behavior

### Default outputs

- a human-readable Markdown report;
- a machine-readable JSON report.

### Report states

Reports should distinguish at least:

- completed with no findings;
- completed with findings;
- inconclusive due to missing or inaccessible evidence;
- infrastructure or tool failure.

Notification delivery, PR comments, artifact upload, and webhook retries remain outside the core package.

## 10. Safety and reliability

The following controls are required across milestones:

- least-privilege and read-only access by default;
- explicit adapter and tool allowlists;
- workspace and output-path confinement;
- safe command argument construction;
- credential and sensitive-content redaction;
- maximum evidence size and execution time;
- clear partial-result and error states;
- external documents marked as untrusted data;
- prompt-injection regression fixtures;
- evidence references required for substantive findings;
- merge blocking disabled by default.

Early releases will prefer finding precision over recall to reduce alert fatigue.

## 11. Initial MCP surface

The following tool names are provisional until the protocol spike is complete:

- `get_change_scope`
- `collect_local_evidence`
- `collect_external_evidence`
- `collect_runtime_evidence`
- `get_review_bundle`
- `validate_findings`
- `write_report`

The public contract should remain small. Host-specific instructions or an optional Skill may guide tool use without moving reasoning into the MCP server.

## 12. v1 scope

v1 includes:

- Git change scope;
- repository-local documentation;
- versioned evidence, bundle, finding, and report schemas;
- multiple local Host compatibility;
- at least one cloud PR-review path;
- advisory CI examples;
- external documentation adapters;
- optional runtime evidence ingestion;
- fixture replay and quality metrics.

v1 excludes:

- built-in model/provider management;
- a proprietary Agent;
- hosted enterprise document storage;
- automatic code or documentation mutation;
- a full E2E execution engine;
- built-in notification delivery;
- mandatory Docker or persistent services;
- default release gates.

## 13. Quality gates

Development should measure:

- setup time to the first report;
- successful review-run rate;
- report duration and context size;
- proportion of findings with valid evidence references;
- accepted and confirmed finding rate;
- dismissed or false-positive rate;
- inconclusive rate and cause;
- cross-Host schema compatibility;
- whether pilot teams keep the advisory CI job enabled.

External integrations should follow local fixtures and a stable evidence contract. Runtime evidence should follow a reliable static evidence loop.

## 14. Public documentation policy

- `docs/ROADMAP.md` is the public development plan.
- `docs/PROJECT_DECISIONS.md` is the public record of accepted product and architecture decisions.
- `MEMORY.md` is local working memory and is intentionally ignored by Git.
- `docs/research/` contains local research notes and is intentionally ignored by Git.

Stable decisions discovered during research or implementation should be promoted into this document. Temporary observations, unfinished thoughts, and local operational notes should remain in `MEMORY.md`.

## 15. M1 implementation baseline

### Package identity and license

The project is licensed under Apache-2.0. This license was confirmed by the
project owner on 2026-07-22.

The public package and MCP server name is `change-trace-mcp`. The project owner
accepted this name on 2026-07-22 after npm availability and public-name conflict
checks. `spec-walk` is reserved as the working name for a future optional Agent
Skill that guides the semantic review workflow; it is not the core package name.

### Runtime and language baseline

- Require Node.js 22 or newer. Node.js 20 is end-of-life, while Node.js 22 and
  24 are supported LTS lines as of the M1 spike.
- Compile TypeScript in strict Node ESM mode.
- Use Zod 4 for runtime tool schemas and Vitest for unit/integration tests.
- Keep stdout exclusively for MCP JSON-RPC; write structured operational logs
  to stderr.

### MCP SDK generation

Pin the official MCP TypeScript SDK v1 series during M1. SDK v2 is still
pre-alpha and its maintainers recommend v1 for production until v2 stabilizes.
Revisit this decision at M7 or earlier if v2 becomes stable and provides a
compatibility benefit that justifies migration.

The M1 implementation currently pins `@modelcontextprotocol/sdk` 1.29.0. Its
transitive `@hono/node-server` dependency is overridden to a patched 2.x release
because the latest compatible 1.x release is covered by a moderate Windows
path-traversal advisory. The project uses only stdio in M1, and integration
tests verify that the override does not change the stdio behavior. Reassess the
override when the SDK updates its own dependency range.

### M1 public tool surface

- `get_server_info` returns environment-dependent startup diagnostics.
- `get_compatibility_fixture` returns a versioned, byte-stable JSON fixture.

Both tools are read-only. Evidence collection tools remain deferred to M2 so
the M1 spike stays focused on launch and Host compatibility.

## 16. M1 cloud gate and paid Host policy

The project owner revised the M1 cloud gate on 2026-07-22 while retaining M1 as
a hard gate.

M1 requires byte-identical fixture calls from Codex, Claude Code, OpenCode, the
official SDK reference client, and a clean standard GitHub Actions runner that
launches the published npm package. The Actions run verifies Linux startup,
package retrieval, stdio negotiation, tool discovery, and fixture output in an
ephemeral cloud environment.

GitHub Copilot Code Review execution is deferred to M4 as an optional Host
compatibility item because the repository owner does not have and does not plan
to purchase the required paid Copilot entitlement. The repository-level MCP
configuration remains saved for a future licensed contributor or pilot. A
saved configuration alone does not count as a compatibility pass, and the
project must not claim Copilot Code Review compatibility until linked session
logs prove the tool call.

This policy keeps a real cloud-runtime gate without making core open-source
development depend on a proprietary paid Host. M4 retains GitHub Actions with a
headless Agent as the primary GitHub pull-request path.

## 17. M2 core schema baseline

M2 begins with strict, versioned Zod contracts for `EvidenceItem`,
`ChangeScope`, `ReviewBundle`, and `Finding`. Their initial schema version is
`1.0.0`, independent of the npm package version.

All contract objects reject unknown keys. Optional source facts are represented
with explicit `null` values where absence is meaningful, while required arrays
remain present even when empty. Evidence items always carry provenance, trust,
truncation, and redaction fields. Findings keep evidence-backed deterministic
facts separate from Agent inference.

Zod is the runtime source of truth. The public package also exports
deterministic JSON Schema Draft 2020-12 representations with stable URN IDs.
Cross-record rules, such as requiring substantive findings to reference IDs
present in a review bundle, remain the responsibility of the M3
`validate_findings` tool rather than the shape-only base schema.

Git collection begins only after fixture repositories exist. The first fixture
materializes a real two-commit repository with fixed author metadata and line
ending policy, then verifies its expected name-status diff. The fixture set now
covers the required rename, deletion, binary, submodule, and oversized cases.

The initial `get_change_scope` implementation invokes Git through explicit
argument arrays without a shell. It requires the caller to name the exact
repository root, rejects ref values that resemble command options, resolves
refs to full commit IDs before diffing, and only processes paths reported by
Git. File count, per-file patch bytes, and total retained diff bytes have
separate hard limits. Commit summaries have their own limit and omitted count.
Patch subprocess output is drained as a stream while only the configured byte
budget is retained. Repository-configured external diff and text conversion
helpers are disabled, and ordering uses locale-independent comparisons. Errors
and truncation remain visible in the result.

Edge fixtures remain declarative and materialize into real Git repositories.
Small text trees are stored directly; fixture manifests may generate bounded
binary files, repeated text, and gitlinks. This keeps the repository compact
while testing Git's actual rename, deletion, binary, submodule, and oversized
diff behavior.

The initial `collect_local_evidence` implementation accepts a validated
`ChangeScope` and reads regular files only beneath configured repository-local
document roots. Repository escape paths and Git metadata paths are rejected;
symbolic links are reported and skipped. Scanned entries, selected files,
single-file bytes, per-file excerpt characters, and total excerpt characters
have independent hard limits.

Explicit document references receive selection priority. Other documents are
linked to changed files only when retained text contains a deterministic path
or filename-stem identifier; pattern-only matches remain valid evidence with
an empty relationship list. Complete files receive a raw SHA-256 content hash.
Byte-truncated files use a `null` hash and expose truncation. Common private-key,
credential-assignment, GitHub token, and `sk-` token shapes are redacted before
excerpts leave the collector.

The same secret redactor now applies to retained Git patches and commit
summaries. Each changed file and commit records its redactions, and any
post-redaction growth is bounded again before returning MCP output.

`get_review_bundle` promotes normalized local documents, Git diffs, and commits
into one indexed evidence set. Local document evidence keeps selection priority
so large patches cannot consume the entire bundle context budget. Git-derived
status and commit-summary facts reference generated evidence IDs; collection
errors, binary content, and upstream truncation become explicit
`missingEvidence` records. Bundle-level evidence count and excerpt-character
limits are enforced independently, including omitted counts. Bundle IDs are
stable hashes of the resolved change and retained evidence content, while
`createdAt` remains observation metadata.

M2 exit tests use an injected fixed clock for deterministic replay. Production
MCP calls use the actual collection time. With the required Git edge fixtures,
confinement tests, UTF-8-safe bounds, provenance, and stdio integration passing,
the M2 deterministic evidence core is complete.

## 18. M3 finding validation baseline

`validate_findings` accepts untrusted Agent-produced JSON and returns a
structured validation result rather than failing the entire call for an invalid
individual finding. It never fills missing semantic content. Safe formatting
differences in category, severity, recommendation, and status tokens are
normalized with warnings. Unknown enum values remain schema errors; the only
semantic aliases accepted initially are `informational` for `info` and common
spellings of `add_or_adjust_tests`.

Confirmed and suspected findings must reference at least one evidence item in
the supplied `ReviewBundle`. All evidence IDs used by findings and their
deterministic facts must exist, fact references must also appear in the
finding's top-level evidence list, affected sources must exist in the bundle's
evidence or missing-evidence indexes, and finding IDs must be unique. Duplicate
or unsupported items are rejected with path-specific issues. Inconclusive
findings may omit evidence; when the bundle has no missing-evidence record this
produces a warning so the Host can reassess the claim.

## 19. M3 cross-Host replay quality gate

M3 uses one shared, Host-neutral fixture suite and scorer for Codex Desktop,
Claude Code, and OpenCode. Its exit gate is evaluated against one declared
complete replay per Host:

- each target Host must pass at least 8 of 9 fixtures;
- `implemented-correctly`, `intentional-doc-free-refactor`, and
  `malicious-instruction` are mandatory no-finding controls;
- `insufficient-evidence` and `missing-permissions` are mandatory
  missing-evidence controls;
- every submitted finding must pass schema and evidence-reference validation,
  with zero rejected findings;
- at most one miss is allowed, and only among the remaining positive fixtures;
- each Host/fixture contributes one declared output; retries, response
  replacement, and best-of selection cannot replace a failure;
- a Host or output-format failure counts as a failed fixture;
- prepared review packets must remain bounded by the existing ReviewBundle
  limits, and their observed byte sizes must be recorded with the run.

Instruction `1.4.0` passed all 9 fixtures on all three target Hosts. Each Host
submitted 6 findings, all 6 were valid, and none were rejected or warned. The
five mandatory controls passed on every Host. The nine prepared packets ranged
from 10,876 to 12,417 bytes, with no scorer input errors.

The exact score outputs, ordered bundle digests, methodology, and
reproducibility hashes are tracked in
[`docs/evaluation/M3_RESULTS.md`](evaluation/M3_RESULTS.md). Raw prompts,
captures, and response streams remain ignored local audit material because
they contain untrusted fixture content and local execution details.

This gate closes the M3 review-loop milestone. It does not create a general
model-quality guarantee, publish a new package, or extend Host compatibility
claims beyond the recorded replay configuration.

## 20. Free GitHub Models GPT-4.1 is not the M4 reference reviewer

M4 does not accept the free GitHub Models `openai/gpt-4.1` path as its
reference semantic reviewer.

The first live OpenCode workflow established a capacity failure before useful
inference: the five public MCP tool definitions require more input tokens than
the free High-tier request limit. M4-004 then removed those tool definitions
from the question and sent the exact accepted M3 ReviewPackets directly to the
model through the official inference API.

The direct quality spike used one declared response per fixture, mandatory
controls first, no retries or response repair, a 4,000-token output limit, and
the accepted M3 scorer. `implemented-correctly` passed with no findings.
`intentional-doc-free-refactor` produced an invalid inference response, so the
run stopped after its second request. The frozen gate failed and no stability
rerun was authorized.

This is a no-go for the tested free provider/model/response-contract path. It
is not a general finding that the deterministic evidence, validation, and
reporting core is unviable, and it does not isolate GPT-4.1 semantic reasoning
from provider/output reliability. The exact bounded evidence is recorded in
[`docs/evaluation/M4_GPT41_RESULTS.md`](evaluation/M4_GPT41_RESULTS.md).

Until another M4 architecture is selected:

- automatic GitHub Models inference remains paused;
- the OpenCode inference step requires an explicit manual workflow input;
- no free GitHub semantic-review compatibility claim may be published;
- a replacement model/Host must pass the same M3-derived quality gate before
  it can become the M4 reference path;
- compact schemas or deterministic orchestration may solve request capacity,
  but do not by themselves satisfy model-quality or output-reliability gates.

## 21. M4 uses a caller-supplied Agent Host

M4 selects the provider-neutral advisory runner and caller-supplied Host
direction. Change Trace does not bundle, subsidize, or certify a default free
semantic reviewer.

The durable responsibility split is:

- the repository platform owns event triggers, protected execution, identity,
  credentials, artifact retention, PR/MR comments, and merge-policy wiring;
- the caller-selected Agent Host and model own semantic reasoning and MCP tool
  invocation;
- Change Trace owns deterministic change scope, bounded and provenance-rich
  evidence, validation, outcome classification, and portable Markdown/JSON
  report artifacts.

Official platform evidence shows that this is a supported deployment pattern:
GitHub Actions can run Codex or Claude through vendor-maintained Actions;
GitLab External Agents supports managed Codex and Claude paths across its
documented offerings; Bitbucket Agentic Pipelines supports Rovo Dev plus
bring-your-own Codex and Claude; Azure Pipelines, Gitee Go, and self-managed
forge runners can invoke explicit command-line Hosts. These paths have
different availability, trust, credential, and runner constraints, so none is
part of the core public contract.

M4 compatibility claims follow these rules:

- a deterministic Host may prove CI orchestration, artifact behavior, rerun
  identity, and advisory failure containment;
- semantic Host/model compatibility requires that exact path to pass the
  M3-derived replay quality gate;
- a platform listing or successful CLI launch does not establish semantic
  quality;
- platform-specific comments and checks belong in optional examples or
  adapters, not the MCP core;
- the rejected free GitHub Models GPT-4.1 path remains paused and historical;
  it is not a fallback.

The M4 exit gate therefore requires provider-neutral GitHub and generic CI
examples plus deterministic orchestration evidence. It does not require the
project to purchase or operate a model credential. The supporting official and
live evidence is tracked in
[`docs/evaluation/M4_CI_AGENT_LANDSCAPE.md`](evaluation/M4_CI_AGENT_LANDSCAPE.md).

## 22. Product differentiation is the change-intent evidence layer

Change Trace will not compete as a general AI code reviewer. Repository
platforms and model vendors already provide code-quality review, repository
instructions, skills, MCP access, and increasingly intent-aware review.

The v1 product claim is:

> Change Trace provides cross-system, traceable, and verifiable change-intent
> evidence to an existing review Agent.

The core differentiators are:

- platform- and model-neutral evidence contracts;
- external requirements, product documentation, ADRs, decisions, and issue
  acceptance criteria;
- stable provenance, source identity, timestamps, hashes, selection reasons,
  truncation, and missing-access records;
- CI, test, API, Playwright, deployment, and other runtime observations kept
  distinct from static evidence;
- validated findings that can distinguish requirement gaps, stale
  documentation, code drift, runtime mismatch, and insufficient evidence.

This decision raises the strategic priority of M5 external-document adapters
and M6 runtime evidence. Repository-specific presentation remains an outer
integration concern, while Change Trace stays focused on evidence collection,
normalization, traceability, and report validation.

## 23. M5 adapters use preconfigured commands and explicit references

The generic external-document adapter is a bounded protocol boundary. MCP tool
input may select a preconfigured adapter ID and supply explicit source
references, but it cannot supply an executable, arguments, working directory,
environment-variable names, shell text, or credentials.

Adapter registration is owned by the user or CI Host outside Agent-controlled
tool input. Each registration fixes:

- an explicit argument vector executed without a shell;
- a bounded timeout and stdout/stderr byte allowance;
- the credential environment names that may reach that adapter process;
- the source systems and read capabilities the adapter may use.

The initial protocol is read-only and explicit-reference-first. Broad
organization search and inferred discovery are disabled by default. A later
adapter may expose discovery only as a separately configured, allowlisted
capability with its own limits and evidence-selection record.

The process protocol uses one strict JSON request on stdin and one strict JSON
response on stdout. Diagnostics remain bounded on stderr. Available records
must include adapter identity and version, source type, canonical source
reference, title, nullable update time, retrieval time, bounded content, and
change relation. Missing, denied, unsupported, and adapter-error results are
structured records without document content. Credentials, command
configuration, and free-form logs are not part of either protocol payload.

Change Trace assigns external content the `untrusted_external` trust level
during normalization regardless of adapter identity. An adapter cannot
self-declare its content trusted. Permission failures become explicit missing
evidence, and secret-like content is redacted before it enters a review bundle,
report, log, or artifact.

M5 will implement this in bounded slices:

1. strict adapter request/response schemas and deterministic JSON Schema
   exports;
2. the preconfigured command runner and response normalizer;
3. the `collect_external_evidence` MCP path and review-bundle integration;
4. Lark and Jira/Confluence fixture adapters that prove the shared contract,
   permission handling, provenance, and injection resistance.

## 24. External provenance remains structured on normalized evidence

M5 normalization must not discard the source title, source update time,
external source type, or adapter identity/version established by the adapter
protocol. Normalized external `EvidenceItem` records therefore carry an
optional strict `externalProvenance` object containing:

- adapter ID, name, and version;
- external source type;
- source title;
- nullable source update time.

The field is optional so existing repository, Git, test, and runtime evidence
remain valid. Every available external result must populate it. External
collections enforce that the item provenance matches the collection adapter
and that the item trust level is `untrusted_external`.

The normalizer, rather than the external adapter, owns core evidence identity,
content hashing, secret redaction, trust assignment, missing-evidence mapping,
and related-change linkage. An adapter may supply source content and
provenance, but it cannot choose a core evidence ID or elevate trust.

The core schema remains provisional before v1 stabilization. This additive
field keeps the current schema version during M5; M8 will freeze the complete
v1 schema snapshot and compatibility policy before the stable release.

## 25. CLI adapter registration uses one Host-owned JSON file

The `npx`/stdio entry point discovers external adapters only through the
Host-set `CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE` environment variable. Its value
names one bounded JSON file read once before the MCP server starts.

The file contains:

- the current core schema version;
- a bounded list of strict M5-002 registrations;
- no credential values, document content, search queries, or tool input.

The loader accepts only a regular non-symbolic-link file under a hard byte
limit, uses fatal UTF-8 and strict JSON/schema validation, and rejects duplicate
adapter IDs. Loader failures use stable codes and cannot log file content,
argv, environment names/values, or credentials. When the environment variable
is absent, the server starts with zero configured adapters.

Library callers may pass the same validated registrations directly to
`createServer`. The `collect_external_evidence` MCP tool is always discoverable
so Hosts have a stable tool contract, but an unknown or unconfigured adapter ID
returns a bounded safe error without process execution.

The tool is read-only, non-destructive, and idempotent for a stable upstream
source. Its MCP `openWorldHint` is true because it reads an external system.
All other M5-002 process and credential boundaries remain unchanged.

## 26. Final reports carry a bounded evidence-source catalog

The final JSON and Markdown reports must retain the source identity needed to
audit every evidence item that survived bundle construction. The report
therefore gains a required `evidenceSources` catalog derived from all retained
bundle evidence items in bundle order.

Each catalog entry contains:

- the core evidence ID and evidence type;
- the canonical source system, locator, and nullable URI;
- retrieval time, nullable content hash, and trust level;
- related change IDs and redaction metadata;
- optional external provenance: adapter ID/name/version, source type, title,
  and nullable source update time.

The catalog does not copy evidence excerpts into the final report. This keeps
the report traceable without creating a second store of external document
content or prompt-injection-shaped text. Findings may still reference evidence
IDs, and an operator can follow the canonical source reference under the
source system's own access controls.

The Markdown renderer presents source URIs as escaped code literals rather
than constructing active links from untrusted values. External titles and all
other dynamic values use the existing containment helpers. Missing-evidence
records also render their nullable source URI when present, while permission
messages remain bounded and redacted by the external normalizer.

The report writer always emits the catalog, including for reports with zero
findings. Catalog order follows the deterministic bundle order and remains
within the existing 10,000-item evidence bound and report byte limits. A
change to external title, update time, source type, or adapter identity already
changes the bundle ID under Decision 24, so the report remains tied to the
exact provenance snapshot it presents.

This additive report change keeps the provisional `1.0.0` schema version
during M5. Existing M3 review-bundle replay identities remain unchanged;
serialized report fixtures are updated intentionally. M8 will freeze the v1
schema snapshot and compatibility policy.

M5 source-specific proof uses deterministic command-adapter fixtures rather
than live vendor credentials:

- one Lark/Feishu document fixture preserves a document/block locator, URL,
  retrieval/update timestamps, and injection-shaped untrusted content;
- one Jira/Confluence fixture covers an issue, a linked page, and a
  permission-denied record;
- both travel through the same configured command protocol, MCP collection
  tool, normalized collection, review bundle, validation, and report writer.

These fixtures prove the shared contract and security boundary. They are not
claims of live vendor API compatibility; real credentialed pilots remain an
M7 activity.

## 27. M6 normalizes pre-produced runtime evidence

M6 accepts pre-produced, read-only runtime results through a strict normalized
manifest. The Change Trace core does not launch test suites, browsers, API
probes, deployments, or arbitrary subject-repository commands as part of
runtime evidence collection.

The stable core boundary is format-neutral. Bounded converters may map JUnit
XML, Playwright JSON or report metadata, API-smoke output, browser-MCP
observations, and CI summaries into the manifest. The core Schema does not
copy a complete upstream vendor report object. This keeps changes in
Playwright reporters, JUnit dialects, and CI platform parsing rules outside
the normalized public contract. Supporting official format evidence is
recorded in
[`docs/evaluation/M6_RUNTIME_FORMAT_LANDSCAPE.md`](evaluation/M6_RUNTIME_FORMAT_LANDSCAPE.md).

Every available normalized runtime record carries:

- a stable producer identity and declared source format;
- a runtime kind distinguishing test runs/cases, API observations, browser
  observations, environment metadata, and other bounded observations;
- an explicit outcome for executed behavior;
- source and non-production environment identity;
- nullable start/completion time and duration;
- related Git change IDs and related requirement/document evidence IDs;
- a bounded summary plus bounded references to external or local artifacts;
- explicit truncation metadata.

Unavailable, inaccessible, unsupported, malformed, and truncated source
records remain explicit missing evidence. A staging outage or unreadable
artifact does not become a failed product observation. Conversely, a
successfully parsed test or probe that reports a failed outcome remains
observed runtime evidence; the Agent may evaluate it only with its linked
requirements, changes, environment, and other evidence.

Normalization assigns core evidence IDs, hashes, `observed_runtime` trust,
redactions, and safe missing-evidence reasons. A producer cannot select its
core trust level or inject executable configuration. Runtime evidence uses
only `test_result`, `runtime_observation`, or `configuration` evidence types
and cannot also claim external-document provenance.

Screenshots, traces, videos, HTML reports, and raw logs are not copied into
the review bundle or final report. The normalized record may retain bounded
`SourceReference` entries for those artifacts. The core does not fetch those
references or manage a browser.

Production execution and destructive actions remain outside the M6 default
contract. The initial environment vocabulary covers local, CI, staging, and
other explicitly non-production contexts. Already-produced production
evidence and active probing require a later security decision.

M6 will proceed in bounded slices:

1. normalized runtime manifest, provenance, and collection Schemas with
   deterministic JSON Schema exports;
2. a confined, explicit local-manifest collector and MCP tool that performs no
   subject execution;
3. review-bundle identity/relationship validation and final-report runtime
   provenance;
4. bounded JUnit/Playwright/API/staging fixtures, converter decisions, and
   end-to-end exit evidence.

The Schema remains provisional until the M8 compatibility freeze.

## 28. M6 reads one explicit, confined runtime manifest per collection

The first runtime collector accepts exactly one repository-relative manifest
path together with an explicit Git repository root. It does not discover
reports, scan artifact directories, infer filenames, or accept a command,
browser action, URL to fetch, credential, trust level, or active-probe
configuration.

The collector resolves the exact Git root through the existing fixed,
read-only Git-root check. The manifest path must use forward slashes, remain
inside that root, exclude `.git`, and traverse no symbolic-link segment. The
target must remain the same regular file across a bounded open/read check.
Files larger than 4,194,304 bytes are rejected before normalization. Decoding
uses fatal UTF-8, JSON parsing accepts one complete value, and the result must
pass the strict M6-001 manifest Schema.

Failures cross the MCP boundary only as
`collect_runtime_evidence_failed` plus one stable code:

- `invalid_input`;
- `repository_unavailable`;
- `manifest_not_found`;
- `manifest_file_unsafe`;
- `manifest_file_too_large`;
- `manifest_read_failed`;
- `manifest_encoding_invalid`;
- `manifest_json_invalid`;
- `manifest_schema_invalid`;
- `normalization_failed`.

Messages, paths, file content, producer summaries, artifact locators, and
schema diagnostics are not copied into error output or logs.

For available records, normalization:

- derives a stable core evidence ID from normalized producer, format, record,
  source, kind, and environment identity;
- maps test records to `test_result`, API/browser/other observations to
  `runtime_observation`, and environment metadata to `configuration`;
- assigns `observed_runtime`, the collection timestamp, redaction metadata,
  and the accepted structured runtime provenance;
- hashes the complete pre-redaction summary only when the producer did not
  declare it truncated;
- redacts common credential patterns and applies the existing evidence-excerpt
  bound;
- preserves artifact entries only as bounded `SourceReference` values and
  never opens or fetches them.

Unavailable records become `MissingEvidence`. `not_found`, `inaccessible`,
`unsupported`, and `truncated` map directly; `malformed` maps to
`unsupported`. Their reasons are redacted and bounded. They never create a
failed runtime observation.

The always-discoverable `collect_runtime_evidence` MCP tool returns one
`RuntimeEvidenceCollection`. It is read-only, non-destructive, locally
bounded, and has `openWorldHint: false`. It may perform the accepted fixed Git
root verification and file read; it launches no tests, application code,
browsers, API probes, deployments, converter commands, or arbitrary
repository commands. Bundle relationships and final-report presentation
remain reserved for M6-003.

## 29. Runtime relationships and unavailable provenance survive the bundle

M6-003 adds runtime collections to review-bundle construction as a bounded,
explicit input. A bundle accepts at most 16 `RuntimeEvidenceCollection`
objects. Existing local, external, generic additional, and Git evidence
behavior remains compatible.

Every runtime available item and runtime unavailable record must reference only
change IDs present in the supplied `ChangeScope`. Its related evidence IDs
must resolve to non-runtime `document` evidence supplied through local,
external, or generic additional evidence. Runtime-to-runtime relationships,
unknown IDs, and links to Git, commit, or configuration items are rejected.

Static relationship targets are ordered before runtime candidates. The
candidate order is:

1. local evidence;
2. external evidence;
3. non-runtime additional evidence;
4. available evidence from explicit runtime collections;
5. runtime-provenance additional evidence;
6. generated Git evidence.

If a static relationship target is omitted by the bundle item or excerpt
limits, a runtime item that depends on it is also omitted. A retained runtime
item therefore cannot point at an absent requirement/document item. Existing
non-runtime ordering and bundle identities remain byte-compatible.

Unavailable runtime records need more provenance than the generic
`MissingEvidence` shape can represent. M6 therefore adds a strict
`RuntimeUnavailableProvenance` containing producer, source format, manifest
record ID, runtime kind, non-production environment, original unavailable
access status, related change IDs, and related requirement/document evidence
IDs. Runtime collections require this structured missing-evidence variant.
Generic and external missing evidence retain their existing strict shape.
Review bundles and reports accept the tagged runtime variant in addition to
the existing variant.

The normalized status remains `not_found`, `inaccessible`, `unsupported`, or
`truncated`; the provenance retains whether the producer originally reported
`unsupported` or `malformed`. Status/provenance mismatches are rejected. An
unavailable runtime record still cannot carry an execution outcome or become
a failed behavior observation.

Bundle identity conditionally includes full available runtime provenance,
runtime related-change links, and structured runtime missing evidence. No
runtime input means the pre-M6 bundle identity algorithm and replay hashes are
unchanged. Collection/retrieval time remains outside identity so repeated
collection of the same pre-produced result stays stable.

Final JSON and Markdown evidence catalogs preserve bounded runtime producer,
format, record, kind, environment, outcome, timing, artifact-reference, and
related-evidence metadata without copying evidence excerpts or artifact
content. Runtime missing entries preserve their unavailable provenance.
Markdown labels observed outcomes separately from unavailable/not-observed
records. Report Schema refinements prevent external and runtime provenance
from coexisting.

## 30. M6 exits through pinned offline mapping fixtures

M6-004 proves the normalized boundary with deterministic, checked-in,
format-shaped fixtures. It does not add a general JUnit XML parser, a complete
Playwright report model, live API/staging access, or converter execution to the
MCP server.

Conversion remains a Host/CI preprocessing responsibility. The proof covers
four pinned mapping profiles:

- a JUnit-style profile with suite/case identity and explicit passed, failed,
  errored, and skipped cases;
- a Playwright JSON reporter profile with nested suite/spec/test/result
  identity, final attempt status, timing, and path-only attachment references;
- a project-owned API-smoke profile containing already-produced request-check
  outcomes without request/response bodies;
- staging environment metadata with one available record and one inaccessible
  observation.

Each fixture producer is a local deterministic test process. It accepts only a
fixture ID plus coordinator-supplied change and document evidence IDs, then
returns one strict `RuntimeEvidenceManifest`. It has no command, URL fetch,
credential, environment-variable, browser, deployment, discovery, or
arbitrary content input. The process reads no subject artifact and launches no
child process.

The profiles intentionally map a bounded subset:

- JUnit `failure`, `error`, `skipped`, and an otherwise successful case map to
  `failed`, `errored`, `skipped`, and `passed`;
- the Playwright profile supports ordinary final attempts with `passed`,
  `failed`, `timedOut`, `skipped`, or `interrupted`, mapped respectively to
  `passed`, `failed`, `timed_out`, `skipped`, or `cancelled`;
- retries, flaky/expected-failure semantics, unknown JUnit dialect extensions,
  malformed upstream reports, embedded attachment bodies, stdout/stderr,
  stacks, raw logs, and HTTP bodies are outside these profiles;
- unsupported input becomes an unavailable `unsupported` or `malformed`
  manifest record in a real converter; it cannot be guessed into an observed
  outcome.

Artifact handling remains reference-only. The Playwright fixture may preserve
bounded trace or screenshot paths/URIs, while attachment bodies are absent.
The API fixture preserves the check source and outcome but omits headers,
cookies, request bodies, response bodies, and credentials. The staging fixture
describes an already-produced environment observation and never contacts its
URL.

The fixture pipeline must use the built stdio MCP surface:

1. resolve one deterministic Git change and local requirement document;
2. produce strict normalized manifests from all four fixture profiles;
3. collect each manifest through `collect_runtime_evidence`;
4. build one relationship-valid review bundle;
5. validate a deterministic empty finding submission;
6. write JSON and Markdown reports twice from identical input.

The proof must show observed outcomes and unavailable/not-observed staging
evidence separately, preserve requirement/change links and artifact
references, reject an unsupported profile, redact secret-shaped fixture text,
and produce byte-identical report pairs. The fixture and normalized artifact
sizes remain beneath the accepted core bounds.

M6 documentation packages strict normalized manifest examples and a mapping
guide. Compatibility claims are limited to the checked-in fixture profiles and
recorded shape snapshot. General JUnit/Playwright/API vendor compatibility,
converter SDKs, live staging pilots, and active browser/API probing remain M7
or extension work.

## 31. M7 starts with an auditable security and privacy baseline

M7 hardening begins by documenting and testing the current trust boundaries
before broadening installation, CI, publishing, or pilot claims. The first
slice does not change a public Schema, MCP tool, package version, dependency,
or release state.

The baseline covers the complete deployed path:

- a Host launches the local stdio server with the Host user's operating-system
  privileges;
- Git scope and repository-document collectors read explicit, bounded local
  inputs;
- the external-evidence tool may launch only a Host-configured adapter and is
  the sole current MCP tool annotated as open-world;
- the runtime collector reads one explicit pre-produced manifest and does not
  execute tests, browsers, probes, deployments, or artifact fetches;
- bundle and finding validation are in-memory transformations;
- report writing is the sole destructive MCP tool and is confined to an
  explicit repository-relative output directory;
- the Agent Host, model provider, CI runner, configured adapters, source
  systems, and artifact-retention settings remain separate operational trust
  boundaries.

The project publishes four linked artifacts:

1. `SECURITY.md` defines the supported pre-1.0 state, coordinated disclosure
   route, report contents, and scope. GitHub private vulnerability reporting
   is used when the repository exposes that form. If it is unavailable, a
   reporter may open a minimal issue asking for a private contact but must not
   publish exploit details, credentials, or sensitive data.
2. A threat model identifies protected assets, actors, entry points, trust
   boundaries, accepted controls, residual risks, and out-of-scope Host or
   provider behavior.
3. A privacy and telemetry statement records data that may enter evidence and
   reports, network/process boundaries, retention ownership, and deletion
   behavior. The core currently adds no first-party telemetry and does not
   transmit evidence by itself. Configured adapters, Agent Hosts, model
   providers, CI systems, and user-selected source systems can process data
   under their own policies.
4. A machine-readable control inventory maps every public tool and major
   non-tool surface to capabilities, sensitive-data exposure, failure
   projection, control references, verification references, and residual
   risk. A test validates its shape, coverage, referenced files, tool
   annotations, package inclusion, and selected implementation invariants.

The inventory is executable documentation, not a substitute for adversarial
testing or a security audit. Common-pattern redaction is best-effort and must
not be presented as a data-loss-prevention guarantee. Documentation must
distinguish implemented controls, tested properties, operator
responsibilities, and unresolved findings.

The security review records findings by severity and disposition. Any
high-severity issue, unexpected network/process capability, credential leak,
path escape, unsafe write, or false capability annotation stops the slice at
`needs_decision` or creates a dedicated hardening task. Lower-severity gaps may
be queued explicitly, but cannot be silently described as mitigated.

The construction order after this baseline is:

1. bounded security fixes required by the audit;
2. clean installation and Host compatibility;
3. provider-neutral CI templates and sample fixtures;
4. extension, contribution, changelog, and versioning guidance;
5. reproducible publishing-workflow preparation and dry-run;
6. pilot kit, baseline metrics, and real advisory pilots.

Package publishing, a tag, a GitHub release, private vulnerability-reporting
enablement, CI execution on hosted runners, credentials, and live pilot access
remain coordinator/user-authorized actions. A dry-run, offline fixture, or
local smoke test cannot be reported as a public release or a completed pilot.

## 32. M7 resolves Git environment inheritance and raw exception projection before compatibility expansion

M7-001 records `FIND-M7-001` and `FIND-M7-002` as medium findings. Both are
bounded enough to fix without a new dependency or Schema version, and both
must be mitigated before M7 broadens clean-installation or Host-compatibility
claims.

The fixed Git subprocesses will receive a fresh, explicit environment instead
of spreading `process.env`. The portable allowlist is limited to process
lookup, operating-system, home/config-discovery, and temporary-directory
keys:

- `PATH`;
- `SystemRoot`, `ComSpec`, `PATHEXT`, and `WINDIR`;
- `HOME`, `USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`, and `XDG_CONFIG_HOME`;
- `TEMP`, `TMP`, and `TMPDIR`.

Lookup is case-insensitive on Windows and emits at most one canonical key for
each allowed name. Missing values stay absent. The child environment then sets
`GIT_PAGER=cat`, `GIT_TERMINAL_PROMPT=0`, and `LC_ALL=C` itself. No other
`GIT_*`, credential/token, trace, runtime-loader, or arbitrary Host variable
is inherited. Existing fixed argument arrays, time and output bounds,
`--no-ext-diff`, `--no-textconv`, and shell-free execution remain in force.
Global/system/repository Git configuration discovered through the retained
Host path variables remains an operator-owned boundary; this change is not a
Git sandbox.

This contract follows the current Node child-process behavior: `env` defaults
to `process.env`, command lookup uses the supplied `PATH`, and Windows treats
environment names case-insensitively. It also accounts for Git's documented
`GIT_CONFIG_*`, diff, pager, prompt, and trace environment behavior. Primary
references accessed 2026-07-26:

- `https://nodejs.org/api/child_process.html`;
- `https://git-scm.com/docs/git`;
- `https://git-scm.com/docs/git-config`;
- `https://git-scm.com/docs/diff-options`.

Exception-derived failure text must not cross the MCP boundary. The five
handlers that currently project raw exceptions — `get_change_scope`,
`collect_local_evidence`, `get_review_bundle`, `validate_findings`, and
`write_report` — will return an error result containing exactly the existing
tool-specific `error` value plus `code: "operation_failed"`. They do not
include an exception message, path, Git stderr, or `String(error)`. The
external and runtime collectors retain their already-safe enumerated codes.

Partial-success errors also stop copying exception text:

- `git_file_diff_failed` keeps its repository-relative path and uses one fixed
  safe message;
- `document_root_unavailable` and `document_read_failed` keep their
  repository-relative paths and use fixed safe messages.

Expected validation messages, fixed operator guidance, and repository-relative
evidence locators are unchanged. Success Schemas, tool names, inputs,
annotations, report content, and deterministic identities are unchanged.
Because error text is provisional pre-1.0 behavior and contains the reported
risk, preserving it is not a compatibility requirement.

Tests must prove that secret-shaped and hostile `GIT_*`/configuration
environment sentinels do not reach or redirect Git, Windows key casing does
not create duplicate environment entries, exception-derived sentinel values
do not appear in MCP or partial-success results, and all existing success and
failure-mode gates continue to pass. Only after those tests pass may
`FIND-M7-001` and `FIND-M7-002` move to `mitigated`; the low redaction
limitation and informational no-sandbox boundary remain open/accepted as
recorded.

## 33. M7 separates clean artifact installation from real Host compatibility

M7 installation evidence must test the package artifact that would be
consumed, not a checkout-relative `dist/cli.js` path and not the older package
currently selected by an npm dist-tag. Until a release is explicitly
authorized, M7 uses a locally generated tarball from the current source
version and must not publish it, change a dist-tag, or describe it as a
registry release.

M7-003 proves package mechanics in a fresh temporary consumer:

1. run `npm pack --json` into a temporary artifact directory after the normal
   `prepack` build;
2. record the package name/version, npm integrity, file count, size, and an
   independently computed SHA-256 digest;
3. install that exact tarball into a new directory with a fresh npm cache, an
   empty temporary user config, install lifecycle scripts disabled, and no
   inherited npm or registry credential variables;
4. prove the installed package is a copied package artifact outside the
   checkout, exposes the declared bin and required packaged documentation, and
   has a valid production dependency tree;
5. launch the installed server with the existing reference client and require
   exact discovery of all nine tools plus the byte-stable M1 fixture;
6. exercise the equivalent pinned local-tarball `npx` launch path when the
   installed npm version supports it.

The reusable smoke command must create and remove its own temporary
directories, reserve stdout for one bounded machine-readable summary, and
avoid persisting credentials, npm configuration, caches, tarballs, or consumer
projects in the repository. Unit tests for its planning, environment
sanitization, result validation, and cleanup must remain offline; the explicit
clean-install smoke is the networked registry-read gate for declared
dependencies.

Package configuration examples use an exact
`change-trace-mcp@<VERSION>` placeholder. They may also show the exact local
tarball form used by maintainers, but must not recommend an unpinned `latest`
launch or imply that the source version is already published. Development
checkout commands remain clearly labeled as development-only.

Current priority-Host syntax is taken only from primary documentation:

- Codex/ChatGPT desktop, CLI, and IDE use local stdio commands configured in
  the UI, `codex mcp add`, or `[mcp_servers.<name>]` tables with `command`,
  `args`, optional `cwd`, and timeout/tool-policy fields:
  `https://developers.openai.com/codex/mcp/` and
  `https://developers.openai.com/codex/config-reference/`;
- Claude Code local stdio configuration requires its options before the server
  name and `--` before the executable; local, project, and user scopes retain
  their documented trust behavior:
  `https://code.claude.com/docs/en/mcp`;
- OpenCode configuration is version-bound. The installed v1 line and current
  v2 line must not share an unlabeled example; current v2 places named servers
  under `mcp.servers` and represents a local command as an array:
  `https://opencode.ai/v2/docs/mcp-servers`;
- npm supports installing a local tarball and disabling lifecycle scripts, and
  `npm pack` is the local preview of publish contents:
  `https://docs.npmjs.com/cli/install/` and
  `https://docs.npmjs.com/cli/v9/using-npm/developers/`.

M7-003 does not make a real Codex, Claude Code, or OpenCode compatibility
claim. M7-004 will start fresh sessions of the exact recorded Host versions,
make each Host call the installed artifact's fixture tool, and record startup,
tool discovery, exact fixture text, timeout, and shutdown evidence. Model/API
calls, user/global Host configuration changes, and any credential-bearing
external execution remain coordinator/user-authorized actions.

Because `docs/ROADMAP.md` is currently part of the npm package, a coordinator
acceptance update changes the tarball bytes. Worker artifact evidence is
therefore pre-integration evidence. After recording M7-003 acceptance, the
coordinator must regenerate and rerun the clean-install smoke from accepted
`main`, then store the final digest and result in an un-packaged evaluation
record. No later packaged-file change may be included in that final
clean-install claim without rerunning it.

## 34. M7 records real Host compatibility with Host-specific shutdown semantics

M7-004 proves the frozen compatibility fixture through one installation of one
local tarball. The evidence artifact was packed from clean commit
`13e9d13c52590381434780e747c2eb9b4badcf76`, has SHA-256
`7a27bf2f7399982015b162a649ef024668cb34b2fbebee34eac8e4eaa2ba7659`,
and installs `dist/cli.js` with SHA-256
`e828bf961baa7af827e3833d598d9bf3fe6922c7a873bebcb056878322ef4d3f`.
The installation used a fresh cache and empty user config outside the
checkout, disabled lifecycle scripts, and exposed exactly the frozen nine-tool
surface.

The accepted Host matrix is:

- Claude Code `2.1.217`: exact discovery, one `{}` fixture call,
  byte-identical fixture text, and automatic process close;
- OpenCode `1.18.4`: the same exact discovery/call/result and automatic
  process close;
- Codex Desktop `26.707.3748.0`: the same exact discovery/call/result in a
  fresh `gpt-5.6-terra`/`high` task, followed by Host-held MCP ownership rather
  than a one-shot close.

Codex Desktop's result is accepted with an explicit limitation. Turn
completion and task archive did not emit a graceful `server_closed` event.
The unique temporary-state marker identified the remaining probe/server pair;
the pair was terminated explicitly, temporary state and checkpoint
configuration were removed, and the final exact-match orphan count was zero.
This evidence supports Codex launch and tool-call compatibility. It does not
support a graceful one-shot shutdown claim for that Host.

The compatibility claim is limited to the recorded Host versions, installed
runtime, stdio protocol surface, exact fixture call, and observed lifecycle.
It is not a semantic-review quality guarantee, provider benchmark, future
Host-version promise, release authorization, or registry-package claim. Claude
Code updated locally to `2.1.220` after the recorded session, so the claim
remains pinned to the pre-session `2.1.217` observation.

The reusable M7 harness now rejects mismatched executable versions, non-zero
preparation commands, artifact/tool/result mismatches, duplicate or borrowed
lifecycle events, unsafe finalization roots, and unbounded child processes or
output. Claude Code and OpenCode must close automatically. Codex Desktop uses
the separately recorded Host-held disposition plus exact operator cleanup.

As with M7-003, Roadmap and Decision updates are packaged and therefore change
the accepted-main tarball bytes. The coordinator must rerun the clean-install
smoke after this Decision is committed. If the accepted-main
`dist/cli.js` digest remains identical, the real-Host result applies to that
runtime-equivalent accepted artifact; the exact real-Host tarball digest
remains the pre-integration digest above.

## 35. M7 packages the provider-neutral CI contract without bundling a reviewer

M7-005 turns the accepted M4 advisory-CI mechanics into an installed-package
surface. The npm artifact will include exactly the provider-neutral advisory
runner, the bounded status summarizer, `docs/ci`, and a deterministic public CI
fixture. It will not package the historical provider experiments, test suite,
live repository workflows, credentials, or a model/Agent runtime.

The public fixture is a mechanics-only Host substitute. It writes one bounded,
schema-valid no-finding report pair so the installed advisory runner can prove
configuration, confinement, status normalization, the exact three-artifact
contract, and cleanup without inference or provider access. Documentation and
tests must label it as orchestration evidence; it cannot support a semantic
review or Host/model quality claim.

The packaged examples preserve the M4 trust split:

- Change Trace supplies the deterministic runner, validation, advisory outcome
  classification, bounded summary, and artifact contract;
- the consumer installs an exact package version or checks out an immutable
  trusted tooling revision separately from the subject repository;
- the consumer supplies and quality-qualifies its own headless Host/model;
- provider credentials reach only the selected Host process, while that Host
  must sanitize the MCP child environment and keep credentials out of argv,
  logs, prompts, reports, status, and artifacts;
- the platform owns triggers, protected environments, retention, comments,
  checks, and any merge policy.

GitHub Actions remains the concrete hosted example, and GitLab remains one
concrete generic-pipeline example. A portable POSIX-shell example documents
how the same command/artifact contract maps to self-managed GitLab, Gitee Go,
Jenkins, Bitbucket Pipelines, Azure Pipelines, Forgejo, and comparable runners.
Those mappings are portability guidance, not certified platform-Agent
integrations.

Installed-package validation must pack and install one local tarball under the
existing credential-free clean-install boundary, then launch the packaged
runner against the packaged public fixture. It must require
`completed_no_findings`, exactly
`release-review.md`, `release-review.json`, and
`release-review-status.json`, a schema-valid report, and successful temporary
cleanup. No hosted CI dispatch, model call, credential, package publish,
version change, tag, release, or dist-tag action is authorized.

## 36. M7 publishes separate extension, contribution, changelog, and version policies

M7-006 closes the public documentation gap without changing runtime behavior
or release state. The npm artifact will add:

- a root `CONTRIBUTING.md` for public contributors;
- a root `CHANGELOG.md` with an `Unreleased` section and the verified
  `0.0.0-dev.0` construction snapshot;
- a packaged `docs/VERSIONING.md`;
- a packaged external-adapter authoring guide;
- a packaged runtime-evidence converter authoring guide.

The public contribution guide is distinct from
`docs/CONTRIBUTING_WORKFLOW.md`. The latter remains repository coordination
policy for assigned workers and does not become the public package entry
point. Public contributors receive issue/PR, test, documentation, security,
license-rights, and breaking-change expectations. No CLA, DCO, hosted check,
or response-time promise may be claimed unless the repository actually
enforces it. Security reports continue through `SECURITY.md`.

Package versions follow Semantic Versioning 2.0.0. The package's public
surface includes MCP tool names and inputs/outputs, exported runtime and JSON
Schemas, CLI/bin and configuration behavior, report artifacts, packaged
examples, and documented extension protocols. Before the first stable
release, `0.0.0-dev.N` versions are construction snapshots and do not imply a
stable compatibility promise. A later beta version/tag is selected only by
the publishing task; M7-006 must not change the current
`0.0.0-dev.1` source version, npm tags, registry state, or release metadata.

Serialized contract `schemaVersion` values are independent from the npm
package version. A compatible package release can keep a Schema version. An
incompatible serialized change requires a new Schema version and migration
notes as well as the appropriate package-version change. The provisional
`1.0.0` Schema values remain subject to the M8 freeze and cannot be presented
as a stable package `1.0.0` guarantee.

The changelog uses fixed `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
and `Security` headings as needed. Every public behavior or contract change
must be recorded under `Unreleased` before release. Release entries are dated
and immutable after publication except for clearly identified factual
corrections. A registry artifact, Git tag, GitHub release, compatibility
claim, and milestone declaration remain separate facts; documentation may
claim only those that were actually verified.

An external-adapter guide must preserve the M5 wrapper boundary: fixed
Host-owned registration, shell-free bounded execution, allowlisted credential
names, exact JSON stdin/stdout, explicit references, untrusted output,
structured unavailable results, and fixture/live least-privilege testing.
Adapter identity and version describe the wrapper contract and must change
when that contract changes.

A runtime-converter guide must preserve the M6 preprocessing boundary:
deterministic bounded conversion outside the MCP core, a declared and
separately versioned upstream mapping profile, no test/browser/probe execution
by Change Trace, no raw bodies/secrets/logs, stable relationship IDs, explicit
unavailable outcomes, and fixture-based tests. Support for one pinned upstream
shape does not establish general vendor or format compatibility.

The package smoke must require these public files from the exact installed
tarball and reject broken repository-relative links among the newly published
entry points. M7-006 may change only documentation, package file allowlisting,
and focused package/documentation validation. It cannot change source,
Schemas, dependencies, lockfiles, package version, hosted CI, credentials,
tags, releases, publishing, or dist-tags.

Primary references accessed 2026-07-26:

- `https://semver.org/`;
- `https://docs.npmjs.com/about-semantic-versioning/`;
- `https://docs.npmjs.com/cli/dist-tag/`.

## 37. M7 prepares stage-only npm publishing with separate human approval

M7-007 prepares a public, reviewable release path while preserving the rule
that a dry-run is not release authorization. The repository will add a
manual-only GitHub Actions workflow named
`.github/workflows/npm-stage-publish.yml`, repository-only publishing
guidance, bounded release-preparation/dry-run scripts, and offline contract
tests. The workflow has no push, pull-request, release, tag, schedule, or
automatic trigger.

The future authenticated path uses npm trusted publishing through GitHub OIDC
with `npm stage publish` permission only. It must not receive direct
`npm publish` permission or a long-lived npm token. The exact future trust
relationship is:

- package: `change-trace-mcp`;
- repository: `Canlendula/change-trace-mcp`;
- workflow filename: `npm-stage-publish.yml`;
- GitHub environment: `npm-stage`;
- allowed action: stage publish only.

The trust relationship and GitHub environment are external release state.
M7-007 documents them but does not create, edit, or test them. npm currently
permits only one trusted-publisher configuration per package, so later
configuration requires a separate coordinator/user authorization and
interactive account authentication.

Staged publishing separates candidate upload from public availability.
Staging a version reserves that package/version and fixes its dist-tag, so
even staging requires explicit release authorization. Approval or rejection
then requires a maintainer proof-of-presence through npm 2FA; the owner's
existing WebAuthn flow is suitable and no time-based OTP is assumed. Public
availability begins only after that separate approval. M7-007 must not stage,
approve, reject, publish, unpublish, create a Git tag/GitHub release, or change
a dist-tag.

The prepared workflow has two manually selected operations:

- `dry-run` is the default and has only `contents: read`; it prepares one exact
  candidate tarball and runs npm's non-mutating publish dry-run without an
  ID-token or credential;
- `stage` is dormant until separately authorized. It requires an exact
  `v<package-version>` tag ref, exact version and commit inputs, a fixed
  confirmation string, the `npm-stage` environment, an explicitly enabled
  repository variable `NPM_STAGE_PUBLISH_ENABLED`, and a dedicated job with
  only `contents: read` plus `id-token: write`. The variable is absent or
  disabled during M7-007, so a manual `stage` selection cannot reach a
  publishing command.

Both operations use a GitHub-hosted Ubuntu runner, Node.js `24.18.0` LTS with
its npm `11.16.0`, disabled package-manager caching, lifecycle scripts disabled
during dependency installation and candidate publication, fixed trusted
registry `https://registry.npmjs.org/`, and shell-free bounded local helper
processes. The workflow pins:

- `actions/checkout` v7.0.1 at
  `3d3c42e5aac5ba805825da76410c181273ba90b1`;
- `actions/setup-node` v7.0.0 at
  `820762786026740c76f36085b0efc47a31fe5020`.

The stage operation uses `next`; it cannot move `latest`. The historical
`latest` and `next` mappings to `0.0.0-dev.0` remain unchanged during this
task. A later authorized candidate must use a version not already published or
staged. Git tag creation, GitHub release creation, changelog release dating,
npm stage approval, dist-tag adjustment, compatibility publication, and
milestone completion remain separate coordinator actions.

The local accepted M7 dry-run must use the current source
`0.0.0-dev.1`, a credential-free temporary npm cache/config/home, one exact
candidate tarball, and npm's `--dry-run`. It records bounded identity,
file-count, size, integrity, SHA-256, CLI/runtime, exact safe operation, and
cleanup evidence. It must verify the existing nine-tool, M1 fixture,
public-documentation, CI fixture, production-dependency, and package-surface
gates before declaring readiness. It cannot claim OIDC, trusted-publisher,
provenance, GitHub-runner, stage, approval, publication, or release success.

The workflow may be pushed to the default branch after coordinator acceptance
so GitHub can parse and display it, but it must not be dispatched during this
task. M7-007 changes no package version, public runtime contract, dependency,
lockfile, registry, trusted-publisher, environment, tag, release, staged
version, publication, or dist-tag state.

Primary references accessed 2026-07-26:

- `https://docs.npmjs.com/trusted-publishers/`;
- `https://docs.npmjs.com/staged-publishing/`;
- `https://docs.npmjs.com/cli/v11/commands/npm-stage/`;
- `https://docs.npmjs.com/cli/v11/commands/npm-trust/`;
- `https://docs.npmjs.com/cli/publish/`;
- `https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow`;
- `https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-npm`;
- `https://nodejs.org/en/blog/release/v24.18.0`.

## 38. M7 pilot evidence is opt-in, privacy-minimized, and threshold-free until real baselines exist

M7-008 establishes a reusable pilot kit and a deterministic baseline-metric
contract. It does not conduct a pilot or satisfy the M7 real-team gate. A
qualifying pilot still requires 3 to 5 independent teams, at least three
calendar weeks of advisory use, and representation of all three Roadmap
profiles:

1. requirements and documentation kept in the repository;
2. explicit external requirements from Jira, Lark, or an equivalent system;
3. pre-produced runtime evidence from a staging Web/API environment.

The kit records one bounded JSON observation envelope with pseudonymous teams
and individual review attempts. It contains no repository or organization
name, URL, path, requirement/document text, diff, evidence excerpt, report
body, prompt, model response, raw Host log, credential, email, user name, or
free-form feedback. Raw operational evidence remains with each team under its
own retention policy. Participation, data sharing, and keeping advisory CI
enabled are opt-in decisions.

Each team record contains only:

- a stable pseudonymous team ID;
- one of the three pilot profiles;
- setup elapsed milliseconds to the first valid report, or `null` when not
  observed;
- observed whole calendar weeks;
- whether advisory execution remains enabled at pilot end, or `null` when the
  team has not made that decision;
- an affirmative confirmation that the team approved the bounded metric
  submission.

Each run record contains only:

- a pseudonymous run ID and team reference;
- Host family/version and instruction version;
- an outcome from the frozen bounded vocabulary;
- duration, ReviewBundle context characters, and evidence-item count;
- whether the accepted package/report Schemas validated;
- total, valid-evidence, accepted/confirmed, dismissed/false-positive,
  inconclusive, and unreviewed finding counts.

The run outcomes are `completed_findings`, `completed_no_findings`,
`inconclusive`, `failed_setup`, `failed_host`, and `failed_validation`.
Completed runs count as successful only when Schema compatibility is true.
Every attempted record stays in the denominator; failures cannot be omitted to
improve the successful-run rate.

Metric denominators are frozen before seeing real results:

- setup median uses teams with a non-null setup measurement and separately
  reports missing teams;
- successful-run rate uses all run records;
- duration, context characters, and evidence-item medians use successful runs;
- valid-evidence-reference rate uses all findings;
- accepted/confirmed and dismissed/false-positive rates use dispositioned
  findings (`accepted + dismissed + inconclusive`);
- inconclusive rate uses all findings and is additionally grouped by
  `inconclusive` run outcome versus finding disposition;
- retention uses teams with a non-null end-of-pilot decision;
- cross-Host Schema compatibility uses all run records and reports exact Host
  families separately.

A zero denominator produces `null`, never `0` or a fabricated percentage.
Counts, numerators, denominators, missingness, and ratios are all retained in
the summary. Median calculation is deterministic: sort numeric inputs,
select the middle for odd counts, and use the arithmetic mean of the two
middle values for even counts.

The repository-only summarizer accepts one explicit local file, caps input
bytes, teams, runs, identifiers, versions, and counts, rejects unknown fields,
duplicate IDs, dangling team references, inconsistent finding totals, and
outcome/count contradictions, performs no network or subprocess call, writes
no file, and emits one canonical bounded JSON line. A checked fixture and
expected summary prove mechanics only.

Thresholds remain explicitly `unfrozen`. Fixture values, local Host evidence,
and the first team's data cannot become release or gate thresholds. The
coordinator and project owner may freeze thresholds only after reviewing a
complete real baseline across the qualifying team/profile/duration set. The
pilot remains advisory throughout M7; no finding or aggregate metric blocks a
merge by default.

M7-008 adds repository-only pilot documents, Schema, fixture, summarizer, and
offline tests. It performs no recruitment, external messaging, credentialed
adapter/runtime access, Host/model call, hosted workflow run, telemetry,
package-surface/version change, compatibility publication, or pilot claim.

Primary references:

- `docs/ROADMAP.md`, M7 pilot plan and beta exit metrics;
- Decision 10, precision-first advisory policy;
- Decision 13, quality-gate vocabulary;
- Decision 31, no first-party telemetry and operator-owned retention;
- `https://json-schema.org/draft/2020-12/`.

## 39. The GitLab.com reference starts credential-free and remains separate from the real pilot

The project owner approved a dedicated public GitLab.com subject project named
`change-trace-gitlab-reference`. On 2026-08-04 the project was created under
the owner's personal `infinty081` namespace at
`https://gitlab.com/infinty081/change-trace-gitlab-reference`. The initially
considered default group was rejected for this reference because its effective
visibility policy permitted only Private projects. The project contains only
synthetic code, requirements, tests, and reports. It must contain no customer,
organization, credential, browser-storage, or incident-log data.

The reference is engineering and integration evidence. One synthetic project,
its merge request, and its pipelines cannot count as an independent pilot
team, a pilot week, or evidence that the M7 multi-team gate has passed. M7
therefore remains in progress, and M8 does not start.

Execution is phased:

1. M7-010 prepares a copyable minimal subject project and runs the accepted
   deterministic fixture through the provider-neutral advisory runner. This
   mechanics phase uses no model, GitLab API token, GitLab MCP, Lark
   credential, or other secret.
2. After hosted mechanics pass, a separately assigned protected phase may run
   one real semantic Agent path. The canonical path remains a caller-supplied,
   provider-neutral Host. A GitLab-managed Codex or Claude External Agent may
   be evaluated only as a trial-specific compatibility experiment.
3. A later explicit-reference external-document phase may read one synthetic
   Feishu/Lark product-update document. Search or organization-wide discovery
   is out of scope.

The reference product change is a small service-status iteration. The baseline
supports the operational state. A feature commit adds a planned-maintenance
state and tests while the repository-local behavior document remains stale.
The external document `CTGR-001` records the approved maintenance behavior. A
follow-up commit synchronizes the local behavior document. This creates a
bounded finding/no-finding sequence without using a real product repository.

The credential-free GitLab pipeline uses a GitLab-hosted Linux runner, runs
ordinary subject tests first, and then executes the deterministic Change Trace
mechanics fixture from the immutable accepted tooling commit
`aa52a1795a587cb32704018bdd60b1d33649309d`. The advisory job has a finite
fifteen-minute timeout, zero retries, `allow_failure: true`, and exactly these
three short-retention artifacts:

- `release-review.md`;
- `release-review.json`;
- `release-review-status.json`.

The first real pipeline, `2730064343`, was created on 2026-08-04 for baseline
commit `b3f4b9ab2e7a5bf5fcab4557cff30b85597878bc`. GitLab stopped it before job
creation because the project owner's user account was not verified. The
pipeline had no YAML error, runner job, retry, log, or artifact. This is an
external GitLab.com hosted-compute prerequisite, not evidence that the subject
test, Change Trace runner, or artifact contract passed or failed. Hosted
mechanics acceptance remains blocked until the project owner completes the
GitLab-required identity verification and deliberately starts one new pipeline
for the same baseline commit.

No merge gate, schedule, daemon, retry loop, npm publication, package-version
change, tag, release, or dist-tag belongs to this reference.

The later semantic phase may receive one model credential only in a protected,
manual default-branch pipeline. The project owner enters it through a GitLab
masked, hidden where available, and protected CI variable. The pipeline maps it
to the selected Host only for the bounded Agent invocation. Untrusted or fork
merge-request jobs receive no model credential and no repository write
credential. The Host must remove the model credential before starting the
Change Trace MCP child.

The external document is a dedicated synthetic Feishu/Lark document titled
`Change Trace GitLab Reference — Maintenance Status Update`, with stable ID
`CTGR-001`. On 2026-08-04 the project owner created its Wiki document at
`https://rcnw05c7n18f.feishu.cn/wiki/Ecm9wM0EXiH8I4kvQIfcivtUnoe`; at creation
time it contained the title only. Until a read-only authenticated Lark client
is available, the project owner may populate it manually from the tracked
template. Future automation requires explicit read-only scopes and separate
masked/protected `LARK_APP_ID` and `LARK_APP_SECRET` variables. Those values
must not enter prompts, MCP configuration, logs, reports, or artifacts.

The Codex Desktop GitLab-webview incident changes the access path, not the
reference claim. Until the upstream issue is resolved or the project owner
decides otherwise, the coordinator must not reopen the affected historical
task, use Codex in-app Browser for GitLab, reinstall GitLab MCP for incident
reproduction, or inspect browser storage. GitLab object creation and pipeline
execution require a separately available authenticated CLI or a user-performed
browser action.

Primary references accessed 2026-07-27 through 2026-07-30:

- `https://docs.gitlab.com/ci/variables/`;
- `https://docs.gitlab.com/ci/jobs/job_artifacts/`;
- `https://docs.gitlab.com/ci/runners/`;
- `https://docs.gitlab.com/user/duo_agent_platform/agents/external/`;
- `https://learn.chatgpt.com/docs/non-interactive-mode`;
- `https://github.com/openai/codex/issues/35637`.

Additional hosted-execution reference accessed 2026-08-04:

- `https://docs.gitlab.com/ci/debugging/#error-identity-verification-is-required-in-order-to-run-ci-jobs`.
