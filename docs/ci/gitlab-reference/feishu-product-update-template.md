# Change Trace GitLab Reference — Maintenance Status Update

- Stable identifier: `CTGR-001`
- Scope: synthetic reference project only

## Approved behavior

The service reports `operational` when planned maintenance is not active. When
planned maintenance is active, it reports `maintenance`. The maintenance result
must not change the operational result for callers that do not provide that
input.

## Acceptance criteria

- The operational state remains available and returns its approved message.
- A planned-maintenance input returns the maintenance state and its approved
  message.
- Automated tests cover both states.

## Expected release note

Add a planned-maintenance status so clients can distinguish scheduled
maintenance from normal operational availability.
