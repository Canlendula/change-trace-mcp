# Change Trace MCP Project Decisions

> Status: accepted baseline
> Last updated: 2026-07-22
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
| GitHub pull request | GitHub Copilot Code Review where repository MCP is available | Ephemeral cloud environment |
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
