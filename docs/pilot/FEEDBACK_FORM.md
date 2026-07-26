# Bounded pilot feedback form

Submit only these fixed choices and numbers in one schema-valid observation.
Use pseudonymous IDs in the existing safe-ID shape. Do not submit any free-form
product content.

## Envelope

- `schemaVersion`: `1.0.0`
- `pilotId`: bounded pseudonymous ID
- `teams`: 1 to 50 records; `teamId` values must be unique
- `runs`: 1 to 10,000 records; `runId` values must be unique and every run
  `teamId` must reference one listed team

## Per team

- `teamId`: bounded pseudonymous ID
- `profile`: `repository_documents`, `external_requirements`, or `runtime_staging`
- `setupElapsedMs`: whole number `0..604800000`, or `null`
- `observationWeeks`: whole number `0..52`
- `advisoryEnabledAtEnd`: `true`, `false`, or `null`
- `consentRecorded`: `true` only

## Per attempted run

- `runId` and `teamId`: bounded pseudonymous IDs; `teamId` must name a listed team
- `hostFamily`: `codex`, `claude_code`, `opencode`, or `other`
- `hostVersion` and `instructionVersion`: bounded factual safe-ID-shape strings
- `outcome`: `completed_findings`, `completed_no_findings`, `inconclusive`,
  `failed_setup`, `failed_host`, or `failed_validation`
- `durationMs`: whole number `0..86400000`
- `contextCharacters`: whole number `0..10000000`
- `evidenceItemCount`: whole number `0..10000`
- `schemaCompatible`: `true` or `false`
- `findings.total`, `validEvidenceReferences`, `acceptedConfirmed`,
  `dismissedFalsePositive`, `inconclusive`, and `unreviewed`: whole numbers
  `0..10000`; `validEvidenceReferences <= total`; and
  `acceptedConfirmed + dismissedFalsePositive + inconclusive + unreviewed`
  must equal `total`

For a completed-no-findings run, total is zero; for a completed-findings run,
total is positive; for any other outcome every finding count is zero.

## Team-owned notes — do not submit to Change Trace

Keep any local operational notes, product details, raw reports, evidence,
requirements, diffs, logs, prompts, responses, paths, URLs, names, and
credentials with the team. They do not map to observation JSON and must not be
submitted through this form.
