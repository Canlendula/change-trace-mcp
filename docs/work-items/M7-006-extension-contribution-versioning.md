# M7-006 — Publish extension, contribution, changelog, and version guidance

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `2a3eb5f90eed817a307a76490e4ced63c4d2cf0f`
- Branch: `codex/M7-006-extension-contribution-versioning`
- Worktree: Codex-managed isolated worktree for the assigned branch; record the
  absolute path in the worker handoff.
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: publish complete, mutually consistent guidance for external
  adapter authors, runtime converter authors, public contributors, changelog
  maintainers, and package/Schema versioning, then prove those entry points
  are present and usable in the exact installed package artifact.
- Dependencies: accepted M5/M6 extension boundaries, accepted M7-003
  clean-install harness, accepted M7-005 package surface, and Decisions 23–30,
  33, 35, and 36.

The Base commit is the implementation review base. The coordinator will create
the task branch from the subsequent coordinator-only assignment commit that
adds this contract and milestone bookkeeping. The worker must start from that
prepared task branch and must not modify the coordinator-owned assignment
delta.

## Frozen documentation surface

The npm artifact must add these public entry points:

1. root `CONTRIBUTING.md`;
2. root `CHANGELOG.md`;
3. `docs/VERSIONING.md`;
4. `docs/external-adapters/AUTHORING.md`;
5. `docs/runtime-evidence/CONVERTER_AUTHORING.md`.

`README.md`, `docs/external-adapters/README.md`, and
`docs/runtime-evidence/README.md` must link to the appropriate entry points.
The root README contribution section must lead package consumers to
`CONTRIBUTING.md`; it may separately identify the repository-only
coordinator/worker workflow without creating a broken installed-package link.

Do not package `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`,
`docs/work-items/`, tests, local reports, credentials, or maintainer-only
release state.

## Public contribution contract

`CONTRIBUTING.md` must cover:

- prerequisites and the existing local build/check/test commands;
- a bounded issue/PR workflow for bugs, documentation, tests, and features;
- prior discussion for public MCP/Schema/configuration/security/dependency or
  materially breaking changes;
- tests, public documentation, and `CHANGELOG.md` expectations;
- no secrets, generated local evidence, private repository content, or
  credential-bearing fixtures;
- responsible security reporting through `SECURITY.md`;
- contributing only material the contributor has the right to provide under
  the repository's Apache-2.0 license;
- the coordinator's review/release authority without granting workers
  governance or release permissions;
- an explicit statement that the repository currently claims no CLA/DCO or
  guaranteed response-time policy.

Keep the existing internal workflow intact. Do not replace public contribution
guidance with worker-session mechanics.

## Version and changelog contract

`docs/VERSIONING.md` must:

- define the package public surface and SemVer treatment;
- describe `0.0.0-dev.N` as pre-stable construction snapshots;
- keep the next beta/stable number and tag as a future release decision;
- separate npm package versions, serialized `schemaVersion` values, adapter
  versions, converter/mapping-profile versions, instruction versions, and
  Host compatibility observations;
- explain compatible versus incompatible changes and when migration notes or
  Schema-version changes are required;
- state that the provisional Schema `1.0.0` values are not the npm package
  version and remain subject to the M8 freeze;
- require exact versions or immutable commits in reproducible Host/CI examples;
- distinguish registry publication, npm dist-tags, Git tags, GitHub releases,
  compatibility evidence, and milestone completion;
- link only to current primary SemVer/npm references.

`CHANGELOG.md` must:

- contain an `Unreleased` section with the accepted M2–M7 public additions
  summarized by user-visible capability, not commit-by-commit history;
- contain a dated `0.0.0-dev.0` construction-snapshot entry limited to verified
  M1 package/fixture behavior;
- disclose that `0.0.0-dev.0` has no repository Git tag if that remains true;
- use the fixed category vocabulary from Decision 36 and explain future entry
  maintenance;
- avoid claiming that source `0.0.0-dev.1` is published, beta, stable, tagged,
  or released.

No task change may edit the package version, registry, tags, or release state.

## Adapter authoring contract

`docs/external-adapters/AUTHORING.md` must turn the existing protocol reference
into a practical authoring checklist:

- choose stable adapter identity/version and declare exact supported systems;
- read exactly one bounded request from stdin and write exactly one response
  to stdout, reserving stderr for bounded diagnostics;
- preserve exact request coverage and structured unavailable outcomes;
- accept only explicit references and avoid discovery/inference;
- use fixed Host-owned shell-free argv and allowlisted credential names;
- keep output untrusted, bounded, redacted, and free of credential/raw vendor
  leakage;
- test deterministic fixtures, malformed/duplicate/missing responses, timeout,
  output limits, permission denial, prompt-injection-shaped content, and secret
  sentinels before any live least-privilege exercise;
- document upstream API/version scope and bump the adapter version for a
  changed wrapper contract;
- avoid claiming live Lark/Jira/Confluence support from the offline fixtures.

Use the existing schemas/config example as the canonical field-level
reference; do not duplicate them inconsistently or create an SDK/template.

## Runtime converter authoring contract

`docs/runtime-evidence/CONVERTER_AUTHORING.md` must:

- keep conversion in Host/CI preprocessing and output the existing normalized
  manifest;
- define a named, separately versioned, deterministic mapping profile with
  explicit upstream product/format/version scope;
- map stable IDs, outcomes, timing, provenance, artifact references, and
  relationships without guessing unknown values;
- represent unsupported, malformed, inaccessible, or unobserved inputs as
  explicit unavailable evidence where the existing contract permits;
- exclude raw request/response bodies, headers, cookies, stdout/stderr,
  stacks, attachment bodies, credentials, retry commands, and active probes;
- cover bounds, encoding, duplicate identity, ordering/determinism,
  truncation, redaction, timing, relationship, unsupported-status, and
  secret-sentinel tests;
- require pinned fixtures and end-to-end manifest collection tests before a
  compatibility claim;
- avoid claiming general JUnit, Playwright, API, staging, browser, or vendor
  compatibility from the M6 pinned fixtures.

Do not add a converter binary, dependency, source module, executable template,
or new manifest field.

## Package proof

Extend the current package/smoke validation so one clean local tarball:

1. contains all five frozen entry points;
2. keeps internal workflow/task/governance files excluded;
3. retains the exact existing nine-tool surface and M1 fixture;
4. rejects broken repository-relative Markdown links originating in the five
   entry points and their README entry links, while ignoring external,
   fragment-only, and example-placeholder targets;
5. removes the complete temporary install root as before.

Tests may implement a small focused Markdown-link validator in test or smoke
code. They must remain deterministic and must not fetch external URLs.

## In scope

- The five frozen public documentation files.
- Links or short navigation text in the three existing README files.
- Package `files` allowlist entries only.
- Clean-install required-file/link validation.
- Focused offline documentation/package tests.
- The Worker handoff section of this file.

## Out of scope

- Product source, MCP tools, Schemas, exports, bin names, dependencies,
  lockfile, package version, license text, security policy, internal workflow,
  coordinator rules, hosted workflows, or repository settings.
- Converter/adapter code, SDKs, templates, vendor API implementation,
  credentials, live vendor calls, model/Host execution, or compatibility
  claims.
- Publishing workflow, provenance/signing, npm/Git tags, GitHub releases,
  package publication, dist-tags, beta/stable declarations, or pilot activity.

## Allowed paths

- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `README.md` — public navigation/contribution/version links only
- `docs/VERSIONING.md`
- `docs/external-adapters/AUTHORING.md`
- `docs/external-adapters/README.md` — authoring navigation only
- `docs/runtime-evidence/CONVERTER_AUTHORING.md`
- `docs/runtime-evidence/README.md` — authoring navigation only
- `package.json` — `files` entries only
- `scripts/smoke-clean-install.mjs` — required public-file/link validation only
- `tests/unit/clean-install-smoke.test.ts`
- one new focused documentation/package test under `tests/integration/`
- the Worker handoff section of this file

## Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- the Assignment and Coordinator review sections of this file
- package versions, dependencies, lockfile, exports, bin names, license,
  security policy, tags, releases, publishing metadata, npm dist-tags,
  repository settings, and hosted workflow state

## Acceptance criteria

- [ ] All five frozen public entry points are complete, mutually consistent,
      linked from the appropriate READMEs, and included in `npm pack`.
- [ ] Public contribution guidance covers development, review, security,
      changelog, documentation, rights, and governance without inventing an
      unenforced CLA/DCO/check/response promise.
- [ ] Versioning and changelog guidance distinguish every Decision 36 version
      and release fact and make no false `0.0.0-dev.1` publication claim.
- [ ] Adapter authoring guidance preserves the M5 explicit-reference,
      process, credential, untrusted-content, and failure boundaries.
- [ ] Converter authoring guidance preserves the M6 preprocessing, manifest,
      provenance, relationship, privacy, and compatibility boundaries.
- [ ] One exact clean tarball contains the public docs, excludes internal
      governance/task files, has no broken checked relative entry links, and
      preserves installed package/CI/stdio/cleanup behavior.
- [ ] No source, public Schema/tool, dependency, lockfile, version, license,
      security policy, hosted workflow, credential, vendor call, registry,
      tag, release, publish, dist-tag, or pilot state changes.

## Required validation

```text
npm run check
npx vitest run tests/unit/clean-install-smoke.test.ts tests/integration/<new-public-docs-test>.test.ts
npm test
npm run smoke:stdio
npm run smoke:ci
node scripts/smoke-clean-install.mjs
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

The worker records the exact focused test path, package file count, clean
install digest/summary, and any skipped validation in the handoff.

## Escalate when

- a package/Schema/adapter/converter/instruction version must change;
- a public tool, field, source module, dependency, lockfile, license, security
  policy, internal workflow, hosted check, registry, tag, release, publish, or
  dist-tag change appears necessary;
- current code behavior contradicts the frozen authoring guidance;
- a relative link cannot be valid in both the repository and installed
  package;
- verified history is insufficient for a changelog claim;
- validation would require live vendor credentials or external publication.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M7-006-extension-contribution-versioning`
- Worktree: `C:\Users\C\.codex\worktrees\0d06\agent-e2e-mcp`
- Implementation commits:
  - `13f394ef52580777344085046f34610b1976efd1` — public guidance, package
    allowlist, installed-tarball proof, and focused tests

### Implementation summary

- Added the five frozen public package entry points and linked them from the
  root, external-adapter, and runtime-evidence READMEs.
- Added public contribution, changelog, and versioning guidance without
  changing package version or release state. `0.0.0-dev.0` is recorded only as
  the verified 2026-07-22 M1 construction snapshot with no repository Git tag;
  `0.0.0-dev.1` is not described as published, beta, stable, tagged, or
  released.
- Added practical adapter and converter authoring checklists that retain the
  accepted M5/M6 explicit-reference, Host-owned process, untrusted-content,
  preprocessing, manifest, privacy, and fixture-only boundaries.
- Extended the exact clean-install tarball proof to require all five public
  files, reject internal governance/task files, validate package-relative
  Markdown links, and freeze mandatory public navigation mappings.

### Changed areas

- `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/VERSIONING.md`
- `docs/external-adapters/AUTHORING.md`,
  `docs/runtime-evidence/CONVERTER_AUTHORING.md`, and README navigation
- `package.json` package `files` entries only
- `scripts/smoke-clean-install.mjs`, focused clean-install unit coverage, and
  `tests/integration/public-documentation-package.test.ts`

### Validation

| Command | Result | Notes |
|---|---|---|
| `npm run check` | pass | TypeScript check completed. |
| `npx vitest run tests/unit/clean-install-smoke.test.ts tests/integration/public-documentation-package.test.ts` | pass | 14 passed, 1 existing Windows-specific skip. |
| `npm test` | pass | 39 files passed; 393 tests passed, 2 existing skips. |
| `npm run smoke:stdio` | pass | Exact nine-tool surface and byte-stable M1 fixture. |
| `npm run smoke:ci` | pass | `completed_no_findings`; CI smoke completed. |
| `node scripts/smoke-clean-install.mjs` | pass | Exact local tarball installed and removed its complete temporary root. |
| `npm run pack:check` | pass | Dry-run tarball contained 209 files. |
| `npm audit --omit=dev --audit-level=high` | pass | `found 0 vulnerabilities`. |
| `git diff --check` | pass | No whitespace errors. |
| `git status --short` | pass | Allowed implementation changes only before commit; final status is clean after this handoff commit. |

### Package and smoke evidence

- Final clean-install summary: package `change-trace-mcp@0.0.0-dev.1`; tarball
  `change-trace-mcp-0.0.0-dev.1.tgz`; 209 files; packed/unpacked bytes
  `175325`/`862546`; npm shasum
  `e350a5f1063bd0b9e9ab414add9977a4f8a1e5e3`; npm integrity
  `sha512-ryCpdcXikn7pa5yTwW3FxB9tsvkF4U3sDUcBEH46XHlbTTkfG1KfLXEyZ5dJcoNaxizabJ2fhLowrSJKnO+9Dg==`;
  independently computed SHA-256
  `3913cb19df81b67cc15a91b0fa00e1857cbe91efa33f758707bdcec3d1e18c96`.
- The smoke used Node `v24.0.0` and npm `11.3.0` on `win32`/`x64`, installed a
  copied artifact with lifecycle scripts disabled, validated production
  dependencies, exercised the equivalent local-tarball `npx` path, preserved
  the exact nine-tool surface and M1 fixture, and validated the three packaged
  CI fixture artifacts.
- The installed tarball required all five frozen entry points and resolved
  local links from all five plus the three entry READMEs. It freezes root README
  links to each entry point and the two authoring README links. It rejects
  `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, and `docs/work-items/**` from
  the same tarball surface. External, fragment-only, and `<VERSION>` example
  targets are ignored by the link check. Temporary artifact, consumer, cache,
  configuration, npx, and subject roots were removed (`cleanup: true`).

### Public contract and documentation impact

- The package now gives external adapter authors, runtime converter authors,
  public contributors, changelog maintainers, and package/Schema maintainers
  navigable, packaged guidance. It introduces no tool, Schema, dependency,
  credential, vendor, compatibility, release, or publication claim.

### Deviations from assignment

- Local development dependencies were absent at start. Restored them with
  `npm install --ignore-scripts --no-package-lock --no-audit --no-fund`; this
  wrote no lockfile and made no tracked dependency change. No validation was
  skipped.

### Known limitations and risks

- This is local pre-integration tarball evidence only. It does not publish a
  package, establish a registry/dist-tag/GitHub release fact, or make a new
  Host, vendor, converter, adapter, or semantic-review compatibility claim.
  The coordinator must regenerate package evidence after any later packaged
  file changes during integration.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, lockfile, license, tag, publish, release, or
      dist-tag action was performed.
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

- M7 construction-sequence item 5 remains in progress until coordinator
  acceptance.
