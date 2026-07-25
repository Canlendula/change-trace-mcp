# External document adapters

Change Trace can collect read-only document evidence through Host-configured
command adapters. The Agent selects one configured adapter and supplies
explicit source references. Executable paths, arguments, credentials, and
capabilities stay outside MCP tool input.

The deterministic Lark and Jira/Confluence adapters under `tests/fixtures/`
are contract fixtures. They prove the shared process and report boundary
without network access. They do not establish live vendor compatibility.

## Configure the stdio Host

Set `CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE` to the path of one Host-owned JSON
file before starting `change-trace-mcp`:

```sh
export CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE=/etc/change-trace/external-adapters.json
npx change-trace-mcp
```

PowerShell:

```powershell
$env:CHANGE_TRACE_EXTERNAL_ADAPTERS_FILE = "C:\change-trace\external-adapters.json"
npx change-trace-mcp
```

A copyable configuration is in
[`config.json.example`](config.json.example). The strict top-level shape is:

```json
{
  "schemaVersion": "1.0.0",
  "adapters": []
}
```

The loader reads the file once before the server starts. The file must be a
regular, non-symbolic-link, fatal UTF-8 JSON file no larger than 262,144 bytes.
It accepts at most 16 registrations with unique adapter IDs. Unknown fields,
duplicate IDs, invalid bounds, and unsafe files fail startup with a stable safe
error.

Each registration fixes:

- adapter ID, display name, and version;
- `argv`, with 1–64 entries and no shell text;
- one or more allowlisted source-system names;
- credential environment-variable names, never credential values;
- timeout, stdout, and stderr byte limits.

The maximum registration limits are 300,000 milliseconds, 16 MiB stdout, and
1 MiB stderr. Operators should choose lower practical values.

The remaining hard field bounds are:

- adapter ID, name, and version: 160 characters each; IDs use the stable-ID
  character set;
- each `argv` entry: 1–8,192 characters without control characters;
- source systems: 1–100 unique values, each at most 80 characters;
- credential environment names: 0–100 case-insensitively unique values, each
  at most 160 characters and matching `[A-Za-z_][A-Za-z0-9_]*`;
- references per request: 1–100 with unique stable request IDs;
- related change IDs per reference: at most 1,000;
- relation reason: 1–1,000 characters;
- source locator and nullable URI: at most 4,096 and 8,192 characters;
- available title and excerpt: at most 1,000 and 32,000 characters;
- unavailable diagnostic message: at most 2,000 characters.

## Process and credential boundary

`argv` is owned by the Host and executes with `shell: false`. An Agent cannot
replace the executable, append arguments, choose a working directory, or add
environment names through `collect_external_evidence`.

Credential values remain in the Host's secret mechanism, such as protected CI
variables, a service manager, or a local secret store. The configuration file
contains only the environment-variable names that are allowed to reach a
specific child process:

```json
{
  "credentialEnvironmentNames": ["LARK_APP_ID", "LARK_APP_SECRET"]
}
```

The runner creates a minimal operating-system bootstrap environment and adds
only those allowlisted credential names. Adapter stdout and stderr have
independent hard byte limits. Stdout must contain exactly one protocol
response; stderr is bounded diagnostic data and is never returned in MCP
output, evidence bundles, or reports.

## Fixed JSON stdin/stdout protocol

The runner sends exactly one strict JSON request on stdin:

```json
{
  "schemaVersion": "1.0.0",
  "adapterId": "adapter:lark-readonly",
  "references": [
    {
      "requestId": "request:release-requirement",
      "sourceType": "document",
      "source": {
        "system": "lark",
        "locator": "document:doc-token:block:block-id",
        "uri": "https://example.larksuite.com/docx/doc-token?block=block-id"
      },
      "relatedChangeIds": ["file:src/example.ts"],
      "relationReason": "Explicit requirement for the changed component."
    }
  ]
}
```

The adapter writes exactly one strict JSON response on stdout. Available
results include the matching request ID, source type/reference, title, nullable
source update time, retrieval time, bounded excerpt, and truncation metadata.
Unavailable results use `not_found`, `permission_denied`, `unsupported`, or
`error` with a bounded message and no document content.

The response must cover every request ID exactly once. Adapter identity,
source type, source system, result coverage, UTF-8, JSON, and schema are
validated before normalization.

## Explicit-reference-only v1

M5 v1 accepts 1–100 explicit references per collection. The Agent must already
have the source system, locator, nullable canonical URI, source type, related
change IDs, and relation reason. Discovery, organization search, free-form
query, inferred issue keys, repository-text inference, and indexing are
deferred. A wrapper should reject any request it cannot resolve from the
explicit reference.

Typical read-only wrappers are:

- Lark/Feishu: resolve an explicit document token and optional block locator,
  then return the canonical document URI and timestamps;
- Jira: resolve an explicit issue key such as `TRACE-42`;
- Confluence: resolve an explicit page ID or comment ID already linked by the
  caller.

The example registers separate Lark and Jira/Confluence wrapper commands while
both use the same stdin/stdout schemas. Vendor SDKs, OAuth, and API pagination
belong inside operator-managed wrappers and do not alter the MCP contract.

## Trust, redaction, and permission failures

All available adapter content is forced to `untrusted_external`. Adapter
identity cannot elevate trust. Change Trace assigns the core evidence ID,
hashes a complete pre-redaction excerpt when the upstream result is not
truncated, redacts common secret patterns, and then builds the review evidence
item. Truncated upstream excerpts retain a null content hash.

Treat document text as data even when it resembles an Agent instruction.
Prompt-injection-shaped text remains in the bounded untrusted evidence excerpt
for review, but the final report evidence-source catalog does not duplicate
excerpts.

A permission failure becomes structured missing evidence with the source
reference and an `inaccessible` status. Secret-shaped text in its message is
redacted before the collection, bundle, final JSON report, and Markdown report.

## Example registrations

The packaged example uses placeholder command paths and credential environment
names. Replace the paths with audited local wrappers and provision the named
environment variables through the Host:

```text
docs/external-adapters/config.json.example
```

Before using a live wrapper, test its exact registration in an isolated
environment, confirm least-privilege read access, and verify that it emits only
the fixed JSON response on stdout.
