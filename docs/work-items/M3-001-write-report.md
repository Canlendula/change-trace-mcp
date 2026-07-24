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
  - `9161a04790e3bb8874ea04d05e69c262c3e29378` — feat: initial implementation
  - `da8e1403943e20e68edff3b7465542f0608c0a80` — fix: first review round
  - `2cc369ed1725ce61b97f5e281f9c184a07e6812d` — fix: second review round

### Implementation summary

Third commit (second review round fixes):

- **Transaction-local staging**: Replaced predictable `.json.tmp`/`.md.tmp` paths
  with `mkdtempSync(join(targetDir, '.report-'))` inside the validated target
  directory. Staging entries are validated with `validateStagingEntry` (rejects
  pre-existing symlinks, files, directories). Backups use `.bak` suffix but only
  after the staging directory holds written content.
- **Fail-closed paired replacement**: `TxPhase` enum tracks state from `Init` →
  `Staged` → `JsonLive` → `MdLive` → `Committed`. On any failure after `Staged`,
  rollback restores `.bak` → originals and cleans staging. Errors collect
  unresolved artifact paths. `Committed` is asserted before returning success.
- **CommonMark-safe rendering**: `safeInline` escapes all Markdown structural
  characters (`#`, `>`, `-`, `*`, `_`, `[`, `]`, `!`, `|`, backticks) plus
  ordered-list prevention (`1. ` → `1\. `) and thematic-break prevention
  (`---` → `\---`). `safeLiteral` wraps untrusted strings in dynamic code spans
  (variable-length backtick delimiters). `dynamicFence` wraps multiline prose
  with heading suppression (`^#` → `\#`). `safeLine` removed; all inline text
  uses `safeInline` or `safeLiteral` consistently.
- **Repository root validation**: Both `repositoryRoot` and
  `bundle.changeScope.repositoryRoot` are resolved via `realpathSync` before any
  filesystem mutation. They must identify the same directory or error
  `repo_root_mismatch`.
- **Separate limits**: `DEFAULT_MAX_REPORT_SIZE_BYTES = 10 MiB`,
  `HARD_MAX_REPORT_SIZE_BYTES = 100 MiB`. Input schema enforces `.max(HARD_MAX)`.
  README documents default/hard caps and required `reviewMeta.createdAt`.
- **Literal status enforcement**: `reportFindingConfirmedSchema` requires
  `status: z.literal("confirmed")`, similarly for `suspectedSchema` and
  `inconclusiveSchema`. `reportSchema.findings` uses the status-specific schemas.
- **Unicode cleanup**: `\u2014` (em dash) → ` -- `, `\u2192` (arrow) → ` -> `.
- **Regression tests**: Staging symlink victim untouched test; repo root realpath
  mismatch test; CommonMark injection suite (newline-heading, thematic-break,
  link, ordered-list, blockquote, table, code-span injection in reviewer, notes,
  titles, warning messages, source locators, issue paths/messages); fail-closed
  no-artifact-left-behind test.

### Changed areas

- `src/schemas/report.ts` — added status-specific schemas, DEFAULT/HARD constants
- `src/schemas/index.ts` — updated exports
- `src/reports/write-report.ts` — mkdtemp staging, TxPhase state machine,
  CommonMark rendering, repo root realpath validation
- `tests/unit/report-schema.test.ts` — literal status tests, limit constant tests
- `tests/unit/report-write.test.ts` — staging symlink, repo root mismatch,
  injection suite, fail-closed tests
- `README.md` — documented default/hard limits and required createdAt

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm run check` | PASS | Zero errors |
| `npm test` | PASS | 81 tests (12 files), zero failures |
| `npm run smoke:stdio` | PASS | write_report in tools, fixture byte-stable |
| `npm run pack:check` | PASS | Tarball includes all new files |
| `git diff --check` | PASS | No whitespace errors |
| `git status --short` | Clean after commits | Task file pending |

### Deviations from assignment

- None.

### Known limitations and risks

- `mkdtempSync` requires write permission in the target directory; failure
  surfaces as `staging_create_failed`.
- Rollback is best-effort; if `.bak` rename fails during recovery, the error
  includes unresolved artifact paths for operator inspection.
- The `realpathSync` ancestor walk may fail on network mounts where intermediate
  directories cannot be resolved.

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
