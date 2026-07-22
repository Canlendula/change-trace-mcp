# M1 Host smoke tests

These checks verify that one packaged stdio MCP server initializes, advertises
the same tool surface, and returns the same deterministic fixture in each
target Host.

## Expected fixture

The Host must call `get_compatibility_fixture` with `{}` and receive this exact
text payload:

```json
{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}
```

`get_server_info` is intentionally environment-dependent and is used only for
startup diagnostics.

## Reference client

From a local checkout:

```sh
npm install
npm run smoke:stdio
```

The smoke client can also test another launch command:

```sh
node scripts/smoke-stdio.mjs npx -y change-trace-mcp@<VERSION>
```

The command exits non-zero unless initialization, tool discovery, and fixture
comparison all succeed.

## Codex

Copy the relevant block from [`config/codex.toml.example`](config/codex.toml.example)
into the project or user `config.toml`, replace the checkout path, then start a
fresh Codex task. Ask Codex to call `get_compatibility_fixture` once and return
only its text payload.

The current Codex configuration reference supports stdio `command`, `args`,
`cwd`, startup/tool timeouts, and an `enabled_tools` allowlist. See the
[official Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).

## Claude Code

For a local checkout, either adapt
[`config/claude.mcp.json.example`](config/claude.mcp.json.example) or add the
server without editing a configuration file:

```sh
claude mcp add --transport stdio --scope local change-trace -- node /absolute/path/to/change-trace-mcp/dist/cli.js
claude mcp list
```

In an authenticated one-shot session, restrict the allowed tool to
`mcp__change-trace__get_compatibility_fixture` and request the expected
fixture. The `--` separator before the executable is required. Project-scoped
servers require workspace trust/approval. See the
[official Claude Code MCP reference](https://code.claude.com/docs/en/mcp).

## OpenCode

Set `OPENCODE_CONFIG` to the absolute path of a copy of
[`config/opencode.json.example`](config/opencode.json.example), replace the
checkout path, and run:

```sh
opencode mcp list
opencode run "Call change-trace get_compatibility_fixture once and return only its text result."
```

OpenCode local MCP configuration uses a command array and supports per-server
working directories and discovery timeouts. See the
[official OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers/).

## GitHub Actions published-package smoke

The required M1 cloud check runs
[`m1-published-package-smoke.yml`](../../.github/workflows/m1-published-package-smoke.yml)
on a standard `ubuntu-latest` runner. It starts the public package from a clean
temporary directory and uses the same reference smoke client to verify MCP
initialization, tool discovery, and the exact fixture value.

Run it from the Actions page with **Run workflow**, or with GitHub CLI:

```text
gh workflow run "M1 published package smoke"
```

## Optional GitHub Copilot code review

After a package version is published, paste the adapted contents of
[`config/github-repository-mcp.json.example`](config/github-repository-mcp.json.example)
into **Repository settings → Copilot → Cloud agent → Model Context Protocol
(MCP)**, then leave MCP tools enabled for code review. Ask for a review that
explicitly requests the compatibility fixture and inspect the linked session
logs for the server/tool call.

GitHub's repository MCP environment supports tools only, runs local servers in
an ephemeral cloud environment, and currently exposes MCP-backed code review as
public preview. This paid-Host check is deferred to M4 and does not count as an
M1 pass until a linked session log proves the tool call. See GitHub's official guides for
[repository MCP configuration](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers)
and [Copilot code review](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review).

## Recording results

Update [`RESULTS.md`](RESULTS.md) with the Host version, operating environment,
launch method, initialization result, fixture result, and any timeout or
shutdown observations. A connection-only check does not count as a complete M1
Host pass; the fixture must also match.
