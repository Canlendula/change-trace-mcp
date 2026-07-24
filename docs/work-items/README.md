# Work-item Records

Each delegated implementation task has one tracked record in this directory.
The record is both the assignment contract and the durable worker handoff.

## Naming

Use:

```text
<milestone>-<sequence>-<slug>.md
```

Example:

```text
M3-001-write-report.md
```

Task IDs and filenames stay stable after dispatch.

## Ownership

The coordinator owns:

- the Assignment section;
- changes to scope, acceptance criteria, or protected paths;
- the Coordinator review section;
- task acceptance and integration metadata.

The worker owns only the Worker handoff section. It may change its status among
`in_progress`, `blocked`, `needs_decision`, and `ready_for_review`.

Workers cannot set `accepted`, `rejected`, or `milestone_complete`.

## Git information

The Assignment section records the exact base commit and task branch. The
Worker handoff lists implementation commits and validation results.

Do not store a final branch-head SHA inside the same commit that creates the
handoff record. The branch ref is the source of truth for the final head, and
the coordinator resolves it during review.

## Required handoff quality

A `ready_for_review` record must include:

- a concise implementation summary;
- changed areas and public-contract impact;
- every required validation command and result;
- failures, skipped checks, deviations, and known risks;
- decisions/questions requiring coordinator attention;
- confirmation that coordinator-only files were not changed.

Uncommitted changes, ignored artifacts, or chat-only explanations are not
durable handoff output.

See `docs/CONTRIBUTING_WORKFLOW.md` for the full process.
