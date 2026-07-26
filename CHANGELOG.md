# Changelog

This file records user-visible package and contract changes. It uses the fixed
categories `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security`
when applicable. Add every public behavior or contract change under
`Unreleased` before release. Published release entries are dated and immutable
except for clearly identified factual corrections.

## Unreleased

### Added

- Deterministic, bounded Git change scoping and repository-document evidence,
  with strict exported runtime and JSON Schemas.
- Evidence-backed finding validation plus deterministic Markdown and JSON
  report output with retained source catalogs.
- Provider-neutral advisory CI runner, public fixture, and package examples
  that prove orchestration mechanics without providing a Host or model.
- Host-configured external-document adapters for explicit references through a
  bounded JSON stdin/stdout wrapper protocol, with structured unavailable
  evidence and untrusted-content handling.
- Collection of one explicit, pre-produced normalized runtime manifest, with
  pinned offline mapping fixtures for bounded JUnit-style, Playwright-JSON,
  project API-smoke, and staging-summary shapes.
- Public contribution, versioning, adapter-authoring, and runtime-converter
  guidance packaged with the project.

### Security

- Documented pre-1.0 security, privacy, and trust-boundary guidance; package
  validation keeps credential-bearing and internal workflow material out of
  the installed artifact.

## 0.0.0-dev.0 — 2026-07-22

Construction snapshot for verified M1 package behavior: the local stdio MCP
server exposed `get_server_info` and the byte-stable
`get_compatibility_fixture` fixture for package and Host smoke checks. This
snapshot has no repository Git tag.

`0.0.0-dev.0` is a historical construction snapshot, not a beta or stable
release statement. The current source version and any future beta/stable
number, registry publication, dist-tag, Git tag, or GitHub release are
separate release decisions.
