# M7-001 — Establish the security, privacy, and failure-mode baseline

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M7 — Public beta hardening`
- Base commit: `e5955fb27ba2bf93f70df20b6057043fdb8d1afa`
- Branch: `codex/M7-001-security-privacy-baseline`
- Worktree: Codex-managed isolated worktree for the assigned branch; record the
  absolute worktree path in the worker handoff.
- Implementation profile: `gpt-5.6-terra` with `high` reasoning.
- Push task branch: `no`
- Objective: publish an accurate pre-beta security policy, threat model,
  privacy/telemetry statement, review record, and machine-readable control
  inventory whose tests prove coverage of the current MCP surface without
  changing product behavior or hiding unresolved security findings.
- Dependencies: accepted M1 through M6 behavior and Decision 31.

### Coordinator-owned baseline contract

This task documents and tests the current product. It must distinguish:

- implemented controls;
- properties directly covered by tests;
- operational responsibilities assigned to the Host/operator;
- residual risks and unresolved findings;
- behavior outside the local stdio product boundary.

Use current primary sources as context:

- MCP Security Best Practices:
  `https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices`;
- the official MCP trust model and disclosure policy:
  `https://github.com/modelcontextprotocol/modelcontextprotocol/security`;
- GitHub private vulnerability reporting:
  `https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository`.

Do not copy generic remote-MCP OAuth threats into the implemented-control
column. This package currently exposes a local stdio server and no remote
transport or authorization server. Remote authorization risks may be named as
future/out-of-scope considerations.

The security review must inspect at least:

1. stdio launch privileges, stdout/stderr separation, server diagnostics, and
   all nine public tool annotations;
2. fixed Git subprocess execution, arguments, environment, time/size bounds,
   diff controls, repository-root checks, raw error projection, and secret
   redaction;
3. local document root/path/symlink/race/size/encoding handling and untrusted
   document or prompt-injection treatment;
4. external adapter configuration loading, Host-selected executable trust,
   `shell: false`, argument immutability, environment allowlisting,
   credential handling, stdin/stdout/stderr limits, timeout/termination,
   identity/source validation, redaction, and safe errors;
5. runtime-manifest confinement, file identity/race checks, size/encoding/
   Schema errors, unavailable-evidence semantics, redaction, and the absence
   of active execution or artifact fetching;
6. bundle relationship checks, evidence trust/provenance, Finding validation,
   hostile Markdown/HTML values, report size limits, output confinement,
   overwrite/transaction/race behavior, and error projection;
7. first-party network/telemetry capability, dependency risk, package contents,
   Host/model/CI data flow, artifact retention, deletion, and the limits of
   common-pattern secret redaction.

Record findings with stable IDs, `critical`, `high`, `medium`, `low`, or
`informational` severity, evidence, impact, disposition, and follow-up. A
finding can be `mitigated`, `open`, `accepted`, or `out_of_scope`. Do not mark
a finding mitigated solely because the threat model documents it.

Any critical/high finding, unexpected network or process capability,
credential exposure, repository/output path escape, unsafe report overwrite,
or materially false MCP capability annotation requires `needs_decision`.
Report a bounded medium/low follow-up explicitly; do not expand this task into
a product fix.

### Security policy requirements

`SECURITY.md` must:

- state that the package is pre-1.0 and identify what is currently evaluated
  for security fixes without promising an unsupported SLA;
- direct reporters to the repository's private vulnerability-reporting form
  when GitHub exposes it;
- when that form is unavailable, permit only a minimal public issue requesting
  private contact and prohibit public exploit, secret, or sensitive-data
  details;
- list useful report contents and coordinated-disclosure expectations;
- separate product vulnerabilities from expected local stdio process
  privileges, trusted Host configuration, model judgment, third-party service
  policy, and unsupported remote deployment;
- avoid claiming that GitHub private vulnerability reporting is enabled unless
  it was independently verified. Enabling it is not part of this task.

### Threat-model requirements

`docs/security/THREAT_MODEL.md` must cover:

- scope, protected assets, actors, entry points, trust boundaries, data flow,
  assumptions, controls, residual risk, operator guidance, and future review
  triggers;
- trusted repository content versus untrusted external/runtime/document
  content;
- fixed Git subprocesses versus arbitrary Host-configured adapter processes;
- local reads, process execution, external/open-world access, in-memory
  processing, and report writes as distinct capabilities;
- prompt injection/tool poisoning, secret leakage, path/symlink/race attacks,
  command/argument injection, malicious adapter output, denial of service,
  misleading or missing runtime evidence, report rendering, supply chain, CI
  permissions, and retained artifacts;
- the local stdio privilege model and the absence of a sandbox guarantee;
- the absence of remote transport/authentication in the current package.

The document must link each implemented control to code or test evidence and
must state residual limitations without compatibility or certification claims.

### Privacy and telemetry requirements

`docs/security/PRIVACY.md` must explain:

- what Git metadata, patches, document excerpts, source references, runtime
  summaries, findings, diagnostics, and report paths can be processed or
  retained;
- which operations stay local in the core and which configured adapter,
  Agent/model provider, source system, CI, or artifact store can cross an
  external boundary;
- that the core currently adds no first-party telemetry or network client;
- that `get_server_info` returns bounded runtime/platform diagnostics;
- that common-pattern redaction is best-effort and is not DLP, secret scanning,
  or a guarantee that sensitive data cannot reach a Host/model/report;
- that users control source selection, credentials, output locations,
  CI/artifact retention, and deletion. The MCP server exposes no remote account
  and no deletion/retention service.

### Executable control inventory

Add `docs/security/control-inventory.json` as strict internal documentation,
not as an exported public Schema. It must contain:

- one reviewed-at date and the reviewed base commit;
- exactly the nine current public MCP tools;
- each tool's read-only, destructive, idempotent, and open-world annotations;
- the tool's filesystem, process, network/external, and write capabilities;
- data classes, trust level, failure projection, implemented control
  references, verification references, operator responsibilities, and
  residual risks;
- non-tool entries for stdio launch/configuration, fixed Git subprocesses,
  external-adapter registration/loading, Agent/model/CI processing, package
  installation/supply chain, and report/artifact retention.

References must use repository-relative paths and may include a stable search
token. Every referenced file must exist and every declared search token must
be present.

Add `tests/unit/security-baseline.test.ts`. Without importing a new dependency,
it must validate:

- strict top-level and entry keys, unique stable IDs, bounded strings/arrays,
  accepted enums, required non-empty control/risk/responsibility fields, and
  repository-relative safe references;
- exact nine-tool coverage and exact current annotation values from
  `src/server.ts`;
- only `collect_external_evidence` is open-world;
- only `write_report` is destructive, non-read-only, and non-idempotent;
- fixed Git and configured-adapter process capabilities are represented
  separately;
- all code/test references and their selected tokens resolve;
- the review record has a disposition for every finding and no critical/high
  finding is silently accepted or described as mitigated without evidence;
- README links, package inclusion, Apache-2.0 metadata, and the absence of
  version/dependency/script/engine changes;
- the package source has no unrecorded first-party network-client import or
  call. The check must allow only intentionally represented process/network
  boundaries and must fail closed when a new one appears.

The test may read repository source as text because its purpose is to keep
security documentation synchronized with implementation. Avoid a fragile
whole-file snapshot; assert bounded public facts and selected stable tokens.

### Security review record

Add `docs/security/M7_SECURITY_REVIEW.md` with:

- scope/base/date and primary sources;
- manual and executable review method;
- audited surface inventory;
- production dependency-audit result;
- finding table with evidence and disposition;
- limitations and explicit follow-up;
- a clear statement that this is a project hardening review, not an
  independent audit, certification, penetration test, or v1 security claim.

## In scope

- Security disclosure, threat-model, privacy/telemetry, control-inventory, and
  M7 security-review documentation.
- One focused executable documentation/control-coverage test.
- README security/privacy links and M7 wording.
- Package file inventory additions for `SECURITY.md` and `docs/security`.
- Worker handoff.

## Out of scope

- Production source, public Schema, MCP tool, annotation, error, report, Git,
  local/external/runtime evidence, or CLI behavior changes.
- Security bug fixes; record and escalate findings instead.
- Remote MCP transport, OAuth, authentication, authorization, sandbox,
  encrypted storage, DLP, telemetry service, network client, or deletion API.
- New dependencies, lockfile, scripts, engines, package version, npm publish,
  tag, release, dist-tag, or provenance changes.
- GitHub repository-setting changes, enabling private vulnerability reporting,
  hosted CI runs, credentials, live source systems, browsers, staging, or
  external pilots.
- Installation guides, compatibility claims, CI templates, converter SDKs,
  contribution guide, changelog, versioning policy, publishing workflow, pilot
  metrics, Roadmap, decisions, or milestone completion.

## Allowed paths

- `SECURITY.md`
- `docs/security/README.md`
- `docs/security/THREAT_MODEL.md`
- `docs/security/PRIVACY.md`
- `docs/security/control-inventory.json`
- `docs/security/M7_SECURITY_REVIEW.md`
- `tests/unit/security-baseline.test.ts`
- `README.md`
- `package.json` — only add `SECURITY.md` and `docs/security` to `files`
- `docs/work-items/M7-001-security-privacy-baseline.md` — worker handoff only

Reading all repository source, tests, fixtures, documentation, Git metadata,
package-lock data, and installed dependency metadata is allowed. Writing
outside the listed paths is not.

## Coordinator-only paths

- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `docs/evaluation/**`
- assignment, acceptance-criteria, and coordinator-review sections of this
  file
- `src/**`
- all existing `tests/**`
- `.github/**`
- `docs/ci/**`
- `docs/smoke-tests/**`
- `package-lock.json`
- package dependencies, scripts, engines, versions, publish configuration,
  release, tag, npm, and GitHub state

## Acceptance criteria

- [ ] Security policy provides a usable coordinated-disclosure route without
      claiming an unverified repository setting or unsupported response SLA.
- [ ] Threat model covers every assigned asset, actor, boundary, capability,
      threat, control, residual risk, and current stdio limitation.
- [ ] Privacy statement accurately separates local core processing from
      adapter/Host/model/CI/source-system boundaries and makes no DLP,
      telemetry, retention, or deletion overclaim.
- [ ] The strict inventory covers exactly nine tools plus every assigned
      non-tool surface and maps current annotations/capabilities to
      implementation, tests, responsibilities, and risks.
- [ ] The focused test fails for tool/annotation drift, missing or stale
      references, unrecorded process/network capabilities, invalid findings,
      missing package/docs links, or forbidden package metadata drift.
- [ ] The review records production dependency-audit evidence, all discovered
      findings and dispositions, limitations, and exact follow-up.
- [ ] Any critical/high issue or material boundary mismatch is escalated; no
      unresolved issue is hidden by documentation.
- [ ] README and packed package expose the security, threat-model, privacy, and
      control-inventory entry points.
- [ ] Focused tests, type checking, two consecutive full suites, stdio and CI
      smoke, package dry-run, dependency audit, base diff, and clean-worktree
      checks pass.
- [ ] No production behavior, public contract, dependency, lockfile, script,
      engine, version, CI, governance, release, npm, GitHub setting, or live
      external state changed.

## Required validation

```text
npx vitest run tests/unit/security-baseline.test.ts tests/unit/logger.test.ts tests/unit/change-scope-edge-cases.test.ts tests/unit/local-evidence.test.ts tests/unit/external-adapter-config.test.ts tests/integration/external-adapter-runner.test.ts tests/unit/runtime-evidence-collector.test.ts tests/unit/report-write.test.ts tests/integration/stdio.test.ts
npm run check
npm test
npm test
npm run smoke:stdio
npm run smoke:ci
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check e5955fb27ba2bf93f70df20b6057043fdb8d1afa..HEAD
git status --short
```

The worker must report the initial failing focused-test evidence, final exact
command results, inventory counts, tool-annotation audit, process/network
capability audit, package inventory, dependency-audit result, findings,
limitations, deviations, and decision requests.

## Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task,
   Decision 31, the M7 Roadmap section, README, package metadata, all production
   source, and relevant security/failure tests.
2. Confirm the isolated branch/worktree, assigned base ancestry, assignment
   commit, and clean status.
3. Inspect the three named current primary sources and record access date.
4. Build a factual surface/capability/data-flow inventory and run the
   production dependency audit before drafting conclusions.
5. Write the failing strict inventory/package/reference/network/process test
   first and record its expected failure.
6. Add the smallest accurate policy, threat model, privacy statement, inventory,
   review record, README links, and package file entries satisfying the frozen
   contract.
7. Audit for overclaims, undocumented capabilities, raw secret/error/path
   exposure, unresolved findings, stale references, remote-MCP confusion, and
   scope drift.
8. Run every required validation, update only the worker handoff, commit all
   output, and leave the worktree clean.

## Escalate when

- a critical/high finding or material trust-boundary mismatch is found;
- a source/public contract/tool annotation/error behavior must change;
- a new dependency, lockfile, script, engine, credential, network call,
  repository setting, hosted CI run, or live external system is required;
- accurate documentation would require claiming an unverified GitHub setting,
  security guarantee, compatibility, certification, or release state;
- a coordinator-only or unlisted path must change.

## Worker handoff — worker owned

- Status: `in_progress | blocked | needs_decision | ready_for_review`
- Handoff branch:
- Worktree:
- Implementation commits:

### Implementation summary

- `<what was implemented>`

### Changed areas

- `<path or component and reason>`

### Validation

| Command | Result | Notes |
|---|---|---|
|  |  |  |

### Security and privacy audit

- Inventory:
- Tool annotations:
- Process/network capabilities:
- Dependency audit:
- Findings:

### Public contract and documentation impact

- `<impact, or None>`

### Deviations from assignment

- None.

### Known limitations and risks

- None.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [ ] Coordinator-only files were not modified.
- [ ] No product behavior, dependency, lockfile, version, CI, release, npm,
      GitHub-setting, credential, or live external-state action was performed.
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
