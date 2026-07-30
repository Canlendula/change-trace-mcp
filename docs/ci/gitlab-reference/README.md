# Change Trace GitLab reference

This directory is a copyable, synthetic reference for a future public
`change-trace-gitlab-reference` project. It prepares one credential-free,
advisory GitLab mechanics path. It is not evidence of a hosted pipeline,
semantic review, Feishu retrieval, a pilot team, a pilot week, or product
compatibility.

## Materialize the subject project

Create an empty public GitLab project only after the project owner has
confirmed its group, entitlement, and access. Copy `baseline/` into that
project root and copy `gitlab-ci.yml.example` to `.gitlab-ci.yml`. Keep the
following initial sequence explicit and reviewable:

1. Commit the public baseline project.
2. Create a feature branch and copy only `feature/src/service-status.mjs` and
   `feature/test/service-status.test.mjs` over the baseline files.
3. Open an advisory merge request, then run the separate semantic follow-up
   only after its credential and Host have been approved.
4. Commit `follow-up/docs/product-behavior.md` to synchronize the local
   document with `CTGR-001`.
5. After merge, run a post-merge release-candidate advisory path.

The mechanics pipeline runs only the deterministic public fixture. The feature
branch intentionally leaves the local product document stale so a later
semantic assignment can prove the expected finding. The documentation follow-up
is expected to remove that finding. Live Feishu retrieval and both semantic
claims require separate assignments and externally recorded evidence.

## Variable classes

| Phase | Variable | Credential | Who supplies it |
|---|---|---:|---|
| mechanics | tooling commit and safe revisions | no | tracked pipeline metadata |
| semantic follow-up | one Host/model credential | yes | user, masked/hidden and protected |
| Feishu follow-up | `LARK_APP_ID`, `LARK_APP_SECRET` | yes | user, masked/hidden and protected |

No semantic or Feishu credential variable belongs in this reference YAML. A
future protected semantic job must use trusted default-branch configuration,
exclude fork and untrusted merge-request jobs, map its model credential only
to one bounded Host invocation, and sanitize that credential from the MCP child
environment. Do not place credentials in command arguments, prompts, reports,
artifacts, or repository files.

## Included states

`baseline/` has the operational-only implementation and document.
`feature/` contains only the source and test overlay that introduces planned
maintenance. `follow-up/` contains only the synchronized local product document.
`feishu-product-update-template.md` is the controlled synthetic source for the
future external-document step; it does not call Feishu or carry a locator.
