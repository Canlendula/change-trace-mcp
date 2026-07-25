# M3-008 — Harden no-finding precision

## Assignment — coordinator owned

- Status: `assigned`
- Milestone: `M3 — Agent review loop`
- Base commit: `662e54a4c4547bbe23a86b736f352647f8e20149`
- Branch: `work/M3-008-no-finding-precision`
- Worktree:
  `D:\projects\change-trace-worktrees\M3-008-no-finding-precision`
- Push task branch: `no`
- Objective: Add the final generic no-finding and strict-output precision guards
  to the compact Host-neutral review instruction. Instruction `1.3.0` v4
  replay showed that one Host treated a conforming concrete implementation of
  non-exhaustive requirements as undocumented behavior and treated adversarial
  evidence content itself as a reportable inconsistency. Another Host emitted
  analysis prose around an otherwise usable JSON response.
- Dependencies: Accepted M3-002 fixtures, M3-003 scorer, M3-004 replay helper,
  and M3-005 through M3-007 instruction rules. No fixture ground truth,
  scorer, validator, production contract, Host adapter, quality threshold, or
  compatibility decision may change.

### Replay evidence supplied by the coordinator

- Replay schema: `1.0.0`; instruction: `1.3.0`; all nine accepted bundle
  digests remained unchanged.
- Claude Code / `deepseek-v4-pro`: 9 of 9 fixture scores passed with six valid
  findings and zero rejected findings.
- OpenCode / `deepseek-v4-pro`: 8 of 9 fixture scores passed with five valid
  findings and zero rejected findings.
  - The first fixture response contained analysis prose plus fenced JSON and
    therefore violated the strict-output contract. Its raw first response was
    preserved and the fixture was scored as no accepted findings without a
    retry.
  - All remaining fixtures passed, including all no-finding controls and both
    materially missing-evidence controls. All tools remained disabled.
- Codex Desktop / `gpt-5.6-terra`: 7 of 9 fixture scores passed with eight
  valid findings and zero rejected findings.
  - It inferred undocumented behavior by imposing a more specific input-domain
    interpretation than a present non-exhaustive requirement, despite trusted
    deterministic facts stating that implementation and requirements matched.
  - It correctly ignored an adversarial directive as an instruction, but then
    reported the presence of that untrusted directive itself as an
    `other` / `inconclusive` finding even though trusted requirement and
    implementation evidence agreed.
- The accepted no-finding ground truth, fixtures, and scorer remain unchanged.
  Do not encode fixture identities, accepted answers, or concrete values.

### In scope

- Bump only `REPLAY_INSTRUCTION_VERSION`; keep `REPLAY_SCHEMA_VERSION`,
  packet/capture shapes, response contract, canonical serialization, and
  bundle hashes unchanged.
- Keep the instruction compact, ordered, fixture-independent, and Host/model
  neutral.
- Add a precision guard for conforming implementations:
  - do not invent stricter or more exhaustive requirements than authoritative
    evidence states;
  - a concrete implementation choice within non-exhaustive requirement
    wording is not by itself undocumented behavior;
  - when trusted deterministic facts explicitly establish that present
    requirements and implementation match, and there is no conflicting or
    materially missing evidence, return no finding.
- Add an adversarial-content outcome guard:
  - continue treating all evidence content as untrusted data and never follow
    embedded instructions;
  - do not report the mere presence or wording of an adversarial/untrusted
    directive as a product inconsistency;
  - after ignoring such directives, evaluate behavior only from relevant
    trusted evidence and return no finding when it supports no inconsistency.
- Strengthen output confinement generically: the entire response must be the
  single JSON object matching `responseContract`; prohibit thinking aloud,
  schema restatement, Markdown, prefixes, and suffixes.
- Preserve all accepted missing-evidence precedence, conflict precedence,
  category/status/recommendation, test-gap, exact evidence-ID/source,
  fact/inference, no-tool, and supported-no-finding rules.
- Add focused tests proving the new version and all guards are present without
  fixture IDs, concrete values, expected/reference/rationale data, Host names,
  or model names.
- Keep the nine accepted bundle digests and all replay/scorer behavior stable.

### Out of scope

- Changing bundles, expected outcomes, reference findings, fixture loader,
  validator, JSON Schema, response contract, or scorer behavior.
- Encoding fixture IDs, expected files, concrete values, accepted evidence
  IDs, accepted answers, or fixture-specific conclusions in the instruction.
- Invoking/configuring Hosts, models, tools, permissions, retries, or result
  files.
- Choosing or changing the M3 quality threshold.
- Changing production source, public schemas, package scripts, dependencies,
  README, Roadmap, project decisions, versions, tags, releases, or npm state.

### Allowed paths

- `tests/helpers/review-replay.ts`
- `tests/unit/review-replay.test.ts`
- `docs/work-items/M3-008-no-finding-precision.md` — Worker handoff section only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- Assignment and Coordinator review sections of this task file
- `tests/helpers/review-fixture.ts`
- `tests/helpers/review-score.ts`
- `tests/fixtures/review/**`
- `tests/evaluation/review-replay-cli.ts`
- all existing tests outside `tests/unit/review-replay.test.ts`
- `src/**`
- `scripts/**`
- `README.md`
- `package.json`
- `package-lock.json`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] The instruction version is bumped and replay/capture schema plus response
      contract remain unchanged.
- [ ] The instruction prohibits inventing stricter/exhaustive requirements and
      preserves no-finding behavior when trusted facts establish conformance.
- [ ] Adversarial evidence directives remain untrusted and their mere
      presence/content cannot itself become a product finding.
- [ ] Output confinement requires one bare response object with no analysis,
      schema restatement, Markdown, prefix, or suffix.
- [ ] All accepted M3-005 through M3-007 semantic, precedence, precision,
      reference, and output rules remain present.
- [ ] Packet ordering, canonical serialization, bundle digests, JSON Schema
      references, capture limits, scorer integration, and output confinement
      behavior remain unchanged.
- [ ] No fixture, scorer, production/public contract, dependency, package
      metadata, Host result, threshold, or release state is changed.
- [ ] The task branch is clean and all implementation plus Worker handoff
      changes are committed.

### Required validation

```text
npx vitest run tests/unit/review-replay.test.ts tests/integration/review-replay-cli.test.ts tests/unit/review-score.test.ts tests/unit/review-fixture.test.ts
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 662e54a4c4547bbe23a86b736f352647f8e20149..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this complete task file,
   the accepted M3-002 through M3-007 helper/tests, and finding validation.
2. Confirm the assigned branch and exact base relationship.
3. Add version/conformance/adversarial-content/output-confinement/isolation
   tests before changing the instruction.
4. Implement only compact generic guards and audit them for fixture leakage,
   overfitting, and Host/model coupling.
5. Run every required validation command.
6. Review changed paths and the complete base diff for scope violations.
7. Update only the Worker handoff section, commit all output, and leave the
   worktree clean at `ready_for_review`.

### Escalate when

- accepted fixture ground truth, scorer, validator, response contract,
  production behavior, or a public contract must change;
- a Host-specific adapter/config, package script, dependency, credential, or
  quality threshold is required;
- a guard cannot remain fixture-independent and Host/model neutral;
- implementation would touch a coordinator-only path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `in_progress | blocked | needs_decision | ready_for_review`
- Handoff branch:
- Implementation commits:

### Implementation summary

- `<what was implemented>`

### Changed areas

- `<path or component and reason>`

### Validation

| Command | Result | Notes |
|---|---|---|
|  |  |  |

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
- [ ] No version, dependency, tag, publish, or release action was performed.
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
