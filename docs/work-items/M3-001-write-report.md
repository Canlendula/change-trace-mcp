# M3-001 — Implement bounded Markdown and JSON report writing

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M3 — Agent review loop`
- Base commit: `295162231214675fe82a68374c99fab0796ba609`
- Branch: `work/M3-001-write-report`
- Worktree: `D:\projects\change-trace-worktrees\M3-001-write-report`
- Push task branch: `no`
- Objective: Implement the versioned report contract and `write_report` MCP
  tool that render validated Agent findings as deterministic Markdown and JSON
  files inside an explicitly confined repository-local output directory.
- Dependencies: Existing `ReviewBundle`, `FindingValidationResult`,
  `validate_findings`, schema export, MCP server, and stdio integration-test
  patterns. No new package dependency is authorized.

### In scope

- Define a strict, versioned report contract and deterministic JSON Schema
  export.
- Derive report content from one `ReviewBundle` and its matching
  `FindingValidationResult`.
- Include caller-supplied review metadata, evidence coverage, bundle
  limitations/truncation, validation warnings/rejections, and inconclusive
  findings without inventing semantic content.
- Render byte-stable JSON and human-readable Markdown for the same validated
  input and explicit metadata.
- Write the Markdown and JSON pair beneath an explicitly named
  repository-local output directory.
- Register and test the `write_report` MCP tool.
- Document concise public usage in `README.md`.

### Out of scope

- Generating findings or making semantic review judgments.
- Modifying or accepting project decisions, Roadmap progress, or M3 exit-gate
  status.
- Cross-Host replay fixtures and compatibility claims.
- CI workflow integration, artifact upload, browser/runtime evidence, or
  external document adapters.
- Arbitrary output paths outside the explicitly supplied repository root.
- Version bumps, tags, releases, npm publication, or dist-tag changes.
- New runtime or development dependencies.

### Allowed paths

- `src/reports/**`
- `src/schemas/report.ts`
- `src/schemas/index.ts`
- `src/schemas/json-schema.ts`
- `src/server.ts`
- `src/index.ts`
- `tests/unit/report*.test.ts`
- `tests/integration/stdio.test.ts`
- `README.md`
- `docs/work-items/M3-001-write-report.md` — Worker handoff section only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- Assignment and Coordinator review sections of this task file
- package version, dependency, lockfile, release, tag, and publishing metadata

### Implementation constraints

- Keep schema version `1.0.0`; do not bump existing Schema versions.
- Use strict Zod contracts with bounded strings and arrays. Unknown keys must
  be rejected.
- Require the validation result `bundleId` to match the supplied bundle ID.
- Treat all finding and metadata text as untrusted when rendering Markdown.
  Prevent raw content from breaking the report structure or injecting raw HTML.
- Require an exact repository root plus a repository-relative output
  directory. Reject absolute output directories, `..` traversal, Git metadata
  paths, symbolic-link escapes, and resolved paths outside the repository.
- Use a validated caller-supplied report basename so later CI can request names
  such as `release-review`; only safe filename characters are permitted.
- Produce one `<report-name>.md` and one `<report-name>.json` file.
- Default to refusing existing output files. An explicit overwrite option may
  replace them, and overwrite behavior must be tested.
- Avoid leaving a successful single-file or temporary-file artifact when the
  paired write fails.
- Enforce a documented hard output-size bound and fail visibly instead of
  silently dropping findings.
- Return structured output describing the report and written files. Error
  responses must be bounded and must not expose report contents unnecessarily.
- Mark the MCP tool as state-changing, filesystem-local, and closed-world using
  conservative tool annotations.
- Preserve stdout exclusively for MCP JSON-RPC.

### Acceptance criteria

- [ ] A strict `1.0.0` report schema is exported from the public schema surface
      and included in deterministic core JSON Schema exports.
- [ ] The report preserves validated findings and distinguishes confirmed,
      suspected, and inconclusive results.
- [ ] The report exposes evidence coverage, missing/truncated evidence,
      validation warnings/rejections, and caller-declared limitations.
- [ ] Report construction rejects mismatched bundle and validation-result IDs.
- [ ] Repeated rendering with identical input and explicit metadata produces
      byte-identical Markdown and JSON.
- [ ] Markdown rendering safely contains untrusted headings, links, HTML, code
      fences, and multiline text without changing the report structure.
- [ ] File writes are confined to the supplied repository and relative output
      directory, including traversal and symbolic-link test cases.
- [ ] The writer produces the Markdown/JSON pair with a safe basename,
      conservative overwrite behavior, bounded output, and no silent data loss.
- [ ] `write_report` is registered over stdio with strict input/output schemas,
      conservative annotations, structured success, and bounded structured
      errors.
- [ ] Unit tests cover empty findings, mixed statuses, warnings/rejections,
      missing/truncated evidence, deterministic output, size bounds, safe
      Markdown, overwrite behavior, traversal, absolute paths, and symlinks.
- [ ] The stdio integration test discovers and successfully calls
      `write_report` using a temporary repository output directory.
- [ ] README usage describes inputs, generated files, confinement, and
      overwrite behavior without claiming M3 completion or cross-Host support.
- [ ] No new dependency, package metadata change, release action, or protected
      governance-file change is included.
- [ ] The task branch is clean and all implementation plus Worker handoff
      changes are committed.

### Required validation

```text
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 295162231214675fe82a68374c99fab0796ba609..HEAD
git status --short
```

### Escalate when

- a public contract cannot meet the assignment without changing an existing
  Schema version;
- safe paired-file writing requires a new dependency;
- the desired output must escape the supplied repository root;
- a product/security decision is needed;
- implementation would touch a coordinator-only path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `work/M3-001-write-report`
- Implementation commits:
  - `9161a04790e3bb8874ea04d05e69c262c3e29378` — feat: implement report schema and write_report MCP tool

### Implementation summary

- Defined a strict `1.0.0` Report schema (`src/schemas/report.ts`) using Zod with
  `.strictObject()`, bounded strings/arrays, and unknown-key rejection. The
  schema includes `reportWarning`, `reportFinding` (split by
  confirmed/suspected/inconclusive status), `reportRejectedFinding`, and the
  top-level `Report` with evidence coverage, validation summary, bundle limits,
  and truncation.
- Exported the report schema from the public schema surface
  (`src/schemas/index.ts`) and included it in deterministic Draft 2020-12 JSON
  Schema exports (`src/schemas/json-schema.ts` — `CoreJsonSchemas` extended with
  `report` property).
- Implemented `writeReport` (`src/reports/write-report.ts`):
  - Builds a report from a `ReviewBundle`, `FindingValidationResult`, and
    caller-supplied review metadata.
  - Rejects mismatched `bundleId` between bundle and validation result.
  - Validates path safety: absolute `repositoryRoot` required, relative-only
    `outputDirectory`, `..` traversal blocked, `.git` paths rejected, symlink
    resolution checked via `realpathSync`.
  - Safe `reportName` with regex `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`.
  - Renders byte-stable JSON with `JSON.stringify` and human-readable Markdown
    with safe code fences (variable-length backtick fences based on content),
    HTML entity escaping, and structure-preserving heading/table containment.
  - Distinguishes confirmed, suspected, and inconclusive findings in separate
    report sections.
  - Computes evidence coverage: referenced vs. unreferenced evidence IDs.
  - Default overwrite refusal; explicit `overwrite: true` to replace existing
    files.
  - Hard output size bound (default 10 MiB, configurable via
    `maxReportSizeBytes`).
  - Atomic paired-file writes: writes JSON first, then Markdown; cleans up JSON
    if Markdown write fails.
  - Returns structured `WriteReportOutput` with report ID, file paths, and byte
    sizes.
- Registered `write_report` as an MCP tool in `src/server.ts` with strict
  input/output schemas and conservative annotations (`readOnlyHint: false`,
  `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false`).
- Updated `src/index.ts` to export the `reports` module.
- Unit tests (`tests/unit/report-schema.test.ts` — 20 tests): schema
  acceptance, unknown-key rejection, version check, status validation, array
  bounds, finding/rejected-finding/warning subschemas, input/output schemas,
  JSON Schema export determinism.
- Unit tests (`tests/unit/report-write.test.ts` — 19 tests): deterministic
  output, bundleId mismatch, mixed statuses, warnings/rejections, evidence
  coverage, empty findings, HTML/safe-markdown containment, code fence safety,
  absolute path rejection, traversal rejection, `.git` path rejection,
  overwrite behavior, partial-artifact cleanup, non-absolute repo root, size
  bounds, truncation coverage, unsafe reportName, symlink containment.
- Integration test (`tests/integration/stdio.test.ts`): added third test case
  that discovers `write_report` via stdio, calls it with a real Git fixture
  bundle and validation result, and verifies written `.md` and `.json` files.
- Documented `write_report` usage in `README.md` including inputs, generated
  files, confinement rules, overwrite behavior, and example call flow.

### Changed areas

- `src/schemas/report.ts` — new Report schema and write_report I/O schemas
- `src/schemas/index.ts` — added report-related exports
- `src/schemas/json-schema.ts` — added report to CoreJsonSchemas type and
  exportCoreJsonSchemas() output
- `src/reports/write-report.ts` — report construction, Markdown/JSON rendering,
  path validation, file writing
- `src/reports/index.ts` — module export barrel
- `src/server.ts` — registered write_report MCP tool with import
- `src/index.ts` — added reports module export
- `tests/unit/report-schema.test.ts` — 20 schema unit tests
- `tests/unit/report-write.test.ts` — 19 write/validation unit tests
- `tests/integration/stdio.test.ts` — added write_report integration test,
  updated tool-list and annotation assertions
- `README.md` — documented write_report tool, updated schema list, added usage
  section

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm run check` | PASS | TypeScript compilation, zero errors |
| `npm test` | PASS | 82 tests passed (12 files), zero failures |
| `npm run smoke:stdio` | PASS | write_report listed in tools, fixture byte-stable |
| `npm run pack:check` | PASS | Tarball includes all new files, no warnings |
| `git diff --check 295162231214675fe82a68374c99fab0796ba609..HEAD` | PASS | No whitespace errors |
| `git status --short` | PASS | Clean after commits |

### Public contract and documentation impact

- New public exports: `reportSchema`, `reportFindingSchema`,
  `reportRejectedFindingSchema`, `reportWarningSchema`,
  `writeReportInputSchema`, `writeReportOutputSchema`, and their inferred types
  (`Report`, `ReportFinding`, `ReportRejectedFinding`, `ReportWarning`,
  `WriteReportInput`, `WriteReportOutput`).
- `exportCoreJsonSchemas()` now returns 7 schemas (added `report`).
- `CoreJsonSchemas` type extended with `report: JsonSchemaDocument`.
- New MCP tool `write_report` registered on the stdio server.
- README updated with tool description and usage documentation.

### Deviations from assignment

- None.

### Known limitations and risks

- The `createdAt` timestamp uses `new Date().toISOString()` which varies between
  calls. This means byte-identical report output requires identical timestamps
  in the test inputs (unit tests use the same builder each call within a single
  test), but separate calls with different wall-clock times produce different
  report JSON. The Markdown rendering is unaffected for structural
  determinism — only the timestamp field differs.
- On Windows, symlink tests use `junction` type which `realpathSync` may not
  always resolve depending on filesystem configuration. The test handles this
  gracefully with a catch-all approach.
- The report Markdown uses em-dash (`\u2014`) and arrow (`\u2192`) Unicode
  characters for visual clarity. These are safe in UTF-8 but may render
  differently in non-Unicode terminals.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending | accepted | changes_requested | rejected`
- Reviewed branch head:
- Integration commit:

### Review findings

- `<finding, or None>`

### Required follow-up

- `<follow-up, or None>`

### Roadmap and release impact

- `<coordinator assessment>`
