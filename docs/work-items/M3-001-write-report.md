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
  - `9161a04` — feat: initial implementation
  - `da8e140` — fix: first review round
  - `2cc369e` — fix: second review round
  - `289ab44` — fix: third review round
  - `31fa425` — fix: fourth review round

### Implementation summary

Fifth commit (fourth review round fixes):

- **Rollback unlink failure**: `safeUnlink` replaces swallowed `catch {}` blocks.
  Failed unlinks of promoted final files are collected in `rollbackErrors`.
  Residual final paths are reported in the `write_report_rollback_failed` error.
- **Backup restore failure**: `rollbackFatal` flag set when `safeRename` fails
  during backup restore. When fatal, bak files are NOT deleted and txDir is NOT
  removed — both are preserved for manual recovery. Error includes both final
  residual paths and backup paths. Handled for both JSON and Markdown directions.
- **Three new failure-injection tests**:
  - No old reports: md promotion fails + json final unlink fails → reports
    unlink error and residual json final path
  - With old reports: json backup restore fails → verifies bak.json preserved
    in txDir with old content, old md restored from backup
  - With old reports: md backup restore fails → verifies bak.md preserved in
    txDir with old content, old json restored from backup
- **Four-space/Tab indented code block fix**: `safeInline` now replaces
  `^ {4,}` → `   \\` + rest (3 spaces + backslash breaks 4-space indentation),
  `^\t` → `   \\t` (3 spaces + backslash-t). Test verifies no output line has
  valid 4-space or tab indentation structure.
- **Restored acceptance tests**: bundleId mismatch, absolute output directory
  rejection, `..` traversal rejection, unsafe reportName rejection, empty
  findings handling, warnings/rejections in Markdown, truncated evidence
  display.
- **WriteReportFs hidden**: Public API is `writeReport(input)` only. Internal
  `_writeReportForTest(input, fs)` exposed for failure injection; not part of
  `reports/index.ts` barrel export.

### Changed areas

- `src/reports/write-report.ts` — safeUnlink rollback, rollbackFatal flag,
  fix safeInline 4-space/tab escapes, split public/internal API
- `src/reports/index.ts` — exports writeReport only
- `tests/unit/report-write.test.ts` — 3 new failure-injection tests, restored
  7 acceptance tests, 4-space/tab verification test

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm run check` | PASS | Zero errors |
| `npm test` | PASS | 80 tests (12 files), zero failures |
| `npm run smoke:stdio` | PASS | write_report in tools |
| `npm run pack:check` | PASS | 127 files, no warnings |
| `git diff --check` | PASS | No whitespace errors |
| `git status --short` | Clean | Task file pending |

### Deviations from assignment

- None.

### Known limitations and risks

- `rollbackFatal` flag-based preservation of bak files and txDir relies on
  the filesystem not being in a catastrophic failure state; extreme scenarios
  (disk full) may still leave artifacts.
- `_writeReportForTest` is internal; coordinator may request removal before
  release.

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
