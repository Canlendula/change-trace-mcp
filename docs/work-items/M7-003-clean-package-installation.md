# M7-003 — Prove clean package installation and prepare Host configurations

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `6a18ca1c56b52b7d8b3ec9ad8b2ba2299f030fa2`
- Branch: `codex/M7-003-clean-package-installation`
- Worktree: Codex-managed isolated worktree for the assigned branch; record the
  absolute path in the worker handoff.
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: implement Decision 33's reusable clean-tarball smoke, prove the
  current package installs and launches outside the checkout, and update the
  priority-Host configuration guide without making a real Host or release
  claim.
- Dependency: accepted M7-002 and Decision 33.

## Frozen artifact contract

The smoke subject is one tarball generated from the task branch with
`npm pack --json --pack-destination <temporary-directory>`. Do not use the npm
registry copy of `change-trace-mcp` as the subject, because the registry and
source versions are currently different.

The smoke must:

1. create a unique temporary root outside the repository;
2. place the generated tarball, npm cache, empty npm user config, and consumer
   project beneath that root;
3. parse the one npm pack JSON result and validate the expected package name
   and source version;
4. compute SHA-256 over the exact tarball bytes and retain npm's integrity,
   shasum, packed/unpacked sizes, and file count;
5. verify the packed file list contains the declared bin output, root package
   entry/types, README, LICENSE, SECURITY, and the packaged smoke/security
   documentation, and excludes source, tests, work items, node_modules,
   credentials, npm config, and repository metadata;
6. install the exact tarball into a fresh consumer with a fresh npm cache,
   empty temporary user config, `--ignore-scripts`, `--no-audit`, `--no-fund`,
   and no package lock;
7. ensure common npm/registry token variables and inherited user-config
   selection cannot reach the install or npx children;
8. prove the installed package is a real copied directory outside the
   repository, not a symlink or file/directory dependency back to the
   checkout;
9. validate the installed package name, version, bin, exports, engine,
   Apache-2.0 license, production dependencies, and required packaged files;
10. run `npm ls --omit=dev --json` successfully in the consumer;
11. use the existing reference client to launch the installed package with
    Node, discover exactly the current nine tools, and receive the exact M1
    fixture text;
12. use the equivalent local-tarball `npx --package ... -- change-trace-mcp`
    path with the same fresh cache and require the same result;
13. always terminate child processes and remove the complete temporary root,
    including on failure.

Use argument arrays and no shell. Bound child time, stdout, and stderr. Do not
print raw npm configuration, environment values, registry responses, absolute
home paths, or credentials. Expected command/status diagnostics may go to
stderr. Successful stdout is exactly one JSON object with bounded,
non-sensitive fields:

- schema/version for this smoke result;
- package name and source version;
- tarball filename, SHA-256, npm shasum, npm integrity, sizes, and file count;
- Node/npm/platform facts;
- install and npx launch results;
- sorted tool names and exact compatibility fixture;
- cleanup success.

The reusable command may accept bounded testing options, such as a supplied npm
executable or retained temporary root on failure, only when they do not weaken
the default production smoke. Do not add an install or runtime dependency.

## Frozen documentation contract

Update the packaged smoke guide and configuration examples to distinguish:

- development checkout launch;
- exact pinned registry version
  `change-trace-mcp@<VERSION>` for future published use;
- exact local tarball launch for maintainer smoke evidence.

Do not recommend unpinned `latest`, claim `0.0.0-dev.1` is published, or
overwrite the historical M1 Host results with a new Host pass.

### Codex

- Use the current official stdio UI/CLI/TOML forms.
- The TOML example must launch through `npx` with an exact version placeholder.
- Include all nine current tools for normal use, or label a smaller allowlist
  as compatibility-only.
- Explain project trust, restart/new-task behavior, startup timeout, and
  per-tool timeout without promising a particular approval policy.

### Claude Code

- Put `--transport`, `--scope`, and other Claude options before the server
  name.
- Put `--` between the server name and the `npx` executable.
- Keep local/project/user scope behavior and project approval accurate.
- The JSON example must use a stdio command plus argument array with the exact
  version placeholder.

### OpenCode

- Detect and record the exact locally installed OpenCode version.
- Keep the installed v1-compatible example explicitly version-labeled.
- Add a separate current-v2 example under `mcp.servers`; do not silently feed a
  v2 file to the installed v1 CLI.
- Treat configuration parsing/mechanical validation as preparation only.

Use these primary references, accessed 2026-07-26:

- `https://developers.openai.com/codex/mcp/`;
- `https://developers.openai.com/codex/config-reference/`;
- `https://code.claude.com/docs/en/mcp`;
- `https://opencode.ai/v2/docs/mcp-servers`;
- `https://docs.npmjs.com/cli/install/`;
- `https://docs.npmjs.com/cli/v9/using-npm/developers/`.

Create `docs/evaluation/M7_INSTALL_RESULTS.md` for the pre-integration artifact
evidence. It is intentionally outside the npm `files` list so its digest does
not recursively alter the artifact. Record the branch head, platform and
toolchain versions, exact command, artifact fields, install/npx outcomes,
cleanup result, limitations, and an explicit statement that coordinator
acceptance changes packaged Roadmap bytes and requires a final accepted-main
rerun.

## In scope

- A reusable, bounded clean-package smoke script.
- Offline unit tests for its plan, sanitized environment, result validation,
  error handling, and cleanup.
- One real fresh-cache clean-install and local-tarball npx proof.
- Current, version-labeled configuration examples and installation guidance.
- A pre-integration evaluation record and worker handoff.

## Out of scope

- Calling a model or a real Codex, Claude Code, or OpenCode session.
- Editing user/global Host configuration, user npm configuration, credentials,
  registry state, dist-tags, repository settings, or hosted CI.
- Publishing, versioning, tagging, releasing, provenance signing, SBOMs,
  attestations, or a package-publishing workflow.
- Production source, MCP tools, Schemas, annotations, identities, reports,
  dependencies, lockfile, package metadata, or package file-list changes.
- Claiming compatibility from config parsing or reference-client results.

## Allowed paths

- `scripts/smoke-clean-install.mjs`
- `tests/unit/clean-install-smoke.test.ts`
- `tests/integration/stdio.test.ts` — only if the shared reference-client
  contract needs a focused assertion
- `tests/unit/security-baseline.test.ts` — only for packaged guide/config
  integrity
- `README.md`
- `docs/smoke-tests/README.md`
- `docs/smoke-tests/config/codex.toml.example`
- `docs/smoke-tests/config/claude.mcp.json.example`
- `docs/smoke-tests/config/opencode.json.example`
- `docs/smoke-tests/config/opencode-v2.json.example` — optional new file
- `docs/evaluation/M7_INSTALL_RESULTS.md` — new pre-integration result
- `docs/work-items/M7-003-clean-package-installation.md` — worker handoff only

Reading repository files, Git metadata, installed CLI/package metadata, and the
primary references is allowed. Writing outside the listed paths is not.

## Coordinator-only paths and actions

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- assignment, acceptance, and coordinator-review sections of this file
- `package.json`, `package-lock.json`, public exports, production source, and
  `.github/**`
- package versions, tags, releases, npm publish/dist-tags, repository settings,
  credentials, hosted runs, and real Host/model sessions

## Acceptance criteria

- [ ] The smoke builds and parses one exact local tarball in a temporary
      artifact directory and records its independent SHA-256 plus npm metadata.
- [ ] Packed-file assertions cover required inclusions and forbidden source,
      test, work-item, dependency, config, credential, and repository paths.
- [ ] A fresh-cache, empty-user-config, lifecycle-script-disabled consumer
      installation passes without using checkout `node_modules`.
- [ ] The installed package is copied outside the checkout, its bin/exports/
      engine/license/dependencies/docs are correct, and production `npm ls`
      passes.
- [ ] Installed-Node and local-tarball npx launches each expose exactly nine
      tools and the byte-stable fixture.
- [ ] Child execution is shell-free, bounded, credential-sanitized, and cleaned
      up on success and deterministic failure.
- [ ] Offline tests prove planning, sanitization, parsing, bounded failures, and
      cleanup without accessing the registry.
- [ ] Codex, Claude Code, installed OpenCode v1, and current OpenCode v2
      examples are syntactically and version-semantically accurate.
- [ ] Documentation separates checkout, pinned registry, and local tarball
      paths and makes no release or real-Host claim.
- [ ] The evaluation record is outside package contents and clearly marks its
      proof as pre-integration.
- [ ] No package metadata, lockfile, dependency, source, public contract,
      version, CI, registry, credential, release, or live Host state changed.

## Required validation

```text
npm run build
npx vitest run tests/unit/clean-install-smoke.test.ts tests/unit/security-baseline.test.ts tests/integration/stdio.test.ts
node scripts/smoke-clean-install.mjs
npm run check
npm test
npm test
npm run smoke:stdio
npm run smoke:ci
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check <BASE_COMMIT>..HEAD
git status --short
```

The real clean-install smoke is authorized only for registry reads needed to
install the already-declared dependencies. It must use no user credential,
make no registry write, and leave no retained cache/artifact/consumer state.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete work item,
   Decisions 31–33, the M7 Roadmap section, current package metadata, smoke
   client, guides/configs, security baseline, and referenced official docs.
2. Confirm the isolated branch/worktree, exact assignment commit, ancestry,
   and clean state.
3. Write offline failing tests for the smoke plan, environment sanitization,
   pack-result validation, fixed summary, failure bounds, and cleanup.
4. Implement the smallest portable script and make offline tests pass.
5. Update the packed guide/config examples; validate JSON/TOML and v1/v2
   separation without starting a real Host.
6. Run the real clean-install smoke from the final packed-content state and
   write the pre-integration evaluation record outside package contents.
7. Audit package contents, checkout independence, network/credential boundary,
   temporary cleanup, documentation claims, and protected paths.
8. Run every required validation, update only the worker handoff, commit all
   output, and leave the task worktree clean.

## Escalate when

- current package contents cannot install or launch with lifecycle scripts
  disabled;
- a declared production dependency requires credentials, an install script, or
  a non-default registry;
- npm cannot exercise a local-tarball npx launch on the current platform;
- accurate Host examples require a package metadata, dependency, public
  contract, or production-source change;
- an installed Host version cannot be reconciled with a version-labeled
  primary source;
- a real Host/model call, user/global config mutation, credential, hosted run,
  publish, or coordinator-only path is required.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M7-003-clean-package-installation`
- Worktree: `C:\Users\C\.codex\worktrees\a099\agent-e2e-mcp`
- Implementation commits: `8e71ef873fcc820d3ace79d56b97b7a9954f2b6f`; `6212b51a8e89a7b191549669687435f99ee77d20`; `837dfa948858d3262b7f9a530875ea8d54d0d262`; `255dcc309a45e04d70db728e3e143cf930907f80`; final handoff record follows this change-request fix.

### Implementation summary

- Added a reusable local-tarball clean-install smoke that uses a unique OS temporary root, one `npm pack --json` result, independent SHA-256, packed-path allow/deny checks, fresh cache and empty user config, lifecycle-script-disabled install/npx paths, sanitized environment, shell-free bounded children, and unconditional cleanup.
- Added offline coverage for planning, environment sanitization, pack/launch/summary validation, temporary-root cleanup, timeout/output bounds, credential/config path rejection, npm CLI override/fallback, and POSIX SIGKILL escalation (platform-skipped on Windows).
- Prepared exact-version configuration examples for Codex, Claude Code, installed OpenCode v1.18.4, and current OpenCode v2 without making a real Host claim.
- Change-request follow-up: fixed cross-volume Windows containment so a `C:` temporary root is correctly outside a `D:` checkout; this also corrects installed-package and tarball containment checks that share the helper.
- Change-request follow-up: removed the unused `.mjs` hashbang so Vitest 4.1.10's default Vite module runner can load the smoke helper from a `D:` project checkout. The documented `node scripts/smoke-clean-install.mjs` invocation is unchanged.

### Changed areas

- `scripts/smoke-clean-install.mjs` — reusable clean local-package smoke.
- `tests/unit/clean-install-smoke.test.ts` — offline smoke helper and bounded-failure coverage.
- `tests/unit/security-baseline.test.ts` — packaged guide/config integrity checks.
- `docs/smoke-tests/README.md` and `docs/smoke-tests/config/*` — pinned registry, checkout, local-tarball, and version-separated Host preparation guidance.
- `docs/evaluation/M7_INSTALL_RESULTS.md` — un-packaged pre-integration artifact evidence.

### Validation

- Initial failing test-first runs exposed path-separator/Windows-key behavior, missing temporary-root/summary/CLI fallback coverage, and broad credential-path coverage; each was corrected before the final run.
- `npm run build` — passed.
- `npx vitest run tests/unit/clean-install-smoke.test.ts tests/unit/security-baseline.test.ts tests/integration/stdio.test.ts` — passed: 18 passed, 1 Windows-inapplicable POSIX escalation test skipped.
- `node scripts/smoke-clean-install.mjs` — passed from artifact commit `6212b51a8e89a7b191549669687435f99ee77d20`.
- `npm run check` — passed.
- `npm test` (run twice) — each passed: 367 passed, 1 Windows-inapplicable POSIX escalation test skipped.
- `npm run smoke:stdio` — passed with all nine tools and the exact fixture.
- `npm run smoke:ci` — passed: `outcome=completed_no_findings code=ok` and `smoke=ok`.
- `npm run pack:check` — passed: 197 files, 151.4 kB packed / 786.2 kB unpacked.
- `npm audit --omit=dev --audit-level=high` — passed: 0 vulnerabilities.
- `git diff --check 6a18ca1c56b52b7d8b3ec9ad8b2ba2299f030fa2..HEAD` — passed.
- `git status --short` — clean after the final evidence commit.
- Change-request follow-up validation: focused suite passed 19 tests with 1 Windows-inapplicable POSIX test skipped; both required full test runs passed 368 tests with 1 skip; build, check, clean-install smoke, stdio/CI smoke, pack check, audit, and diff checks passed.
- Vite follow-up validation: the exact default `npx vitest run tests/unit/clean-install-smoke.test.ts` passed 11 tests with 1 platform skip. The focused suite, two full suites, build, check, clean-install smoke, stdio/CI smoke, pack check, audit, and diff checks passed again.

### Artifact and clean-install evidence

- Artifact commit: `6212b51a8e89a7b191549669687435f99ee77d20`.
- Tarball: `change-trace-mcp-0.0.0-dev.1.tgz`; SHA-256 `11ba87bc0760f23c1ccac65635b4bb086155d4bb5d19b48ff0437a74bdb5a040`; npm shasum `07d540a59ff3dad5140bb73a8a2c80dd09e07153`; integrity `sha512-nL4vfgss0smKC321ro8AJB1qAFQODFLR13v6L9Z8IRjc9oM7dDn/U25OfcBCJOCwLvzwE5TJQt+CxHEaSEMKMA==`; packed/unpacked sizes `151369` / `786243`; 197 files.
- Fresh consumer install, copied-package checks, production `npm ls`, installed-Node reference launch, and isolated local-tarball npx reference launch all passed. Both launches exposed exactly `collect_external_evidence`, `collect_local_evidence`, `collect_runtime_evidence`, `get_change_scope`, `get_compatibility_fixture`, `get_review_bundle`, `get_server_info`, `validate_findings`, and `write_report`, and returned the required byte-stable M1 fixture. Cleanup reported success; the OS temporary directory had no retained `change-trace-clean-install-*` root.

### Host configuration and claim audit

- Official primary references were accessed 2026-07-26. Codex TOML uses `mcp_servers`, exact-version npx, all nine tools, startup timeout, and per-tool timeout. Claude Code uses `--transport`/`--scope` before the server name and `--` before npx; the JSON example uses stdio command plus args. Installed OpenCode `1.18.4` retains its direct `mcp.<name>` v1 form; current v2 is separately placed under `mcp.servers` with `disabled: false`, timeout object, and `codemode: false`.
- JSON parsing and integrity tests passed. No Codex, Claude Code, OpenCode, model, credential-bearing, or live Host session was started; no Host compatibility claim is made.

### Public contract and documentation impact

- Package metadata, dependency graph, lockfile, public source/tool/schema contracts, CI, and version remain unchanged. Packaged smoke documentation now distinguishes development checkout, a future exact pinned registry version, and maintainer local-tarball evidence. The evaluation record is intentionally excluded from the package; coordinator acceptance updates packaged Roadmap bytes and requires a new accepted-main smoke/digest.

### Deviations from assignment

- None.

### Known limitations and risks

- The clean-install proof is Windows/Node `v24.0.0`/npm `11.3.0` evidence. POSIX SIGTERM-ignore escalation is tested but skipped on Windows. It proves package mechanics and reference-client behavior only; real priority-Host evidence remains M7-004 work.

### Decisions or questions for coordinator

- None. The coordinator must rerun the clean-install smoke after acceptance changes the packaged Roadmap on `main`.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No dependency, lockfile, package metadata, version, CI, registry,
      release, credential, hosted-run, or real Host/model action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head: `fc43a15901e34ff841817f57d7c8258ffdf0c502`
- Integration commits: initial fast-forward
  `fc43a15901e34ff841817f57d7c8258ffdf0c502`; cross-volume fix and handoff
  `555ffa5` / `3553dda`; Vite-loader fix and handoff `3ad1f06` / `25f2e23`.
- Final accepted-main artifact commit: pending coordinator acceptance commit
  and required clean-install rerun.
- Final accepted-main artifact SHA-256: pending required clean-install rerun.

### Review findings

- No unresolved findings. The reviewed branch stayed within its allowed paths,
  preserved package metadata and public contracts, and maintained a
  reconstructible artifact/evidence boundary.
- The first accepted-main smoke exposed a Windows cross-volume containment
  error for a `D:` checkout with a `C:` temporary directory. Commit `555ffa5`
  rejects absolute `path.relative()` results and adds the regression.
- The next default focused run exposed a Vitest 4.1.10 Vite-module-runner parse
  failure for the unused `.mjs` hashbang in the `D:` checkout. Commit `3ad1f06`
  removes the hashbang; the supported invocation remains
  `node scripts/smoke-clean-install.mjs`.
- Branch validation passed the build, 19-test focused gate, two complete
  368-test suites, clean installation, stdio and advisory-CI smokes, package
  dry-run, zero-vulnerability production audit, diff check, and clean-status
  check. The single skipped test is the POSIX-only SIGTERM escalation case on
  Windows. Final coordinator main-worktree validation follows the packaged
  Roadmap update.
- Current primary documentation confirms the recorded Codex, Claude Code, and
  OpenCode v1/v2 configuration forms. These mechanical examples do not support
  a real-Host compatibility claim.

### Required follow-up

- Rerun the complete coordinator gates and clean-install smoke from the exact
  accepted-main artifact state after this packaged Roadmap update, then record
  its final digest in the un-packaged evaluation record.
- Keep M7-004 real Codex, Claude Code, and OpenCode sessions behind the explicit
  model/API/user-configuration authorization boundary in Decision 33.

### Roadmap and release impact

- M7-003 package mechanics and configuration-preparation criteria are accepted.
  This advances construction-sequence item 3 only through clean installation;
  real priority-Host compatibility remains M7-004. No release, registry, hosted
  CI, version, or package-compatibility claim is authorized by this acceptance.
