# Repository Agent Rules

These rules apply to every Agent session working in this repository.

## Role resolution

- One user-designated primary session is the coordinator, reviewer, and release
  owner.
- Every other session or sub-agent is an implementation worker unless its task
  assignment explicitly identifies it as the coordinator.
- A worker cannot promote itself to coordinator or infer coordinator authority
  from access to the repository.

## Coordinator-only authority

Only the coordinator may:

- modify `docs/ROADMAP.md`, milestone status, exit-gate status, or the global
  backlog;
- modify `docs/PROJECT_DECISIONS.md`;
- modify this file, `docs/CONTRIBUTING_WORKFLOW.md`, or the work-item templates;
- accept or reject a worker handoff;
- merge or cherry-pick work into `main`;
- change package versions, create tags or releases, publish npm packages, or
  change npm dist-tags;
- publish compatibility claims or declare a milestone/release complete.

Workers may propose any of these changes in their work-item report.

## Worker requirements

- Work only from a task file under `docs/work-items/` with a task ID, base
  commit, scope, allowed paths, acceptance criteria, and validation commands.
- Use an isolated branch and worktree for any write task. The primary worktree
  and `main` belong to the coordinator.
- Stay inside the assigned scope. Stop and report `needs_decision` when a public
  contract, dependency, security policy, or product decision must change beyond
  the assignment.
- Do not modify coordinator-only files, merge into `main`, rebase shared
  branches, force-push, tag, publish, or perform release actions.
- Update only the worker-owned handoff section of the assigned work-item file.
- Commit implementation, tests, permitted documentation, and the handoff record
  to the task branch. Uncommitted changes are not handoff output.
- Report task status as `ready_for_review`, `blocked`, or `needs_decision`.
  These states do not mean the milestone is complete.
- Include exact validation commands and results, known limitations, deviations,
  and decision requests in the handoff.

## Shared-worktree sub-agents

Sub-agents in the same Codex task may share one filesystem and Git checkout.
They may run read-only analysis in parallel. Parallel writes require explicitly
non-overlapping paths and coordinator approval; otherwise use a separate Codex
task/session with an isolated worktree.

## Review and completion

- The coordinator reviews `base_commit..task_branch_head`, runs appropriate
  validation, and records `accepted`, `changes_requested`, or `rejected`.
- Only the coordinator updates Roadmap progress after all milestone exit
  criteria pass.
- Only the coordinator removes task worktrees or branches after integration or
  explicit abandonment.

## Communication and writing

- Do not use ignored files such as `MEMORY.md`, `reports/`, `artifacts/`, or
  `.codex/config.toml` as the only cross-session handoff record.
- Preserve unrelated user changes and keep commits scoped.
- Avoid excessive “不是……而是……” constructions and excessive analogies.
- At the end of every task, report what was completed and where it was changed.

The detailed workflow and templates are in
`docs/CONTRIBUTING_WORKFLOW.md` and `docs/work-items/`.
