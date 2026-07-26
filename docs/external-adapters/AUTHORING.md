# External adapter authoring

This checklist helps authors build a bounded wrapper for the existing external
adapter protocol. The field-level contract remains the
[external-adapter reference](README.md) and its
[configuration example](config.json.example); this guide does not provide an
SDK or executable template.

## Declare a narrow wrapper contract

- Choose a stable adapter ID, name, and adapter version. State the exact
  upstream system, API or content shape, and versions the wrapper supports.
- Register one fixed, Host-owned argument vector. The Host owns command path,
  working directory, timeout, output limits, and allowlisted credential
  environment names. Do not accept them from MCP request data.
- Use shell-free argv execution. Keep stderr for bounded diagnostics only.
- Treat the adapter version as the wrapper-contract version. Bump it whenever
  its protocol, output interpretation, supported upstream scope, or security
  boundary changes.

## Implement the one-request protocol

- Read exactly one bounded JSON request from stdin and write exactly one strict
  JSON response to stdout.
- Preserve exact request coverage: return one structured result for every
  request ID, with no duplicate, missing, or invented response.
- Resolve only the explicit source references in the request. Do not add
  organization search, discovery, inferred issue keys, or free-form queries.
- Represent unavailable material as the existing structured outcomes for
  missing, denied, unsupported, or adapter-error results. Do not turn an
  inaccessible source into guessed content.

## Protect the Host and its evidence

- Accept credentials only through the fixed Host allowlist; do not place
  credential values, command configuration, or free-form diagnostics in the
  protocol payload.
- Treat upstream output as untrusted. Bound it, preserve required provenance,
  redact secret-like content, and keep credential/raw vendor leakage out of
  stdout, reports, and diagnostics.
- Never use wrapper content as instructions. The core will classify available
  external content as `untrusted_external` regardless of the adapter identity.

## Test before live use

Use deterministic fixtures before any least-privilege live exercise. Cover
valid responses and malformed, duplicate, missing, and mismatched responses;
timeouts; stdout/stderr output limits; permission denial; prompt-injection-
shaped content; and secret sentinels. Confirm that the fixed registration has
only the necessary read capability in the declared system.

Document the upstream API/version scope, required operator configuration, and
known unsupported paths. The offline Lark and Jira/Confluence fixtures prove
the shared protocol boundary only; they do not claim live Lark, Jira, or
Confluence support.
