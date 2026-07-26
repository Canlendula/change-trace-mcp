# Security Policy

Change Trace MCP is pre-1.0 software. Maintainers evaluate credible defects in
the shipped local stdio package and documented configuration paths. This policy
does not promise a response-time SLA, a fix in every pre-release version, or
support for unshipped deployments.

## Reporting a vulnerability

Visit the repository's [Security Advisories page](https://github.com/Canlendula/change-trace-mcp/security/advisories)
and use **Report a vulnerability** when GitHub exposes that form. It is the
preferred private, coordinated-disclosure route. This policy does not claim
that private vulnerability reporting is enabled at all times.

If the form is unavailable, open only a minimal public issue requesting private
contact. Do not publish exploit steps, credentials, tokens, private paths,
customer data, logs, or other sensitive details. Include the affected version
or commit, Host context, reproduction, impact, configuration boundary, and an
optional mitigation. Give maintainers a reasonable opportunity to investigate
and coordinate a fix before public disclosure.

## Scope and responsibility boundary

Product reports include the local stdio server, fixed Git invocation, local and
runtime evidence reading, report-output confinement, and the configured-adapter
boundary. Expected stdio process privilege is not a vulnerability on its own:
the Host launches this package with the Host user's OS privilege. Operators
select and trust the Host command, adapters and credentials, repositories,
output paths, Agent/model, CI, source systems, and artifact retention.

Model judgment, third-party service policy, compromised Host configuration,
unsupported remote transport, OAuth/authorization servers, sandboxing, and
remote deployment are outside the current product boundary. See
[security documentation](docs/security/README.md) for the threat model,
privacy statement, executable inventory, and review record.
