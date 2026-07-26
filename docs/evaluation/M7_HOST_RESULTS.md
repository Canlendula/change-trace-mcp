# M7 real Host compatibility — checkpoint evidence

> Status: `in_progress` Codex checkpoint. This is worker evidence only and
> does not make a Codex compatibility claim.

## Frozen artifact and installation

The harness packed one artifact from committed task state, then installed that
exact local tarball in one fresh consumer outside the checkout. It used a fresh
npm cache, an empty temporary npm user config, disabled install lifecycle
scripts, and a sanitized allowlist environment for npm and the installed MCP
child. The temporary state root, raw logs, consumer, cache, configs, tarball,
and probe remain outside the repository until the pending Codex task completes.

| Field | Value |
| --- | --- |
| Package / source version | `change-trace-mcp` / `0.0.0-dev.1` |
| Tarball | `change-trace-mcp-0.0.0-dev.1.tgz` |
| Tarball SHA-256 | `7a27bf2f7399982015b162a649ef024668cb34b2fbebee34eac8e4eaa2ba7659` |
| Installed `dist/cli.js` SHA-256 | `e828bf961baa7af827e3833d598d9bf3fe6922c7a873bebcb056878322ef4d3f` |
| npm shasum / integrity | `7891a4e3d7925bf1bcfa863cccacca7d3a0213c0` / `sha512-+9bEpmCtFZ4Uc9TwCnJ1gS7M7jzjkOZALhm+G7I4oOWjs7ebkSgrOqBFOqD5wXHNepx5uvdc5xXi5yt5DyuwEw==` |
| Packed / unpacked bytes / files | `151622` / `787375` / `197` |
| Installation checks | copied non-symlink package outside checkout; production `npm ls` passed |

## Host attempts to date

All sessions used the same installed `dist/cli.js` behind an instrumented stdio
probe. The probe records only lifecycle method metadata, exact tool names,
the `{}` fixture arguments, the fixed public fixture text, and shutdown. Raw
Host output is capped under the temporary state root and is never committed.

| Host | Version | Result | Duration | Evidence |
| --- | --- | --- | --- | --- |
| Claude Code | `2.1.217` | passed | `8194 ms` | exact nine-tool discovery, fixture call/result, clean process close |
| OpenCode | `1.18.4` | passed | `8551 ms` | exact nine-tool discovery, fixture call/result, clean process close |
| Codex Desktop | `26.707.3748.0` | pending fresh task | — | branch-only project MCP configuration committed at this checkpoint |

The bounded failed-attempt history is retained in temporary state: two
shell-free launcher-resolution failures, one CLI diagnostic failure before the
MCP call, and one corrected CLI diagnostic failure before the MCP call. The
diagnostic was resolved by adding Claude's documented `--verbose` requirement
for `--output-format stream-json`; no failure reached
`get_compatibility_fixture`, and no authentication, trust, 2FA, browser, or
provider-selection prompt was observed.

For both completed Host attempts the observed tool set was exactly:

```text
collect_external_evidence
collect_local_evidence
collect_runtime_evidence
get_change_scope
get_compatibility_fixture
get_review_bundle
get_server_info
validate_findings
write_report
```

The observed `get_compatibility_fixture` arguments were `{}` and its returned
text was byte-identical to:

```json
{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}
```

## Commands and validation

| Command | Result |
| --- | --- |
| `npx vitest run tests/unit/smoke-real-hosts.test.ts` | passed: 9 tests |
| `npm run check` | passed |
| `npm test` | passed: 376 tests, 1 Windows-inapplicable skip |
| `npm run smoke:stdio` | passed |
| `npm run smoke:ci` | passed |
| `npm run pack:check` | passed |
| `npm audit --omit=dev --audit-level=high` | passed: 0 vulnerabilities |
| `node scripts/smoke-real-hosts.mjs prepare` | passed |
| `node scripts/smoke-real-hosts.mjs run-claude <temporary-state>` | passed after recorded pre-call diagnostics |
| `node scripts/smoke-real-hosts.mjs run-opencode <temporary-state>` | passed |
| `node scripts/smoke-real-hosts.mjs checkpoint <temporary-state>` | passed; Codex evidence pending |

## Required continuation

The next action must be a newly created Codex Desktop task with `gpt-5.6-terra`
and `high` reasoning while this branch-only configuration and temporary state
remain live. Its sole prompt must prohibit repository edits and direct it to
use only the unique M7 MCP server, call `get_compatibility_fixture` once with
`{}`, and return only the tool's text. The worker will then validate the
Codex lifecycle entry, remove the checkpoint configuration, finalize this
record, and clean every temporary artifact.
