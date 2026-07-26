# M7 real Host compatibility — checkpoint evidence

> Status: worker final evidence, pending coordinator review. Codex Desktop's
> long-lived MCP ownership is recorded as Host-specific lifecycle behavior.

## Frozen artifact and installation

The harness packed one artifact from committed task state, then installed that
exact local tarball in one fresh consumer outside the checkout. It used a fresh
npm cache, an empty temporary npm user config, disabled install lifecycle
scripts, and a sanitized allowlist environment for npm and the installed MCP
child. The temporary state root, raw logs, consumer, cache, configs, tarball,
and probe were removed after evidence finalization.

| Field | Value |
| --- | --- |
| Package / source version | `change-trace-mcp` / `0.0.0-dev.1` |
| Clean source commit | `13e9d13c52590381434780e747c2eb9b4badcf76` |
| Tarball | `change-trace-mcp-0.0.0-dev.1.tgz` |
| Tarball SHA-256 | `7a27bf2f7399982015b162a649ef024668cb34b2fbebee34eac8e4eaa2ba7659` |
| Installed `dist/cli.js` SHA-256 | `e828bf961baa7af827e3833d598d9bf3fe6922c7a873bebcb056878322ef4d3f` — runtime unpacked from the exact integrity-bound tarball |
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
| Codex Desktop | `26.707.3748.0` | passed; Host-held lifecycle | `10965 ms` task / `2 ms` MCP call | exact nine-tool discovery and fixture call/result; no one-shot close event before archive |

Version provenance: `claude --version` was observed as `2.1.217 (Claude
Code)` before the evidence session. Coordinator later observed that the global
Claude installation auto-updated to `2.1.220` after the successful run; no
current version output is used to prove the earlier binary. The exact native
OpenCode executable was checked non-billably after review and returned
`1.18.4`. Codex Desktop `26.707.3748.0` is the fresh task/app observation.

The bounded failed-attempt history is retained in temporary state: two
shell-free launcher-resolution failures, one CLI diagnostic failure before the
MCP call, and one corrected CLI diagnostic failure before the MCP call. The
diagnostic was resolved by adding Claude's documented `--verbose` requirement
for `--output-format stream-json`; no failure reached
`get_compatibility_fixture`, and no authentication, trust, 2FA, browser, or
provider-selection prompt was observed. The Codex result came from fresh task
`019f9e52-8a07-78e2-a6c7-f0ff30d0187a` using `gpt-5.6-terra` with `high`
reasoning. It returned the required exact text and reported a completed tool
call. Independent lifecycle inspection found no `server_closed` record after
the result and two probe/server pairs parented by Codex Desktop. After the
coordinator archived the validation task, one pair exited without a lifecycle
close record and one pair remained. The remaining pair was identified only by
the unique temporary state-root command-line marker and force-terminated during
explicit cleanup. The probe therefore emitted no exit code or signal for that
forced termination; final process matching found zero remaining pairs. This is
recorded as Codex Desktop's Host-held lifecycle behavior, not as a graceful
one-shot close claim.

All three Host records observed exactly this tool set. Claude Code and OpenCode
are graceful one-shot sessions; Codex Desktop is the explicit Host-held record
described above:

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
| `npx vitest run tests/unit/smoke-real-hosts.test.ts` | passed: 18 tests, 1 Windows-inapplicable skip (post-review hardening) |
| `npm run check` | passed |
| `npm test` | passed: 386 tests, 2 Windows-inapplicable skips (post-review hardening) |
| `npm run smoke:stdio` | passed |
| `npm run smoke:ci` | passed |
| `npm run pack:check` | passed |
| `npm audit --omit=dev --audit-level=high` | passed: 0 vulnerabilities |
| `node scripts/smoke-real-hosts.mjs prepare` | passed |
| `node scripts/smoke-real-hosts.mjs run-claude <temporary-state>` | passed after recorded pre-call diagnostics |
| `node scripts/smoke-real-hosts.mjs run-opencode <temporary-state>` | passed |
| `node scripts/smoke-real-hosts.mjs checkpoint <temporary-state>` | passed; temporary configuration created |
| exact native OpenCode executable `--version` | passed: `1.18.4` (non-billable post-review check) |

## Host lifecycle and cleanup

Claude Code and OpenCode emitted normal lifecycle closes. Codex Desktop kept
the project MCP process after the task turn completed and after thread archive;
the coordinator has classified this as Host-specific long-lived behavior. No
new Codex call was made. The temporary checkpoint configuration, artifact,
consumer, npm cache, raw logs, state, and precisely matched remaining process
pair were removed; the final exact-match orphan count was zero. The actual
cleanup was manual and exact-state scoped: a command-line marker check selected
only the unique temporary-state pair, `Stop-Process` terminated that remaining
pair, and `cleanupStateRoot(...)` removed the state root. The new
`node scripts/smoke-real-hosts.mjs record-codex-held <temporary-state> <thread-id> <turn-ms> <mcp-ms>`
records only the latest lifecycle segment as an artifact-bound Host-held
attempt. The paired `finalize <temporary-state>` action validates the expected
Claude, OpenCode, and Codex dispositions plus generated checkpoint identity and
safe temporary root before deleting them; neither action was used
retrospectively.
Post-review `runHost` hardening also observes each exact executable's
non-billable `--version` before a semantic session and rejects a mismatch; it
does not alter the historical Claude version provenance above.
Coordinator review owns the corresponding acceptance/Decision wording
adjustment.

### Actual manual Codex cleanup transcript

The real evidence root had already been cleaned before the post-review
`record-codex-held` and `finalize` actions existed. The following is the exact
PowerShell command form used for the bounded post-archive inspection and
manual cleanup, with the non-secret temporary absolute prefix replaced by
`<temp>` only. The unique marker is retained verbatim.

```powershell
$stateRoot = '<temp>\change-trace-m7-real-VVN0kK'
$m7 = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*change-trace-m7-real-VVN0kK*' }
$m7 | ForEach-Object {
  [pscustomobject]@{
    ProcessId = $_.ProcessId
    ParentProcessId = $_.ParentProcessId
    role = if ($_.CommandLine -like '*probe.mjs*') { 'probe' } else { 'server' }
  }
}
```

The first inspection found two exact probe/server pairs. After archive, the
same query found one pair. The actual cleanup then reselected only that marker
and required exactly two processes before force termination:

```powershell
$targets = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*change-trace-m7-real-VVN0kK*' } |
  Select-Object -ExpandProperty ProcessId
if (@($targets).Count -ne 2) { throw 'unexpected_m7_process_count' }
Stop-Process -Id $targets -Force
node --input-type=module -e "import { cleanupStateRoot } from './scripts/smoke-real-hosts.mjs'; await cleanupStateRoot('<temp>\\change-trace-m7-real-VVN0kK');"
if (Test-Path $stateRoot) { throw 'temporary_state_cleanup_failed' }
$remaining = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*change-trace-m7-real-VVN0kK*' }
if ($remaining) { throw 'm7_orphan_cleanup_failed' }
```

The final command completed with `temporary_state_cleanup=passed` and
`m7_orphan_processes=0`. The branch checkpoint was removed by the tracked
file patch that deleted `.codex/config.toml`; its actual subsequent check was
`if (Test-Path .codex\config.toml) { throw 'checkpoint_config_still_present' }`.
No shell deletion command for that tracked file was executed, so none is
claimed here.
