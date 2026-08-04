# Change Trace MCP Development Roadmap

> Initial roadmap: 2026-07-22
> Status: M7 in progress; M7-001 through M7-014 accepted; real multi-team, multi-week pilot evidence remains
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
| M1 — Protocol spike | `npx` stdio MCP works across target Hosts and a clean cloud runner | Three Agent Hosts, the reference client, and GitHub Actions pass |
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
- M1 completed on 2026-07-22. The TypeScript package, stdio entry point, protocol-safe
  logger, diagnostic tool, deterministic fixture tool, reference-client tests,
  package smoke test, and Host configuration examples are implemented.
- The official SDK reference client, Codex, Claude Code, and OpenCode pass
  initialization, tool discovery, and byte-identical fixture calls. A clean
  GitHub Actions Ubuntu runner also passed while launching the published
  package from npm.
- GitHub Copilot Code Review execution is deferred to M4 because its paid Host
  entitlement is unavailable. Its repository MCP configuration is saved, but
  no compatibility claim will be made without a real tool-call session log.
- Detailed, dated compatibility evidence is maintained in
  [`docs/smoke-tests/RESULTS.md`](smoke-tests/RESULTS.md).
- The revised M1 hard gate is satisfied.
- M2 is complete. Strict schemas and deterministic JSON Schema exports cover
  change scope, local evidence, review bundles, and findings. The read-only
  `get_change_scope`, `collect_local_evidence`, and `get_review_bundle` tools
  pass unit and MCP stdio integration tests. Required rename, deletion, binary,
  submodule, oversized, confinement, symlink, UTF-8 truncation, and secret
  redaction cases pass.
- M3 completed on 2026-07-25. Finding validation, bounded Markdown/JSON report
  writing, nine review fixtures, a deterministic replay/scorer workflow, and
  the compact Host-neutral review instruction are implemented.
- The final instruction `1.4.0` replay passed 9 of 9 fixtures on Codex Desktop,
  Claude Code, and OpenCode. Each Host produced 6 valid findings with zero
  rejected or warned findings; all no-finding and missing-evidence controls
  passed. Exact scores and reproducibility hashes are recorded in
  [`docs/evaluation/M3_RESULTS.md`](evaluation/M3_RESULTS.md).
- M4 completed on 2026-07-26. The accepted provider-neutral path supplies a
  generic advisory runner, generic CI template, caller-supplied Host example,
  bounded artifacts, and a manual deterministic GitHub orchestration smoke.
  Final GitHub run `30168292163` passed attempts 1 and 2 with no annotations;
  the attempt-2 sidecar records the expected rerun identity and
  `completed_no_findings`. No semantic model/Host claim was added.
- M5 completed on 2026-07-26. The strict shared protocol, bounded command
  runner/normalizer, Host-owned startup configuration,
  `collect_external_evidence`, deterministic review-bundle merge,
  Lark/Jira/Confluence contract fixtures, final-report evidence catalog, and CI
  catalog guard are accepted.
- Decisions 23–26 fix the explicit-reference security boundary, structured
  external provenance, startup registration, and final-report catalog.
  Local gates passed twice at 27 files / 265 tests. Replacement Ubuntu run
  `30172390638` passed and its downloaded report parsed with the current
  `reportSchema`; detailed failure and replacement evidence is recorded in
  [`docs/evaluation/M5_RESULTS.md`](evaluation/M5_RESULTS.md).
- M6 started on 2026-07-26. Decision 27 selects a strict normalized runtime
  manifest for pre-produced evidence and keeps test execution, browser
  management, active probing, and vendor-private report objects outside the
  core. M6-001 is accepted: the strict manifest, provenance, normalized
  collection, core runtime identity invariants, and deterministic JSON Schema
  exports pass 282 tests. Decision 28 fixes M6-002 as a single explicit,
  repository-confined manifest reader with safe normalization and no subject
  execution. M6-002 is accepted: the ninth MCP tool passes the confined-file,
  redaction, normalization, stdio, and package gates at 322 tests. Decision 29
  fixes M6-003 relationship, unavailable-provenance, bundle-identity, and
  final-report behavior. M6-003 is accepted: its strict runtime bundle/report
  paths pass 332 tests while preserving all nine frozen M3 replay digests and
  the M1 fixture. Decision 30 fixes M6-004 as pinned offline mapping fixtures
  and a complete stdio exit proof; general converters and live staging remain
  outside the milestone claim.
- M6 completed on 2026-07-26. The four offline profiles traverse the complete
  built-stdio change/document/runtime/bundle/validation/report path, preserve
  observed and unavailable provenance, and pass two coordinator full suites
  at 32 files / 340 tests. No GitHub Actions run, dependency, version, tag,
  publish, or release action was created. Detailed evidence is recorded in
  [`docs/evaluation/M6_RESULTS.md`](evaluation/M6_RESULTS.md).
- M7-001 completed on 2026-07-26. The packaged security policy, threat model,
  privacy/telemetry statement, security review, and executable control
  inventory cover all nine tools and six operational surfaces. The accepted
  baseline records two open medium findings, one open low limitation, and one
  accepted informational local-stdio limitation. Its strict source-import
  guard prevents unreviewed process/network module boundaries. Coordinator
  gates pass at 33 files / 344 tests; no product behavior, dependency, version,
  hosted CI, repository setting, publish, or release state changed.
- M7-002 completed on 2026-07-26. Fixed Git subprocesses now receive the
  Decision 32 allowlisted environment, and the five named MCP handlers plus
  three partial-success cases use fixed safe error projections. Both medium
  findings are mitigated; the low redaction limitation and informational
  no-sandbox boundary retain their prior dispositions. Coordinator gates pass
  at 35 files / 356 tests, with nine-tool stdio and local advisory-CI smokes,
  a 196-file package dry-run, and a zero-vulnerability production audit.
- M7-003 completed on 2026-07-26. A reusable one-tarball smoke now proves a
  copied installation in an isolated consumer, production dependency
  resolution, installed-Node and local-tarball npx launches, the exact
  nine-tool surface, and the byte-stable M1 fixture. Codex, Claude Code, and
  OpenCode v1/v2 configuration examples use exact-version placeholders and
  make no live-Host claim. Coordinator gates pass at 36 files / 368 tests with
  one Windows-inapplicable POSIX termination test skipped; the production
  audit reports zero vulnerabilities.
- M7-004 completed on 2026-07-26. One exact local tarball and installation
  exposed the frozen nine tools and byte-identical fixture in fresh Codex
  Desktop `26.707.3748.0`, Claude Code `2.1.217`, and OpenCode `1.18.4`
  sessions. Claude Code and OpenCode closed automatically. Codex Desktop kept
  its MCP process after turn completion and archive; the exact temporary-state
  pair was explicitly terminated and the final orphan count was zero, so the
  accepted claim records Host-held lifecycle behavior rather than graceful
  one-shot shutdown. Coordinator gates pass at 37 files / 386 tests with two
  Windows-inapplicable POSIX skips, and the production audit reports zero
  vulnerabilities. Detailed evidence is in
  [`docs/evaluation/M7_HOST_RESULTS.md`](evaluation/M7_HOST_RESULTS.md).
- M7-005 was accepted on 2026-07-26. The 204-file npm artifact now packages
  only the provider-neutral advisory runner and summarizer plus the complete
  CI documentation tree and deterministic mechanics-only fixture. The clean
  install runs the installed runner and installed fixture from one local
  tarball, producing `completed_no_findings` and exactly three managed
  artifacts. Executable POSIX guards reject floating package selectors,
  nested tooling/subject roots, and pre-populated package manifests. GitHub
  and GitLab retain immutable-commit guidance while the portable mapping
  requires a protected exact published SemVer. No hosted CI, inference,
  credential, version, publication, tag, release, or dist-tag action occurred.
- M7-006 was accepted on 2026-07-26. The npm artifact now includes public
  contribution, changelog, package/Schema versioning, external-adapter
  authoring, and runtime-converter authoring guidance. The installed-package
  proof freezes all required README navigation, rejects internal governance
  and work-item files, preserves the exact nine-tool/M1/CI contracts, and
  removes its temporary root. The public guidance keeps package, Schema,
  adapter, converter-profile, instruction, compatibility, registry, dist-tag,
  Git-tag, GitHub-release, and milestone facts separate. No runtime contract,
  dependency, version, registry, tag, release, publish, or dist-tag state
  changed.
- M7-007 was accepted on 2026-07-26. A manual-only GitHub workflow separates
  a credential-free dry-run job from a repository-variable- and
  environment-guarded OIDC job that can only stage `next`. The future trusted
  publisher is documented as stage-only and remains unconfigured. The local
  helper uses a narrow child environment, exact temporary npm configuration,
  fail-closed public-version lookup, one bounded tarball, and non-mutating
  `npm publish --dry-run`. Coordinator review passes at 41 files / 400 tests
  with two Windows-inapplicable POSIX skips. No hosted run, authentication,
  trusted-publisher/environment/variable change, stage, approval,
  publication, tag, release, or dist-tag action occurred.
- M7-008 was accepted on 2026-07-26. The repository-only pilot kit freezes
  opt-in onboarding, weekly operation, safety stops, offboarding, bounded
  privacy-minimized observations, and deterministic baseline metrics without
  setting thresholds. The synthetic three-profile fixture proves mechanics
  only. Coordinator validation passes 406 tests with two intentional POSIX
  skips after excluding one pre-existing Windows CRLF-only assertion; the focused
  contract tests, 209-file package boundary, exact nine-tool/M1/CI smokes,
  clean install, temporary cleanup, and production audit pass. No team was
  contacted, no real observation was created, and no Host/model, hosted
  workflow, credential, package, version, threshold, compatibility, registry,
  tag, release, or publication state changed.
- M7-009 was accepted on 2026-07-26. The M7-007 repository-text test helper
  now normalizes ordinary Windows CRLF checkouts to LF before running every
  unchanged release workflow safety assertion. Coordinator validation passes
  all 43 files at 407 tests with the two existing Windows-inapplicable POSIX
  skips. No workflow, `.gitattributes`, Git setting, product, package,
  dependency, public contract, external state, pilot, or release behavior
  changed.
- M7-010 was accepted on 2026-07-30. The packageable
  `change-trace-gitlab-reference` tree now provides a dependency-free
  operational baseline, planned-maintenance feature and documentation
  follow-up overlays, a synthetic `CTGR-001` Feishu template, and a
  credential-free deterministic GitLab CI mechanics path. Coordinator
  validation passes 44 files at 411 tests with the two existing
  Windows-inapplicable POSIX skips, a 220-file clean-install/package boundary,
  exact three-artifact CI smoke, and zero production vulnerabilities. The
  clean-install boundary permits only the reference baseline lockfile while
  retaining every other lockfile denial. No GitLab or Feishu object,
  authentication, hosted pipeline, model, credential, pilot, compatibility,
  package version, release, or publication state changed.
- M7-011 started on 2026-08-04 after the project owner created the public,
  empty `infinty081/change-trace-gitlab-reference` project and a title-only
  `CTGR-001` Feishu Wiki document. It is limited to materializing the accepted
  synthetic baseline, running the credential-free GitLab-hosted mechanics
  pipeline, and recording bounded job/artifact evidence. It does not authorize
  a model credential, semantic Agent, external-document retrieval, merge gate,
  pilot claim, package/release action, or M8.
- M7-011's first pipeline `2730064343` was stopped by GitLab before any job was
  created because the project owner's user account was not verified. After the
  owner completed verification, the deliberately created pipeline `2730157298`
  ran on the same baseline commit. `subject_test` passed on a GitLab-hosted
  Linux Runner; `change_trace_mechanics` checked out and built the immutable
  tooling commit, then failed with `invalid_run_attempt` because the real
  `CI_JOB_ID` (`15697682696`) exceeded the runner's undocumented `1_000_000`
  ceiling. No advisory artifact was produced. This failure led to the scoped
  M7-012 portability fix and remains preserved as diagnostic evidence. The
  observation is mechanics evidence, not a semantic or pilot result.
- M7-012 was accepted on 2026-08-04. The advisory runner now accepts strict
  decimal run-attempt values through `Number.MAX_SAFE_INTEGER`; the real GitLab
  job ID `15697682696` round-trips through the Host and status sidecar. Type
  checking, 63 focused tests, deterministic CI smoke, and the full 426-test
  suite passed with the two existing POSIX skips. The required production
  audit independently discovered three newly published transitive advisories
  in the unchanged lockfile: high-severity `fast-uri`, moderate-severity
  `hono`, and high-severity `ip-address` findings. M7-013 is assigned to perform
  a lockfile-only patch refresh within the existing direct dependency ranges.
  M7-011 did not materialize or run the new tooling commit until that audit was
  clean.
- M7-013 was accepted on 2026-08-04 with an exact lock-only delta:
  `fast-uri 3.1.4 -> 3.1.5`, `hono 4.12.31 -> 4.12.34`, and `ip-address
  10.2.0 -> 10.3.1`. Fresh script-disabled installation, the production tree,
  zero-vulnerability audit, type checking, deterministic CI smoke, all 426
  tests with two existing POSIX skips, and the 220-file clean-install/package
  boundary passed. Direct dependencies, `package.json`, source, tests, public
  contracts, versions, releases, and external state did not change. M7-014 is
  assigned to advance only the governed GitLab reference tooling pin and its
  contract assertion to this accepted, audited main state.
- M7-014 was accepted on 2026-08-04. The copyable GitLab reference now uses
  immutable tooling commit `49a07185c2af05ee8dcffe33b23355ce1dce8353`
  for its one fetch, detached checkout, and HEAD equality check. A first review
  requested stronger regression guards; the accepted test requires the new pin
  exactly three times, the historical pin zero times, and the exact same pin in
  all three commands. Coordinator validation passes 63 focused tests, CI smoke,
  production audit with zero vulnerabilities, all 426 tests with two existing
  POSIX skips, and the 220-file clean-install boundary. This authorized M7-011
  to materialize only the accepted YAML into one new subject commit and observe
  the resulting default-branch pipeline.
- M7-011 was accepted on 2026-08-04 after the exact M7-014 YAML became the sole
  subject change in commit `3b0461da6f18b82f1360d9b929d0ac34b630f67d`.
  Its single resulting push pipeline `2730344241` passed `subject_test` and
  advisory job `15698742079` on GitLab-hosted Linux Runners. The trace verified
  audited tooling commit `49a07185c2af05ee8dcffe33b23355ce1dce8353`,
  forwarded the real safe-integer job ID, and reported
  `completed_no_findings`. The downloaded archive contained exactly the three
  configured, seven-day artifacts; report schema, run/revision/count
  consistency, recorded sizes, and hashes all passed. The project retains
  exactly three pipelines, with no active or schedule-sourced pipeline, no
  duplicate for the accepted commit, and no retried job. This proves
  credential-free GitLab mechanics only;
  semantic Agent, authenticated Feishu retrieval, real pilot, release, and M8
  claims remain outside the acceptance.

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
  - GitHub Actions ephemeral runner;
  - optional GitHub repository MCP/Copilot Code Review environment.

### Questions to answer

- Does each Host start the process reliably?
- Are tool names and schemas interpreted consistently?
- How are timeouts and process termination handled?
- Can each Host pass a workspace path safely?
- Which Hosts support tools only, resources, and prompts?
- What setup is required on ephemeral CI runners?

### Exit criteria

- Codex, Claude Code, OpenCode, and the official SDK reference client can
  initialize the same MCP package and receive identical fixture JSON;
- a standard GitHub Actions runner can launch the published package and receive
  the same fixture JSON;
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

Completed on 2026-07-25:

- all three target Hosts passed the final nine-fixture replay at 9 of 9;
- all 18 submitted findings across the three Hosts were schema-valid and
  evidence-valid, with zero rejected or warned findings;
- identical ordered bundle digests were scored across all Hosts;
- the conforming implementation, intentional refactor, and malicious-content
  controls returned no findings on every Host;
- both materially missing-evidence controls returned bounded
  `other` / `inconclusive` / `investigate` findings on every Host;
- final prepared packets ranged from 10,876 to 12,417 bytes and produced no
  scorer input errors.

### Go/No-Go gate

Continue to external integrations only if the local fixture set reaches an acceptable precision threshold and review bundles remain small enough for routine use.

The quality gate recorded in
[`docs/PROJECT_DECISIONS.md`](PROJECT_DECISIONS.md#19-m3-cross-host-replay-quality-gate)
is satisfied. M4 advisory CI work may proceed. M5 remains eligible to proceed
in parallel after M3, while the user-selected milestone sequence continues
with M4.

## 10. M4 — Advisory CI integration

### Goal

Run the review after or alongside existing CI without changing the release path by default.

### Integration targets

1. GitHub Actions with a caller-supplied headless Agent Host;
2. optional platform-native Agent review with repository MCP configuration
   when an entitled pilot is available;
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
- the GitHub and generic examples do not require one bundled provider/model;
- failure of the advisory review does not fail the release pipeline by default;
- secrets are passed only to required MCP adapters;
- logs do not print credentials or full sensitive documents;
- reruns produce a new report with clear run metadata.

### Current status and decision gate

M4 completed on 2026-07-26 with its provider-neutral reference architecture.

- The Host-neutral advisory runner and generic CI path are implemented and
  tested.
- The trusted GitHub Actions/OpenCode workflow preserves credential and
  subject-code isolation, but its first live model run did not complete. The
  five MCP tool definitions exceed the free GitHub Models High-tier input
  allowance before evidence is added.
- A separate direct quality spike removed the MCP schemas and sent the exact
  accepted M3 packets to free GitHub Models `openai/gpt-4.1`. The first
  mandatory fixture passed; the second returned
  `inference_response_invalid`. The frozen gate stopped after two requests,
  made no retry, and failed.
- Automatic model inference is paused. Ordinary non-model quality checks remain
  active.
- The bounded live evidence is tracked in
  [`docs/evaluation/M4_GPT41_RESULTS.md`](evaluation/M4_GPT41_RESULTS.md).
- Official platform evidence now confirms caller-supplied Agent execution
  across GitHub Actions, GitLab External Agents, Bitbucket Agentic Pipelines,
  and generic/self-managed CI runners. Exact capabilities and restrictions are
  tracked in
  [`docs/evaluation/M4_CI_AGENT_LANDSCAPE.md`](evaluation/M4_CI_AGENT_LANDSCAPE.md).
- Decision 21 selects the provider-neutral advisory runner and caller-supplied
  Host. Change Trace will not provide a built-in free semantic reviewer.
- Semantic Host/model compatibility still requires the M3-derived quality
  gate. A deterministic CI Host may validate orchestration, artifacts,
  advisory isolation, and rerun metadata without creating a semantic
  compatibility claim.
- M4-005 replaced the active provider path with a manual, credential-free
  deterministic smoke and added the copyable caller-supplied Host example.
- Final run
  `https://github.com/Canlendula/change-trace-mcp/actions/runs/30168292163`
  passed attempts 1 and 2. Both attempts used the current full-SHA artifact
  action, uploaded exactly the three managed artifacts, and produced no
  annotations. The second downloaded sidecar records `runAttempt: 2`.
- The revised exit gate is satisfied. M5 may proceed without purchasing or
  certifying a model service.

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
- accept explicit document URLs/tokens and project-item identifiers in v1;
- defer search-based discovery to a separately configured, bounded capability
  after the explicit-reference path has pilot evidence;
- preserve document block/source identifiers in evidence references.

### Jira/Confluence strategy

- begin with explicit issue keys and page URLs;
- defer inferred keys from branch, commit, and PR text until after the
  explicit-reference path is validated in pilots;
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

### Completion evidence

- The Lark document/block fixture and the Jira issue, Confluence linked-page,
  and permission-denied comment fixtures traverse the same configured command,
  MCP collection, bundle, validation, and report path.
- External content remains `untrusted_external`; injection-shaped content is
  contained and secret-shaped values are redacted.
- Final JSON and Markdown preserve bounded source identity, URI, retrieval and
  update times, adapter identity, source type, trust, hash, and redaction
  metadata without copying evidence excerpts.
- Coordinator validation passed two consecutive 27-file / 265-test suites,
  stdio and CI smokes, type checking, and package dry-run.
- Ubuntu run `30172390638` passed from exact reviewed revision `65954cf` and
  uploaded a schema-valid three-file artifact with no annotations.
- Exact local, fixture, failed-audit, and replacement-run evidence is in
  [`docs/evaluation/M5_RESULTS.md`](evaluation/M5_RESULTS.md).

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

### Revised implementation strategy

M6 uses a strict normalized runtime manifest rather than exposing complete
JUnit, Playwright, CI-platform, or browser-MCP payloads as the core contract.
Converters remain bounded and format/version-specific.

The normalized boundary preserves:

- producer and input-format identity;
- test, API, browser, environment, or other runtime kind;
- executed outcome and nullable timing;
- non-production environment and source identity;
- related Git change IDs and related requirement/document evidence IDs;
- bounded summaries, artifact references, and truncation;
- explicit missing access without converting a staging outage into a product
  failure.

Implementation order:

1. strict manifest, provenance, and collection Schemas plus JSON Schema;
2. confined explicit-manifest collection and MCP integration;
3. review-bundle relationships/identity and final-report provenance;
4. JUnit, Playwright, API-smoke, and staging fixtures with end-to-end exit
   evidence, using the pinned offline mapping profiles in Decision 30.

The format evidence supporting this boundary is in
[`docs/evaluation/M6_RUNTIME_FORMAT_LANDSCAPE.md`](evaluation/M6_RUNTIME_FORMAT_LANDSCAPE.md).

### Exit criteria

- runtime evidence can be linked to the requirement and change IDs;
- reports identify which behaviors were observed and which were not exercised;
- staging outages do not become false implementation findings;
- artifact size remains bounded.

## 13. M7 — Public beta hardening

> Current state: in progress. M7-001 through M7-014 are accepted. The
> repository construction, local verification, and credential-free GitLab
> hosted mechanics slices are complete; real
> multi-team, multi-week pilot evidence remains. The original two medium
> security findings and the three newly published
> transitive advisories are mitigated. Clean package installation is
> reproducible, and the three priority local Hosts pass the exact installed
> fixture contract with Host-specific lifecycle evidence. The provider-neutral
> runner, bounded summarizer, GitHub/GitLab/portable examples, and
> mechanics-only fixture are packaged under Decision 35. The stage-only
> publishing workflow and non-publishing dry-run are accepted under Decision
> 37. The pilot kit, privacy-minimized observation contract, and deterministic
> baseline metric summarizer are accepted under Decision 38. Real multi-team,
> multi-week evidence remains required before M7 can complete.

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

### Construction sequence

M7 proceeds through bounded, reviewable slices:

1. publish the threat model, privacy/telemetry boundary, vulnerability
   reporting path, and an executable security-control inventory;
2. resolve any security finding that blocks installation or public-beta use;
3. prove clean installation and compatibility for the priority local Hosts;
4. package provider-neutral GitHub and generic CI examples plus sample
   fixtures;
5. complete adapter/converter authoring, contribution, changelog, and
   versioning guidance;
6. prepare and dry-run the package publishing workflow without treating a
   dry-run as release authorization;
7. establish the pilot kit and baseline metric schema, then gather real
   multi-team, multi-week advisory feedback.

The exact task count may expand when the security audit or clean-environment
checks find a bounded follow-up. Local fixtures can validate mechanics, but
they cannot satisfy the real-team pilot requirement.

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

The initial backlog and current progress are:

1. Choose package name and license.
2. Scaffold TypeScript package and test runner.
3. Add a stdio MCP entry point with protocol-safe logging.
4. Implement a deterministic fixture tool.
5. Create Host smoke-test scripts/configuration examples.
6. Define `EvidenceItem`, `ChangeScope`, `ReviewBundle`, and `Finding` schemas.
7. Add the first Git fixtures before implementing Git collection.
8. Record M1 compatibility results in the roadmap and memory.

Progress as of 2026-07-26:

| Item | Status |
|---|---|
| Package name and license | Complete; `change-trace-mcp@0.0.0-dev.0` published under Apache-2.0 |
| TypeScript package and test runner | Complete |
| stdio entry point and protocol-safe logging | Complete |
| deterministic fixture tool | Complete |
| Host smoke scripts/configuration | Complete; local Hosts and GitHub Actions cloud runner pass |
| Core evidence/finding schemas | Initial strict Zod and Draft 2020-12 contracts implemented |
| Git fixtures | Required basic, rename, deletion, binary, submodule, and oversized fixtures pass |
| Git change scope | Initial bounded implementation, edge coverage, and first hardening pass complete |
| Local evidence | Initial confined scanner, provenance, hashing, truncation, and secret redaction complete |
| Review bundle | Deterministic indexing, Git facts, missing evidence, and context limits complete |
| M2 exit gate | Complete; 39 tests plus stdio and package dry-run pass |
| Finding validation | Complete; schema normalization and bundle-reference enforcement pass unit and stdio integration tests |
| Report writing | Complete; confined deterministic Markdown/JSON output passes unit and stdio integration tests |
| M3 evaluation fixtures and scorer | Complete; nine fixtures, deterministic replay preparation, capture scoring, and summaries are tracked |
| M3 cross-Host exit gate | Complete; Codex Desktop, Claude Code, and OpenCode each pass 9 of 9 on instruction `1.4.0` |
| M4 advisory CI | Complete; provider-neutral runner/examples and two-attempt deterministic GitHub evidence accepted |
| M5 external documents | Complete; explicit-reference fixtures, final-report provenance, and replacement Ubuntu artifact audit pass |
| M6 runtime evidence | Complete; strict manifest collection, relationship-safe bundle/report provenance, and four pinned offline source profiles pass |
| M7 public beta hardening | In progress; M7-001 through M7-014 are accepted, credential-free GitLab hosted mechanics passes, and the real multi-team, multi-week pilot remains |
| M1 compatibility record | Complete in `docs/smoke-tests/RESULTS.md` |

M2 completed without external document credentials or staging access. Source is
prepared as `0.0.0-dev.1`; the published M1 compatibility artifact remains
`0.0.0-dev.0` until the next preview release is explicitly published.

M7 security hardening, clean installation, real priority-Host compatibility,
packaged provider-neutral CI examples, public extension/contribution/version
guidance, stage-only publishing workflow preparation/dry-run, pilot kit, and
baseline metric mechanics are accepted. Release-contract tests are
line-ending independent. The credential-free GitLab reference preparation is
accepted and its hosted mechanics execution is blocked on GitLab user
verification before job creation. The real multi-team pilot remains.
