# Package installation and Host configuration preparation

This guide separates package-mechanics evidence from real Host compatibility.
The M7 clean-install smoke starts the local tarball with the reference MCP
client; it does not start Codex, Claude Code, or OpenCode, and it makes no
compatibility claim for any Host.

## Expected fixture

The reference client calls `get_compatibility_fixture` with `{}` and requires
this exact text payload:

```json
{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}
```

The package currently exposes these nine tools: `collect_external_evidence`,
`collect_local_evidence`, `collect_runtime_evidence`, `get_change_scope`,
`get_compatibility_fixture`, `get_review_bundle`, `get_server_info`,
`validate_findings`, and `write_report`.

## Three launch paths

### Development checkout only

Use this only while developing this checkout. It launches `dist/cli.js` from
the repository rather than proving package installation.

```sh
npm install
npm run smoke:stdio
```

### Future published package, exact version only

After a coordinator-authorized publish, configure an exact released version:

```sh
npx -y change-trace-mcp@<VERSION>
```

Replace `<VERSION>` with an actual published version. Do not substitute the
source version `0.0.0-dev.1`, and do not use an unpinned `latest` launch.

### Maintainer local tarball evidence

From a checkout with dependencies installed, run the reusable clean artifact
smoke:

```sh
node scripts/smoke-clean-install.mjs
```

It runs `npm pack --json` once, hashes that local tarball, installs it into a
fresh temporary consumer using an empty user config, fresh cache, and disabled
lifecycle scripts, then checks both the installed Node launch and an isolated
local-tarball `npx --package <tarball> -- change-trace-mcp` launch. Its one-line
JSON output is pre-integration package evidence. It creates no registry or
Host state and removes its temporary files before returning.

## Codex configuration preparation

Use the Codex desktop MCP-server UI to add a STDIO server, or add the same
exact-version launch with the CLI:

```sh
codex mcp add change-trace -- npx -y change-trace-mcp@<VERSION>
```

For TOML configuration, copy
[`config/codex.toml.example`](config/codex.toml.example) into the relevant
Codex configuration. Codex supports project configuration only for trusted
projects. Restart the desktop app after a UI change or start a new task after a
configuration change so the server is initialized again. The example sets a
10-second startup timeout and a 60-second per-tool timeout, exposes all nine
tools, and deliberately leaves approval policy to the operator's local policy.

These instructions follow the [Codex MCP guide](https://developers.openai.com/codex/mcp/)
and [Codex configuration reference](https://developers.openai.com/codex/config-reference/),
accessed 2026-07-26. They are configuration preparation only.

## Claude Code configuration preparation

For a local scope, keep every Claude option before the server name and use `--`
before the executable:

```sh
claude mcp add --transport stdio --scope local change-trace -- npx -y change-trace-mcp@<VERSION>
```

[`config/claude.mcp.json.example`](config/claude.mcp.json.example) is the
equivalent stdio command plus argument-array form for a project `.mcp.json`.
Claude Code distinguishes local, project, and user scopes. Project-scoped
servers are shared through `.mcp.json` and require workspace trust/interactive
approval before use; local and user scopes remain local-user configuration.
No Claude Code session was started to validate this example.

See the [official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp),
accessed 2026-07-26.

## OpenCode configuration preparation

The locally installed OpenCode is **v1.18.4**. Its v1-compatible configuration
is [`config/opencode.json.example`](config/opencode.json.example), where named
servers are directly beneath `mcp`. Keep this file version-labeled; do not give
the v2 structure to the installed v1 CLI.

Current OpenCode v2 configuration instead places named servers beneath
`mcp.servers`; use the separate
[`config/opencode-v2.json.example`](config/opencode-v2.json.example). Both
examples use a local command array and an exact package-version placeholder.
The v2 example uses `disabled: false`, separate startup/catalog/execution
timeouts, and `codemode: false` so the nine native MCP tools remain exposed.
JSON parsing is mechanical configuration preparation only; it does not prove a
Host launched or called the server.

See the [OpenCode v2 MCP-server documentation](https://opencode.ai/v2/docs/mcp-servers),
accessed 2026-07-26.

## Historical M1 records

[`RESULTS.md`](RESULTS.md) preserves historical M1 Host observations. This M7
guide does not replace them with a new Host pass. Any future real-Host evidence
must use a fresh session and record the installed artifact, startup, tool
discovery, exact fixture, timeout, and shutdown observations.
