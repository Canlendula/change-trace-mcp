# Advisory pilot plan

## Before a team starts

The team names a team-side operator and explicitly consents to submit the
bounded observation. The operator classifies data before use and excludes
secrets and private product content from every shared field. Record the exact
package, Host, Host-version, and instruction-version facts locally; only the
bounded Host and instruction version strings belong in the observation.

Run Change Trace in advisory mode only. Findings do not create a merge gate by
default. Start setup timing when the operator begins the agreed configuration;
stop it at the first valid report: a completed report whose accepted package
and report Schemas validate. Record that elapsed value or `null` when it was
not observed.

## Qualifying baseline boundary

A qualifying baseline requires 3 to 5 independent teams, at least three whole
calendar weeks of advisory use for every team, and at least one team in each
profile: `repository_documents`, `external_requirements`, and
`runtime_staging`. Participation and continued advisory use remain opt-in.
The mechanics fixture, local validation, existing Host evidence, the project
owner, and the implementing worker do not qualify as pilot teams or weeks.
This kit prepares collection only; it does not start or complete a pilot.

## Weekly operation and disposition

Record every attempted run, including setup, Host, and validation failures.
Use only the frozen outcomes and finding counts in the schema. For each
finding, the team-side review records one count in exactly one disposition:
accepted/confirmed, dismissed/false-positive, inconclusive, or unreviewed.
`validEvidenceReferences` counts references judged valid and never exceeds the
total. Collect the bounded JSON weekly; do not submit raw reports, evidence,
requirements, diffs, prompts, responses, logs, URLs, paths, names, or notes.

The summary keeps every attempt in the successful-run denominator. Setup
medians use observed setup values. Duration, context, and evidence medians use
successful completed/schema-compatible runs. Accepted and dismissed rates use
dispositioned findings; valid-evidence and finding-inconclusive rates use all
findings; retention uses decided teams; cross-Host compatibility uses all
runs. A zero denominator is `null`.

## Immediate stops

Stop sharing and escalate to the coordinator immediately on credential
exposure, unexpected write or network behavior, a high-severity product
finding, or a Schema contradiction. Preserve raw evidence only under the
team's own policy; do not send it to Change Trace through this kit.

## Offboarding and review

At pilot end, the team voluntarily records enabled, disabled, or undecided
advisory status. The team owns raw-artifact retention and deletion. The
coordinator aggregates only validated bounded observations and alone may
review qualification, compatibility evidence, thresholds, milestones, or
release actions. Thresholds remain unfrozen; the mechanics fixture is not
pilot evidence.
