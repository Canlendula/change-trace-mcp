# Versioning and release facts

Change Trace MCP follows [Semantic Versioning 2.0.0](https://semver.org/).
This guide applies to the npm package and complements npm's
[semantic-versioning guidance](https://docs.npmjs.com/about-semantic-versioning/).

## Package public surface

The package public surface includes MCP tool names and inputs/outputs, exported
runtime and JSON Schemas, CLI/bin and configuration behavior, report artifacts,
packaged examples, and documented extension protocols. A compatible change
preserves the applicable public contract; an incompatible change needs the
appropriate SemVer treatment, clear migration notes, and updated tests and
documentation.

After the first stable release, use SemVer as follows: a `MAJOR` release is for
an incompatible public-surface change; a `MINOR` release is for a backward-
compatible public addition; and a `PATCH` release is for a backward-compatible
fix. Deprecations and migration notes should make the affected contract and
upgrade path explicit before removal.

Before the first stable release, `0.0.0-dev.N` versions are construction
snapshots. They do not create a stable compatibility promise. The next beta or
stable version and its tag remain future release decisions. In particular, the
source version `0.0.0-dev.1` is not a claim of registry publication, beta
status, stability, a Git tag, or a released artifact.

## Separate version domains

Do not equate these independent version or observation domains:

| Domain | Meaning |
|---|---|
| npm package version | The SemVer version of the distributed `change-trace-mcp` package. |
| Serialized `schemaVersion` | The version carried by a serialized public contract. It is independent of the npm version. |
| Adapter version | The version of an external wrapper protocol and its declared upstream scope. |
| Converter or mapping-profile version | The separately named version of deterministic Host/CI preprocessing for one declared upstream format and version scope. |
| Instruction version | The version of Host instructions or evaluation guidance, where applicable. |
| Host compatibility observation | A dated, exact Host/runtime observation; it is evidence, not a package version promise. |

The current provisional serialized Schema values such as `1.0.0` are not an
npm package `1.0.0` promise. They remain subject to the M8 Schema freeze.
A compatible package change may retain a Schema version. An incompatible
serialized change needs a new Schema version, migration notes, and the
corresponding package-version decision.

## Reproducibility and releases

Use exact package versions or immutable commits in reproducible Host and CI
examples. Do not use an unpinned `latest` reference. A local tarball may prove
package mechanics before release, but it is not a registry artifact.

These are separate facts and must be recorded only when verified:

- registry publication;
- npm dist-tag assignment (see npm's [dist-tag documentation](https://docs.npmjs.com/cli/dist-tag/));
- Git tag;
- GitHub release;
- compatibility evidence for a recorded environment; and
- milestone completion.

Changing one does not establish the others. Release entries in
[CHANGELOG.md](../CHANGELOG.md) are dated after publication; public behavior
changes are first recorded under `Unreleased`.
