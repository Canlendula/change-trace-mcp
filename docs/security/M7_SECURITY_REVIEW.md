# M7 security review

## Scope and method

Reviewed 2026-07-26 against base `8b11c55ff14a6b2a8268968c17954be5ffd45132`.
This project hardening review inspected source and failure-mode tests for stdio,
nine annotations, Git, local documents, adapters, runtime manifests, bundles,
findings, reports, package contents, and data flows. It is not an independent
audit, certification, penetration test, or v1 security claim.

Primary sources accessed 2026-07-26: [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices),
[MCP trust model and disclosure policy](https://github.com/modelcontextprotocol/modelcontextprotocol/security),
and [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
They informed local-stdio privilege and disclosure treatment. Remote OAuth/proxy
controls are not represented as current package controls.

## Audited surface and dependency result

The inventory covers nine tools and six non-tool surfaces. Only
`collect_external_evidence` is open-world; only `write_report` is destructive,
non-read-only, and non-idempotent. Review found two intentional process
boundaries: fixed `git` and Host-configured adapters. It found no first-party
HTTP, HTTPS, socket, DNS, fetch, or telemetry client in `src/`.

`npm audit --omit=dev --audit-level=high` returned `found 0 vulnerabilities`
on 2026-07-26. This is a point-in-time production dependency result, not a
supply-chain guarantee.

## Findings

| ID | Severity | Evidence and impact | Disposition | Follow-up |
|---|---|---|---|---|
| FIND-M7-001 | medium | `createGitEnvironment` builds a fresh fixed-Git environment from the frozen cross-platform allowlist and overrides pager/prompt/locale; poisoned parent-environment collection is covered in `tests/unit/git-environment.test.ts`. | mitigated | Retain the allowlist for every fixed-Git invocation; retained home/config paths remain an operator boundary. |
| FIND-M7-002 | medium | The five named MCP handlers use the exact `{error,code:"operation_failed"}` envelope; local/Git partial errors retain only fixed messages and repository-relative paths. `tests/unit/tool-errors.test.ts`, `tests/unit/local-evidence.test.ts`, and `tests/unit/change-scope-edge-cases.test.ts` guard the wiring. | mitigated | Keep new MCP failure paths on the fixed safe-error policy. |
| FIND-M7-003 | low | `src/security/redact.ts` recognizes common patterns only; split, encoded, novel, or contextual secrets can remain. | open | Keep sensitive sources narrow; evaluate stronger redaction through an approved product/privacy decision. |
| FIND-M7-004 | informational | Local stdio has no sandbox; Host and server use Host-level OS privileges. | accepted | Keep the documented least-privilege/external-sandbox guidance. |

No critical/high finding, unexpected process/network capability, credential leak,
path escape, unsafe report overwrite, or materially false annotation was found.
The inventory retains all findings; documentation is not a mitigation.

## Limitations

The review used no production credentials, live source system, hosted CI, or
external penetration test. It did not verify GitHub private-reporting enablement.
Remote transport, OAuth, sandboxing, telemetry, active probes, and retention
APIs require a new review before implementation or public claims.
