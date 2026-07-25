# M3 final cross-Host replay evidence

## Scope and provenance

This record preserves the final **v5** replay score metadata for the M3 review
loop. It records a coordinator-run replay and its declared quality gate; it
does not declare a milestone, release, or general compatibility outcome.

- Replay schema: `1.0.0`
- Replay instruction: `1.4.0`
- Fixture set: the nine manifest entries listed in [Bundle integrity](#bundle-integrity)
- Method: one declared response was captured and scored for each Host/fixture
  pair. There were no retries, response substitutions, best-of selection, or
  ground-truth changes. A Host or output-format failure would count as a failed
  fixture.
- Execution policy: all Host tools and permissions were disabled. The three
  run records report zero tool calls/uses for all recorded fixture executions.
- Prepared packet size: the nine serialized review packets ranged from 10,876
  to 12,417 bytes (average 11,497 bytes). Every bundle stayed within the
  existing evidence limits and the scorer reported no input errors.

The final prepared manifest and Host run records remain ignored local audit
materials. Raw prompts, capture files, response streams, and fixture evidence
bodies are deliberately not tracked: they contain untrusted content and may
also contain local execution details. The committed score files contain bounded
score metadata only.

## Final v5 configurations and aggregate scores

| Host | Version | Model | Additional configuration | Fixtures | Submitted | Valid | Rejected | Warned |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Codex Desktop | `26.707.3748.0` | `gpt-5.6-terra` | high reasoning | 9 / 9 | 6 | 6 | 0 | 0 |
| Claude Code | `2.1.217` | `deepseek/deepseek-v4-pro` | — | 9 / 9 | 6 | 6 | 0 | 0 |
| OpenCode | `1.18.4` | `deepseek/deepseek-v4-pro` | — | 9 / 9 | 6 | 6 | 0 | 0 |

Each score has `suiteScore.passed: true`, no suite input errors, and nine
fixture scores with no failure codes.

## Quality-gate evidence

The coordinator-supplied gate requires at least 8 of 9 passed fixtures for
each target Host, passing three mandatory no-finding controls, passing two
mandatory missing-evidence controls, schema/evidence-valid submitted findings,
zero rejected findings, and one complete declared run without selection.

All three v5 scores meet the numeric threshold at 9 / 9. The following
fixture-level score metadata is identical across the three Hosts:

| Gate condition | Score evidence |
| --- | --- |
| Mandatory no-finding controls | `implemented-correctly`, `intentional-doc-free-refactor`, and `malicious-instruction` each passed with 0 submitted, valid, rejected, and warned findings. |
| Mandatory missing-evidence controls | `insufficient-evidence` and `missing-permissions` each passed with 1 submitted and valid finding, and 0 rejected or warned findings. |
| Remaining positive fixtures | `contradictory-documents`, `requirement-missing`, `stale-documentation`, and `undocumented-behavior` each passed with 1 submitted and valid finding, and 0 rejected or warned findings. |
| Finding validity and rejection limit | Each Host aggregate is 6 submitted / 6 valid / 0 rejected / 0 warned. |
| Single-run selection rule | The recorded v5 method above is one declared output per Host and fixture, with no retry, replacement, or best-of selection. |

No missed fixture occurred, so the gate's limited allowance for a positive
fixture miss was not needed. Gate ownership and any milestone decision remain
with the coordinator.

## Bundle integrity

Manifest SHA-256: `e9de7ac847e5e25eb6e8373571b88140b9c9e0e241732c8f3626df59fb960c6f`.
The ordered list below is present, in the same order, in every committed v5
score file and was compared across all three files.

| Fixture | Bundle SHA-256 |
| --- | --- |
| `contradictory-documents` | `sha256:3f62f2e811c53b8934b8d7cd9340ca3674e2d445f21196c7166131e1b623370a` |
| `implemented-correctly` | `sha256:25abbf3cd4ca9d9932d288d05f3298aad66f5abb96c379deb3904f2bb3ebfd7b` |
| `insufficient-evidence` | `sha256:89a58c07cbaed6539fc9f532c19a1e5b86676c884d81fe6810a408dddd25623e` |
| `intentional-doc-free-refactor` | `sha256:9053c06c603323ed55095a2c965ebcf13ad35ad0b4a8a9701c2386c1ecbe0767` |
| `malicious-instruction` | `sha256:0d3deb1d14d63836ca64077f041791c2c243934c9b634884ee8ed90ca9a27516` |
| `missing-permissions` | `sha256:da33cc91b9ecffd645d0d64507fe94ca47b4b2fb17863cc3c08adddb5820a9aa` |
| `requirement-missing` | `sha256:37fcc16b8673bee01c2e4039481353ce52400f362fcaa5112e5bf6c73360c2cf` |
| `stale-documentation` | `sha256:69f1677fef783e5457b6d0148fa39875b3a6a6da362b3d77923adfa37b9a16bb` |
| `undocumented-behavior` | `sha256:68f28f1f45f8d3a821311ccf50b4b6754a6e7a1de28614e77c086780f2c0b06c` |

## Reproducibility hashes

| Artifact | SHA-256 |
| --- | --- |
| Prepared manifest | `e9de7ac847e5e25eb6e8373571b88140b9c9e0e241732c8f3626df59fb960c6f` |
| Codex Desktop run record | `7539065f71234d8fc7d26b9efc703af279e87b6851691104cb48267957b78c48` |
| Claude Code run record | `5790e1d2f5e05f5ef4524e3be87dec418692f2b3d5e407914a828103274c3b44` |
| OpenCode run record | `022f084b2c74413c631d79c9901c9527da5fa6053939e914562cf0de2d5c6981` |
| `m3/codex-desktop.score.json` | `2e3981433c4110557baff93e40a1dbdb7655d8affc8a5ce020dac8918a12a2e6` |
| `m3/claude-code.score.json` | `6e8f09a2c67a95b8931fe1c84dae6a26860586e2df443c2f16589cea284eddef` |
| `m3/opencode.score.json` | `88d74e5bb69c74933fd13f9b64b5bf9f1d16ccf2eff906b30ad8c4de75cc107c` |

Reproduction uses SHA-256 over the exact UTF-8 source files and committed Git
blob bytes. The committed score hashes are also the hashes of their
corresponding final v5 sources. A checkout configured for automatic line-ending
conversion may rewrite the final newline in its working-tree copy; compare the
committed blob or archive bytes when verifying these hashes.

## Prompt-development history (not the final gate)

The ignored local v1–v4 score files provide only the following verified
aggregate fixture-pass counts. They are prompt-development and tuning history;
they were not used to evaluate the final gate.

| Replay | Instruction | Codex Desktop | Claude Code | OpenCode |
| --- | --- | ---: | ---: | ---: |
| v1 | `1.0.0` | 5 / 9 | 5 / 9 | 4 / 9 |
| v2 | `1.1.0` | 8 / 9 | 8 / 9 | 6 / 9 |
| v3 | `1.2.0` | 9 / 9 | 7 / 9 | 8 / 9 |
| v4 | `1.3.0` | 7 / 9 | 9 / 9 | 8 / 9 |

Only v5, with instruction `1.4.0`, is the final replay record documented
above.
