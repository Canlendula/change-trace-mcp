# M7-007 — Prepare stage-only publishing and a non-publishing dry-run

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `7dc391b1676ae3626fa1a416580e40e8575f40bb`
- Branch: `codex/M7-007-stage-only-publishing-dry-run`
- Worktree: Codex-managed isolated worktree for the assigned branch; record the
  absolute path in the worker handoff.
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: prepare a manual, stage-only npm publishing workflow and a
  credential-free local dry-run, prove their safety boundaries offline, and
  document the later human authorization steps without staging or publishing
  anything.
- Dependencies: accepted M7-003 clean-install proof, accepted M7-005 packaged
  CI fixtures, accepted M7-006 public version/contribution guidance, and
  Decision 37.

The Base commit is the implementation review base. The coordinator will create
the task branch from the subsequent coordinator-only assignment commit that
adds this contract and milestone bookkeeping. The worker must start from that
prepared task branch and must not modify the coordinator-owned assignment
delta.

## Frozen release-state boundary

This task prepares files and offline evidence only. It must not:

- dispatch any hosted workflow;
- create or configure an npm trusted publisher;
- create or modify the `npm-stage` GitHub environment;
- create or enable the `NPM_STAGE_PUBLISH_ENABLED` repository variable;
- stage, approve, reject, publish, unpublish, deprecate, or change a dist-tag;
- create a Git tag, GitHub release, attestation, compatibility claim, or
  milestone-completion claim;
- authenticate to npm or GitHub, request a token, or read a credential.

The current source version remains `0.0.0-dev.1`. The registry's verified
`0.0.0-dev.0`, `latest`, and `next` state remains unchanged. The future
candidate version and release tag remain coordinator decisions.

## Frozen workflow surface

Add `.github/workflows/npm-stage-publish.yml` with these properties:

1. `workflow_dispatch` is the only trigger.
2. The `operation` choice defaults to `dry-run` and permits only `dry-run` and
   `stage`.
3. `dry-run` and `stage` are separate jobs with job-local permissions.
4. The dry-run job has exactly `contents: read` and never receives
   `id-token: write`, a package token, `NODE_AUTH_TOKEN`, or another release
   credential.
5. The stage job has exactly `contents: read` and `id-token: write`, uses the
   `npm-stage` environment, and can run only when all of these are true:
   - operation is `stage`;
   - repository variable `NPM_STAGE_PUBLISH_ENABLED` equals `true`;
   - the ref is exactly `refs/tags/v<input-version>`;
   - the tag annotation resolves to the checked-out commit;
   - input commit is an exact lowercase 40-hex commit equal to `HEAD`;
   - input version exactly equals `package.json` and is not
     `0.0.0-dev.0`;
   - confirmation input exactly equals
     `STAGE CHANGE-TRACE-MCP CANDIDATE`.
6. An absent or false `NPM_STAGE_PUBLISH_ENABLED` skips the stage job. Do not
   add a fallback that can bypass this gate.
7. Both jobs use GitHub-hosted Ubuntu, exact Node.js `24.18.0`, exact npm
   `11.16.0`, no package-manager cache, and explicit
   `https://registry.npmjs.org/`.
8. Dependency installation uses `npm ci --ignore-scripts --no-audit
   --no-fund`. Explicit build/check/test commands may follow.
9. Candidate publication disables lifecycle scripts. Build explicitly before
   candidate preparation instead of relying on `prepack`.
10. Actions are pinned to:
    - `actions/checkout` v7.0.1 commit
      `3d3c42e5aac5ba805825da76410c181273ba90b1`, with
      `persist-credentials: false`;
    - `actions/setup-node` v7.0.0 commit
      `820762786026740c76f36085b0efc47a31fe5020`.
11. Do not use floating action tags, third-party actions, action caches,
    artifact upload/download, package-manager cache, or external scripts.
12. The only mutating registry command present is `npm stage publish`, and it
    uses `--tag next`, `--access public`, `--ignore-scripts`, and the exact
    registry. Do not include direct `npm publish` except the non-mutating
    `npm publish --dry-run` path executed by the local helper.
13. The workflow cannot move `latest`, approve/reject a stage, create a tag or
    release, or edit repository/npm settings.

The future npm trusted-publisher configuration documented for maintainers is
exactly:

- package: `change-trace-mcp`;
- repository owner/name: `Canlendula/change-trace-mcp`;
- workflow filename: `npm-stage-publish.yml`;
- environment: `npm-stage`;
- allowed action: stage publish only.

No token-based alternative may be presented as an equivalent default.

## Frozen local dry-run

Add `scripts/release/dry-run-publish.mjs`. It is repository-only and must:

- require a clean-enough source tree for a reviewable candidate, while
  allowing only explicitly documented coordinator evidence-file changes if
  the implementation needs such an exception;
- use the current package version and reject an already published/staged
  version when that fact can be determined without authentication;
- create a unique temporary root containing isolated npm cache, user config,
  and home locations;
- remove credential-bearing npm environment variables from every child
  process;
- force the exact public npm registry and disable lifecycle scripts;
- build explicitly, create exactly one tarball with `npm pack --json
  --ignore-scripts`, then run `npm publish --dry-run` against that exact
  tarball with `--tag next`, `--access public`, `--ignore-scripts`, and the
  exact registry;
- use shell-free, fixed executable/argv child processes with bounded captured
  output and a finite timeout;
- fail closed on malformed npm JSON, extra tarballs, unexpected package
  identity/version, missing digest/integrity, output overflow, timeout, or
  cleanup failure;
- always attempt to remove the complete temporary root;
- emit one deterministic, bounded JSON summary to stdout containing package
  identity/version, exact safe operation, tag, registry, tarball file count,
  packed and unpacked sizes, SHA-1 shasum, integrity, independently calculated
  SHA-256, Node/npm versions, publish-dry-run success, and cleanup status;
- label the result as local dry-run evidence only and make no OIDC,
  provenance, GitHub-runner, trusted-publisher, stage, approval, publication,
  availability, compatibility, or release-success claim.

Diagnostics go to stderr and must be bounded. The helper must not modify the
source version, changelog, registry, tags, repository settings, or package
files. Do not add a dependency for argument parsing, process execution, YAML,
hashing, or validation.

## Publishing guide and checklist

Add repository-only `docs/release/PUBLISHING.md`. It must:

- state the frozen non-release boundary and separate dry-run, staging, npm
  approval, dist-tags, Git tags, GitHub releases, evidence claims, and
  milestone completion;
- document exact prerequisites for npm staged/trusted publishing, including
  Node/npm versions and the one-trusted-publisher limitation;
- document the exact future trusted-publisher configuration and the separately
  protected `npm-stage` environment/repository-variable authorization;
- state that enabling the repository variable alone is insufficient;
- require an unused source version, completed changelog/release decision,
  exact commit/tag agreement, clean review, and coordinator authorization
  before staging;
- require human npm WebAuthn/proof-of-presence approval after staging and
  avoid assuming a TOTP code exists;
- explain that a staged version/tag is reserved until approval or rejection;
- require `next` for a preview and prohibit moving `latest` without a separate
  release decision;
- provide rollback/abort guidance that distinguishes a failed dry-run, a
  skipped/failed workflow, a staged candidate, and a public package;
- include the exact local validation sequence below;
- explain what each evidence class proves and cannot prove;
- link primary npm, GitHub Actions/OIDC, and Node references without copying
  large external passages.

The guide may be linked from `CONTRIBUTING.md` or `README.md` only if the link
is clearly repository-maintainer guidance and remains valid in the installed
package. Prefer keeping the guide repository-only and avoid changing the npm
package allowlist.

## Offline proof

Add focused offline tests that inspect the exact workflow, helper, and
publishing guide. At minimum they must fail if:

- an automatic trigger, broad/write permission, floating action tag, action
  cache, package cache, long-lived token, or credential input is introduced;
- the dry-run job gains `id-token: write`;
- the stage job loses its operation, repository-variable, environment,
  tag/version/commit, or fixed-confirmation guard;
- a direct `npm publish` or any stage approve/reject/dist-tag/tag/release
  mutation appears in the workflow;
- the stage command can move `latest`, run lifecycle scripts, or target a
  non-public registry;
- the helper can consume release credentials, create multiple tarballs, omit
  cleanup/bounds, or make a release-success claim;
- repository-only release files leak into the npm tarball;
- the documentation suggests that this task configured, staged, approved, or
  published anything.

Tests must be deterministic and perform no network request, authentication,
workflow dispatch, registry write, repository-setting change, or package
publication.

## In scope

- The frozen manual workflow.
- The repository-only publishing guide.
- The bounded local dry-run helper.
- Focused offline unit/integration tests.
- A concise `CHANGELOG.md` `Unreleased` note for the repository-maintainer
  release preparation, without implying publication.
- The Worker handoff section of this file.

## Out of scope

- Product source, MCP tools, Schemas, exports, bin names, dependencies,
  lockfile, package version, package `files`, license, security policy, public
  extension contracts, or installed-package documentation.
- Hosted workflow execution, npm/GitHub authentication, tokens, trusted
  publisher/environment/variable configuration, package staging/approval/
  rejection/publication, tags, releases, attestations, provenance claims,
  dist-tags, compatibility publication, pilot activity, or M7 completion.
- Any package-version selection, changelog release dating, beta/stable label,
  or release-notes finalization.

## Allowed paths

- `.github/workflows/npm-stage-publish.yml`
- `docs/release/PUBLISHING.md`
- `scripts/release/dry-run-publish.mjs`
- `tests/unit/release-publishing-contract.test.ts`
- `tests/integration/release-dry-run.test.ts`
- `CHANGELOG.md` — `Unreleased` note only
- the Worker handoff section of this file

## Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- the Assignment and Coordinator review sections of this file
- package version, dependency/lockfile/package surface, repository settings,
  npm trusted-publisher/settings state, credentials, tags, releases,
  attestations, publishing metadata, npm dist-tags, and hosted workflow state

## Acceptance criteria

- [ ] The only hosted trigger is manual, dry-run is the default, and no
      hosted workflow is dispatched during this task.
- [ ] The dry-run job has no OIDC or credential path; the stage job is
      independently permissioned and remains disabled by an absent/false
      repository variable.
- [ ] Exact tag/version/commit/confirmation/environment/variable guards
      precede the one stage-only `next` command.
- [ ] Exact action SHAs, Node/npm versions, registry, no-cache behavior, and
      disabled lifecycle behavior are offline-tested.
- [ ] The local helper creates and dry-runs exactly one current-version
      tarball in an isolated credential-free temporary environment, reports
      bounded digest/runtime/cleanup evidence, and leaves no temporary root.
- [ ] The publishing guide distinguishes every release state and manual
      authorization boundary without claiming that any external state changed.
- [ ] Existing nine-tool, M1, public-documentation, packaged-CI, production
      dependency, package-surface, and clean-install gates still pass.
- [ ] The exact npm artifact does not include repository-only release files.
- [ ] No source, public contract, dependency, lockfile, version, package
      allowlist, credential, repository setting, registry, stage, tag, release,
      publish, approval, dist-tag, hosted-run, or pilot state changes.

## Required validation

```text
npm run check
npx vitest run tests/unit/release-publishing-contract.test.ts tests/integration/release-dry-run.test.ts
npm test
npm run smoke:stdio
npm run smoke:ci
node scripts/release/dry-run-publish.mjs
node scripts/smoke-clean-install.mjs
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

The worker must record the exact focused/full test counts, local dry-run
summary, clean-install digest/summary, package file count, npm audit result,
and any skipped validation. Running the local dry-run is allowed because it
uses npm's non-mutating `--dry-run`; no hosted run or authenticated npm
command is allowed.

## Escalate when

- npm CLI behavior makes the stated stage-only OIDC boundary impossible;
- an action pin, exact Node/npm version, registry behavior, or staged-publish
  command differs from Decision 37;
- a dependency, token, hosted run, external setting, version change, package
  allowlist change, public contract change, or release-state mutation appears
  necessary;
- the local helper cannot remove credentials, bound child output, enforce one
  tarball, or prove complete cleanup;
- the current package version is already published or staged;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M7-007-stage-only-publishing-dry-run`
- Implementation commits: `b143b10`, `32eeee9`, `3193582`, `d9dbf51`, `d45f39d`
- Worktree: `C:\Users\C\.codex\worktrees\3384\agent-e2e-mcp`

### Implementation summary

- Added the manual-only `npm-stage-publish.yml` workflow. Its default
  credential-free dry-run is separated from the protected, guarded `stage`
  job, which can only use `next`.
- Added the repository-only publishing guide, bounded credential-free local
  dry-run helper, offline workflow/helper/documentation contract tests, and
  an Unreleased maintainer-preparation note.
- Addressed coordinator review findings: setup-node now disables its package
  manager cache and verifies Node 24.18.0's bundled npm 11.16.0; stage-only
  inputs are optional for dry-run; the helper now uses a narrow child-env
  allowlist, fail-closed version status parsing, and bounded tarball evidence.

### Changed areas

- `.github/workflows/npm-stage-publish.yml` — pinned manual dry-run and
  stage-only workflow with job-local permissions, no package-manager cache,
  bundled npm verification, and fixed safeguards.
- `scripts/release/dry-run-publish.mjs` — isolated bounded local tarball and
  `npm publish --dry-run` evidence helper with narrow environment inheritance,
  registry-status failure closure, and on-disk tarball validation.
- `docs/release/PUBLISHING.md` and `CHANGELOG.md` — repository maintainer
  procedure and scoped Unreleased preparation record.
- `tests/unit/release-publishing-contract.test.ts` and
  `tests/integration/release-dry-run.test.ts` — deterministic offline
  contract and package-boundary coverage.

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm run check` | passed | TypeScript check completed. |
| `npx vitest run tests/unit/release-publishing-contract.test.ts tests/integration/release-dry-run.test.ts` | passed | 2 files, 7 tests passed; no network, authentication, or dispatch. |
| `npm test` | passed | 41 files passed; 400 tests passed and 2 skipped. |
| `npm run smoke:stdio` | passed | Confirmed the existing nine-tool stdio surface. |
| `npm run smoke:ci` | passed | Deterministic advisory smoke reported `completed_no_findings`. |
| `node scripts/release/dry-run-publish.mjs` | passed | `change-trace-mcp@0.0.0-dev.1`; exactly 1 tarball containing 209 files; packed/unpacked `177366`/`868803` bytes; SHA-1 `2368cc2daf2b699d5147f5f7515791529d038513`; SHA-256 `4d319bf981300d85d19e12b1e927a5b49b075a4ad2bf6306818cd03fa137f4f4`; Node `v24.0.0`; npm `11.3.0`; cleanup `true`. Local dry-run evidence only. |
| `node scripts/smoke-clean-install.mjs` | passed | 209 packed files; SHA-256 `4d319bf981300d85d19e12b1e927a5b49b075a4ad2bf6306818cd03fa137f4f4`; copied install, npx, CI artifacts, and cleanup succeeded. |
| `npm run pack:check` | passed | `change-trace-mcp-0.0.0-dev.1.tgz`; 209 files; release-only files absent. |
| `npm audit --omit=dev --audit-level=high` | passed | `found 0 vulnerabilities`. |
| `git diff --check` | passed | No whitespace errors. |
| `git status --short` | passed | Clean before this handoff update. |

### External-state confirmation

- [x] No hosted workflow was dispatched.
- [x] No npm or GitHub authentication was requested or used.
- [x] No trusted publisher, environment, repository variable, registry,
      stage, approval, publication, tag, release, or dist-tag state changed.

### Public contract and documentation impact

- No installed-package public contract changed. Repository-only maintainer
  guidance and offline release-boundary tests were added.

### Deviations from assignment

- None.

### Known limitations and risks

- The successful local helper invocation used the available local Node `v24.0.0`
  and npm `11.3.0`; the future hosted workflow uses Node `24.18.0`, which
  bundles and verifies npm `11.16.0` without a global npm installation.
- A local `--dry-run` cannot establish OIDC, trusted-publisher, protected
  environment, stage, approval, registry availability, or release success.
- The unauthenticated version lookup cannot see a pending staged reservation;
  a coordinator must separately confirm that state through the authorized npm
  review path before a future stage request.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No dependency, lockfile, package surface, version, tag, publish, or
      release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `accepted`
- Reviewed branch head:
  `ef862e1de28a93d110513466891b09b98e4cd186`
- Integration commit:
  `ef862e1de28a93d110513466891b09b98e4cd186` (fast-forward)

### Review findings

- The first review requested stricter inherited-environment isolation,
  fail-closed npm version-status handling, real package file counts and
  tarball bounds, setup-node cache/runtime pinning, direct behavior tests, and
  exact staged-publishing references.
- Commits `d9dbf51` and `d45f39d` resolved those findings. Independent review
  confirmed the workflow has only a manual trigger, job-local permissions,
  an absent/false repository-variable stop, exact tag/version/commit/
  confirmation guards, stage-only `next`, and no credential or direct-publish
  path.
- Coordinator validation passed 7 focused tests and the complete 41-file
  suite at 400 passed / 2 existing Windows-inapplicable skips. An additional
  adversarial local dry-run injected invalid npm registry/config, token, proxy,
  and unrelated credential variables; the helper still forced the public
  registry and isolated configuration and produced the same 209-file digest.

### Required follow-up

- Do not dispatch `stage`, configure the trusted publisher/environment/
  repository variable, create a tag, or perform npm approval without a
  separate coordinator/user release authorization and interactive
  proof-of-presence.
- Proceed to the M7 pilot kit and baseline metric schema as a separate work
  item. Offline fixtures cannot satisfy the real multi-team, multi-week pilot
  gate.

### Roadmap and release impact

- M7 construction-sequence item 6 is accepted. This adds repository-only
  release preparation and offline evidence; it does not change the package
  version or establish OIDC, provenance, staging, approval, publication,
  compatibility, release, or M7 completion.
