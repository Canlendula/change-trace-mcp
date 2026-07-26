# Runtime converter authoring

Runtime conversion belongs in Host or CI preprocessing. Change Trace consumes
the existing normalized manifest through its confined collector; it does not
run a converter, test suite, browser, API probe, deployment, or artifact fetch.
The field-level contract remains the [runtime-evidence reference](README.md)
and its [normalized manifest examples](examples/).

## Define a deterministic mapping profile

- Give each converter mapping profile a stable name and separate version.
- Declare the exact upstream product, format, and version scope it maps. A
  pinned shape is evidence for that scope only.
- Produce the existing normalized manifest deterministically from bounded,
  pinned inputs. Preserve stable producer and record identities, explicit
  outcomes, timing, provenance, artifact references, and relationships.
- Map only known values. Keep unknown or absent data unknown; do not infer
  identities, outcomes, timings, provenance, or relationships.

## Represent unavailable evidence and protect content

- Where the existing contract permits, represent unsupported, malformed,
  inaccessible, or unobserved input as explicit unavailable evidence. An
  unavailable observation is not a failed behavior outcome.
- Exclude raw request and response bodies, headers, cookies, stdout, stderr,
  stacks, attachment bodies, credentials, retry commands, and active probes.
- Keep artifact entries as bounded references only. Do not fetch or embed
  artifact content in the manifest.

## Verify the profile

Before a compatibility claim, pin fixtures and run end-to-end manifest
collection tests through the built MCP surface. Cover bounds, encoding,
duplicate identities, deterministic ordering, truncation, redaction, timing,
relationships, unsupported status, and secret sentinels.

The M6 fixtures cover only bounded JUnit-style, Playwright-JSON, project
API-smoke, and staging-summary mapping snapshots. They do not establish
general JUnit, Playwright, API, staging, browser, or vendor compatibility.
