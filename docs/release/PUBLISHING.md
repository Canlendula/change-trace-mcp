# Publishing a candidate

This is repository-maintainer guidance. It prepares a future manual candidate
flow only. It does not configure npm or GitHub, stage a version, approve or
reject a candidate, publish a package, change a dist-tag, create a Git tag or
release, make an evidence claim, or complete a milestone.

## State boundaries

Keep these states separate:

- A local `npm publish --dry-run` is credential-free package-shape evidence.
  It does not prove OIDC, trusted-publisher configuration, GitHub runner
  behavior, staging, approval, availability, compatibility, or release
  success.
- A protected workflow `stage` request reserves a candidate for later human
  npm approval. It is not a public package and does not move `latest`.
- npm approval or rejection is a separate human action. A staged version and
  its `next` tag reservation remain in that state until approval or rejection.
- Moving a dist-tag, creating a Git tag, creating a GitHub release, recording
  compatibility evidence, and marking a milestone complete each require their
  own coordinator decision and evidence.

## Local validation

Run this sequence from a clean, reviewed checkout after the coordinator has
selected the candidate version and release decision. The helper requires a
clean source tree and creates an isolated temporary npm cache, home, and user
configuration. It removes credential-bearing npm environment variables from
its child processes and always uses the public registry.

```text
npm run check
npx vitest run tests/unit/release-publishing-contract.test.ts tests/integration/release-dry-run.test.ts
npm test
npm run smoke:stdio
npm run smoke:ci
node scripts/release/dry-run-publish.mjs
node scripts/smoke-clean-install.mjs
npm run pack:check
npm audit --omit=dev --audit-level=high
git diff --check
git status --short
```

The final helper output is one bounded JSON line labelled
`local-dry-run-only`. Preserve it as local evidence only. The clean-install
summary and `npm pack --dry-run` inspect the installable artifact, including
that repository-only workflow, release guide, helper, and tests are absent.
Static contract tests inspect workflow guards without a network request or a
workflow dispatch.

The unauthenticated helper can confirm a public version lookup only. It cannot
see a pending staged candidate or prove that no staged reservation exists.
Before authorizing stage, a coordinator must separately confirm the staged
reservation state through the authorized npm review path; this preparation did
not perform that confirmation.

## Future manual staging prerequisites

Before a coordinator authorizes a stage request, require all of the following:

1. An unused source version, a completed changelog and release decision, a
   clean reviewed commit, and the exact commit/tag agreement.
2. The manual workflow must use Node.js `24.18.0` and npm `11.16.0`; the
   candidate input commit must be exactly lowercase 40-hex and equal `HEAD`.
3. The tag must be exactly `v<version>`, resolve to that checked-out commit,
   and `<version>` must exactly match `package.json` while differing from
   `0.0.0-dev.0`.
4. The `stage` operation must carry the exact confirmation
   `STAGE CHANGE-TRACE-MCP CANDIDATE`.
5. The protected GitHub `npm-stage` environment and the repository variable
   `NPM_STAGE_PUBLISH_ENABLED=true` must both be intentionally authorized.
   Enabling the repository variable alone is insufficient.

The eventual npm trusted-publisher configuration is exactly one trusted
publisher for package `change-trace-mcp`, repository
`Canlendula/change-trace-mcp`, workflow file `npm-stage-publish.yml`, and
environment `npm-stage`, with the allowed action limited to stage publish.
Use npm's trusted-publisher facility as the default; a token-based alternative
is not an equivalent default. The protected environment is still a separate
human authorization boundary.

The workflow has only `workflow_dispatch`. Its default operation is
`dry-run`; that job has only `contents: read` and no OIDC or package
credential. The independently permissioned stage job has `contents: read` and
`id-token: write`, and stays skipped when the repository variable is absent or
false. It stages only with `npm stage publish --tag next --access public
--ignore-scripts` against `https://registry.npmjs.org/`.

After a successful stage request, a human must complete npm WebAuthn or other
proof-of-presence approval appropriate to the npm account. Do not assume a
TOTP code exists. `next` is the preview tag; do not move `latest` without a
separate release decision.

## Abort and rollback guide

- Failed local dry-run: keep the source version unchanged, inspect the bounded
  diagnostic, correct the repository candidate, and repeat the local sequence.
- Skipped or failed workflow: do not infer staging. Leave the protected
  variable and environment unchanged unless a separately authorized
  administrator changes them; repair inputs or workflow only through review.
- Staged candidate: before human approval, use npm's separately authorized
  stage rejection path if the candidate must be abandoned. Confirm the
  reserved version/tag state with npm; do not reuse the version casually.
- Public package: package versions are immutable. Coordinate a follow-up
  version, any deprecation, and any dist-tag change as separate release
  decisions; never use this workflow to move `latest`.

## Primary references

- [npm trusted publishers](https://docs.npmjs.com/trusted-publishers)
- [npm staged publishing](https://docs.npmjs.com/staged-publishing/)
- [npm stage command](https://docs.npmjs.com/cli/v11/commands/npm-stage/)
- [npm publish command](https://docs.npmjs.com/cli/v11/commands/npm-publish)
- [npm two-factor and proof-of-presence guidance](https://docs.npmjs.com/about-two-factor-authentication)
- [GitHub Actions OIDC](https://docs.github.com/actions/concepts/security/openid-connect)
- [GitHub deployment environments](https://docs.github.com/actions/how-tos/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
- [Node.js 24.18.0 release note](https://nodejs.org/en/blog/release/v24.18.0)
