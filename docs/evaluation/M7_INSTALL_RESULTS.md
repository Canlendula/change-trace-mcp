# M7 clean package installation — pre-integration evidence

> Status: worker pre-integration evidence only
>
> Recorded: 2026-07-26
>
> Artifact (packaged-content) commit when run: `6212b51a8e89a7b191549669687435f99ee77d20`

## Command and environment

The exact command was run from the task worktree:

```text
node scripts/smoke-clean-install.mjs
```

| Fact | Value |
| --- | --- |
| Platform | `win32` / `x64` |
| Node.js | `v24.0.0` |
| npm | `11.3.0` |
| Local OpenCode observed | `1.18.4` |
| Registry interaction | Public-registry reads for already-declared production dependencies only |

The smoke created one temporary root outside the repository. It generated one
tarball through `npm pack --json --pack-destination`, used an empty temporary
npm user config and fresh temporary npm cache, removed inherited npm/registry
credential settings, disabled lifecycle scripts for install and npx, and used
shell-free bounded child processes. No registry, Host, user configuration, or
credential state was written.

## Artifact evidence

| Field | Value |
| --- | --- |
| Package | `change-trace-mcp` |
| Source version | `0.0.0-dev.1` |
| Tarball | `change-trace-mcp-0.0.0-dev.1.tgz` |
| SHA-256 | `11ba87bc0760f23c1ccac65635b4bb086155d4bb5d19b48ff0437a74bdb5a040` |
| npm shasum | `07d540a59ff3dad5140bb73a8a2c80dd09e07153` |
| npm integrity | `sha512-nL4vfgss0smKC321ro8AJB1qAFQODFLR13v6L9Z8IRjc9oM7dDn/U25OfcBCJOCwLvzwE5TJQt+CxHEaSEMKMA==` |
| Packed size | `151369` bytes |
| Unpacked size | `786243` bytes |
| Packed file count | `197` |

The packed file list included the declared CLI, root entry/types, README,
LICENSE, SECURITY policy, smoke-test guide/configuration, and security guide.
It excluded source, tests, work items, dependencies, npm configuration,
credential-named files, and repository metadata.

## Installation and launch results

| Check | Result |
| --- | --- |
| Fresh consumer install from exact local tarball | passed |
| Installed package copied outside checkout (not symlinked) | passed |
| Installed metadata, bin, exports, engines, license, dependencies, docs | passed |
| `npm ls --omit=dev --json` in consumer | passed |
| Installed Node launch through reference client | passed |
| Isolated local-tarball `npx --package` launch through reference client | passed |
| Temporary-root cleanup | passed |

Both launches discovered exactly these nine tools:

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

Both required the exact compatibility fixture:

```json
{"schemaVersion":"1.0.0","fixtureId":"m1-host-compatibility","ok":true,"scalar":"change-trace","values":[1,2,3],"nested":{"alpha":"A","beta":"B"}}
```

## Limitations and required follow-up

This is package-mechanics evidence, not a real Codex, Claude Code, or OpenCode
compatibility result. No model, Host session, user/global Host configuration,
or credential-bearing process was started.

`docs/ROADMAP.md` is packaged. Coordinator acceptance changes packaged Roadmap
bytes, so coordinator acceptance requires a clean-install smoke rerun on
accepted `main` and a new final digest/result in this un-packaged evaluation
record. No later packaged-file change can be included in the final clean-install
claim without another rerun.
