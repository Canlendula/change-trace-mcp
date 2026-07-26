# Privacy and telemetry

The core is local-first and currently adds no first-party telemetry or network
client. It can process Git refs, metadata, commit summaries and patches;
repository document excerpts; source references; runtime summaries; findings;
diagnostics; and absolute report paths returned to the Host. `get_server_info`
returns bounded package/runtime diagnostics: name, version, stdio transport,
Node version, platform, and architecture.

Git, document, runtime-manifest, bundle, finding-validation, and report work
stay in the local core. `collect_external_evidence` starts a Host-configured
adapter that can contact an operator-selected source system. The Host may send
output to an Agent or model provider, and CI may upload evidence or reports.
Those adapter, Host, provider, source-system, CI, and artifact-store transfers
follow their own policies and are outside the core telemetry boundary.

Common-pattern secret redaction is best effort. It is not DLP, secret scanning,
or a guarantee that sensitive content cannot reach a Host, model, adapter,
report, log, or artifact store. Users control source selection, credentials,
output locations, Host/model routing, CI permissions, artifact retention, and
deletion. The server has no remote account, retention service, telemetry
service, or deletion API.
