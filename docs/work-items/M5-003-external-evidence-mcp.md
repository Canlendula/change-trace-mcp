# M5-003 — Configure, collect, and bundle external evidence

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M5 — External documentation adapters`
- Base commit: `e4b2fd1c8b677596578c8ef3e84c525137c69eea`
- Branch: `codex/M5-003-external-evidence-mcp`
- Worktree:
  `D:\projects\change-trace-worktrees\M5-003-external-evidence-mcp`
- Push task branch: `no`
- Objective: make the accepted external adapter runner usable from the stdio
  package through one Host-owned registration file, add the read-only
  `collect_external_evidence` MCP tool, and merge normalized external evidence
  and missing-access records into deterministic review bundles.
- Dependencies: accepted M5-001/M5-002 and Decisions 23–25.

### Coordinator-owned registration contract

`CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE` is the only CLI discovery input. When
absent, startup succeeds with no configured adapters. When present, it points
to one strict JSON object:

```json
{
  "schemaVersion": "1.0.0",
  "adapters": []
}
```

The file is read once before server creation and must:

- be a regular, non-symbolic-link file;
- be at most 262,144 bytes;
- be valid UTF-8 under fatal decoding;
- contain exactly one JSON value;
- contain no unknown fields;
- contain at most 16 accepted M5-002 registrations;
- contain unique adapter IDs.

It contains no credential values. Registration argv and environment-name
allowlists remain Host-owned configuration and never enter MCP tool input or
tool output.

Loader errors expose one of these stable codes and a static bounded message:

- `configuration_path_invalid`;
- `configuration_read_failed`;
- `configuration_file_unsafe`;
- `configuration_file_too_large`;
- `configuration_encoding_invalid`;
- `configuration_json_invalid`;
- `configuration_schema_invalid`;
- `configuration_adapter_id_duplicate`.

They cannot contain the file path, file content, argv, environment
names/values, or credentials.

Library callers may use `createServer({ externalAdapters })` with the same
validated registrations. Duplicate/invalid programmatic registrations fail
before tool execution.

### Coordinator-owned MCP contract

`collect_external_evidence`:

- uses the accepted M5-001 request schema unchanged;
- is always registered;
- selects only an exact configured adapter ID;
- invokes the accepted M5-002 runner without changing its process environment
  or error boundary;
- returns `ExternalEvidenceCollection` on success;
- returns a bounded MCP error with only
  `collect_external_evidence_failed` plus `adapter_not_configured` or one
  accepted runner error code;
- is annotated read-only, non-destructive, idempotent, and
  `openWorldHint: true`.

Unknown adapter IDs must not execute a process. Tool descriptions cannot imply
that external content is trusted or that search/discovery is available.

### Coordinator-owned bundle contract

`get_review_bundle` gains a bounded
`externalEvidenceCollections` input, defaulting to `[]`, with at most 16
accepted collections.

The builder:

- validates that every external `relatedChangeId` exists in the supplied
  `ChangeScope`;
- adds external items after local document evidence and before generic
  `additionalEvidenceItems` and generated Git evidence;
- adds structured external missing evidence in collection/request order;
- preserves `externalProvenance`, canonical URI, retrieval time, trust,
  redactions, selection reasons, and source update time;
- applies the existing bundle item, excerpt, missing-evidence, and truncation
  limits;
- keeps existing non-external bundle IDs and replay hashes byte-identical;
- includes structured external provenance in bundle identity when present, so
  a title, source update time, source type, or adapter identity/version change
  changes an external bundle ID.

### In scope

- Add the strict registration-file schema, typed safe loader errors, and
  bounded synchronous or asynchronous loader used before server creation.
- Extend `createServer` with validated programmatic external registrations.
- Load the optional registration file in the CLI before `createServer`.
- Register and implement `collect_external_evidence`.
- Add external collections to the review-bundle input/builder.
- Export the configuration schema/loader types and functions needed by library
  callers.
- Update the stdio smoke/tool-list expectations for the new tool while
  preserving the byte-identical M1 compatibility fixture.
- Add focused tests for:
  - missing env/file path behavior;
  - valid empty and populated config;
  - size, symlink, non-file, read, invalid UTF-8, invalid JSON, strict schema,
    duplicate ID, and secret-safe error cases;
  - library registration validation;
  - tool discovery annotations;
  - configured success and unknown-adapter non-execution;
  - safe runner error projection;
  - external evidence and missing-evidence bundle merge;
  - unknown change IDs, duplicate/conflicting evidence IDs, ordering, bounds,
    truncation, provenance survival, external bundle identity changes, and
    existing replay/hash stability.

### Out of scope

- Report schema/rendering changes or final-report provenance presentation.
- Lark/Jira/Confluence-specific fixture adapters, live credentials, network
  calls, browser access, discovery/search, issue-key inference, or vendor SDKs.
- Writing or modifying the registration file from an MCP tool.
- Credential values in registration files or MCP input.
- Process runner behavior changes except a defect required by integration and
  explicitly escalated.
- Runtime evidence, caching, retries, response repair, platform comments,
  dependencies, lockfile, package version, Roadmap, decisions, governance, CI,
  release, or npm state.

### Allowed paths

- `src/schemas/external-adapter-config.ts`
- `src/schemas/index.ts`
- `src/evidence/external/load-external-adapters.ts`
- `src/evidence/external/index.ts`
- `src/evidence/bundle/build-review-bundle.ts`
- `src/evidence/bundle/index.ts`
- `src/evidence/index.ts`
- `src/server.ts`
- `src/cli.ts`
- `scripts/smoke-stdio.mjs` — only if its tool-list contract requires update
- `tests/fixtures/external-adapter/**`
- `tests/unit/external-adapter-config.test.ts`
- `tests/unit/review-bundle.test.ts`
- `tests/integration/external-evidence-stdio.test.ts`
- `tests/integration/stdio.test.ts`
- `tests/integration/advisory-host.test.ts` — only an obsolete exact tool-list
  expectation exposed by this additive MCP tool
- `docs/work-items/M5-003-external-evidence-mcp.md` — Worker handoff only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- this task's Assignment and Coordinator review sections
- `.github/**`
- `src/evidence/external/run-external-adapter.ts`
- `src/schemas/evidence.ts`
- `src/schemas/external-adapter.ts`
- `src/schemas/external-evidence.ts`
- `src/schemas/external-provenance.ts`
- `src/reports/**`
- `src/schemas/report.ts`
- `package.json`
- `package-lock.json`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The optional Host-owned file is bounded, strict, fatal-UTF-8, regular,
      non-symlink, duplicate-free, and loaded only at startup.
- [ ] Loader and startup errors are stable and contain no path, config, argv,
      environment, credential, or document content.
- [ ] No credential value, registration, argv, environment field, config path,
      search query, or trust value appears in MCP tool input/output.
- [ ] `collect_external_evidence` is always discoverable with the required
      annotations and executes only an exact configured adapter ID.
- [ ] Unknown adapter and runner failures return only bounded safe codes.
- [ ] Successful stdio collection returns the accepted normalized external
      collection with forced untrusted provenance and redaction.
- [ ] Review bundles preserve external items and missing evidence, reject
      unknown related change IDs, and apply existing bounds deterministically.
- [ ] Existing non-external bundle IDs/replay hashes and the M1 compatibility
      fixture remain unchanged.
- [ ] External provenance changes affect external bundle identity.
- [ ] Focused tests, type checking, two consecutive full-suite runs, stdio
      smoke, package dry-run, diff checks, and clean worktree checks pass.
- [ ] No report, source-specific/live adapter, search, runner, dependency,
      version, Roadmap, decision, CI, release, or npm state change occurs.

### Required validation

```text
npx vitest run tests/unit/external-adapter-config.test.ts tests/integration/external-evidence-stdio.test.ts tests/unit/review-bundle.test.ts tests/integration/stdio.test.ts tests/unit/review-replay.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run pack:check
git diff --check e4b2fd1c8b677596578c8ef3e84c525137c69eea..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task,
   Decisions 23–25, the M5 Roadmap section, accepted M5-001/M5-002, CLI/server,
   bundle builder/schema, stdio tests, replay hashes, logger, and redaction.
2. Confirm the isolated worktree, branch, and exact base relationship.
3. Write failing loader, MCP, bundle, and stability tests before production
   implementation.
4. Implement the smallest loader, server/CLI, tool, and bundle changes
   satisfying the contract.
5. Audit the complete diff for config/path/content disclosure, symlink or size
   bypass, non-fatal decoding, startup ambiguity, command/config fields in MCP
   schemas, unconfigured process execution, unsafe error projection, lost
   provenance/missing evidence, unknown change links, bound/order drift,
   existing replay hash changes, and out-of-scope report/source work.
6. Run every required validation and review the complete base diff.
7. Update only the Worker handoff section, commit all output, leave the
   worktree clean, and report `ready_for_review`.

### Escalate when

- a credential value, registration, argv, environment field, config path,
  search query, or trust value must enter MCP input/output or a log;
- an accepted M5-002 runner/process behavior must change;
- existing non-external bundle IDs or M3 replay hashes change;
- report, vendor-specific, network, dependency, version, or another path
  outside the allowlist is required;
- safe startup cannot be achieved without printing the config path/content;
- a product decision beyond Decisions 23–25 is required.

## Worker handoff — worker owned

- Status: `not_started`
- Handoff branch:
- Implementation commits:

### Implementation summary

- Pending.

### Changed areas

- Pending.

### Validation

- Pending.

### Public contract and documentation impact

- Pending.

### Deviations from assignment

- None recorded.

### Known limitations and risks

- Pending.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [ ] Coordinator-only files were not modified by the worker.
- [ ] No version, dependency, tag, publish, live external-system, CI, or
      release action was performed.
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
