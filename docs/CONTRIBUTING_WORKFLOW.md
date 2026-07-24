# Coordinator and Worker Workflow

## Purpose

This repository uses one long-lived primary session for coordination, review,
Roadmap ownership, and releases. Bounded implementation tasks are delegated to
worker sessions or sub-agents so implementation context does not accumulate in
the release/review session.

The workflow uses tracked work-item records plus Git branches and commits as the
cross-session protocol. A worker reporting `ready_for_review` means that its
assigned task is ready for coordinator review. It does not mean that a
milestone, release, or Roadmap exit gate is complete.

## Roles and authority

| Action | Coordinator | Implementation worker |
|---|---:|---:|
| Split and assign tasks | Yes | No |
| Define acceptance criteria and dependencies | Yes | Propose changes only |
| Modify task-scoped code, tests, fixtures, and usage docs | As needed | Yes, within assigned paths |
| Modify Roadmap, global backlog, or milestone status | Yes | No |
| Record accepted project decisions | Yes | Propose in handoff |
| Accept/reject work | Yes | No |
| Merge/cherry-pick into `main` | Yes | No |
| Change versions, tag, publish, or make release claims | Yes | No |

The coordinator may reserve shared integration files for itself, including
public export barrels, MCP tool registration, package metadata, and global
documentation. A worker may change them only when the assignment explicitly
lists the paths. `docs/ROADMAP.md` and `docs/PROJECT_DECISIONS.md` remain
coordinator-only in all cases.

## Choosing a delegation mechanism

### New task/session with an isolated worktree

Use this for normal implementation work. Each writable worker receives a
dedicated branch and worktree. The primary worktree stays on `main`.

Recommended external worktree layout on Windows:

```text
D:\projects\change-trace-worktrees\<task-id>
```

Recommended branch name:

```text
work/<task-id>
```

### Sub-agent inside the current task

Use this for read-only research, code review, test-log analysis, or clearly
non-overlapping changes. Codex sub-agents in one task can share the same
filesystem and checkout, so concurrent writes to shared files, the index, or
the active branch are unsafe.

If isolation is unavailable, allow only one writer at a time.

## Task lifecycle

### 1. Coordinator creates the assignment

Copy `docs/work-items/TEMPLATE.md` to:

```text
docs/work-items/<task-id>.md
```

Use IDs such as `M3-001-write-report`. Fill the coordinator-owned Assignment
section, including:

- an exact base commit;
- branch and worktree names;
- objective and bounded scope;
- allowed and coordinator-only paths;
- acceptance criteria and required validation;
- dependencies and escalation conditions;
- whether pushing the task branch is authorized.

For parallel tasks, create all assignment records in one coordination commit so
workers can share a known base without modifying one another's task files.

### 2. Coordinator dispatches the worker

The worker prompt must name:

- the task ID and work-item path;
- the implementation-worker role;
- the branch/worktree;
- the base commit;
- prohibited governance/release actions;
- the required handoff status.

The worker must read `AGENTS.md`, this workflow, and its task file before making
changes.

### 3. Worker implements in isolation

The worker:

1. confirms the branch and base commit;
2. modifies only assigned paths;
3. keeps commits coherent and scoped;
4. runs the required validation plus relevant additional checks;
5. records deviations, risks, and decision requests;
6. updates only the Worker handoff section;
7. commits the handoff record and leaves the task worktree clean.

Workers must stop at `needs_decision` when proceeding would require:

- an unassigned public API or Schema change;
- a new dependency or credential;
- a product/security decision;
- editing a coordinator-only file;
- materially expanding the task.

### 4. Worker hands off through Git

The durable handoff consists of:

- the tracked work-item report;
- the task branch;
- the base commit in the assignment;
- implementation commits listed in the report;
- validation results and known limitations.

The task file does not hardcode its own final branch-head commit because that
would be self-referential. The coordinator resolves the current head directly
from the named Git branch and reviews:

```text
<base_commit>..<task_branch_head>
```

Ignored local files, terminal history, and chat commentary may supplement the
handoff but cannot replace the tracked report and commits.

### 5. Coordinator reviews

The coordinator checks:

- the branch derives from the assigned base;
- changes stay within scope and protected files are untouched;
- implementation and tests satisfy every acceptance criterion;
- public contracts, security, error behavior, and documentation are coherent;
- validation commands pass from the coordinator environment;
- the work-item report discloses failures, omissions, and decisions;
- commits contain no secrets or unrelated changes.

The coordinator records one outcome in the Coordinator review section:

- `accepted`;
- `changes_requested`;
- `rejected`.

`changes_requested` returns the same task to the worker with bounded follow-up
instructions. It does not create a new milestone status.

### 6. Coordinator integrates

After acceptance, the coordinator chooses merge, fast-forward, or cherry-pick,
runs integration gates on `main`, and records the integration commit. Shared
seams or coordinator-only documentation are updated in the primary session.

Task acceptance may advance implementation progress. Roadmap or milestone
status changes only after the coordinator verifies every relevant exit
criterion.

### 7. Coordinator releases

Only the coordinator may:

- bump versions;
- update release notes and compatibility evidence;
- create Git tags or GitHub releases;
- publish npm packages or change dist-tags;
- make public compatibility, beta, milestone, or release-completion claims.

Human approval such as npm WebAuthn remains a release-session interaction.

## Git safety rules

- Keep `main` checked out only in the primary worktree.
- Do not reuse a worker branch for unrelated tasks.
- Do not merge `main` into a task branch unless the coordinator requests it.
- Do not rebase or force-push a branch used for handoff.
- Do not delete task branches/worktrees before coordinator acceptance or
  rejection.
- A worker may push only the assigned task branch and only when the Assignment
  section authorizes it.
- The coordinator resolves integration conflicts and owns branch cleanup.

## Parallel-task design

Parallel tasks should have non-overlapping primary ownership. Common conflict
hotspots include:

- `src/server.ts`;
- public `index.ts` export barrels;
- shared schemas;
- `package.json` and `package-lock.json`;
- README status text;
- shared fixtures and workflow files.

When two tasks need the same integration seam, workers should implement
isolated modules and describe the required wiring in their reports. The
coordinator performs the shared wiring during integration.

## Decision protocol

A worker records a decision request with:

- the blocking question;
- facts already verified;
- two or more options when available;
- its recommendation and tradeoffs;
- the files or contracts affected.

The coordinator discusses material product decisions with the user and records
accepted decisions. Workers do not edit `docs/PROJECT_DECISIONS.md`.

## Status vocabulary

| Status | Owner | Meaning |
|---|---|---|
| `assigned` | Coordinator | Task is defined but not started |
| `in_progress` | Worker | Task implementation is active |
| `blocked` | Worker | External state prevents progress |
| `needs_decision` | Worker | Coordinator/user decision is required |
| `ready_for_review` | Worker | Worker believes assignment criteria are met |
| `changes_requested` | Coordinator | Handoff needs bounded revisions |
| `accepted` | Coordinator | Task passed coordinator review |
| `rejected` | Coordinator | Handoff will not be integrated |
| `milestone_complete` | Coordinator only | All Roadmap exit criteria passed |

## Review cadence

The primary session should remain compact by loading worker reports and Git
diffs, not full worker chat histories. It should retain only release evidence,
accepted decisions, integration findings, and current Roadmap state.
