# M7-004 — Prove the installed artifact in three real Agent Hosts

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `cdb90a6c2c2c9963b69d332b5b957746e08b3405`
- Branch: `codex/M7-004-real-host-compatibility`
- Worktree: Codex-managed isolated worktree for the assigned branch; record the
  absolute path in the worker handoff.
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: implement the bounded M7-004 Host-validation harness and prove one
  installed local tarball in fresh Codex, Claude Code, and OpenCode sessions.
- Dependencies: accepted M7-003, Decision 33, and the user's explicit
  credential-bearing Host-call authorization on 2026-07-26.

The worker must start from the exact Base commit above.

## Frozen evidence subject

All three Hosts must call one installation of one exact local tarball:

1. run `npm pack --json` once from a committed task-branch state;
2. record package name/version, npm integrity and shasum, independent SHA-256,
   packed file count, size, unpacked size, and the SHA-256 of the packed
   `dist/cli.js`;
3. install that tarball outside the repository with a fresh npm cache, empty
   temporary user config, lifecycle scripts disabled, and registry credential
   variables removed;
4. verify the installed package is outside the checkout, has a valid
   production dependency tree, and matches the recorded packed runtime;
5. keep that exact installation alive only while the three Host sessions run,
   then remove the artifact, consumer, cache, configs, logs, and state root.

Do not use checkout-relative `dist/cli.js`, the npm registry package, an npm
dist-tag, or separate artifacts per Host. Test instrumentation may proxy stdio
and record lifecycle events, but the MCP server process behind that proxy must
be the installed artifact.

## Frozen Host matrix

| Host | Required session | Configuration boundary |
|---|---|---|
| Codex Desktop `26.707.3748.0` | A newly created Codex task using `gpt-5.6-terra` with `high` reasoning | A project-scoped `.codex/config.toml` checkpoint on this task branch, with a unique M7 server name and absolute paths into the temporary evidence root |
| Claude Code `2.1.217` | One new non-persistent, non-interactive session using the user's existing CC Switch provider | `--mcp-config` plus `--strict-mcp-config`; no project, local, or user MCP registration |
| OpenCode `1.18.4` | One new `opencode run` session using the user's existing configured provider | A temporary `OPENCODE_CONFIG`; no project or user configuration edit |

The worker may record a branch-only Codex configuration checkpoint while the
temporary evidence root is live. It must remain `in_progress` at that
checkpoint and report the commit and state lifetime to the coordinator. The
coordinator creates the fresh Codex Host task. After its result is returned,
the worker removes `.codex/config.toml`, finalizes the evidence, and cleans up.
The final task head must not contain `.codex/config.toml`.

Each Host session must:

- start the installed MCP process successfully;
- discover exactly these nine server tools:
  `collect_external_evidence`, `collect_local_evidence`,
  `collect_runtime_evidence`, `get_change_scope`,
  `get_compatibility_fixture`, `get_review_bundle`, `get_server_info`,
  `validate_findings`, and `write_report`;
- call `get_compatibility_fixture` with `{}`;
- return this exact text payload:

```json
{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}
```

- finish within the configured startup and tool-call bounds;
- close the MCP process when the Host session exits, with no recorded orphan.

A model-written claim alone is insufficient. Durable evidence must bind the
Host version/session, observed MCP tool call, exact tool result, instrumented
server lifecycle, artifact identity, and final exit status. The committed
record may contain bounded redacted event excerpts or hashes. Raw Host logs
remain temporary and must be deleted.

## Authorization and safety boundary

The user authorizes the minimum model/API calls needed for the three frozen
Host sessions and use of already configured authentication:

- Codex may use the existing signed-in Codex account;
- Claude Code may use the existing CC Switch third-party provider;
- OpenCode may use its existing provider credentials.

This authorization does not permit:

- reading, printing, copying, committing, or changing credential values;
- modifying user/global Codex, Claude Code, OpenCode, npm, Git, or shell
  configuration;
- running additional semantic review prompts or unrelated tools;
- publishing, changing npm dist-tags, tagging, releasing, or using hosted CI;
- retrying a billable Host session after it reached the MCP call without
  coordinator approval.

Use existing authentication as opaque Host state. Do not enumerate secret
environment variables or credential files. If a Host requests login, trust,
2FA, browser confirmation, or a provider choice, stop and report the exact
non-secret prompt to the coordinator so the user can intervene.

The Host prompt must be fixture-specific, bounded, and prohibit repository
edits. Allow only the nine MCP tools where the Host supports an allowlist.
Record every attempt, including failures before a successful call; do not
replace or conceal an unsuccessful run.

## In scope

- A reusable, deterministic local harness for artifact preparation, temporary
  Host configuration, bounded lifecycle observation, evidence normalization,
  validation, and cleanup.
- Offline tests for planning, artifact and path validation, environment
  sanitization, Host command construction, exact event/result validation,
  timeout/termination handling, redaction, attempt accounting, and cleanup.
- The three authorized real Host sessions.
- An un-packaged M7 Host evaluation record.
- The worker-owned handoff in this file.

## Out of scope

- Product source, public schemas, MCP tool behavior, package metadata,
  dependencies, versioning, or packaged Host guidance.
- General-purpose Host automation, new providers, provider benchmarking,
  semantic review quality, browser automation, or hosted execution.
- User/global configuration changes and credential management.
- M7 exit-gate completion, CI examples, changelog/version work, pilot claims,
  publishing, tags, releases, and npm dist-tags.

## Allowed paths

- `scripts/smoke-real-hosts.mjs`
- `tests/unit/smoke-real-hosts.test.ts`
- `docs/evaluation/M7_HOST_RESULTS.md`
- the Worker handoff section of
  `docs/work-items/M7-004-real-host-compatibility.md`
- `.codex/config.toml` only as a temporary committed checkpoint for the fresh
  Codex Host task; it must be absent from the final task head

## Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- the Assignment and Coordinator review sections of this file
- all package versions, tags, releases, publishing metadata, npm dist-tags,
  repository settings, and hosted workflow state

## Acceptance criteria

- [ ] One exact committed local tarball and one copied installation are bound
      to all three Host results with the required identity fields.
- [ ] Artifact preparation and install keep credentials out of npm and MCP
      child environments and leave no repository artifact.
- [ ] Codex Desktop `26.707.3748.0` passes in a newly created Codex task using
      the temporary project-scoped configuration.
- [ ] Claude Code `2.1.217` passes in a new strict-config, non-persistent
      one-shot session.
- [ ] OpenCode `1.18.4` passes in a new one-shot session with only the
      temporary `OPENCODE_CONFIG`.
- [ ] Each Host record contains exact nine-tool discovery, the observed
      `get_compatibility_fixture` call with `{}`, byte-identical fixture text,
      bounded timing, process shutdown, and attempt history.
- [ ] Evidence output is deterministic, bounded, secret-free, and rejects a
      mismatched Host, artifact, tool list, fixture, lifecycle, or attempt.
- [ ] Temporary artifact, installation, npm state, Host configs, raw logs, and
      Codex checkpoint configuration are removed after evidence finalization.
- [ ] No user/global configuration, product contract, package metadata,
      dependency, version, registry, hosted CI, tag, or release state changes.

## Required validation

```text
npm run check
npx vitest run tests/unit/smoke-real-hosts.test.ts
npm test
npm run smoke:stdio
npm run smoke:ci
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

The worker must also record the exact harness commands and sanitized results
for artifact preparation, Claude Code, OpenCode, Codex evidence import or
validation, finalization, and cleanup. The coordinator reruns the offline and
package gates and independently inspects the real-Host evidence before
acceptance.

## Checkpoint and handoff protocol

1. Inspect Decision 33, M7-003 evidence, the accepted clean-install harness,
   current Host examples, and installed Host CLI help.
2. Implement offline tests before making a real model/API call.
3. Prepare and validate the exact tarball and isolated installation.
4. Run Claude Code and OpenCode once each; record all attempts.
5. Commit the temporary `.codex/config.toml`, harness, tests, partial evidence,
   and an `in_progress` handoff. Report the checkpoint commit without deleting
   the temporary evidence root.
6. Wait for the coordinator's fresh Codex task result.
7. Validate and record Codex evidence, remove `.codex/config.toml`, finalize
   the evidence record, clean temporary state, run all required validation,
   update the handoff to `ready_for_review`, and commit everything.

## Escalate when

- any Host asks for authentication, trust, 2FA, browser approval, provider
  selection, or a user/global configuration write;
- the installed Host version differs from the frozen matrix;
- a model/API call beyond the first bounded session per Host is needed;
- a credential value, credential file, or unredacted raw log would need to be
  accessed or retained;
- the exact artifact cannot be shared by all three Hosts;
- a Host cannot expose the nine tools, call the fixture, or shut the process
  down within the bound;
- implementation needs a product, dependency, package, public contract,
  coordinator-only path, hosted CI, registry, or release change.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M7-004-real-host-compatibility`
- Worktree: `C:\Users\C\.codex\worktrees\79ab\agent-e2e-mcp`
- Implementation commits: `a29488c5919ec82055877d7627209c0a3aa84eb0`; `df54c3781b785917f6a9fbea6df0326d70268cc0`; `2dde4cfedd8be48d8e693eb2fc993a2c204fee95`; `13e9d13c52590381434780e747c2eb9b4badcf76`; `bdfc05d479485abdb4f6b20435b965ac7d1f3940`; `47df434c0821be8abc57b1b4388f481f7ae13fbb`; final handoff record follows this commit.

### Implementation summary

- Implemented a deterministic local-tarball Host harness with a fresh npm
  cache and config, copied installation validation, a credential-free MCP-child
  environment, stdio lifecycle probe, bounded raw Host logs, strict attempt
  validation, and checkpoint support.
- Added offline tests for path planning, environment sanitization, strict Host
  command construction, lifecycle/result validation, failed-attempt accounting,
  diagnostic classification, bounded termination/output handling, CLI
  resolution, Host-held Codex evidence, and finalization refusal/success.
- Post-review hardening now resets lifecycle evidence per Host, validates exact
  event counts, represents Codex Host-held cleanup explicitly, and offers a
  safe callable finalization action. It also requires an exact executable
  `--version` observation before future Host sessions. It was not used for the
  already-manual real-session cleanup.
- Prepared one committed local tarball and one isolated installation. Claude
  Code and OpenCode passed against that shared installed artifact. The fresh
  Codex task discovered the nine tools and returned the exact fixture. Codex
  Desktop retained its project MCP process after turn completion and archive;
  this Host-specific lifecycle observation and explicit cleanup are recorded
  for coordinator review.

### Changed areas

- `scripts/smoke-real-hosts.mjs` — reusable preparation, Host launch,
  lifecycle instrumentation, validation, checkpoint, and cleanup harness.
- `tests/unit/smoke-real-hosts.test.ts` — offline deterministic coverage.
- `docs/evaluation/M7_HOST_RESULTS.md` — sanitized partial evidence.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/unit/smoke-real-hosts.test.ts` | passed | 17 tests, 1 Windows-inapplicable skip |
| `npm run check` | passed | before real Host calls |
| `npm test` | passed | 385 passed, 2 Windows-inapplicable skips (post-review hardening) |
| `npm run smoke:stdio` | passed | nine tools and exact fixture |
| `npm run smoke:ci` | passed | advisory smoke |
| `npm run pack:check` | passed | package dry run |
| `npm audit --omit=dev --audit-level=high` | passed | 0 vulnerabilities |
| artifact prepare / Claude / OpenCode harness commands | passed | one shared installation |
| fresh Codex task | passed | nine tools, exact fixture, `10965 ms` task / `2 ms` MCP call; Host-held lifecycle recorded |

### Real Host evidence

- The exact artifact identity and sanitized Host evidence are in
  `docs/evaluation/M7_HOST_RESULTS.md`. Claude attempt history retains two
  launcher-resolution failures and two pre-call CLI diagnostics; its final
  session and the single OpenCode session passed. The fresh Codex task passed
  its nine-tool and exact-fixture checks; its distinct long-lived lifecycle and
  explicit zero-orphan cleanup are recorded without calling it a graceful
  one-shot close.
- The tarball was packed from clean source commit
  `13e9d13c52590381434780e747c2eb9b4badcf76`; its installed runtime digest is
  the `dist/cli.js` unpacked from that exact integrity-bound artifact.

### Public contract and documentation impact

- No public product contract, package metadata, dependencies, version, or
  packaged Host guidance changed. The evaluation record and harness are not
  packaged.

### Deviations from assignment

- The first two Claude launcher attempts used Windows shim paths and failed
  before a Host session; the next two reached MCP startup but exited before a
  tool call because Claude requires `--verbose` with stream JSON. All are
  retained in bounded temporary attempt history. The final retry used the
  documented native executable and passed; this is within the assignment's
  no-retry-after-MCP-call restriction.
- Codex Desktop retained its project MCP after turn completion and archive.
  Coordinator directed that this be recorded as Host-specific lifecycle
  behavior, with exact-state cleanup, rather than retried after the call.
- The post-run Claude installation auto-updated from the pre-run observed
  `2.1.217` to `2.1.220`; the earlier captured `claude --version` observation,
  rather than a current binary check, supports the evidence session version.

### Known limitations and risks

- Codex Desktop did not emit a `server_closed` event before archive. Archive
  ended one of two exact-state pairs without a lifecycle close; the remaining
  pair required explicit exact-state cleanup. Its forced termination produced
  no probe exit code/signal, and final exact-match orphan count was zero.
- The reusable `record-codex-held` and `finalize` CLI actions are post-review
  hardening and did not run against the already-cleaned real state root.

### Decisions or questions for coordinator

- Coordinator review should update the Host-specific lifecycle/acceptance
  wording as directed: Claude/OpenCode require automatic close; Codex Desktop
  records held behavior plus explicit, exact temporary-state cleanup.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No user/global configuration or credential value was read, printed,
      copied, committed, or changed.
- [x] No version, dependency, registry, hosted CI, tag, publish, dist-tag, or
      release action was performed.
- [x] Temporary Host state and the Codex checkpoint config were removed after
      recording the Host-specific lifecycle observation.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending`
- Reviewed branch head:
- Integration commit:

### Review findings

- Pending.

### Required follow-up

- Pending.

### Roadmap and release impact

- Pending.
