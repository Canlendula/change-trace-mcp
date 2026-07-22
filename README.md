# Change Trace MCP

Change Trace MCP is a local-first, model-neutral MCP server for collecting
and normalizing change-scoped release evidence. The user's existing Agent makes
semantic judgments; this package keeps evidence preparation deterministic and
reviewable.

The project is currently in the M1 protocol compatibility spike. The available
tools are diagnostic only:

- `get_server_info` reports process and runtime metadata;
- `get_compatibility_fixture` returns a byte-stable fixture for Host smoke tests.

## Requirements

- Node.js 22 or newer.

## Local development

```sh
npm install
npm run check
npm test
```

Run the stdio server from a local checkout:

```sh
npm run build
node dist/cli.js
```

The server reserves stdout for MCP JSON-RPC messages. Structured operational
logs are emitted to stderr.

Host-specific setup and the current compatibility matrix live in
[`docs/smoke-tests/`](docs/smoke-tests/README.md).

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for milestone scope and
[`docs/PROJECT_DECISIONS.md`](docs/PROJECT_DECISIONS.md) for accepted product
and architecture decisions.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
