# M3-001 — Implement bounded Markdown and JSON report writing

## Assignment — coordinator owned

- Status: `accepted`
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
  - `68d5f9e` — fix: harden report writer finalization
  - `75b197d` — fix: contain tilde fenced Markdown

### Implementation summary

Sixth commit (final takeover fixes):

- **CommonMark containment**: `safeInline` escapes 0–3 spaces followed by a
  tab, `1)` and `1.` list markers, one-or-more-character Setext underlines
  with trailing whitespace, all pipe characters, and tilde fence markers.
  `inlineNoNewlines` normalizes CRLF, LF, and lone CR.
- **Exclusive final publication**: fully written, validated staging files are
  hard-linked to final paths. This provides no-clobber publication for both
  overwrite modes and avoids partial-final output if a final write fails.
  `EEXIST` is surfaced as `report_files_exist`.
- **No-clobber recovery and ownership tracking**: rollback restores backups
  with hard links, preserves backups and the transaction directory on recovery
  failure, and tracks when a published final has been removed. Competing files
  are never removed or reported as writer-owned residuals.
- **Strict confinement**: shared relative-path checks reject empty relative
  paths, absolute relatives, and every `..` segment for resolved output and
  transaction directories. A transaction-directory escape fails before staging
  writes. Bundle-root resolution errors are wrapped as
  `bundle_root_unresolvable`; only `repo_root_mismatch` passes through.
- **Regression coverage**: added tests for Markdown structural injections,
  CR line endings, backtick/tilde fences, report substance mapping, exclusive
  publish races, transaction-directory escape, hard-link promotion failure,
  backup restore failures, and competing files during JSON/Markdown recovery.

### Changed areas

- `src/reports/write-report.ts` — Markdown containment, strict path checks,
  no-clobber hard-link publication/recovery, and explicit transaction ownership
- `tests/unit/report-write.test.ts` — Markdown, substance, confinement, race,
  and rollback regression tests

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm run check` | PASS | Zero errors |
| `npm test` | PASS | 87 tests (12 files), zero failures |
| `npm run smoke:stdio` | PASS | write_report in tools |
| `npm run pack:check` | PASS | 127 files, no warnings |
| `git diff --check` | PASS | No whitespace errors |
| `git status --short` | Clean | After handoff commit |

### Deviations from assignment

- None.

### Known limitations and risks

- A concurrent overwrite writer can still replace an existing final before this
  writer moves it to its private backup; portable filesystem APIs provide no
  lock for that earlier race. After backup creation, publication and recovery
  use no-clobber hard links.
- Catastrophic filesystem failures can leave the preserved transaction directory
  and backup for manual recovery. This is reported as a rollback error.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head: `2269f0a44fa9c829697df8e4a1cb92f7b56cada1`
- Integration commit: `2269f0a44fa9c829697df8e4a1cb92f7b56cada1`

### Review findings

- None. The final takeover implementation passed independent source review,
  targeted concurrency/rollback/confinement/Markdown reproductions, and all
  required validation commands.

### Required follow-up

- Continue M3 with the cross-Host replay and precision-oriented fixture work.
- Keep the documented portable-filesystem overwrite race and catastrophic
  rollback residue behavior visible in future usage and CI guidance.

### Roadmap and release impact

- The bounded `write_report` contract and MCP tool are integrated, completing
  this work item.
- M3 remains in progress because cross-Host replay and the M3 evaluation exit
  criteria have not yet passed.
- No version, tag, publication, compatibility, milestone-completion, or release
  claim is authorized by this acceptance.
