# Pilot kit (repository-only)

This kit prepares a future opt-in, advisory Change Trace pilot. It neither
starts a pilot nor supplies pilot evidence, qualification, compatibility,
threshold, release, or milestone claims. The synthetic fixture proves only
offline aggregation mechanics.

Use [the plan](PILOT_PLAN.md) for the team/operator workflow and
[the fixed feedback form](FEEDBACK_FORM.md) for the only fields that may be
submitted. The bounded envelope is defined by
[`pilot-observation.schema.json`](pilot-observation.schema.json) and checked
locally with `node scripts/pilot/summarize-pilot.mjs <observation.json>`.

Share only the bounded JSON envelope. Do not place repository or organization
names, people, URLs, paths, requirements, diffs, evidence/report text,
prompts, responses, logs, secrets, credentials, or free-form feedback in it.
Teams retain and delete their own raw operational artifacts under their own
policies. Participation, data sharing, and continuing advisory execution are
voluntary.

Thresholds are deliberately `unfrozen`. The coordinator alone reviews a
complete qualifying real baseline before considering thresholds, compatibility
statements, releases, or milestone state.
