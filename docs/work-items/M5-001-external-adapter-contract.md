# M5-001 — Define the external adapter protocol contract

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M5 — External documentation adapters`
- Base commit: `3cab00154ff5b1856d5553d620d64f89d5f68c9a`
- Branch: `codex/M5-001-external-adapter-contract`
- Worktree:
  `D:\projects\change-trace-worktrees\M5-001-external-adapter-contract`
- Push task branch: `no`
- Objective: define the strict, provider-neutral JSON request and response
  schemas shared by future generic, Lark, and Jira/Confluence adapters without
  adding process execution, credentials, discovery, or an MCP tool.
- Dependencies: accepted M2 evidence contracts, accepted M3 report contracts,
  completed M4, and Decisions 7, 10, 22, and 23.

### Coordinator-owned protocol contract

The external adapter request is a strict versioned object with:

- `schemaVersion`;
- one preconfigured `adapterId`;
- 1–100 explicit reference records, each containing a unique `requestId`,
  `sourceType`, `SourceReference`, bounded `relatedChangeIds`, and a bounded
  `relationReason`.

The initial `sourceType` vocabulary is:

- `document`;
- `project_item`;
- `comment`;
- `linked_page`;
- `other`.

The request contract must not contain an executable, argv, shell text, working
directory, environment names or values, credentials, arbitrary search query,
or adapter configuration. Those belong to a later Host-owned registration
boundary.

The external adapter response is a strict versioned object with adapter
identity (`id`, `name`, and `version`) and one bounded result per reference.
Results are discriminated by `accessStatus`:

- `available` records require `requestId`, `sourceType`, canonical
  `SourceReference`, title, nullable source update time, retrieval time,
  bounded excerpt, and explicit truncation metadata;
- `not_found`, `permission_denied`, `unsupported`, and `error` records require
  `requestId`, `sourceType`, attempted `SourceReference`, retrieval time, and a
  bounded diagnostic message, and cannot carry document content.

The adapter response cannot declare a trust level, provide credentials, or
return free-form logs. Change Trace will assign `untrusted_external`, redact
content, verify request/result coverage, and convert results into
`EvidenceItem` and `MissingEvidence` records in later M5 tasks.

### In scope

- Add strict Zod schemas and inferred TypeScript types for:
  - external source type;
  - external access status;
  - explicit external reference;
  - adapter identity;
  - available and unavailable adapter results;
  - external adapter request and response.
- Reuse existing core primitives where their semantics match, including the
  core schema version, stable IDs, timestamps, `SourceReference`, excerpt
  limit, and evidence truncation shape.
- Enforce unique request IDs independently in request and response arrays.
- Enforce internally consistent available-result truncation:
  retained characters equal the excerpt length; a truncated result has a
  known original size no smaller than retained content; a non-truncated known
  original size equals retained content.
- Export all new schemas/types from `src/schemas/index.ts`.
- Add deterministic Draft 2020-12 exports named
  `externalAdapterRequest` and `externalAdapterResponse`.
- Add focused positive, negative, bound, union, unknown-field,
  injection-shaped-data, uniqueness, truncation, and deterministic export
  tests.

### Out of scope

- Executing any command or subprocess.
- Reading environment variables or credentials.
- Adapter registration/configuration parsing.
- Search, discovery, branch/commit key inference, network calls, Lark, Jira,
  Confluence, browser, MCP, or live external-system access.
- Normalizing results into `EvidenceItem`, `MissingEvidence`, a review bundle,
  report, artifact, or cache.
- Adding `collect_external_evidence` or changing any MCP tool.
- Changing existing evidence, review-bundle, finding, report, runner, CI,
  workflow, dependency, lockfile, package version, Roadmap, decision,
  governance, release, or npm state.

### Allowed paths

- `src/schemas/external-adapter.ts`
- `src/schemas/index.ts`
- `src/schemas/json-schema.ts`
- `tests/unit/external-adapter-schema.test.ts`
- `tests/unit/core-schemas.test.ts` — only the smallest export assertion if a
  separate focused test cannot cover it cleanly
- `docs/work-items/M5-001-external-adapter-contract.md` — Worker handoff only

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
- `src/server.ts`
- `src/evidence/**`
- `src/security/**`
- `package.json`
- `package-lock.json`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [x] Request and response schemas are strict, versioned, bounded, and
      exported as TypeScript and deterministic Draft 2020-12 contracts.
- [x] Request input can select only a preconfigured adapter ID and explicit
      references; no command, environment, credential, or discovery field is
      accepted.
- [x] Reference and result request IDs are unique within their respective
      arrays.
- [x] Available results preserve adapter/source identity, source type, title,
      nullable update time, retrieval time, bounded excerpt, and consistent
      truncation metadata.
- [x] Missing, denied, unsupported, and error results are structured and
      cannot carry excerpts or other available-document fields.
- [x] Adapter output cannot self-declare `trustLevel`.
- [x] Prompt-injection-shaped text remains inert string data accepted only in
      the bounded excerpt field.
- [x] Existing public schemas and their JSON export identities remain
      unchanged.
- [x] Focused tests, type checking, two consecutive full-suite runs, stdio
      smoke, package dry-run, diff checks, and clean worktree checks pass.
- [x] No runtime execution, credential access, network access, MCP change,
      dependency, version, Roadmap, decision, CI, release, or npm state change
      occurs.

### Required validation

```text
npx vitest run tests/unit/external-adapter-schema.test.ts tests/unit/core-schemas.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 3cab00154ff5b1856d5553d620d64f89d5f68c9a..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task,
   Decisions 7, 10, 22, and 23, the M5 Roadmap section, and the existing
   common, evidence, local-evidence, review-bundle, index, JSON Schema, and
   schema-test implementations.
2. Confirm the isolated worktree, assigned branch, and exact base
   relationship.
3. Write failing focused tests for the complete accepted and rejected
   contracts before implementing the schemas.
4. Implement the smallest additive schema and export changes that satisfy the
   contract.
5. Audit the complete diff for command/config/credential fields, trust
   self-declaration, unbounded content, ambiguous unions, unstable JSON Schema
   output, accidental existing-schema changes, and out-of-scope runtime work.
6. Run every required validation command and review the complete base diff.
7. Update only the Worker handoff section, commit all output, leave the
   worktree clean, and report `ready_for_review`.

### Escalate when

- the existing `EvidenceItem`, `ReviewBundle`, finding, report, or core schema
  version must change;
- process execution, environment access, normalization, an MCP tool, a
  dependency, or another path outside the allowlist is needed;
- a command, credential, search query, trust declaration, or free-form log
  appears necessary in the protocol;
- source-specific Lark, Jira, or Confluence fields appear necessary instead
  of the shared contract;
- a public compatibility claim, package version, or release action is
  required.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M5-001-external-adapter-contract`
- Implementation commits:
  - `9cda0b784e9b2e935b5fa9b3b4257c505d4b55a3` —
    `feat(schema): add external adapter contract`

### Implementation summary

- Added a strict provider-neutral protocol for explicit external references,
  adapter identity, available results, structured unavailable results, and
  versioned request/response envelopes.
- Reused the core stable ID, `SourceReference`, timestamp, evidence excerpt
  limit, and evidence truncation contracts.
- Enforced independent request/result ID uniqueness and runtime truncation
  consistency, including exact retained excerpt length.
- Added deterministic Draft 2020-12 request and response exports without
  changing existing export IDs.

### Changed areas

- `src/schemas/external-adapter.ts` — additive protocol schemas, inferred
  types, bounds, discriminated results, uniqueness checks, and truncation
  checks.
- `src/schemas/index.ts` — public exports for the new schemas and types.
- `src/schemas/json-schema.ts` — deterministic `externalAdapterRequest` and
  `externalAdapterResponse` exports.
- `tests/unit/external-adapter-schema.test.ts` — positive, negative, bounds,
  strictness, forbidden-field, union, uniqueness, truncation,
  injection-shaped-data, and JSON Schema identity coverage.

### Validation

- Test-first confirmation after installing the lockfile dependencies:
  `npx vitest run tests/unit/external-adapter-schema.test.ts` failed all 11
  initial tests because the new schemas and exports did not exist.
- `npx vitest run tests/unit/external-adapter-schema.test.ts
  tests/unit/core-schemas.test.ts` — passed, 2 files / 16 tests.
- `npm run check` — passed.
- First `npm test` — passed, 21 files / 196 tests.
- Second consecutive `npm test` — passed, 21 files / 196 tests.
- `npm run smoke:stdio` — passed; the unchanged seven-tool list and M1
  compatibility fixture were returned.
- `npm run pack:check` — passed; dry-run package contained the new compiled
  schema declarations and JavaScript.
- `git diff --check
  3cab00154ff5b1856d5553d620d64f89d5f68c9a..HEAD` — passed with no output.
- `git status --short` — clean before this handoff update.

### Public contract and documentation impact

- Adds TypeScript schema/type exports and two Draft 2020-12 export keys:
  `externalAdapterRequest` and `externalAdapterResponse`.
- Existing public schema identities and the core schema version remain
  unchanged.
- No MCP tool, server registration, process runner, credential boundary,
  package version, or user-facing compatibility claim changed.

### Deviations from assignment

- None recorded.

### Known limitations and risks

- This schema-only slice intentionally does not compare a request with a
  response. Exact adapter identity matching and one-result-per-request
  coverage remain for the later Host runner/normalizer boundary identified in
  the assignment.
- JSON Schema represents the structural and size bounds. Runtime-only
  cross-item uniqueness and excerpt/truncation consistency are enforced by the
  Zod schemas because Draft 2020-12 cannot express those relations directly.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified by the worker.
- [x] No version, dependency, tag, publish, live external-system, CI, or
      release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head:
  `0b5ae9b607a7ae2b5395c192f5fb022cfb8c1bdc`
- Integration commit:
  `411ad21f87fa5076d782acf8de3db61a49269aad`

### Review findings

- No blocking findings.
- The implementation stays within the schema-only boundary. Strict objects
  reject command, environment, credential, discovery, log, and trust
  self-declaration fields; unavailable variants cannot carry content.
- Source and result vocabularies, request/result uniqueness, bounds, and
  truncation consistency match the assignment. The runtime-only refinements
  that Draft 2020-12 cannot represent are called out accurately in the
  handoff.
- Existing schema IDs and the core schema version remain unchanged.
- Coordinator validation on the merged Windows main tree passed 16 focused
  tests, TypeScript checking, and the complete 21-file/196-test suite.

### Required follow-up

- None for M5-001. M5-002 must enforce request/response identity and coverage
  when it adds the preconfigured command runner and normalizer.

### Roadmap and release impact

- M5-001 is accepted. M5 remains in progress; no package version or release
  state changed.
