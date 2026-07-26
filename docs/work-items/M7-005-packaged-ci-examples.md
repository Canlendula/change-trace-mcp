# M7-005 — Package provider-neutral CI examples and fixtures

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `a1aa1d4eb71cc8a6b2c9ddc935c4e7ab96600b8d`
- Branch: `codex/M7-005-packaged-ci-examples`
- Worktree: Codex-managed isolated worktree for the assigned branch; record the
  absolute path in the worker handoff.
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: ship the accepted provider-neutral advisory runner, bounded
  summarizer, copyable GitHub/generic CI examples, and deterministic
  mechanics-only fixtures in the npm artifact, then prove the installed
  surface from one clean local tarball.
- Dependencies: accepted M4 provider-neutral runner/closeout, accepted M7-003
  clean-install harness, accepted M7-004 Host evidence, and Decisions 21, 22,
  33, 34, and 35.

The Base commit is the implementation review base. The coordinator will create
the task branch from the subsequent coordinator-only assignment commit that
adds this contract and milestone bookkeeping. The worker must start from that
prepared task branch and must not modify the coordinator-owned assignment
delta.

## Frozen public package surface

The npm artifact must add only these CI-facing surfaces:

1. `scripts/ci/advisory-runner.mjs`;
2. `scripts/ci/summarize-advisory-status.mjs`;
3. the complete `docs/ci/` tree, including GitHub, GitLab, portable generic
   shell, and deterministic public fixture guidance/files.

Do not package:

- `.github/workflows/`;
- `tests/` or test-only fixtures;
- historical GPT-4.1/OpenCode/provider experiments or smoke helpers;
- provider credentials, MCP configuration containing credentials, raw Host
  output, local artifacts, caches, or reports;
- a bundled model, Agent Host, provider SDK, or reviewer.

The public deterministic fixture may imitate the Host's artifact-writing role
only. It must perform no inference, network access, Git execution, repository
mutation outside its configured output directory, or credential access. Its
documentation and output identify it as orchestration/mechanics evidence.

## Example and trust contract

All examples must:

- remain advisory and upload/preserve exactly `release-review.md`,
  `release-review.json`, and `release-review-status.json`;
- accept the selected Host command as bounded explicit JSON argv;
- keep trusted tooling separate from the read-only subject checkout;
- use an exact package version or immutable tooling commit, never an unpinned
  `latest`;
- treat provider credentials as protected Host-only state and require the Host
  to sanitize the MCP child environment;
- avoid printing report bodies, raw Host streams, prompts, credentials, or
  untrusted revision text;
- keep platform triggers, retention, comments/checks, and merge policy outside
  the portable core.

GitHub Actions is the concrete hosted example. GitLab is a concrete generic
pipeline example. A portable POSIX-shell example may name Gitee Go, Jenkins,
Bitbucket Pipelines, Azure Pipelines, Forgejo, and similar systems only as
mapping guidance; this task does not certify those vendors or their native
Agents.

## Installed-package proof

Extend the existing M7 clean-install smoke so that its one local tarball:

1. contains every frozen public CI file and excludes the forbidden surfaces;
2. installs as a copied package outside the checkout under the existing fresh
   cache, empty user config, disabled lifecycle-script, and credential-free
   boundary;
3. launches the installed `scripts/ci/advisory-runner.mjs` against the installed
   deterministic public fixture in a fresh temporary subject/output area;
4. validates `completed_no_findings`, the exact three managed file names,
   schema-valid report/status content, bounded non-empty files, and no extra
   managed artifact;
5. removes the consumer, fixture output, npm cache/config, tarball, and complete
   temporary root.

The smoke summary may add one fixed CI field. It must remain one bounded
machine-readable stdout object and contain no temporary absolute paths, raw
Host output, report bodies, environment values, or credentials.

## In scope

- Package-file allowlist changes without a version/dependency/export/bin
  change.
- Provider-neutral CI documentation and examples.
- A deterministic public mechanics-only fixture under `docs/ci/`.
- Installed-package CI smoke coverage and focused offline tests.
- The worker-owned handoff in this file.

## Out of scope

- Product MCP tools, Schemas, evidence/report behavior, source modules, package
  version, dependencies, lockfile, exports, bin names, or license.
- Hosted workflow execution or repository settings.
- Model/API calls, provider setup, credentials, semantic quality evaluation,
  comments/checks, merge gating, or platform-native Agent implementation.
- Publication, npm dist-tags, tags, releases, provenance signing, changelog,
  extension/contribution guidance, publishing workflow, or pilot activity.
- Rewriting or deleting M4 historical evidence/workflows.

## Allowed paths

- `package.json` — `files` entries only
- `README.md` — CI documentation link/short boundary only
- `docs/ci/**`
- `scripts/ci/advisory-runner.mjs` — only if a packaged-path portability fix is
  required
- `scripts/ci/summarize-advisory-status.mjs` — only if a packaged-path
  portability fix is required
- `scripts/smoke-clean-install.mjs`
- `tests/unit/clean-install-smoke.test.ts`
- `tests/integration/provider-neutral-ci.test.ts`
- one new focused CI packaging test under `tests/integration/`
- the Worker handoff section of this file

## Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- the Assignment and Coordinator review sections of this file
- package versions, dependencies, lockfile, exports, bin names, tags, releases,
  publishing metadata, npm dist-tags, repository settings, and hosted workflow
  state

## Acceptance criteria

- [ ] `npm pack --json` includes the exact frozen CI package surface and no
      forbidden workflow/test/provider/credential surface.
- [ ] GitHub, GitLab, and portable generic examples preserve the frozen trust,
      explicit-argv, credential, advisory, and three-artifact contracts.
- [ ] Public fixture files are deterministic, provider-free, network-free,
      mechanics-only, and clearly disclaimed.
- [ ] The installed-package smoke runs the installed runner and installed
      fixture from one copied local-tarball installation and validates the
      exact outcome/artifacts.
- [ ] Package and smoke output remain bounded, deterministic, secret-free, and
      path-confined.
- [ ] Existing advisory runner, M4 historical evidence, nine-tool stdio
      surface, fixture text, package mechanics, and security gates remain
      unchanged.
- [ ] No hosted CI, inference, credential, dependency, version, registry, tag,
      release, publish, or dist-tag action occurs.

## Required validation

```text
npm run check
npx vitest run tests/integration/provider-neutral-ci.test.ts tests/integration/<new-packaged-ci-test>.test.ts tests/unit/clean-install-smoke.test.ts
npm test
npm run smoke:ci
npm run smoke:stdio
node scripts/smoke-clean-install.mjs
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

The worker records the exact focused test path it creates and the clean-install
summary in the handoff.

## Escalate when

- a version, dependency, lockfile, export, bin, public Schema/tool, security
  boundary, provider, credential, hosted workflow, or release change appears
  necessary;
- an example cannot keep trusted tooling separate from the subject checkout;
- an installed fixture would need network/model/provider access;
- package allowlisting would expose historical experiments, tests, workflows,
  raw output, credentials, or local artifacts;
- clean installation or temporary cleanup fails.

## Worker handoff — worker owned

- Status: `pending`
- Handoff branch:
- Implementation commits:

### Implementation summary

- Pending.

### Changed areas

- Pending.

### Validation

| Command | Result | Notes |
|---|---|---|
| Pending | Pending | Pending |

### Package and smoke evidence

- Pending.

### Public contract and documentation impact

- Pending.

### Deviations from assignment

- None.

### Known limitations and risks

- None.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [ ] Coordinator-only files were not modified.
- [ ] No dependency, lockfile, version, export, bin, registry, hosted CI,
      model, credential, tag, release, publish, or dist-tag action occurred.
- [ ] All intended handoff changes are committed to the task branch.

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
