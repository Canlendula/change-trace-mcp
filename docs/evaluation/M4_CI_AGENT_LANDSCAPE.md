# M4 CI Agent integration evidence

> Evidence snapshot: 2026-07-26
> Purpose: support the M4 reference-Host and product-boundary decision

## Scope and evidence classes

This record separates three kinds of evidence:

1. official platform or model-vendor documentation;
2. live Change Trace workflow results from this repository;
3. product conclusions inferred from those facts.

An official integration listing does not establish review quality. A successful
Change Trace orchestration smoke does not certify a model or Host. Semantic
compatibility claims still require the M3-derived replay gate.

## Official platform evidence

| Platform | Verified integration surface | Important boundary | Change Trace implication |
|---|---|---|---|
| GitHub Actions | OpenAI provides `openai/codex-action@v1`; Anthropic provides `anthropics/claude-code-action@v1`. Both can run review prompts from Actions. GitHub Copilot code review can use repository skills and MCP servers in public preview. | The workflow author owns event trust, permissions, secret exposure, sandboxing, artifact upload, and PR comments. Copilot code review requires the applicable paid organization or user capability. | Support a provider-neutral runner contract and optional Host examples. Do not require Copilot or a bundled model. |
| GitLab | GitLab External Agents supports GitLab.com, Self-Managed, and Dedicated offerings at the documented tiers. GitLab lists managed Claude Code and Codex agents and runs external agents through CI/CD with repository context and an audit trail. | Availability depends on tier, version, feature flags, and verified-customer enablement. External agents have provider and isolation risks distinct from GitLab-native agents and are unavailable with self-hosted models. | GitLab can supply the Host and repository interaction. Change Trace should supply normalized evidence and validated report artifacts. |
| Bitbucket Cloud | Agentic Pipelines supports Rovo Dev plus bring-your-own Codex and Claude Code providers. It installs the selected CLI, applies Bitbucket configuration, injects the Bitbucket Cloud MCP server, and runs the agent non-interactively. | Agentic Pipelines does not support self-hosted runners at the evidence date. Provider credentials, cost, and model behavior remain the customer's responsibility. | A caller-supplied Host is a first-class platform pattern, not only a shell fallback. |
| Azure Pipelines / Azure Repos | Azure Pipelines supports command-line, Bash, and PowerShell steps on Microsoft-hosted and self-hosted agents. GitHub documents Copilot code review for Azure DevOps as public preview. | Native review availability and generic pipeline execution are separate capabilities. The pipeline owner must install and authenticate any external CLI. | Use the generic runner contract; treat native Copilot review as an optional Host path. |
| Gitee | Gitee Go supports YAML pipelines and Shell execution. Gitee AI Teammates advertises PR review in its trial offering, and Gitee publishes an MCP server for repository operations. | Public official material does not establish a managed Codex or Claude CI integration equivalent to GitLab or Bitbucket. | Generic command execution and repository APIs/MCP are sufficient integration seams; avoid a vendor-native compatibility claim without a live pilot. |
| Alibaba Cloud DevOps Codeup | Codeup provides native AI merge-request review, repository YAML rules, path-specific instructions, commit-message review, and optional cross-file analysis. | This is a platform-owned reviewer focused primarily on code changes and its configured rules. | Generic code review is already crowded. Change Trace must add requirement, document, provenance, and runtime evidence rather than duplicate code-quality review. |
| Forgejo and similar self-managed forges | Forgejo Actions provides repository workflow execution through runners. Comparable self-managed systems can also invoke command-line tools from their CI runners. | The forge usually does not choose or certify the external model. Operators own runner hardening, credentials, and repository API integration. | A portable command/artifact contract is the durable baseline for self-managed installations. |

## Vendor evidence

### OpenAI Codex

OpenAI documents two relevant automation surfaces:

- [`openai/codex-action@v1`](https://learn.chatgpt.com/docs/github-action)
  installs Codex, starts a Responses API proxy when given an API key, runs
  `codex exec`, supports explicit sandbox and safety settings, and can emit a
  schema-constrained result.
- [`codex exec`](https://learn.chatgpt.com/docs/non-interactive-mode) is the
  non-interactive CLI path for CI and other scripts. OpenAI recommends the
  GitHub Action on GitHub and single-invocation `CODEX_API_KEY` exposure in
  other automation environments.

These are Agent execution capabilities. They do not make Change Trace
model-specific and do not independently satisfy its semantic quality gate.

### Anthropic Claude Code

Anthropic documents
[`anthropics/claude-code-action@v1`](https://code.claude.com/docs/en/github-actions)
for pull-request events, review comments, scheduled automation, repository
skills, and custom prompts. This provides another caller-supplied Host path
without requiring Change Trace to embed an Anthropic dependency.

## Repository live evidence

### Trusted OpenCode workflow

- Run:
  `https://github.com/Canlendula/change-trace-mcp/actions/runs/30157035299`
- Result: the quality and advisory jobs completed under advisory semantics;
  the credential-bearing Host timed out and the runner produced bounded
  `infrastructure_failure` artifacts.
- Follow-up capacity measurement: the five required MCP tool definitions
  occupy 14,014 input tokens before the system prompt or evidence, exceeding
  the tested free GitHub Models High-tier allowance.

This run validates failure containment and artifact safety. It does not
validate a semantic review Host.

### Direct GPT-4.1 quality spike

- Run:
  `https://github.com/Canlendula/change-trace-mcp/actions/runs/30166044169`
- Result: the first mandatory fixture passed; the second returned
  `inference_response_invalid`; the frozen gate stopped after two requests.
- Detailed record:
  [`M4_GPT41_RESULTS.md`](M4_GPT41_RESULTS.md).

This rejects the tested free provider/model/response path as an M4 reference
reviewer. It does not reject the provider-neutral runner or MCP core.

### Provider-neutral deterministic closeout

- Run:
  `https://github.com/Canlendula/change-trace-mcp/actions/runs/30168292163`
- Workflow revision:
  `750e1fae4e54a3eadb9c657b2c6e6df6dd43a6b8`
- Attempt 1: success. Quality and advisory jobs passed with no annotations.
  The advisory log confirms `completed_no_findings`, exactly three uploaded
  files, artifact name
  `change-trace-orchestration-smoke-30168292163-1`, artifact ID
  `8622201189`, and archive SHA-256
  `55bf5ec20b3d47ff74eae79488ca89a62bb1d17cf38d31d9425384476a0acbab`.
- Attempt 2: success. Quality and advisory jobs passed again with no
  annotations. The advisory log confirms the attempt-qualified artifact name
  ending in `-2`, exactly three uploaded files, artifact ID `8622209665`, and
  archive SHA-256
  `cc187449854cf75b9f2a2f8d5e64b4a735ce4a7c91e866ec8fd1d362fc5cab72`.
- The downloaded attempt-2 artifact contained only
  `release-review.md`, `release-review.json`, and
  `release-review-status.json`. The status sidecar recorded
  `runAttempt: 2`, the exact workflow revision as both bounded fixture
  revisions, the deterministic fixture Host, zero findings, and
  `completed_no_findings`. The file SHA-256 values were respectively
  `38b4a657b06fa22da5325f63d54a063c07936de7427a5673543d89029bd62b71`,
  `7877667753bee67ff1e327658e56772e6cde2f9ac8a0be4d083dd5b63f2bbef1`,
  and
  `503ce3d074d146086be0b00e6c2d18ce21137ba5bbcd56214e3f5f7c0e0ee95a`.
- Both attempts downloaded
  `actions/upload-artifact` at the full v7.0.1 commit
  `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`.

GitHub exposes only the current attempt's artifact after a rerun. Attempt 1 is
therefore preserved by the immutable attempt-specific run log, including its
artifact identity, three-file count, size, and digest; attempt 2 is preserved
by both the run log and downloaded content hashes. This platform retention
behavior does not weaken the run-attempt test because the second sidecar
independently records `runAttempt: 2`.

This is deterministic orchestration evidence. It proves the selected workflow,
advisory containment, artifact allowlist, and rerun metadata. It does not
certify a semantic Agent Host or model.

### Automatic-run state

- Verification run:
  `https://github.com/Canlendula/change-trace-mcp/actions/runs/30166037016`
- Result: success; ordinary non-model checks ran, while the credential-bearing
  OpenCode inference and model summary were skipped.
- As of 2026-07-26, all repository workflow runs are complete; no GitHub
  Actions run is queued or in progress.

## Product conclusions

The common cross-platform architecture is:

```text
repository event
  -> platform CI or native Agent trigger
  -> caller-selected Agent Host and model
  -> Change Trace deterministic evidence and report contracts
  -> platform-owned artifact, check, or PR/MR presentation
```

The repository platform is responsible for triggers, protected execution,
identity, credentials, comments, and merge-policy integration. The selected
Host is responsible for semantic reasoning and MCP tool use. Change Trace is
responsible for bounded change scope, normalized evidence, provenance,
validation, and portable Markdown/JSON outputs.

Many target teams already have static analysis or AI code review. The
differentiated product claim is therefore:

> Change Trace provides cross-system, traceable, and verifiable change-intent
> evidence to an existing review Agent.

The defensible scope is platform/model neutrality, external requirements and
decision records, evidence identity and freshness, runtime/test observations,
and classification of requirement gaps, documentation drift, missing
evidence, and runtime mismatch. M5 external-document evidence and M6 runtime
evidence are consequently more important than building another generic code
reviewer.

## Decision supported by this record

M4 uses a provider-neutral advisory runner with a caller-supplied Host. The
project does not bundle, subsidize, or certify a free semantic reviewer.
Specific Host/model compatibility may be documented only after that exact path
passes the M3-derived quality gate. Platform-specific comments and checks stay
outside the core and may be implemented by the platform's Action, CLI, MCP, or
API. The deterministic closeout run satisfies the revised M4 orchestration,
artifact, advisory, and rerun exit gate.

## Official sources

- [OpenAI Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)
- [OpenAI Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Anthropic Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [GitHub Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review)
- [GitLab external agents](https://docs.gitlab.com/user/duo_agent_platform/agents/external/)
- [Bitbucket Agentic Pipelines](https://support.atlassian.com/bitbucket-cloud/docs/agentic-pipelines/)
- [Azure Pipelines](https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/what-is-azure-pipelines?view=azure-devops)
- [Azure Pipelines task and script model](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/tasks?view=azure-devops)
- [Gitee Go Shell execution](https://help.gitee.com/gitee-go/plugin/shell)
- [Gitee AI Teammates](https://gitee.com/ai-teammates)
- [Alibaba Cloud DevOps AI code review](https://help.aliyun.com/zh/yunxiao/user-guide/ai-intelligent-code-review)
- [Forgejo Actions](https://forgejo.org/docs/latest/user/actions/overview/)
- [actions/upload-artifact v7.0.1](https://github.com/actions/upload-artifact/releases/tag/v7.0.1)
