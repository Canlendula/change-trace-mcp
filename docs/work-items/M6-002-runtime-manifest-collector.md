# M6-002 — Collect one confined runtime manifest

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M6 — Runtime and staging evidence`
- Base commit: `3d8ae6ef279ef41f2178617e6404c935e3d65114`
- Branch: `codex/M6-002-runtime-manifest-collector`
- Worktree:
  `D:\projects\change-trace-worktrees\M6-002-runtime-manifest-collector`
- Push task branch: `no`
- Objective: add a bounded, read-only library collector and
  `collect_runtime_evidence` MCP tool that load exactly one explicit normalized
  M6 manifest beneath an exact Git root and return the accepted
  `RuntimeEvidenceCollection`, without executing subject code or changing
  bundle/report behavior.
- Dependencies: accepted M6-001, Decisions 27–28, the accepted Git-root
  resolver, and the existing secret redactor.

### Coordinator-owned collector input

Add a strict `CollectRuntimeEvidenceInput` Schema with exactly:

- `repositoryPath`: a 1–4,096 character explicit path to the exact Git
  repository root;
- `manifestPath`: a 1–1,000 character repository-relative path using forward
  slashes.

`manifestPath` cannot:

- be absolute, drive-qualified, UNC-like, empty, `.`, or end in `/`;
- contain empty, `.`, or `..` segments;
- contain backslashes, control characters, or a `.git` segment.

The tool accepts no report discovery root, glob, URL to fetch, environment
name/value, credential, executable, argv, command, browser action, API-probe
configuration, trust level, evidence ID, content hash, redaction result, or
output path.

### Coordinator-owned file boundary

Export `MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES = 4_194_304`.

The collector must:

1. resolve `repositoryPath` with the existing exact Git-root resolver;
2. resolve `manifestPath` beneath that root;
3. reject every symbolic-link segment and a symbolic-link target;
4. require the target to be a regular file;
5. check the target's stable identity and size before, during, and after the
   bounded open/read, following the accepted M5 configuration-loader pattern;
6. use `O_NOFOLLOW` where the platform exposes it;
7. read at most the hard limit plus one byte;
8. use fatal UTF-8 decoding, `JSON.parse`, and
   `runtimeEvidenceManifestSchema`;
9. close the handle on every terminal path.

No artifact reference in the manifest may be opened, resolved, fetched, or
validated against the filesystem/network. A fixed `git rev-parse
--show-toplevel` used by the accepted root resolver is allowed. No other
process, test, application, browser, probe, deployment, converter, or
repository command may run.

### Coordinator-owned safe failures

Export `RuntimeEvidenceCollectorError`, its code type, and this exact
vocabulary:

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

Each code has one static, bounded message. Errors cannot include the repository
or manifest path, file content, producer summary/reason, artifact locator/URI,
schema diagnostic, environment value, or credential-shaped text.

The MCP handler returns only:

```json
{
  "error": "collect_runtime_evidence_failed",
  "code": "<stable-code>"
}
```

for handled collector failures. Unexpected failures map to
`normalization_failed`. Protocol-level input validation remains owned by the
MCP SDK; library input validation uses `invalid_input`.

### Coordinator-owned normalization

Expose one library collection function and, if useful for later converters,
one pure manifest-normalization function. Both validate their input and return
the accepted `RuntimeEvidenceCollection`.

Use one `now()` value for every evidence item produced by a collection call.
The default is the current time; tests may inject a clock.

For every available record:

- derive the core ID as
  `evidence:runtime:<lowercase sha256 hex>` from a JSON array containing, in
  order:
  - producer ID, name, and version;
  - source format;
  - record ID and runtime kind;
  - record source system, locator, and nullable URI;
  - environment kind, nullable name, and environment source system, locator,
    and nullable URI;
- map `test_run`/`test_case` to `test_result`,
  `api_observation`/`browser_observation`/`other` to
  `runtime_observation`, and `environment_metadata` to `configuration`;
- use the record source, record related change IDs, the single collection
  timestamp, the fixed selection reason
  `Pre-produced runtime evidence supplied through an explicit manifest.`,
  and `observed_runtime`;
- redact the summary with `redactCommonSecrets` before exposing it;
- bound the resulting excerpt to `MAX_EVIDENCE_EXCERPT_CHARACTERS`;
- set `contentHash` to SHA-256 of the complete, original pre-redaction summary
  only when the manifest record says it is not truncated; otherwise use
  `null`;
- make output truncation true when either the producer declared truncation or
  normalization had to shorten redacted content, set retained characters to
  the final excerpt length, and keep a non-smaller known original count;
- copy producer, source format, record ID, runtime kind, environment, outcome,
  timing, artifact references, and related evidence IDs into
  `runtimeProvenance`;
- validate the final item and final collection with the accepted runtime
  Schemas.

For every unavailable record:

- preserve its source;
- redact and bound its reason to 2,000 characters;
- map `not_found`, `inaccessible`, `unsupported`, and `truncated` directly;
- map `malformed` to `unsupported`;
- emit only `MissingEvidence`, never an evidence item or failed outcome.

Output preserves manifest record order separately within `evidenceItems` and
`missingEvidence`. Stable IDs do not depend on collection time or summary
content. Injection-shaped summary/reason text remains inert evidence and is
never treated as configuration.

### Coordinator-owned MCP contract

Register `collect_runtime_evidence` unconditionally with:

- the strict collector input Schema;
- `RuntimeEvidenceCollection` output;
- `readOnlyHint: true`;
- `destructiveHint: false`;
- `idempotentHint: true`;
- `openWorldHint: false`.

Its description must say it reads one explicit pre-produced local manifest and
does not run tests, browsers, probes, or artifact fetches. Successful calls
return identical text and structured content values. Existing tools and the M1
compatibility fixture remain unchanged except that exact tool-list assertions
now contain nine tools.

## In scope

- Add the strict collector input Schema and inferred type.
- Add the safe confined file reader, normalizer, exported error class/codes,
  hard byte limit, and library function.
- Add runtime evidence barrel exports through the existing package chain.
- Register the always-discoverable MCP tool.
- Update only exact stdio/tool-list expectations affected by the additive tool.
- Add focused unit and stdio integration tests for the complete contract.
- Update only the worker-owned handoff section of this file.

## Out of scope

- JUnit/XML, Playwright, API-smoke, CI, browser-MCP, or vendor-specific
  converters; report discovery or directory scanning.
- Test/application/browser/API/deployment execution; child processes other
  than the accepted fixed Git-root resolver; network access; artifact reads.
- Runtime collection registration files, startup environment variables,
  credentials, retries, caching, watching, writing, or telemetry.
- Review-bundle merge/relationships/identity, report Schema/rendering,
  Findings, review instructions, CI workflows, fixtures for the M6 exit gate,
  or live staging access.
- Changes to accepted M6-001 public vocabularies or constraints.
- Dependencies, package/lock metadata, versions, Roadmap, decisions,
  governance, release, tags, npm state, or GitHub state.

## Allowed paths

- `src/schemas/runtime-collector.ts`
- `src/schemas/index.ts`
- `src/evidence/runtime/collect-runtime-evidence.ts`
- `src/evidence/runtime/index.ts`
- `src/evidence/index.ts`
- `src/index.ts` — only if the existing root export chain requires one
  additive runtime export
- `src/server.ts`
- `scripts/smoke-stdio.mjs`
- `tests/unit/runtime-evidence-collector.test.ts`
- `tests/integration/runtime-evidence-stdio.test.ts`
- `tests/integration/stdio.test.ts`
- `docs/work-items/M6-002-runtime-manifest-collector.md` — worker handoff only

Reading other files is allowed. Writing outside this list is not.

## Coordinator-only paths

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- assignment/acceptance-criteria/coordinator-review sections of this file
- `src/git/**`
- `src/security/**`
- `src/schemas/runtime-evidence.ts`
- `src/schemas/runtime-provenance.ts`
- `src/schemas/evidence.ts`
- `src/evidence/external/**`
- `src/evidence/local/**`
- `src/evidence/bundle/**`
- `src/reports/**`
- `.github/**`
- package metadata, lockfile, dependencies, versions, release, and npm state

## Acceptance criteria

- [ ] Input exposes exactly the two assigned paths and rejects every forbidden
      or injection-shaped path form.
- [ ] File access is Git-root-confined, regular-file-only, symlink-free,
      stable-identity checked, byte-bounded, fatal-UTF-8, strict JSON, and
      strict manifest-Schema validated.
- [ ] Safe error types/codes/messages never project paths, content, summaries,
      artifact references, schema diagnostics, or credential-shaped values.
- [ ] Normalization assigns deterministic IDs, correct runtime types,
      `observed_runtime`, one timestamp, hashes, redactions, bounded excerpts,
      consistent truncation, and complete accepted runtime provenance.
- [ ] Unavailable and malformed records become correctly mapped missing
      evidence and cannot masquerade as failed product observations.
- [ ] Artifact references remain references and trigger no filesystem,
      browser, process, or network access.
- [ ] The always-discoverable MCP tool has the exact input/output,
      annotations, safe success/error projection, and no-subject-execution
      description above.
- [ ] Existing eight tools remain behaviorally unchanged, the tool list grows
      to exactly nine, and the M1 compatibility fixture stays byte-identical.
- [ ] Focused tests, type checking, two consecutive full suites, stdio smoke,
      package dry-run, base diff, and clean-worktree checks pass.
- [ ] No bundle, report, converter, Finding, CI, dependency, version,
      governance, release, npm, or GitHub change occurs.

## Required validation

```text
npx vitest run tests/unit/runtime-evidence-collector.test.ts tests/integration/runtime-evidence-stdio.test.ts tests/integration/stdio.test.ts tests/unit/runtime-evidence-schema.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 3d8ae6ef279ef41f2178617e6404c935e3d65114..HEAD
git status --short
```

The worker must report exact test-first failure evidence, final command
results, cases exercised, known limitations, deviations, and decision
requests.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task,
   Decisions 27–28, the M6 Roadmap section, accepted M6-001 Schemas/tests, the
   Git-root resolver, M5 configuration loader, local collector, redactor,
   server, stdio smoke, and integration tests.
2. Confirm the isolated branch/worktree, assigned base, assignment commit, and
   clean status.
3. Write failing unit and stdio tests before production implementation,
   including a direct red test that proves the tool/module is absent.
4. Implement the smallest bounded collector, normalizer, export chain, and MCP
   registration satisfying the frozen contract.
5. Audit for path traversal, Windows absolute/UNC forms, symlink segments,
   file replacement/growth, descriptor leaks, over-read, non-fatal UTF-8,
   error disclosure, redaction expansion, unstable IDs/timestamps, malformed
   outage conversion, artifact dereference, subprocess/network use, existing
   tool drift, and out-of-scope writes.
6. Run every required validation, update only the worker handoff, commit all
   output, and leave the worktree clean.

## Escalate when

- the accepted M6-001 Schema or Decision 28 must change;
- a dependency, credential, process beyond fixed Git-root verification,
  network/browser/API/deployment capability, or write access is required;
- bundle/report/Finding/converter/CI behavior is required;
- safe path confinement, stable file reading, normalization, or MCP error
  projection cannot be implemented inside the allowed paths;
- a product or security decision beyond this assignment is required.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M6-002-runtime-manifest-collector`
- Implementation commits:
  - `2ac9940` — `feat(runtime): collect confined evidence manifest`
  - `1509845` — `test(runtime): verify public collector exports`

### Implementation summary

- Added the strict two-field collector input and public library exports.
- Added one explicit-manifest collector that resolves the exact Git root,
  confines the repository-relative path, rejects symbolic-link segments and
  targets, and performs bounded stable-identity/size checks before, during,
  and after reading.
- Added fatal UTF-8, JSON, manifest-Schema, and normalized collection
  validation with the assigned static error vocabulary.
- Added deterministic runtime evidence normalization, redaction, hashing,
  truncation reconciliation, complete runtime provenance, and unavailable
  record mapping.
- Registered the always-discoverable `collect_runtime_evidence` MCP tool with
  the assigned annotations, safe error projection, and no-execution
  description.

### Changed areas

- `src/schemas/runtime-collector.ts` and `src/schemas/index.ts`: strict input
  Schema, inferred type, and public export.
- `src/evidence/runtime/**`, `src/evidence/index.ts`: confined reader,
  normalizer, static errors/limit, and package export chain.
- `src/server.ts`: unconditional MCP tool registration and safe
  success/failure responses.
- `scripts/smoke-stdio.mjs`, `tests/integration/stdio.test.ts`: nine-tool
  expectation while retaining the fixed compatibility fixture.
- `tests/unit/runtime-evidence-collector.test.ts` and
  `tests/integration/runtime-evidence-stdio.test.ts`: input, normalization,
  file-boundary, safe-error, export-chain, and stdio coverage.

### Validation

| Command | Result | Notes |
|---|---|---|
| Initial focused red run | Failed as intended | 1 suite failed to import because `src/evidence/runtime/collect-runtime-evidence.js` did not exist; stdio calls also failed before the tool/build existed. M6-001 Schema tests passed. |
| `npx vitest run tests/unit/runtime-evidence-collector.test.ts tests/integration/runtime-evidence-stdio.test.ts tests/integration/stdio.test.ts tests/unit/runtime-evidence-schema.test.ts` | Passed | 4 files, 60 tests; rerun from final implementation head. |
| `npm run check` | Passed | TypeScript no-emit check passed from final implementation head. |
| `npm test` | Passed | First final-head run: 30 files, 322 tests. |
| `npm test` | Passed | Consecutive second final-head run: 30 files, 322 tests. |
| `npm run smoke:stdio` | Passed | Exactly nine tools listed; compatibility fixture remained byte-identical. |
| `npm run pack:check` | Passed | Dry-run produced `change-trace-mcp-0.0.0-dev.1.tgz`; 177 files, 127.0 kB packed. |
| `git diff --check 3d8ae6ef279ef41f2178617e6404c935e3d65114..HEAD` | Passed | No whitespace errors. |
| `git status --short` | Passed | Clean before handoff update; will be clean again after this handoff commit. |

### Public contract and documentation impact

- Additive public exports: `collectRuntimeEvidenceInputSchema`,
  `CollectRuntimeEvidenceInput`, `collectRuntimeEvidence`,
  `normalizeRuntimeEvidenceManifest`,
  `MAX_RUNTIME_EVIDENCE_MANIFEST_BYTES`,
  `RUNTIME_EVIDENCE_COLLECTOR_ERROR_CODES`,
  `RuntimeEvidenceCollectorError`,
  `RuntimeEvidenceCollectorErrorCode`, and
  `RuntimeEvidenceCollectorOptions`.
- Additive MCP tool: `collect_runtime_evidence`.
- No accepted M6-001 Schema, bundle, report, Finding, or compatibility-fixture
  contract changed.

### Deviations from assignment

- None.

### Known limitations and risks

- The collector intentionally accepts only the normalized M6 manifest. It
  performs no format conversion, discovery, execution, artifact fetch, or
  relationship merge.
- The real directory-junction segment rejection runs on Windows. The
  additional final-file symbolic-link assertion is skipped only when the host
  denies file-symlink creation with `EPERM`; the collector still rejects final
  symbolic links through `lstat` and `O_NOFOLLOW` where exposed.
- Mid-read replacement/growth is guarded by descriptor/path identity,
  per-segment identity, and size comparisons plus the limit-plus-one read.
  The suite exercises the individual unsafe/oversize boundaries but does not
  inject a deterministic filesystem mutation inside an active read.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending`
- Reviewed branch head:
- Integration commits:

### Review findings

- Pending.

### Required follow-up

- Pending review.

### Roadmap and release impact

- M6 remains in progress. This task cannot complete the milestone or authorize
  a release.
