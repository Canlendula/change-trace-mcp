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

- Status: `ready_for_review`
- Implementation commit(s):
  - `26276609f3f9b50da8b7bae0cdc7a63414eab0b9`
- Branch head: resolve the current
  `codex/M5-004-source-fixtures-and-report` head after the handoff commit; the
  handoff commit is intentionally not self-referenced.

### Implementation summary

- Added the required strict, 10,000-entry `Report.evidenceSources` catalog and
  public schema/type exports. The writer derives it from retained bundle
  evidence in bundle order and deliberately omits excerpts and selection
  reasons.
- Added deterministic Markdown rendering for every retained evidence source.
  Locators and nullable URIs use dynamic code spans, titles and other dynamic
  prose use existing containment helpers, and missing evidence now includes a
  nullable URI code literal.
- Added deterministic Lark/Feishu and Jira/Confluence command fixtures plus a
  built-stdio end-to-end test covering collection, bundle construction, empty
  finding validation, final report writes, secret containment, and repeated
  byte identity.
- Added the packaged external-adapter guide/configuration example and updated
  the README and package file list without changing version, dependency,
  script, engine, or release state.

### Changed areas

- `src/schemas/report.ts`, `src/schemas/index.ts`: report source schema, required
  catalog field, type, and public export.
- `src/reports/write-report.ts`: deterministic catalog projection, Markdown
  `Evidence Sources`, and missing-source URI rendering.
- `tests/unit/report-schema.test.ts`, `tests/unit/report-write.test.ts`,
  `tests/unit/json-schema.test.ts`: required/strict/bounded schema, JSON Schema,
  source ordering/content exclusion, arbitrary locator/URI containment, and
  report determinism. The unchanged replay test remains a required validation
  gate for accepted M3 digests.
- `tests/fixtures/external-adapter/m5-*.mjs`,
  `tests/integration/external-source-fixtures.test.ts`: source-specific generic
  command fixtures and complete public MCP proof.
- `docs/external-adapters/**`, `README.md`, `package.json`: Host configuration,
  fixed protocol, bounds, security model, call flow, schema/tool inventory, and
  package inclusion.

### Validation

- Test-first expected failures, before production implementation:
  - `npx vitest run tests/unit/report-schema.test.ts
    tests/unit/report-write.test.ts tests/unit/json-schema.test.ts`:
    exit 1, 8 failed / 41 passed because the catalog/schema/docs did not exist.
  - `npm run build; npx vitest run
    tests/integration/external-source-fixtures.test.ts`: build passed; test exit
    1, 1 failed because the final report had no `evidenceSources`.
- Transitional failures, all fixed:
  - the same three-unit-file command: exit 1, 3 failed / 46 passed due two JSON
    Schema `$ref` test expectations and one over-escaped title expectation;
    assertions were corrected to the actual safe reused-schema/code-span
    contract.
  - the required focused command followed by `npm run check`: focused 73/73
    passed; check exited 1 with two TS2352 test-only casts. Both were changed to
    explicit `unknown` narrowing.
- Final focused gates:
  - `npx vitest run tests/unit/report-schema.test.ts
    tests/unit/report-write.test.ts tests/unit/json-schema.test.ts
    tests/unit/review-replay.test.ts
    tests/integration/external-source-fixtures.test.ts
    tests/integration/external-evidence-stdio.test.ts
    tests/integration/stdio.test.ts`: 7 files, 74 tests passed.
  - `npm run check`: passed.
- Full-suite attempts:
  - `npm test`: exit 1, 240/241 passed; existing Windows 100 ms runner timeout
    test could not read `pid.txt` before process startup.
  - `npm test`: exit 1, 240/241 passed; same existing `pid.txt` race.
  - after removing unnecessary Git subprocesses from the new E2E,
    `npm test`: 27 files, 241/241 passed.
  - `npm test`: exit 1, 240/241 passed; same existing `pid.txt` race.
  - after adding the final arbitrary locator/URI containment test,
    `npm test`: 27 files, 242/242 passed.
  - `npm test`: exit 1, 241/242 passed; same existing `pid.txt` race.
  - Two consecutive full-suite passes were therefore not obtained. Per
    coordinator direction, the worker did not modify the out-of-scope runner
    or its test and stopped retrying; a separate reliability work item is
    planned before the integration gate.
- Remaining required commands:
  - `npm run smoke:stdio`: passed; all eight tools were listed and the exact M1
    compatibility fixture payload was preserved.
  - `npm run smoke:ci`: passed with
    `outcome=completed_no_findings code=ok` and `smoke=ok`.
  - `npm run pack:check`: passed; dry-run tarball contained
    `docs/external-adapters/README.md` and `config.json.example`.
  - `git diff --check
    13167b918017c9be37488e1d9472ffa0907beeac..HEAD`: passed after the
    handoff commit.
  - `git status --short`: clean after the handoff commit.

### Fixture and final-report evidence

- Lark/Feishu:
  - explicit `document:doc-release-42:block:block-7` with canonical HTTPS URI;
  - retrieval `2026-07-26T11:00:00.000Z`, update
    `2026-07-25T09:30:00.000Z`, contained untrusted Markdown-shaped title, and
    adapter identity/version survive JSON and Markdown;
  - injection-shaped excerpt remains `untrusted_external` in collection/bundle,
    its secret sentinel is redacted, and neither excerpt nor selection reason
    is duplicated into the zero-finding report.
- Jira/Confluence:
  - explicit Jira `issue:TRACE-42` and Confluence
    `page:release-requirements-42` results retain distinct URIs, titles,
    retrieval/update timestamps, source types, and adapter identity;
  - explicit denied comment
    `page:release-requirements-42:comment:denied-7` becomes inaccessible
    missing evidence with its URI and redacted reason.
- Both successful tool results parse with the same
  `ExternalEvidenceCollection` schema. The test confirms there is no search,
  discovery, command, environment, credential, or trust input field.
- `lark-fixture-secret-sentinel` and
  `confluence-permission-secret-sentinel` are absent from MCP results, bundle,
  final JSON, final Markdown, and captured server stderr.
- The report catalog IDs exactly match all retained bundle evidence IDs in
  order. Repeating the identical `write_report` input after deleting the first
  pair produces byte-identical JSON and Markdown.

### Public contract and documentation impact

- `Report.evidenceSources` is now required under provisional schema version
  `1.0.0`, as frozen by Decision 26. Each strict entry exposes only evidence
  identity, type, source, timestamps/hash, change links, trust, redactions, and
  optional external provenance.
- README documents the M5 pre-stable implementation state, the
  `collect_external_evidence` tool, optional external branch in the call flow,
  the expanded schema set, and the packaged guide.
- The guide defines the Host-owned configuration, all hard field/process
  bounds, `shell: false`, credential-name allowlisting, fixed JSON protocol,
  stderr containment, explicit-reference-only behavior, missing permissions,
  and the distinction between contract fixtures and live vendor compatibility.

### Deviations from assignment

- The required two consecutive full-suite passes were not achieved because the
  existing out-of-scope Windows runner timeout test intermittently checks for
  its PID file before the fixture process starts. Two individual final full
  suites did pass. The coordinator explicitly directed this worker not to
  modify the protected runner/test and to hand off the implementation with the
  transient evidence recorded.

### Known limitations and risks

- Deterministic fixtures prove the shared command/MCP/report contract only; no
  live Lark, Feishu, Jira, or Confluence compatibility is claimed.
- A denied adapter response includes `retrievedAt`, while the accepted
  normalized `MissingEvidence` contract carries source, reason, and status.
  The denied comment locator and URI survive the final report; changing that
  public missing-evidence contract was out of scope.
- The existing Windows 100 ms PID-file race must be hardened in a separate
  task before the coordinator can certify the consecutive integration gate.

### Decisions or questions for coordinator

- None. No public contract beyond Decisions 23–26 was required.

### Protected-file confirmation

- [x] Coordinator-only files were not modified by the worker.
- [x] No dependency, lockfile, version, live external-system, CI, release, or
      npm-state change was performed.
- [x] All intended handoff changes are committed to the task branch.

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
