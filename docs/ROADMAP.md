# Change Trace MCP Development Roadmap

> Initial roadmap: 2026-07-22
> Status: M1 in progress
> Scope: first public, usable, model-neutral release

## 1. Outcome

Deliver a lightweight MCP package that can be started with `npx`, collects change-scoped evidence from code and documentation, and enables a user's existing Agent to produce an evidence-linked release-consistency report locally or in CI.

The first stable release should prove this loop:

```text
Git change
  -> deterministic scope
  -> related requirements/docs
  -> normalized review bundle
  -> user's Agent judgment
  -> validated findings
  -> Markdown + JSON report
  -> advisory CI artifact
```

## 2. Product principles

- Local-first and open source.
- Model and Agent vendor neutral.
- `stdio` MCP as the baseline transport.
- One package, minimal installation steps.
- Deterministic evidence preparation before semantic reasoning.
- Evidence references required for meaningful findings.
- Read-only integrations by default.
- Advisory review before optional gating.
- Precision over recall during early adoption.
- Existing documentation and test tools are inputs; teams do not need to migrate platforms.

## 3. v1 boundaries

### Included

- Git change scoping;
- repository-local Markdown/text evidence;
- configurable evidence source metadata;
- versioned review-bundle schema;
- versioned finding/report schema;
- MCP tools for evidence and report handling;
- compatibility with multiple local Agent Hosts;
- at least one cloud PR-review Host path;
- generic headless CI examples;
- external documentation adapters;
- optional runtime/test evidence ingestion;
- Markdown and JSON reports;
- fixtures, replay tests, and measurable quality gates.

### Excluded

- built-in LLM provider and model configuration;
- proprietary Agent service;
- hosted knowledge index or control plane;
- daemon or Docker requirement;
- full browser automation engine;
- automatic code or document mutation;
- built-in webhook delivery;
- default merge blocking;
- support for every documentation vendor in the first release.

## 4. Recommended implementation baseline

The initial implementation should use TypeScript and the official MCP TypeScript SDK because the desired distribution path is `npx` and the core workload is schema-oriented I/O.

Baseline components:

- Node.js LTS-compatible runtime;
- TypeScript with strict type checking;
- MCP TypeScript SDK;
- a runtime schema library for versioned inputs and outputs;
- a small Git command adapter with explicit argument construction;
- a test runner supporting unit, integration, and fixture replay tests;
- JSON Schema export for evidence and finding contracts;
- no database in the first implementation.

The technical spike may revise this choice if Host compatibility or package startup latency reveals a material problem.

## 5. Milestone overview

| Milestone | Target result | Exit gate |
|---|---|---|
| M0 — Project foundation | Repository and durable project decisions | Clean structure and tracked roadmap |
| M1 — Protocol spike | `npx` stdio MCP works across target Hosts | Four Host smoke tests pass |
| M2 — Deterministic evidence core | Git + local docs produce a bounded review bundle | Fixture results are stable and reproducible |
| M3 — Agent review loop | Agents return schema-valid findings and reports | Cross-Host replay suite passes |
| M4 — Advisory CI | Reports run after PR/push checks without blocking | GitHub and one generic CI path demonstrated |
| M5 — External documents | Lark and Jira/Confluence evidence is normalized | Permission and retrieval tests pass |
| M6 — Runtime evidence | Existing test/staging evidence joins the bundle | Static and runtime evidence remain distinguishable |
| M7 — Public beta hardening | Secure, documented, installable beta | Pilot quality and security gates pass |
| M8 — v1 stabilization | Stable schemas and compatibility policy | Release checklist complete |

### Current implementation status

- M0 was verified complete on 2026-07-22: the default branch is `main`, the
  intended public foundation files are tracked, and local research/memory files
  are ignored.
- M1 is in progress. The TypeScript package, stdio entry point, protocol-safe
  logger, diagnostic tool, deterministic fixture tool, reference-client tests,
  package smoke test, and Host configuration examples are implemented.
- The official SDK reference client, Codex, Claude Code, and OpenCode pass
  initialization, tool discovery, and byte-identical fixture calls. GitHub cloud
  validation is the remaining M1 Host gate.
- Detailed, dated compatibility evidence is maintained in
  [`docs/smoke-tests/RESULTS.md`](smoke-tests/RESULTS.md).
- M1 is a hard gate. M2 implementation must wait until every M1 Host fixture
  check passes or the project owner explicitly revises the gate.

## 6. M0 — Project foundation

### Goals

- Establish the local Git repository.
- Keep research notes local and ignored.
- Track durable decisions and the development plan.
- Define the future source and test layout before implementation.

### Deliverables

- `.gitignore`;
- `MEMORY.md`;
- `docs/ROADMAP.md`;
- `docs/research/` containing the two local research documents;
- Git default branch named `main`.

### Exit criteria

- `git status` reports only intended tracked candidates;
- `git check-ignore docs/research/...` confirms both research files are ignored;
- no source code has been selected prematurely.

## 7. M1 — MCP and Host compatibility spike

### Goal

Prove the package can remain a lightweight stdio MCP and can be called by all priority Hosts without a daemon or Docker.

### Deliverables

- package scaffold;
- executable entry point suitable for `npx`;
- MCP initialization and capability negotiation;
- `health` or `get_server_info` diagnostic tool;
- one deterministic echo/fixture tool;
- structured stderr logging that never corrupts stdout JSON-RPC;
- smoke-test documentation for:
  - Codex;
  - Claude Code;
  - OpenCode;
  - GitHub repository MCP/Copilot Code Review environment.

### Questions to answer

- Does each Host start the process reliably?
- Are tool names and schemas interpreted consistently?
- How are timeouts and process termination handled?
- Can each Host pass a workspace path safely?
- Which Hosts support tools only, resources, and prompts?
- What setup is required on ephemeral CI runners?

### Exit criteria

- all four Hosts can initialize the same MCP package;
- all four can call the fixture tool and receive identical JSON;
- stdout contains protocol output only;
- package startup does not require a network service;
- installation steps fit in a short, reproducible guide.

### Go/No-Go gate

If cloud or local Hosts behave incompatibly, retain one core package but add thin Host-specific launch/config templates. Do not create separate implementations.

## 8. M2 — Deterministic evidence core

### Goal

Turn a Git change and local documentation into a small, reproducible, provenance-rich review bundle.

### Proposed modules

```text
src/
  cli/
  mcp/
  config/
  git/
  evidence/
    local/
    normalize/
    select/
  schemas/
  reports/
  security/
tests/
  unit/
  integration/
  fixtures/
```

### Initial tools

#### `get_change_scope`

Inputs:

- repository path;
- base ref;
- head ref;
- include/exclude patterns;
- maximum diff size.

Outputs:

- commits;
- changed files and status;
- bounded diff excerpts;
- detected languages/components;
- truncation and error metadata.

#### `collect_local_evidence`

Inputs:

- scope result;
- configured document roots;
- file patterns;
- optional explicit references from commit/PR text.

Outputs:

- candidate documents;
- relevant excerpts;
- source URI/path;
- content hash and freshness metadata;
- selection reason;
- trust classification.

#### `get_review_bundle`

Inputs:

- normalized change evidence;
- normalized document evidence;
- configured review policy and limits.

Outputs:

- versioned bundle;
- evidence index;
- facts known deterministically;
- missing or inaccessible evidence;
- context-budget and truncation record.

### Schema requirements

Every evidence item should contain:

- stable ID;
- type;
- source system;
- source locator;
- retrieval timestamp;
- content hash where possible;
- related change IDs;
- selected excerpt;
- selection reason;
- trust level;
- truncation state;
- redaction record.

### Exit criteria

- identical fixtures produce byte-stable normalized JSON;
- file rename, deletion, binary, submodule, and oversized diff cases are covered;
- bundle construction does not scan arbitrary paths outside the workspace;
- large documents are bounded before Agent use;
- each excerpt can be traced back to its source.

## 9. M3 — Agent review loop and report contract

### Goal

Let different Agent Hosts evaluate the same review bundle and return results that pass one shared schema.

### Finding schema

Each finding should include:

- finding ID;
- category;
- severity;
- confidence;
- concise title;
- expected behavior;
- observed implementation or evidence;
- evidence references;
- affected files/documents;
- recommended disposition:
  - update code;
  - update documentation;
  - add/adjust tests;
  - investigate;
  - accept intentional difference;
- status:
  - confirmed;
  - suspected;
  - inconclusive;
- deterministic facts separated from Agent inference.

### Tools

#### `validate_findings`

- validate schema;
- verify evidence IDs exist;
- reject unsupported file/source references;
- normalize severity and category;
- record validation warnings without inventing content.

#### `write_report`

- render Markdown for humans;
- render JSON for CI and later analysis;
- write only inside an explicitly configured output directory;
- include review metadata, evidence coverage, limitations, and inconclusive items.

### Optional guidance assets

- compact review instruction;
- Host-specific configuration examples;
- optional `spec-walk` Agent Skill that describes the review workflow;
- no model-specific reasoning implementation in the MCP core.

### Evaluation suite

Create fixtures containing known examples of:

- requirement implemented correctly;
- requirement missing from code;
- code behavior undocumented;
- intentionally documentation-free refactor;
- contradictory documents;
- missing permissions;
- stale documentation;
- malicious instruction embedded in documentation;
- evidence insufficient for a conclusion.

### Exit criteria

- Codex, Claude Code, and OpenCode can return schema-valid findings;
- substantive findings reference existing evidence IDs;
- deterministic fixtures remain stable across repeated runs;
- known refactors do not routinely create documentation findings;
- missing evidence results in `inconclusive`, not fabricated certainty.

### Go/No-Go gate

Continue to external integrations only if the local fixture set reaches an acceptable precision threshold and review bundles remain small enough for routine use.

## 10. M4 — Advisory CI integration

### Goal

Run the review after or alongside existing CI without changing the release path by default.

### Integration targets

1. GitHub Actions with a headless Agent Host;
2. GitHub Copilot Code Review with repository MCP configuration;
3. one generic template suitable for GitLab CI or another runner.

### Required behavior

- trigger on PR/push or after a deployment job;
- preserve existing test/build status;
- run review with bounded timeout;
- write `release-review.md` and `release-review.json`;
- upload artifacts through the CI platform;
- expose an explicit advisory job result;
- distinguish:
  - review completed with no findings;
  - review completed with findings;
  - review inconclusive;
  - infrastructure/tool failure.

### Exit criteria

- one sample repository demonstrates the full loop;
- failure of the advisory review does not fail the release pipeline by default;
- secrets are passed only to required MCP adapters;
- logs do not print credentials or full sensitive documents;
- reruns produce a new report with clear run metadata.

## 11. M5 — External documentation adapters

### Goal

Read existing enterprise requirements without forcing migration to repository-local specifications.

### Adapter order

1. Generic command adapter;
2. Lark/Feishu documents and project items;
3. Jira issues and Confluence pages;
4. DingTalk or other adapters based on pilot demand.

### Generic adapter contract

An adapter should return normalized evidence rather than arbitrary prose.

Required fields:

- adapter name and version;
- source type;
- canonical URL or identifier;
- title and updated time;
- content or selected excerpts;
- access status;
- relation to change scope;
- provenance and trust metadata.

### Lark strategy

- initially support a command adapter around user-configured Lark tooling;
- keep authentication outside the MCP configuration file where possible;
- prefer read-only operations;
- allow explicit document URLs/tokens and search-based discovery;
- preserve document block/source identifiers in evidence references.

### Jira/Confluence strategy

- begin with explicit issue keys and page URLs;
- optionally infer keys from branch, commit, and PR text;
- avoid organization-wide indexing in v1;
- preserve issue status, acceptance criteria, links, and update timestamps;
- treat comments and linked pages as separate evidence items.

### Security requirements

- credentials provided through environment/Host secret mechanisms;
- per-adapter allowlists;
- read-only tools by default;
- external content marked as untrusted;
- prompt-injection-oriented fixture tests;
- clear logs for permission denied and inaccessible sources.

### Exit criteria

- one Lark-backed and one Jira/Confluence-backed fixture produce the same normalized contract;
- missing permissions are reported without leaking secrets;
- explicit references work without broad search access;
- source URLs and timestamps survive into the final report.

## 12. M6 — Runtime and staging evidence

### Goal

Add behavioral evidence without turning the project into a browser-testing platform.

### Initial evidence sources

- existing CI test summaries;
- JUnit or similar machine-readable test reports;
- Playwright result metadata and trace/artifact links;
- API smoke-test output;
- explicitly supplied staging URL metadata;
- optional evidence obtained by the user's existing Playwright/browser MCP.

### Boundaries

- the core does not manage browsers in v1;
- the core does not store screenshots or traces unless asked to reference local artifacts;
- runtime facts remain distinct from documentation and code evidence;
- failed access is `inconclusive`, not a product failure;
- destructive or production actions are prohibited by default.

### Exit criteria

- runtime evidence can be linked to the requirement and change IDs;
- reports identify which behaviors were observed and which were not exercised;
- staging outages do not become false implementation findings;
- artifact size remains bounded.

## 13. M7 — Public beta hardening

### Goals

- make installation predictable;
- validate security and failure modes;
- gather real pilot feedback;
- document extension points.

### Deliverables

- package publishing workflow;
- installation guides for priority Hosts;
- GitHub and generic CI templates;
- sample repositories and fixtures;
- adapter authoring guide;
- threat model;
- privacy and telemetry statement;
- contribution guide;
- compatibility matrix;
- changelog and versioning policy.

### Pilot plan

Recruit 3 to 5 teams representing:

1. documentation kept entirely in the repository;
2. Jira or Lark as the main requirement source;
3. a team with a deployed staging Web/API environment.

Run in advisory mode for multiple weeks before considering gates.

### Beta exit metrics

- median setup time to first report;
- successful run rate;
- report duration and context size;
- percentage of findings with valid evidence references;
- accepted/confirmed finding rate;
- dismissed/false-positive rate;
- inconclusive rate by cause;
- number of teams keeping the CI job enabled after the pilot;
- cross-Host schema compatibility.

The exact thresholds should be frozen after baseline data from the first fixtures and pilots.

## 14. M8 — v1 stabilization

### Goals

- freeze stable public contracts;
- provide a supported upgrade path;
- document known limitations.

### Release requirements

- evidence bundle schema versioned and migration-tested;
- finding/report schema versioned and migration-tested;
- stable CLI and MCP tool names;
- reproducible package build and provenance;
- no high-severity unresolved security findings;
- CI examples verified from clean environments;
- compatibility matrix current;
- project license and contribution process finalized;
- at least one external documentation adapter proven in a real pilot;
- advisory mode documented as the default.

## 15. Post-v1 candidates

These items remain explicitly deferred:

- opt-in merge gates based on validated policies;
- remote MCP transport and team-hosted deployment;
- cached/local encrypted evidence index;
- additional adapters for DingTalk, Notion, Linear, Azure DevOps, and internal systems;
- policy packs for regulated domains;
- signed review attestations;
- historical drift trends;
- feedback learning from accepted and dismissed findings;
- optional draft documentation updates;
- richer cross-repository dependency graphs.

Each candidate requires separate authorization and design review before entering scope.

## 16. Cross-cutting workstreams

### Security

- least privilege;
- output path confinement;
- command argument safety;
- credential redaction;
- untrusted-document handling;
- network and timeout controls;
- dependency and supply-chain review.

### Reliability

- deterministic normalization;
- cancellation and timeouts;
- partial-result handling;
- retry only for safe reads;
- explicit inconclusive state;
- stable error taxonomy.

### Quality and evaluation

- fixture corpus;
- known-drift ground truth;
- repeated-run variance measurement;
- precision-oriented scoring;
- Host/model comparison without coupling core behavior to a model.

### Developer experience

- one-command local startup;
- diagnostics that identify Host, adapter, permission, and schema failures;
- minimal configuration with documented defaults;
- examples for common document layouts;
- adapter SDK and templates after the core contract stabilizes.

## 17. Dependency sequence

```text
M0 foundation
  -> M1 Host/protocol spike
    -> M2 deterministic evidence
      -> M3 Agent/report contract
        -> M4 advisory CI
        -> M5 external documents
          -> M6 runtime evidence
            -> M7 public beta
              -> M8 stable v1
```

M4 and M5 may proceed in parallel after M3. Runtime evidence should wait until static evidence and report contracts are stable.

## 18. Immediate backlog

The next implementation session should begin with these tasks:

1. Choose package name and license.
2. Scaffold TypeScript package and test runner.
3. Add a stdio MCP entry point with protocol-safe logging.
4. Implement a deterministic fixture tool.
5. Create Host smoke-test scripts/configuration examples.
6. Define `EvidenceItem`, `ChangeScope`, `ReviewBundle`, and `Finding` schemas.
7. Add the first Git fixtures before implementing Git collection.
8. Record M1 compatibility results in the roadmap and memory.

Progress as of 2026-07-22:

| Item | Status |
|---|---|
| Package name and license | Apache-2.0 confirmed; public package name remains under review |
| TypeScript package and test runner | Complete |
| stdio entry point and protocol-safe logging | Complete |
| deterministic fixture tool | Complete |
| Host smoke scripts/configuration | Complete; external Host matrix still in progress |
| Core evidence/finding schemas | Blocked by the remaining M1 Host fixture checks |
| Git fixtures | Blocked by the remaining M1 Host fixture checks |
| M1 compatibility record | In progress in `docs/smoke-tests/RESULTS.md` |

No external document credentials or staging access are needed before M2 is complete.
