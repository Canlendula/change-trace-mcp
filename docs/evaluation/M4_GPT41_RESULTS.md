# M4 GitHub Models GPT-4.1 quality-spike evidence

## Scope

This record preserves the bounded result of the M4-004 first-run quality
feasibility test. It evaluates the free GitHub Models `openai/gpt-4.1` path
against the accepted M3 review packets and scorer. It does not publish a Host
compatibility claim or isolate the model's semantic quality from every provider
and output-protocol factor.

## Run identity

- Workflow: `M4 GPT-4.1 quality spike`
- Run:
  `https://github.com/Canlendula/change-trace-mcp/actions/runs/30166044169`
- Event/attempt: `workflow_dispatch`, attempt `1`
- Head:
  `80fd113391716b619d40cddb7a2ad39de920c9db`
- Result: `failure`
- Model: `openai/gpt-4.1`
- Replay instruction: `1.4.0`
- Response format: `json_schema`, non-streaming
- Request and evaluator timeouts: 30 seconds each
- Output limit: 4,000 tokens
- Selection policy: one declared response per attempted fixture; no retry,
  repair, replacement, best-of selection, or ground-truth change

## Bounded score result

The workflow stopped after two requests, as required by the frozen gate.

| Fixture | Result | Submitted | Valid | Rejected | Failure code |
|---|---:|---:|---:|---:|---|
| `implemented-correctly` | Pass | 0 | 0 | 0 | — |
| `intentional-doc-free-refactor` | Fail | 0 | 0 | 0 | `inference_response_invalid` |

Aggregate metadata:

- attempted: 2;
- passed: 1;
- failed: 1;
- findings submitted/valid/rejected: 0 / 0 / 0;
- stop reason: `request_or_response_failure`;
- gate passed: `false`;
- persisted artifact: one 980-byte `score.json`;
- raw prompts, API bodies, model content, captures, and credentials were not
  uploaded or printed.

The first mandatory no-finding control passed. The second mandatory no-finding
control did not yield a response that the fixed response contract could accept.
The remaining seven fixtures were not requested.

## Quota and automatic-run verification

The push that introduced the spike also ran the existing M4 workflow:

- Run:
  `https://github.com/Canlendula/change-trace-mcp/actions/runs/30166037016`
- Result: `success`
- Quality job: passed
- Credential-bearing OpenCode inference step: `skipped`
- Bounded OpenCode summary step: `skipped`

This confirms that ordinary push/PR execution no longer invokes a model.
The failed quality spike was the only authorized model run. Because the first
run failed, no stability rerun was triggered.

## Decision significance

The free GitHub Models GPT-4.1 path is a no-go for the M4 reference semantic
review under the frozen gate. It did not demonstrate a complete reliable run,
so a compact MCP adapter alone would not make this specific reference path
acceptable.

The result does not prove that GPT-4.1 would fail the semantic cases after a
valid response. One fixture passed and the run stopped on response validity
before the remaining semantic cases. It establishes the narrower, actionable
fact that the tested provider/model/response-contract path is not reliable
enough to support the M4 reference claim without changing the frozen run or
selection policy.

M4 therefore remains open pending a product choice among a quality-qualified
higher-capacity model path, a provider-neutral caller-supplied Host path, or a
reduced M4 scope that does not claim a built-in free GitHub semantic reviewer.
