# Threat model

## Scope, assets, and boundaries

This model reviews base `8b11c55ff14a6b2a8268968c17954be5ffd45132`: a local
MCP server launched directly over stdio. It has no remote transport, HTTP
listener, account system, OAuth authorization server, or sandbox guarantee.
The Host and server use the Host user's available OS privileges. Operators must
select a trustworthy package, startup command, repository, adapter, credentials,
output directory, Agent/model, CI runner, source system, and artifact store.

Protected assets are repository content and Git metadata; document/runtime
excerpts; adapter credentials and environment; provenance; report files; and
Host/model/CI data. `trusted_repository` labels repository origin/provenance
only. Repository documents and every evidence-content field remain untrusted
as instructions, alongside external adapter output, runtime manifests, and
Agent findings. The server treats those values as data, never as executable
instructions.

Data flows are `Host -> stdio server -> tools -> Host`. Git and local readers
access a named repository. A Host config can register an arbitrary adapter
executable; adapter stdin/stdout crosses a process and potential external-source
boundary. Runtime collection reads one explicit pre-produced manifest only.
Bundle/finding work is in memory. `write_report` writes a Markdown/JSON pair
under an explicit repository-relative directory. Host/model/CI/source-system
and artifact-store processing are external operator-owned boundaries.

## Controls, tested properties, and residual risk

| Threat/capability | Implemented control and test evidence | Residual risk and operator responsibility |
|---|---|---|
| stdio launch, diagnostics, nine annotations | stdout is MCP-only; structured logs use stderr (`src/logger.ts`, `tests/unit/logger.test.ts`); `src/server.ts` registers all tools. | No privilege reduction or sandbox. Review the exact Host command and use least privilege. |
| fixed Git process, arguments, diff and bounds | fixed `git`, fresh allowlisted child environment, argument arrays, `--end-of-options`, no external diff/textconv, root checks, timeout, output bounds and redaction (`src/git/change-scope.ts`, `tests/unit/git-environment.test.ts`, `tests/unit/change-scope-edge-cases.test.ts`). | Retained home/config path variables can discover ordinary operator-managed Git configuration. This is not a Git sandbox. |
| local documents, paths, symlinks, size/encoding/races | repository-relative schemas, segment checks, no symlink following, regular-file reads, scan/file/excerpt limits, UTF-8 handling, and fixed partial-error messages (`src/evidence/local/collect-local-evidence.ts`, `tests/unit/local-evidence.test.ts`). | Filesystem races remain possible. Keep roots narrow; treat documents as untrusted prompt content. |
| configured adapter process, credentials, malicious output | bounded safe config loading; immutable argv; `shell: false`; allowlisted environment; timeout/termination; stdin/stdout/stderr limits; identity/source validation; redaction and stable errors (`src/evidence/external/run-external-adapter.ts`, `tests/unit/external-adapter-config.test.ts`, `tests/integration/external-adapter-runner.test.ts`). | The Host chooses executable and credentials. Register only reviewed adapters with least-privilege credentials. |
| runtime manifest, missing/misleading evidence | root confinement, segment/file identity checks, size/encoding/schema errors, unavailable semantics and redaction (`src/evidence/runtime/collect-runtime-evidence.ts`, `tests/unit/runtime-evidence-collector.test.ts`). It does not run tests, browsers, probes, deployments, or fetch artifacts. | Manifest provenance is producer-asserted, not independently attested. Unavailable means not observed. |
| bundle, findings, reports, hostile Markdown/HTML | relationship/finding validation plus escaped rendering, bounded reports, confined transactional output and overwrite checks, and fixed top-level MCP failure envelopes (`src/server.ts`, `src/evidence/bundle/build-review-bundle.ts`, `src/findings/validate-findings.ts`, `src/reports/write-report.ts`, `tests/unit/tool-errors.test.ts`, `tests/unit/report-write.test.ts`). | Agent semantic judgment and report values remain untrusted. Review output before publication. |
| supply chain, CI, retention | no first-party network client; package/dependency checks are recorded in `docs/security/M7_SECURITY_REVIEW.md`. | npm, Host, CI permissions, providers, adapters, sources, and retention are operator-controlled; pin, audit, isolate, and delete under local policy. |

## Review triggers and out of scope

Review this model before remote transport, authentication/authorization, network
clients, telemetry, new subprocesses, artifact fetching, new report targets, or
a dependency with process/network capability. Prompt injection/tool poisoning,
secret leakage, path/symlink/race attacks, command injection, denial of service,
malicious adapter output, misleading evidence, report rendering, supply chain,
CI permissions, and retained artifacts are relevant to the controls above.
Remote OAuth/proxy threats are future/out-of-scope considerations, not current
implemented controls.
