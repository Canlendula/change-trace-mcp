# M1 compatibility results

> Last updated: 2026-07-22

| Host | Version/environment | Initialize + discover | Fixture call | Status / next action |
|---|---|---:|---:|---|
| Official TypeScript SDK client | SDK 1.29.0; Node 24.0.0; Windows | Pass | Pass, byte-identical | Revalidated after the `change-trace-mcp` rename; automated by `npm test` and `npm run smoke:stdio` |
| Claude Code | 2.1.216; Windows; third-party API selected through CC Switch | Pass | Pass, byte-identical | One-shot call completed with only `mcp__change-trace__get_compatibility_fixture` allowed |
| OpenCode | 1.18.4; Windows; `deepseek-v4-pro` Host model | Pass | Pass, byte-identical | Revalidated after the rename with all unrelated tools denied |
| Codex | Desktop 26.707.3748.0; Windows | Pass | Pass, byte-identical | Fresh project task loaded the ignored local `.codex/config.toml` and returned the expected fixture |
| GitHub Actions cloud runner | Ubuntu 24.04; Node 22.23.1; npm 10.9.8; public `0.0.0-dev.0` package | Pass | Pass, byte-identical | Required M1 cloud gate; [workflow run 29933918831](https://github.com/Canlendula/change-trace-mcp/actions/runs/29933918831) |
| GitHub Copilot code review | Ephemeral GitHub environment | Deferred | Deferred | Repository MCP configuration saved; paid Host entitlement unavailable; optional M4 validation |

## Local protocol observations

- stdout remained parseable JSON-RPC throughout initialization and calls;
- structured operational logs were emitted on stderr;
- repeated calls returned identical text and structured content;
- the reference client shut down the server process cleanly;
- package dry-run produced a 35-file, 22.2 kB `change-trace-mcp` tarball;
  the publication allowlist excludes local `docs/research/` notes;
- the packed tarball itself passed the reference smoke client when launched via
  `npx --package <local-tarball>`.
- public `change-trace-mcp@0.0.0-dev.0` registry metadata reports Apache-2.0,
  the expected GitHub repository, and integrity
  `sha512-ymbF5Ivjp8zcypHNC1IAsjA7hrLwZ4MIX5IzIL95pTsMwgTiANakGmJhsGjPO33JA2vcGIJnbW1wzHMjKwZHqw==`;
- a clean temporary directory launched the published package with
  `npx --package=change-trace-mcp@0.0.0-dev.0 -- change-trace-mcp`, discovered
  both tools, and received the byte-identical fixture.
- the first GitHub Actions attempt failed before server startup because the
  checked-out reference client dependencies were not installed; the workflow
  added `npm ci --ignore-scripts`, upgraded its pinned official Actions to their
  Node 24 runtime releases, and the second run passed in 13 seconds;
- cloud run `29933918831` discovered both tools and logged the exact expected
  fixture from the public npm package on an Ubuntu 24.04 ephemeral runner.

M1 completed on 2026-07-22. All three target local Agent Hosts, the protocol
reference client, and the required GitHub Actions cloud runner pass. Copilot
Code Review is not included in compatibility claims until a future linked
session log proves its tool call.
