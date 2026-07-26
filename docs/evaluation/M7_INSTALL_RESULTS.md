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

## Final accepted-main evidence

The coordinator reran the complete gate from accepted `main` after all packaged
Roadmap changes and both portability fixes. The exact artifact state was:

| Field | Value |
| --- | --- |
| Accepted-main artifact commit | `eb0911d891cc7319d7f6dc77f6eccb76f21cf3c0` |
| Command | `node scripts/smoke-clean-install.mjs` |
| Platform | `win32` / `x64` |
| Node.js / npm | `v24.0.0` / `11.3.0` |
| Tarball | `change-trace-mcp-0.0.0-dev.1.tgz` |
| SHA-256 | `426179ff512430d88c46d247caaa5d6cfb7138845a04f889a735d115e9102949` |
| npm shasum | `38669f416ee9d94abc9feadac8da72a81eab1e91` |
| npm integrity | `sha512-4b4Qrj2IoWxSXatkQrqiygQcvRwfrJpa0Teni+mW2SN7k7p7mmh+PxyXSS/XeNlgvKU9tFpxXRITvgfLYcPDMw==` |
| Packed / unpacked size | `151323` / `784672` bytes |
| Packed file count | `197` |

The final focused gate passed 19 tests with the POSIX-only termination test
skipped on Windows. Both complete suites passed 368 tests with the same single
platform skip. Build, type checking, installed-Node and local-tarball npx
launches, stdio and advisory-CI smokes, package dry-run, production audit, diff
check, and clean working-tree check passed. The production audit reported zero
vulnerabilities.

The accepted-main rerun process caught and resolved two portability defects
before this final result: Windows cross-volume containment for a `D:` checkout
and `C:` temporary root, and Vitest's default Vite-module-runner handling of an
unused `.mjs` hashbang in the `D:` checkout. The final default commands pass in
that target layout.

## Limitations and required follow-up

This is package-mechanics evidence, not a real Codex, Claude Code, or OpenCode
compatibility result. No model, Host session, user/global Host configuration,
or credential-bearing process was started.

`docs/ROADMAP.md` is packaged. The final digest above includes the coordinator
acceptance state at `eb0911d891cc7319d7f6dc77f6eccb76f21cf3c0`. No later
packaged-file change can be included in this clean-install claim without another
rerun. Real Codex, Claude Code, and OpenCode compatibility remains the separate
M7-004 authorization boundary.
