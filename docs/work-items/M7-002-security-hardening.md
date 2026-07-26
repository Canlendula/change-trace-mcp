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

- Status: `assigned | in_progress | ready_for_review | blocked | needs_decision`
- Handoff branch:
- Worktree:
- Implementation commits:

### Implementation summary

- `<summary>`

### Changed areas

- `<path and purpose>`

### Validation

- `<command: result>`

### Security and contract audit

- `<environment, safe-error, import/capability, and finding evidence>`

### Public contract and documentation impact

- `<impact>`

### Deviations from assignment

- `<deviation, or None>`

### Known limitations and risks

- `<limitation, or None>`

### Decisions or questions for coordinator

- `<decision request, or None>`

### Protected-file confirmation

- [ ] Coordinator-only files were not modified.
- [ ] No dependency, lockfile, version, CI, release, npm, GitHub-setting,
      credential, hosted-run, or live external-state action was performed.
- [ ] All intended handoff changes are committed to the task branch.

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
