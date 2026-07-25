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

- [ ] Request and response schemas are strict, versioned, bounded, and
      exported as TypeScript and deterministic Draft 2020-12 contracts.
- [ ] Request input can select only a preconfigured adapter ID and explicit
      references; no command, environment, credential, or discovery field is
      accepted.
- [ ] Reference and result request IDs are unique within their respective
      arrays.
- [ ] Available results preserve adapter/source identity, source type, title,
      nullable update time, retrieval time, bounded excerpt, and consistent
      truncation metadata.
- [ ] Missing, denied, unsupported, and error results are structured and
      cannot carry excerpts or other available-document fields.
- [ ] Adapter output cannot self-declare `trustLevel`.
- [ ] Prompt-injection-shaped text remains inert string data accepted only in
      the bounded excerpt field.
- [ ] Existing public schemas and their JSON export identities remain
      unchanged.
- [ ] Focused tests, type checking, two consecutive full-suite runs, stdio
      smoke, package dry-run, diff checks, and clean worktree checks pass.
- [ ] No runtime execution, credential access, network access, MCP change,
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
