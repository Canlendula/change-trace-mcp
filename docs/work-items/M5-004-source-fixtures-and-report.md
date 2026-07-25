# M5-004 — Prove source fixtures and final-report provenance

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M5 — External documentation adapters`
- Base commit: `13167b918017c9be37488e1d9472ffa0907beeac`
- Branch: `codex/M5-004-source-fixtures-and-report`
- Worktree:
  `D:\projects\change-trace-worktrees\M5-004-source-fixtures-and-report`
- Push task branch: `no`
- Objective: complete the M5 implementation exit proof with deterministic
  Lark/Feishu and Jira/Confluence command-adapter fixtures, preserve their
  source identity and timestamps through the full stdio pipeline into final
  reports, and publish bounded setup guidance.
- Dependencies: accepted M5-001 through M5-003 and Decisions 23–26.

### Coordinator-owned report contract

`Report` gains a required `evidenceSources` array derived from every retained
`ReviewBundle.evidenceItems` entry in existing bundle order. The array is
bounded to 10,000 entries and each strict entry contains:

- `evidenceId`;
- `type`;
- the complete `source` reference, including nullable `uri`;
- `retrievedAt`;
- nullable `contentHash`;
- `relatedChangeIds`;
- `trustLevel`;
- `redactions`;
- optional `externalProvenance`.

The external provenance remains the accepted strict object with adapter
ID/name/version, source type, title, and nullable source update time.

The catalog deliberately excludes `excerpt` and `selectionReason`. Final
reports must preserve traceability without duplicating external document
content or prompt-injection-shaped excerpts.

`writeReport` always emits the complete catalog in JSON and a deterministic
`Evidence Sources` section in Markdown, including when there are no findings.
Dynamic titles and values use existing containment helpers. A source URI is
rendered as an escaped code literal, never converted into an active Markdown
link. Missing-evidence Markdown also includes the nullable source URI when
present.

This is an intentional provisional M5 report-schema addition under Decision
26. Keep `schemaVersion: "1.0.0"` until M8. Existing M3 bundle IDs and replay
hashes must not change.

### Coordinator-owned source-fixture contract

The two new fixture adapters are deterministic local command processes that
implement the accepted M5-001 stdin/stdout contract. They do not call live
vendor APIs and do not establish live compatibility claims.

The Lark/Feishu fixture:

- accepts one explicit document reference;
- preserves a document/block locator and canonical HTTPS URI;
- returns a title, source update time, retrieval time, and bounded excerpt;
- includes injection-shaped text and a secret-shaped value in the excerpt so
  forced `untrusted_external` handling and redaction can be demonstrated.

The Jira/Confluence fixture:

- accepts explicit Jira issue, Confluence linked-page, and Confluence comment
  references in request order;
- returns available issue and page results with distinct canonical URIs and
  timestamps;
- returns `permission_denied` for the comment with a secret-shaped value in
  its message.

Both fixtures use the same generic request/response schemas and runner. No
search query, inferred key, organization scan, credential value, command,
environment field, trust value, or core evidence ID appears in MCP tool input.

The end-to-end integration test must use the built stdio server and public MCP
tools:

1. start with a Host-owned configuration containing the two fixture adapter
   registrations;
2. collect the Lark and Jira/Confluence references with
   `collect_external_evidence`;
3. build one bundle with `get_review_bundle`;
4. pass an empty deterministic finding submission through
   `validate_findings`;
5. write the final JSON/Markdown pair through `write_report`;
6. verify byte stability by repeating the same report input after removing the
   first pair.

The test must prove:

- both successful collections parse as the same
  `ExternalEvidenceCollection` contract;
- Lark, Jira, and Confluence source URIs, retrieval timestamps, source update
  timestamps, titles, and adapter identity survive in JSON and Markdown;
- the document/block locator and distinct issue/page/comment locators survive;
- permission denial becomes missing evidence and no secret sentinel survives
  MCP output, bundle, report JSON, report Markdown, or captured stderr;
- injection-shaped content remains only a redacted
  `untrusted_external` evidence excerpt and is absent from the final report
  catalog/report when no finding quotes it;
- no broad-search capability is needed or exposed.

### Coordinator-owned documentation contract

Add a packaged external-adapter guide and copyable JSON example. The guide
must explain:

- `CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE`;
- the strict configuration shape and hard bounds;
- `argv` is Host-owned and executes with `shell: false`;
- credential values remain in Host secret mechanisms while the file contains
  only allowlisted environment-variable names;
- the fixed JSON stdin/stdout protocol and safe stderr boundary;
- explicit-reference-only v1 behavior and deferred discovery/search;
- Lark and Jira/Confluence wrapper examples;
- external content is untrusted and permission failures are missing evidence;
- deterministic fixtures are contract proofs, not live vendor compatibility.

Update the README tool list, M5 status, call flow, schema list, and guide link.
Include the guide/example in the npm package without changing package version,
dependencies, scripts, engines, or release state.

## In scope

- Add the strict report evidence-source schema/type and public exports.
- Populate/render the report evidence-source catalog and missing-source URI.
- Add two deterministic source-specific command fixture adapters.
- Add a stdio end-to-end source fixture test.
- Extend report/schema/replay tests for the new required field and containment
  behavior.
- Add the external-adapter guide, configuration example, README integration,
  and package file inclusion.
- Update only the worker-owned handoff section of this file.

## Out of scope

- Live Lark, Feishu, Jira, or Confluence network/API calls.
- Vendor SDKs, OAuth flows, credential provisioning, or production adapter
  binaries.
- Search, discovery, inferred keys, organization indexing, or repository text
  inference.
- New MCP tools, changes to adapter request/response contracts, changes to the
  external runner/normalizer, or changes to bundle construction.
- Model/Agent execution or semantic compatibility claims.
- New dependencies, package version changes, npm/GitHub releases, CI workflow
  changes, or release publication.
- Roadmap, project decisions, milestone status, global backlog, governance, or
  coordinator review edits.

## Allowed paths

- `src/schemas/report.ts`
- `src/schemas/index.ts`
- `src/reports/write-report.ts`
- `tests/unit/report-schema.test.ts`
- `tests/unit/report-write.test.ts`
- `tests/unit/json-schema.test.ts`
- `tests/unit/review-replay.test.ts`
- `tests/fixtures/external-adapter/m5-lark-fixture.mjs`
- `tests/fixtures/external-adapter/m5-jira-confluence-fixture.mjs`
- `tests/integration/external-source-fixtures.test.ts`
- `docs/external-adapters/README.md`
- `docs/external-adapters/config.json.example`
- `README.md`
- `package.json`, limited to adding `docs/external-adapters` to `files`
- `docs/work-items/M5-004-source-fixtures-and-report.md`, worker handoff only

Reading other source, test, fixture, workflow, and documentation files is
allowed. Writing outside this list is not.

## Coordinator-only paths

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- assignment/acceptance criteria and coordinator-review sections of this file
- `.github/**`
- `package-lock.json`
- all package version, tag, release, publish, and dist-tag state

## Acceptance criteria

- [ ] `Report.evidenceSources` is required, strict, bounded, deterministic, and
      contains every retained bundle evidence source in bundle order.
- [ ] Each catalog entry preserves the exact required core and optional
      external provenance fields, while excluding excerpt/document content.
- [ ] JSON and Markdown preserve canonical source URIs, retrieval timestamps,
      external source update times, titles, source types, and adapter identity.
- [ ] Markdown renders untrusted URIs as escaped code literals and safely
      contains titles, locators, and other dynamic values.
- [ ] Missing-evidence Markdown preserves nullable URIs without leaking an
      unredacted permission message.
- [ ] The deterministic Lark and Jira/Confluence command fixtures both satisfy
      the shared adapter/collection schemas through the stdio MCP path.
- [ ] Lark document/block, Jira issue, Confluence page, and denied-comment
      source identities and timestamps survive the complete pipeline.
- [ ] Permission denial is structured and all secret sentinels are absent from
      tool output, bundle, reports, and stderr.
- [ ] Injection-shaped fixture text remains redacted, external, and untrusted;
      it is not copied into the zero-finding final report.
- [ ] Fixture requests are explicit-reference-only and no search/discovery
      input or capability is introduced.
- [ ] Identical final inputs write byte-identical report pairs; existing M3
      review bundle IDs/replay hashes and M1 compatibility bytes remain stable.
- [ ] The external-adapter guide/example and README accurately document the
      public boundary and are included by npm pack.
- [ ] Focused tests, type checking, two consecutive full suites, stdio smoke,
      deterministic CI smoke, package dry-run, diff checks, and a clean
      worktree pass.
- [ ] No live vendor access, dependency, lockfile, version, CI workflow,
      Roadmap, decision, release, or npm state change occurs.

## Required validation

```text
npx vitest run tests/unit/report-schema.test.ts tests/unit/report-write.test.ts tests/unit/json-schema.test.ts tests/unit/review-replay.test.ts tests/integration/external-source-fixtures.test.ts tests/integration/external-evidence-stdio.test.ts tests/integration/stdio.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run smoke:ci
npm run pack:check
git diff --check 13167b918017c9be37488e1d9472ffa0907beeac..HEAD
git status --short
```

The worker may run additional focused checks. It must report exact commands,
results, fixture source inventory, report assertions, and any transient
failure. A command that fails is not omitted from the handoff.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task,
   Decisions 23–26, the M5 schemas/runner/tool/bundle path, report
   schema/writer/tests, package files, README, and relevant stdio helpers.
2. Confirm the isolated worktree, branch, exact base relationship, and clean
   status.
3. Write failing report catalog, source-fixture, security, and documentation
   package assertions before production implementation.
4. Implement the smallest report schema/writer change, deterministic fixture
   adapters, e2e path, and documentation satisfying the frozen contracts.
5. Audit the complete diff for excerpt duplication, Markdown/URI injection,
   secret leakage, search/discovery fields, live/vendor access, nondeterministic
   time/order, schema drift, M3 replay hash drift, and out-of-scope files.
6. Run the required validation, then update only the worker-owned handoff.
7. Commit implementation/tests/docs and the handoff. Leave the worktree clean
   and report `ready_for_review`, `blocked`, or `needs_decision`.

## Escalate when

- the required report catalog cannot be added without changing another public
  schema, adapter contract, bundle identity, or schema version;
- the fixtures require live access, credentials, search/discovery, a new
  dependency, or runner/normalizer/server changes;
- existing M3 bundle IDs/replay hashes or M1 fixture bytes change;
- a required documentation file cannot be packaged without broader package
  metadata/lockfile changes;
- a path outside the allowlist must change;
- any secret-shaped value survives an intended security boundary.

## Worker handoff — worker owned

- Status: `in_progress`
- Implementation commit(s):
- Branch head:

### Implementation summary

- Pending.

### Changed areas

- Pending.

### Validation

- Pending.

### Fixture and final-report evidence

- Pending.

### Public contract and documentation impact

- Pending.

### Deviations from assignment

- None reported.

### Known limitations and risks

- Pending.

### Decisions or questions for coordinator

- None reported.

### Protected-file confirmation

- [ ] Coordinator-only files were not modified by the worker.
- [ ] No dependency, lockfile, version, live external-system, CI, release, or
      npm-state change was performed.
- [ ] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending`
- Reviewed branch head:
- Integration commit:

### Review findings

- Pending.

### Required follow-up

- Pending review.

### Roadmap and release impact

- M5 remains in progress until all milestone exit criteria pass.
