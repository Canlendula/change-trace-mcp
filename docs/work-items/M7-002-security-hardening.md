# M7-002 — Resolve the bounded public-beta security findings

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `8b11c55ff14a6b2a8268968c17954be5ffd45132`
- Branch: `codex/M7-002-security-hardening`
- Worktree: Codex-managed isolated worktree for the assigned branch; record the
  absolute path in the worker handoff.
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: mitigate `FIND-M7-001` and `FIND-M7-002` exactly as frozen in
  Decision 32, while preserving success Schemas, deterministic identities,
  tool names/inputs/annotations, dependencies, and release state.
- Dependencies: accepted M7-001 baseline and Decision 32.

### Frozen Git environment contract

Every fixed Git subprocess must receive a fresh environment. It may copy only
these non-empty Host values:

- `PATH`;
- `SystemRoot`, `ComSpec`, `PATHEXT`, `WINDIR`;
- `HOME`, `USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`, `XDG_CONFIG_HOME`;
- `TEMP`, `TMP`, `TMPDIR`.

Windows lookup is case-insensitive and emits at most one canonical key for each
allowed name. POSIX lookup is exact. The implementation then sets:

- `GIT_PAGER=cat`;
- `GIT_TERMINAL_PROMPT=0`;
- `LC_ALL=C`.

It must not spread `process.env`, inherit another `GIT_*` variable, or forward
credential/token, trace, runtime-loader, proxy, adapter, model, or arbitrary
Host variables. Keep the existing fixed `git` executable, immutable argument
arrays, `shell: false` default, time/output limits, `--no-ext-diff`,
`--no-textconv`, root checks, and redaction. Do not disable ordinary
global/system/repository Git configuration discovered through the retained
home/config path variables, change repository ownership policy, or claim a
Git sandbox.

Tests must cover:

- Windows case-insensitive source keys and single canonical outputs;
- POSIX exact lookup, missing values, and the exact allowed-key set;
- secret-shaped arbitrary variables and hostile `GIT_DIR`, `GIT_WORK_TREE`,
  `GIT_CONFIG_*`, `GIT_EXTERNAL_DIFF`, pager, prompt, trace, and loader
  sentinels being absent or overwritten as required;
- real fixed-Git collection still resolving the intended repository when the
  parent environment contains redirect/config sentinels;
- unchanged root/ref/diff/bounds/redaction behavior.

An internal helper may be exported from its source module for direct tests, but
it must not be added to the package's public root exports.

### Frozen safe-error contract

Add one small internal helper if useful. The catch paths for:

- `get_change_scope`;
- `collect_local_evidence`;
- `get_review_bundle`;
- `validate_findings`;
- `write_report`;

must return `isError: true` with one JSON text item containing exactly:

```json
{"error":"<existing tool-specific value>","code":"operation_failed"}
```

Do not include `message`, exception name/text, input path, Git stderr,
rollback details, or `String(error)`. The external-adapter and runtime
collector errors retain their current enumerated safe codes. SDK input
validation behavior is outside this change.

Exception-derived partial-success messages must also become fixed:

- `git_file_diff_failed` retains its repository-relative `path` and uses one
  constant safe message;
- `document_root_unavailable` retains its repository-relative `path` and uses
  one constant safe message;
- `document_read_failed` retains its repository-relative `path` and uses one
  constant safe message.

Expected fixed validation guidance, schema-generated issues, and the
repository-relative paths themselves remain available. Do not change the
`ChangeScope` or `LocalEvidenceCollection` error shapes.

Tests must prove the exact five top-level envelopes and the three fixed
partial-error messages. Use secret/path/Git-stderr-shaped sentinel exceptions
where a test seam is needed, and prove that the sentinel text is absent. Keep
test seams internal and deterministic; do not weaken production checks or
execute a shell.

### Security documentation update

After implementation and tests pass:

- set `FIND-M7-001` and `FIND-M7-002` to `mitigated` in the executable
  inventory and M7 review;
- point their evidence directly at the new implementation and test tokens;
- update affected tool/surface failure projections and residual risks;
- update the threat-model control text without claiming sandboxing,
  certification, DLP, or independent audit;
- keep `FIND-M7-003` open low and `FIND-M7-004` accepted informational.

## In scope

- Explicit fixed-Git child environment construction.
- Safe top-level MCP error envelopes for the five named handlers.
- Fixed exception-derived messages for the three named partial-error cases.
- Focused unit/integration tests and M7 security artifact synchronization.
- Worker handoff.

## Out of scope

- New MCP tools, transports, authentication, authorization, remote servers,
  sandboxing, DLP, telemetry, network clients, process types, or dependencies.
- Public success Schema, input, annotation, tool-name, report, identity,
  compatibility, or package-version changes.
- Stronger secret-redaction behavior or mitigation of `FIND-M7-003`.
- Git config isolation, repository ownership overrides, remote Git operations,
  hooks, credential helpers, SSH, or network access.
- Installation/Host guides, CI templates, adapter/converter SDKs,
  contribution/versioning/publishing work, hosted runs, or pilots.
- Lockfile, package scripts/engines/dependencies/version, GitHub settings, npm,
  release, tag, or dist-tag changes.

## Allowed paths

- `src/git/change-scope.ts`
- `src/tool-errors.ts` — optional new internal helper
- `src/server.ts`
- `src/evidence/local/collect-local-evidence.ts`
- `tests/unit/git-environment.test.ts` — optional new focused test
- `tests/unit/tool-errors.test.ts` — optional new focused test
- `tests/unit/change-scope-edge-cases.test.ts`
- `tests/unit/local-evidence.test.ts`
- `tests/unit/security-baseline.test.ts`
- `tests/integration/stdio.test.ts`
- `docs/security/control-inventory.json`
- `docs/security/THREAT_MODEL.md`
- `docs/security/M7_SECURITY_REVIEW.md`
- `docs/work-items/M7-002-security-hardening.md` — worker handoff only

Reading all repository source, tests, documentation, Git metadata, installed
dependency metadata, and the primary references in Decision 32 is allowed.
Writing outside the listed paths is not.

## Coordinator-only paths

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- assignment, acceptance-criteria, and coordinator-review sections of this
  file
- `package.json`
- `package-lock.json`
- public export barrels
- `.github/**`
- versions, dependencies, scripts, engines, npm, tags, releases, repository
  settings, credentials, hosted CI, and live external systems

## Acceptance criteria

- [ ] Every fixed Git invocation uses the exact fresh environment contract and
      no complete or arbitrary Host environment spread remains.
- [ ] Windows/POSIX key lookup and hostile Git/config/credential environment
      cases are executable and deterministic.
- [ ] The five named top-level error responses contain exactly `error` and
      `code: "operation_failed"` with no exception-derived text.
- [ ] The three named partial-success errors use fixed safe messages while
      retaining their existing codes and repository-relative paths.
- [ ] Existing external/runtime safe-error behavior and all success contracts
      remain unchanged.
- [ ] `FIND-M7-001` and `FIND-M7-002` move to `mitigated` only with direct
      implementation/test evidence; the remaining findings retain their
      accepted dispositions.
- [ ] The strict security baseline still rejects unreviewed production imports
      and process/network boundaries.
- [ ] Focused tests, type checking, two consecutive full suites, both smoke
      tests, package dry-run, production audit, base diff, and clean-status
      checks pass.
- [ ] No dependency, lockfile, package metadata, public Schema/export, CI,
      version, release, npm, GitHub setting, credential, or live external state
      changes.

## Required validation

```text
npm run build
npx vitest run tests/unit/git-environment.test.ts tests/unit/tool-errors.test.ts tests/unit/change-scope-edge-cases.test.ts tests/unit/local-evidence.test.ts tests/unit/security-baseline.test.ts tests/integration/stdio.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run smoke:ci
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check 8b11c55ff14a6b2a8268968c17954be5ffd45132..HEAD
git status --short
```

If an optional test file is unnecessary, cover its frozen cases in another
allowed test and report the exact substituted focused command.

The worker must report initial failing-test evidence, exact final counts,
environment keys emitted on Windows/POSIX fixtures, poisoned-environment
results, exact error envelopes/messages, inventory disposition changes,
limitations, deviations, and decision requests.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this entire task,
   Decisions 31–32, the M7 Roadmap section, M7-001 security artifacts, and all
   affected source/tests.
2. Confirm isolated branch/worktree, assigned base ancestry, assignment commit,
   and clean state.
3. Write focused failing tests for the exact environment and safe-error
   contracts and record the expected failures.
4. Implement the smallest fresh-environment helper, fixed partial-error
   messages, and safe top-level error helper/handler wiring.
5. Audit for complete-environment spread, Windows duplicate keys, raw
   exception projection, Git stderr/path/secret leakage, new imports, and
   success-contract drift.
6. Update only the assigned M7 security artifacts after executable evidence
   passes.
7. Run every required validation, update only the worker handoff, commit all
   output, and leave the worktree clean.

## Escalate when

- an allowed Host key outside Decision 32 is required for current fixed-Git
  compatibility;
- ordinary local repository reads fail under the frozen environment;
- a public Schema/input/tool/annotation/success result must change;
- a new dependency, non-relative production import, process/network
  capability, credential, repository setting, hosted run, or live system is
  required;
- either medium finding cannot be honestly marked mitigated;
- a coordinator-only or unlisted path must change.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M7-002-security-hardening`
- Worktree: `C:\Users\C\.codex\worktrees\ab18\agent-e2e-mcp`
- Implementation commits: `5eef5278ac853d3103776ad2f480e7a87c090651`

### Implementation summary

- Replaced every fixed-Git child environment with a fresh frozen allowlist,
  canonicalizing Windows source keys and adding only `GIT_PAGER=cat`,
  `GIT_TERMINAL_PROMPT=0`, and `LC_ALL=C` overrides.
- Replaced the five named top-level MCP catch responses with the exact safe
  `{"error":"<tool-specific value>","code":"operation_failed"}` envelope.
- Replaced exception-derived partial-error messages with fixed safe messages
  while retaining the existing codes and repository-relative paths.
- Updated the M7 security inventory, threat model, and review to record
  `FIND-M7-001` and `FIND-M7-002` as mitigated with direct implementation and
  test evidence.

### Changed areas

- `src/git/change-scope.ts`: fresh child environment and fixed Git partial error.
- `src/tool-errors.ts`, `src/server.ts`: exact top-level safe envelopes.
- `src/evidence/local/collect-local-evidence.ts`: fixed local partial errors.
- `tests/unit/git-environment.test.ts`, `tests/unit/tool-errors.test.ts`,
  `tests/unit/change-scope-edge-cases.test.ts`, `tests/unit/local-evidence.test.ts`,
  `tests/unit/security-baseline.test.ts`: environment, error, wiring, and
  inventory coverage.
- `docs/security/control-inventory.json`, `docs/security/THREAT_MODEL.md`,
  `docs/security/M7_SECURITY_REVIEW.md`: mitigations and residual-risk updates.

### Validation

- Initial test-first evidence: before dependency installation the focused run
  failed during Vitest startup because this isolated worktree had no
  `node_modules`; after `npm ci`, the intended first run had 4 failed files / 5
  failed tests / 12 passed tests: missing `operationFailed`,
  `createGitEnvironment`, and fixed-message exports, plus poisoned parent Git
  redirection. The strengthened pass then had 3 expected failures / 21 passes
  until the wired partial-error constructors were implemented.
- `npm run build`: passed.
- `npx vitest run tests/unit/git-environment.test.ts tests/unit/tool-errors.test.ts tests/unit/change-scope-edge-cases.test.ts tests/unit/local-evidence.test.ts tests/unit/security-baseline.test.ts tests/integration/stdio.test.ts`: passed, 6 files / 31 tests.
- `npm run check`: passed.
- `npm test`: passed twice, each 35 files / 356 tests.
- `npm run smoke:stdio`: passed; discovered all nine tools and returned the stable fixture.
- `npm run smoke:ci`: passed; `completed_no_findings`, `code=ok`.
- `npm run pack:check`: passed; dry-run package built successfully.
- `npm audit --omit=dev --audit-level=high`: passed, `found 0 vulnerabilities`.
- `git diff --check 8b11c55ff14a6b2a8268968c17954be5ffd45132..HEAD`: passed.
- `git status --short`: clean after the handoff commit.

### Security and contract audit

- Windows fixture emitted exactly `PATH`, `SystemRoot`, `USERPROFILE`, `TMP`,
  `GIT_PAGER`, `GIT_TERMINAL_PROMPT`, and `LC_ALL`; case-variant inputs emitted
  one canonical key each. POSIX emitted exactly `PATH`, `HOME`, `GIT_PAGER`,
  `GIT_TERMINAL_PROMPT`, and `LC_ALL`; `Path` and empty `TMPDIR` were absent.
- A real Git fixture still resolved its intended root with poisoned parent
  `GIT_DIR`, `GIT_WORK_TREE`, `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_0`,
  `GIT_CONFIG_VALUE_0`, `GIT_EXTERNAL_DIFF`, pager, prompt, trace, and
  `NODE_OPTIONS` sentinels. `GIT_DIR` and `NODE_OPTIONS` were absent from the
  emitted child environment.
- Exact top-level envelopes are `{"error":"get_change_scope_failed","code":"operation_failed"}`,
  `{"error":"collect_local_evidence_failed","code":"operation_failed"}`,
  `{"error":"get_review_bundle_failed","code":"operation_failed"}`,
  `{"error":"validate_findings_failed","code":"operation_failed"}`, and
  `{"error":"write_report_failed","code":"operation_failed"}`. A source
  synchronization test proves exactly those five server handlers call the safe
  helper and that the affected server source contains no `error.message` or
  `String(error)` projection.
- Partial errors are `git_file_diff_failed` / `Git file diff could not be
  collected.`, `document_root_unavailable` / `Document root could not be
  accessed.`, and `document_read_failed` / `Document could not be read.`;
  direct constructors and source wiring are tested, and a missing configured
  root behavior test proves the fixed message with `docs/missing`.
- No complete Host-environment spread remains in fixed-Git code. The strict
  security baseline still accepts only the existing process/network boundaries.
  `FIND-M7-001` and `FIND-M7-002` are `mitigated`; `FIND-M7-003` remains open
  low and `FIND-M7-004` remains accepted informational.

### Public contract and documentation impact

- No public success Schema, tool name/input/annotation, root export, package
  metadata, dependency, version, or release state changed. Error responses are
  intentionally narrowed to Decision 32's fixed pre-1.0 safe behavior.

### Deviations from assignment

- None.

### Known limitations and risks

- The retained home/config path variables permit ordinary operator-managed
  global, system, and repository Git configuration. This mitigation is not a
  Git sandbox. Common-pattern redaction remains `FIND-M7-003`.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No dependency, lockfile, version, CI, release, npm, GitHub-setting,
      credential, hosted-run, or live external-state action was performed.
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
