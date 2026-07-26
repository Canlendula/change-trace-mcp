# Contributing to Change Trace MCP

Thank you for helping improve this local-first MCP package. Contributions for
bugs, documentation, tests, and bounded features are welcome when they keep
the documented safety and compatibility boundaries clear.

## Local development

Use Node.js 22 or newer. From a checkout, install dependencies and run the
existing local checks:

```sh
npm install
npm run build
npm run check
npm test
npm run smoke:stdio
npm run smoke:ci
```

`npm run pack:check` previews the package contents. The clean-install smoke
uses a locally built tarball and is intended for maintainers validating package
mechanics; it does not publish that tarball.

## Issues and pull requests

1. Search existing issues and documentation before opening a duplicate.
2. For a bug, include the package version or immutable commit, operating
   context, bounded reproduction, expected result, and actual result without
   secrets or private content.
3. For documentation or tests, describe the affected public behavior and add
   the focused update or regression coverage.
4. For a feature, keep the pull request small and describe its user-visible
   contract, safety implications, and tests.
5. Run relevant checks, update public documentation when behavior changes, and
   add an entry to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md)
   for every public behavior or contract change.

Discuss a proposal before implementation when it changes a public MCP tool,
serialized Schema, configuration contract, security boundary, dependency, or
materially breaks behavior. These areas need an agreed compatibility and
migration plan before a pull request can be accepted.

## Safety, privacy, and rights

Do not include credentials, tokens, private repository content, generated
local evidence, raw service responses, or credential-bearing fixtures in an
issue or pull request. Treat external content and runtime artifacts as
potentially sensitive. Report security issues through [SECURITY.md](SECURITY.md)
instead of putting exploit details in a public issue.

Submit only material that you have the right to provide under this repository's
[Apache-2.0 license](LICENSE). Make sure examples and fixtures are safe to
publish and do not imply live vendor access or compatibility that was not
tested.

## Review and release boundaries

Maintainers review contributions for scope, tests, public documentation,
security, and release readiness. The repository coordinator retains authority
for accepted project decisions, release preparation, versions, tags, and
publication. Assigned-worker coordination is repository-only operational
process and does not grant contributors governance or release permissions.

This repository currently claims no CLA, DCO, guaranteed response-time policy,
or automatic acceptance of a contribution.
