# <TASK-ID> — <Title>

## Assignment — coordinator owned

- Status: `assigned`
- Milestone:
- Base commit:
- Branch: `work/<task-id>`
- Worktree:
- Push task branch: `no`
- Objective:
- Dependencies:

### In scope

- `<describe included work>`

### Out of scope

- `<describe excluded work>`

### Allowed paths

- `<path or glob>`

### Coordinator-only paths

- `docs/ROADMAP.md`
- `docs/PROJECT_DECISIONS.md`
- `AGENTS.md`
- `docs/CONTRIBUTING_WORKFLOW.md`
- `docs/work-items/README.md`
- `docs/work-items/TEMPLATE.md`
- package version, release, tag, and publishing metadata

### Acceptance criteria

- [ ] `<observable completion criterion>`

### Required validation

```text
<exact command>
```

### Escalate when

- a public contract or Schema must change outside the assignment;
- a dependency, credential, or new permission is required;
- a product/security decision is needed;
- implementation would touch a coordinator-only path;
- task scope must materially expand.

## Worker handoff — worker owned

- Status: `in_progress | blocked | needs_decision | ready_for_review`
- Handoff branch:
- Implementation commits:

### Implementation summary

- `<what was implemented>`

### Changed areas

- `<path or component and reason>`

### Validation

| Command | Result | Notes |
|---|---|---|
|  |  |  |

### Public contract and documentation impact

- `<impact, or None>`

### Deviations from assignment

- None.

### Known limitations and risks

- None.

### Decisions or questions for coordinator

- None.

### Protected-file confirmation

- [ ] Coordinator-only files were not modified.
- [ ] No version, tag, publish, or release action was performed.
- [ ] All intended handoff changes are committed to the task branch.

## Coordinator review — coordinator owned

- Outcome: `pending | accepted | changes_requested | rejected`
- Reviewed branch head:
- Integration commit:

### Review findings

- `<finding, or None>`

### Required follow-up

- `<follow-up, or None>`

### Roadmap and release impact

- `<coordinator assessment>`
