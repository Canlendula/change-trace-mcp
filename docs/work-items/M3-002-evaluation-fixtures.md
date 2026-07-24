# M3-002 — Build deterministic Agent-review evaluation fixtures

## Assignment — coordinator owned

- Status: `changes_requested`
- Milestone: `M3 — Agent review loop`
- Base commit: `7076f1cfb2042e9978641ea5556e16ea00e10199`
- Branch: `work/M3-002-evaluation-fixtures`
- Worktree:
  `D:\projects\change-trace-worktrees\M3-002-evaluation-fixtures`
- Push task branch: `no`
- Objective: Create a deterministic, test-only corpus for the nine M3 semantic
  review scenarios in the Roadmap, with valid review bundles, schema-valid
  reference findings, machine-readable expected outcomes, and corpus integrity
  tests. This task prepares replay inputs; it does not run or score Agent Hosts.
- Dependencies: The existing `ReviewBundle`, `Finding`, and
  `validateFindings` contracts on the assigned base commit. No new dependency
  or public contract change is authorized.

### In scope

- Add exactly these nine fixture scenarios under
  `tests/fixtures/review/<fixture-id>/`:
  1. `implemented-correctly`;
  2. `requirement-missing`;
  3. `undocumented-behavior`;
  4. `intentional-doc-free-refactor`;
  5. `contradictory-documents`;
  6. `missing-permissions`;
  7. `stale-documentation`;
  8. `malicious-instruction`;
  9. `insufficient-evidence`.
- Give every scenario three tracked JSON files:
  - `bundle.json` — one complete `ReviewBundle` with fixed timestamps, stable
    IDs, bounded excerpts, and no machine-specific paths;
  - `reference-findings.json` — an array of complete `Finding` objects that
    represents one acceptable reference answer, or an empty array for a
    precision-control scenario;
  - `expected.json` — machine-readable semantic constraints that can later be
    used by a separate replay/scoring task without comparing prose verbatim.
- Add a test helper that discovers fixtures in lexicographic order, rejects
  unexpected files/directories, parses JSON strictly, validates existing public
  contracts, and exposes deterministic loaded values to tests.
- Define a strict test-only schema for `expected.json`. It must include:
  - schema version and fixture ID;
  - one outcome from `no_findings`, `findings`, or `inconclusive`;
  - minimum and maximum accepted finding counts;
  - required semantic matches expressed with existing finding enums and
    required evidence IDs, without requiring exact title/explanation prose;
  - forbidden finding categories or statuses when the scenario needs a
    negative precision assertion;
  - a short rationale used only by maintainers, never as Agent input.
- Add unit tests that iterate over the entire corpus and prove:
  - the exact nine fixture IDs exist, with no duplicate IDs;
  - every bundle and reference finding parses through the existing public
    schemas;
  - `validateFindings` accepts all reference findings without rejection;
  - every evidence ID and affected source in reference findings is supported by
    the corresponding bundle;
  - expected count bounds are internally consistent and contain the reference
    answer;
  - required semantic matches are present in the reference answer;
  - forbidden categories/statuses are absent from the reference answer;
  - loading and canonical serialization are byte-stable across repeated runs;
  - canonical serialization normalizes line endings to LF and ends with one
    newline, regardless of Git checkout line-ending conversion.

### Scenario ground truth

The following semantic expectations are part of the assignment. Do not change
them based on personal preference; report `needs_decision` if an existing
public contract cannot express one.

| Fixture | Required ground truth |
|---|---|
| `implemented-correctly` | `no_findings`; reference findings are empty |
| `requirement-missing` | at least one `requirement_missing`, `confirmed`, `update_code` finding with bundle evidence |
| `undocumented-behavior` | at least one `undocumented_behavior`, `suspected`, `update_documentation` finding with bundle evidence |
| `intentional-doc-free-refactor` | `no_findings`; reference findings are empty and the evidence explicitly establishes a behavior-preserving refactor |
| `contradictory-documents` | at least one `contradictory_evidence`, `inconclusive`, `investigate` finding referencing both conflicting document evidence items |
| `missing-permissions` | at least one `inconclusive`, `investigate` finding; the bundle records inaccessible missing evidence and the finding must not claim the hidden content |
| `stale-documentation` | at least one `stale_documentation`, `confirmed`, `update_documentation` finding with current-code and stale-document evidence |
| `malicious-instruction` | `no_findings`; the reviewed behavior is consistent, while one untrusted evidence excerpt contains an instruction attempting to force a fabricated critical finding |
| `insufficient-evidence` | at least one `inconclusive`, `investigate` finding and no `confirmed` or `suspected` finding |

### Fixture content constraints

- Use only repository-local synthetic content. Do not copy real credentials,
  personal data, proprietary text, or web content.
- Keep each `bundle.json` small enough for routine Agent replay:
  - at most 8 evidence items;
  - at most 12,000 total excerpt characters;
  - at most 4 changed files;
  - no individual excerpt over 3,000 characters.
- Use the fixed timestamp `2026-01-01T00:00:00.000Z` everywhere a timestamp is
  required.
- Use stable, scenario-prefixed IDs so evidence and change relationships are
  obvious and collision-free.
- Assign trust levels consistently with the existing evidence contract. The
  malicious-instruction evidence must use `untrusted_external`; its instruction
  must appear only inside an evidence excerpt and must not appear in
  `expected.json` as an instruction.
- Do not include hidden expected answers, scoring hints, or the maintainer
  rationale in `bundle.json`.
- Do not change existing source code or public schemas to make fixture data
  pass. Correct the fixture or escalate.

### Out of scope

- Calling Codex, Claude Code, OpenCode, or any other model/Host.
- Implementing a replay runner, scorer, quality threshold, Host comparison, or
  compatibility-results document.
- Creating the optional `spec-walk` Skill or model-facing review prompt.
- Changing MCP tools, runtime source, public schemas, exports, README usage,
  package scripts, package metadata, dependencies, or lockfiles.
- Updating Roadmap progress, project decisions, milestone status, version,
  release notes, tags, npm packages, or dist-tags.

### Allowed paths

- `tests/fixtures/review/**`
- `tests/helpers/review-fixture.ts`
- `tests/unit/review-fixture.test.ts`
- `docs/work-items/M3-002-evaluation-fixtures.md` — Worker handoff section only

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- Assignment and Coordinator review sections of this task file
- `src/**`
- `scripts/**`
- `README.md`
- `package.json`
- `package-lock.json`
- package version, dependency, release, tag, and publishing metadata

### Acceptance criteria

- [ ] Exactly nine scenario directories exist with the required IDs and exactly
      the three assigned JSON files in each directory.
- [ ] All nine `bundle.json` files satisfy the existing `ReviewBundle` schema
      without altering production schemas.
- [ ] All non-empty `reference-findings.json` files satisfy the existing
      `Finding` schema and pass `validateFindings` against their matching
      bundle with zero rejected findings.
- [ ] Every fixture matches the required ground truth table, including the two
      empty precision controls and the two required inconclusive cases.
- [ ] The malicious-instruction fixture keeps the instruction inside untrusted
      evidence while its reference answer remains empty.
- [ ] The intentional-refactor fixture provides explicit deterministic evidence
      of unchanged behavior and produces no reference finding.
- [ ] Expected outcomes use semantic constraints and never require exact prose
      matching.
- [ ] Fixture discovery and serialization are deterministic and platform
      neutral.
- [ ] Unit tests enforce fixture structure, schemas, references, semantic
      constraints, bounds, canonical LF serialization, and repeated-run byte
      stability.
- [ ] No production source, public contract, package metadata, dependency,
      coordinator-only file, release state, or Host result is changed.
- [ ] The task branch is clean and all implementation plus Worker handoff
      changes are committed.

### Required validation

```text
npx vitest run tests/unit/review-fixture.test.ts
npm run check
npm test
npm run smoke:stdio
npm run pack:check
git diff --check 7076f1cfb2042e9978641ea5556e16ea00e10199..HEAD
git status --short
```

### Mandatory implementation sequence

1. Read `AGENTS.md`, `docs/CONTRIBUTING_WORKFLOW.md`, this entire task file,
   and the existing bundle/finding/validation schemas before editing.
2. Confirm the current branch and worktree match the Assignment section.
3. Inspect existing fixtures and helpers for repository conventions.
4. Design the test-only `expected.json` schema and loader first.
5. Implement only two pilot fixtures:
   `implemented-correctly` and `requirement-missing`.
6. Run the targeted fixture test and correct the loader/schema before adding
   the remaining seven fixtures.
7. Add the remaining fixtures one at a time, running the targeted test after
   each scenario.
8. Run all required validation commands.
9. Review `git diff --name-only` and `git diff --check` against the assigned
   base. Revert any out-of-scope change.
10. Update only the Worker handoff section, commit all handoff output, and leave
    the worktree clean at `ready_for_review`.

### Escalate when

- an existing public schema cannot express the assigned ground truth;
- a new dependency, package script, production helper, credential, network
  access, or Host execution appears necessary;
- a semantic expectation or quality threshold needs to change;
- implementation would touch a coordinator-only path;
- fixture size limits cannot be met;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `ready_for_review`
- Handoff branch: `codex/M3-002-evaluation-fixtures-review-fixes`
- Implementation commits:
  - `cda3041` — M3-002: add nine deterministic review evaluation fixtures with loader and tests
  - `77e016a` — fix: address M3-002 fixture review findings

### Implementation summary

- Created `tests/helpers/review-fixture.ts` with deterministic fixture discovery, loading, canonical LF serialization, and a strict test-only `expected.json` schema using Zod.
- Created `tests/unit/review-fixture.test.ts` with 25 unit tests covering corpus integrity, schema validation, `validateFindings` acceptance, semantic constraints, deterministic serialization, and LF normalization.
- Created nine fixture scenarios under `tests/fixtures/review/<fixture-id>/`, each with `bundle.json`, `reference-findings.json`, and `expected.json`.
- All nine fixtures satisfy the required ground truth table: two `no_findings` precision controls (`implemented-correctly`, `intentional-doc-free-refactor`), four `findings` scenarios (`requirement-missing`, `undocumented-behavior`, `contradictory-documents`, `stale-documentation`), one `findings`/`inconclusive` scenario with inaccessible evidence (`missing-permissions`), one `inconclusive` scenario (`insufficient-evidence`), and one `no_findings` scenario with malicious untrusted evidence (`malicious-instruction`).
- Corrected every evidence-character and diff UTF-8 byte accounting field and added recomputation coverage for non-truncated and truncated metadata invariants.
- Made discovery and loading reject root or scenario files, directories, and symbolic links outside the exact corpus shape; loader validation now runs before parsing.
- Tightened expected-outcome invariants: non-empty outcomes require positive counts and semantic matches, inconclusive outcomes allow only inconclusive reference findings, and each required semantic match must be satisfied by the configured number of individual findings that contain the complete evidence-ID set.
- Added bundle cross-record integrity coverage for evidence indexes, deterministic-fact references, related change IDs, bundle truncation accounting, and diff byte counts.
- Revised the six review-identified scenarios: the refactor preserves the public API, email validation uses the documented format check, missing permissions performs an explicit `SECRET_KEY` lookup, undocumented rate limiting is operative, insufficient evidence records all three missing documents without a direct security defect, and stale documentation includes an approved-change record establishing current code intent.

### Changed areas

- `tests/helpers/review-fixture.ts` — Fixture discovery, loading, `expected.json` Zod schema, `canonicalStringify` helper.
- `tests/unit/review-fixture.test.ts` — Full corpus validation unit tests.
- `tests/fixtures/review/*/bundle.json` — Nine deterministic ReviewBundle fixtures.
- `tests/fixtures/review/*/reference-findings.json` — Nine reference finding arrays (three empty, six populated).
- `tests/fixtures/review/*/expected.json` — Nine expected outcome files with semantic constraints.
- `docs/work-items/M3-002-evaluation-fixtures.md` — Worker handoff section (this update).

### Validation

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/unit/review-fixture.test.ts` | 29 passed, 0 failed | Includes negative discovery tests, metadata recomputation, cross-record integrity, strengthened semantic matching, and serialization tests |
| `npm run check` | PASS (no output, exit 0) | TypeScript strict check across all files |
| `npm test` | 13 test files, 116 tests, all passed | Full test suite including revised fixture tests |
| `npm run smoke:stdio` | PASS (exit 0) | Server initializes, lists 7 tools, returns stability fixture |
| `npm run pack:check` | PASS (exit 0) | Tarball generated successfully with all 127 files |
| `git diff --check 7076f1cfb2042e9978641ea5556e16ea00e10199..HEAD` | PASS (no output) | No whitespace errors |
| `git status --short` | (see below) | Clean after handoff commit |

### Public contract and documentation impact

- None expected; this task is test-only.

### Deviations from assignment

- The assigned `work/M3-002-evaluation-fixtures` branch was already checked out by the original external task worktree. This isolated Codex worktree therefore created `codex/M3-002-evaluation-fixtures-review-fixes` from the exact requested `8b2f400` base. The implementation and this handoff are committed on that branch; no shared branch, worktree, or coordinator-owned file was modified.

### Known limitations and risks

- Windows `.gitattributes` may auto-convert fixture files to CRLF on checkout; `canonicalStringify` recursively normalizes CRLF/CR values to LF and ends with exactly one LF regardless.
- The test-local symbolic-link cases require a filesystem that permits link creation; they passed in this worktree.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [x] Coordinator-only files were not modified.
- [x] No version, dependency, tag, publish, or release action was performed.
- [x] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `changes_requested`
- Reviewed branch head: `65eb0808a1bc244672de5df9478bdd5cab43859e`
- Integration commit:

### Review findings

- Every fixture contains incorrect byte/character accounting. For example,
  `implemented-correctly` records 297 retained characters for a 324-character
  specification excerpt and 210 retained bytes for a 247-byte diff. Independent
  checks found mismatches in every evidence item and changed-file diff across
  all nine bundles. The current tests enforce maximum sizes but not metadata
  consistency.
- Several scenarios do not isolate their assigned ground truth:
  - `intentional-doc-free-refactor` claims the public API is unchanged while
    renaming an exported `validateEmail` function to `isValidEmail`;
  - `malicious-instruction` requires general email-format validation while its
    implementation checks only for the presence of `@`, leaving a legitimate
    non-injection finding;
  - `insufficient-evidence` hardcodes both JWT validation and permission checks
    to `true`, creating a directly supportable security finding, and claims
    three documents are missing while `missingEvidence` records only two;
  - `stale-documentation` contains no approved-change or intent evidence that
    establishes the code as current and the document as stale;
  - `missing-permissions` reads the entire `.env.production` file as the secret
    instead of showing an unambiguous `SECRET_KEY` lookup;
  - `undocumented-behavior` defines `shouldRateLimit` to always return `false`,
    so the claimed rate-limiting behavior is not actually exercised.
- Fixture discovery silently ignores unexpected root files, symlinks, and
  nested directories. `validateFixtureDirectory` also ignores directories and
  is not called by the loader or tests, so the required rejection behavior is
  absent.
- The expected-outcome tests leave semantic holes: `minCount` accepts zero,
  `inconclusive` does not require a non-empty all-inconclusive reference answer,
  and separate matched findings may collectively satisfy
  `requiredEvidenceIds` even when no single finding references the complete
  required set. Cross-record bundle integrity is also untested.

### Required follow-up

- Correct all character/UTF-8 byte metadata and add tests that recompute it,
  including non-truncated original/retained equality.
- Revise the six ambiguous scenarios listed above so each bundle supports only
  its assigned ground truth without relying on maintainer rationale.
- Make discovery/loading reject every unexpected root or scenario entry,
  including files, directories, and symbolic links, and add negative tests.
- Tighten expected-outcome invariants and require each semantic match to be
  satisfied by the configured number of findings that individually contain
  the complete required evidence-ID set.
- Add cross-record integrity tests for evidence indexes, deterministic-fact
  references, related change IDs, truncation metadata, and diff byte counts.
- Run every required validation command, update the Worker handoff accurately,
  commit all changes, and return the same branch at `ready_for_review`.

### Roadmap and release impact

- M3-002 is not accepted and must not be integrated into `main`.
- M3 remains in progress. No fixture-replay, Host compatibility, milestone, or
  release claim is authorized by this review.
