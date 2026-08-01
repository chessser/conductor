# Jira structure

## Issue types

| Issue type | Purpose | Key fields |
|---|---|---|
| `Forge Request` | The intake form issue — what a human files. | Free-text description, target repo(s), urgency, requester |
| `Forge Task` | A single repeatable, repo-agnostic unit of work — one repo, one agent run. | `repo` (single), `template`, `parameters`, labels below |
| `Forge Ordered Task` (epic-level) | A DAG of `Forge Task` sub-tasks spanning multiple repos, executed in dependency order. | `depends_on` via native Jira issue links (`Blocks`/`Blocked by`) |

A `Forge Request` is triage input. On grooming (`forge triage`) it's
converted into either a single `Forge Task` or decomposed into a
`Forge Ordered Task` plus sub-tasks. This conversion can be
agent-*assisted* but always ends with a human confirming the decomposition
before anything is written back to Jira — never auto-created and
auto-marked ready in one step. See [task-types.md](task-types.md).

## The intake form

Built with Jira's native form/request-type mechanism (Jira Service
Management request forms, or a plain "Create Issue" screen scheme if JSM
isn't available) — not a bespoke external form, so it stays inside Jira's
own permission model and audit trail.

Fields, split by who fills them in:

- **User-provided** (requester): title, description/problem statement,
  target repo(s) (dropdown, sourced from the repo registry — see
  [repo-registry.md](repo-registry.md)), urgency/priority.
- **Team-provided variables** (a required second step before an issue can
  be marked ready, e.g. via a "Needs Triage" status/assignee): environment
  or config values, which template applies (for a `Forge Task`), acceptance
  criteria, whether this needs a design HITL gate.
- **System-derived** (written by `forge`, never hand-edited): knowledge-
  graph links to related past issues/PRs, suggested `agent-type`/`mode`
  labels, a rough cost-estimate band.

## Labels/flags (the dispatch gate)

- `agent-type/<claude>` — which agent profile to use.
- `mode/<background|foreground>` — autonomous unattended run vs. live
  human-paired session.
- `status/<draft|triaged|ready|in-progress|review|blocked|done>` — issue
  lifecycle, mirrored into the local task index on every `forge sync`.
- `hitl-gate/<none|design|mr-approval>` — whether this task requires a
  human checkpoint *before* dispatch, in addition to the standing
  MR-approval gate every task has at the end.

**Dispatch rule** (implemented in `isDispatchable`, `src/types/task.ts`):
an issue is dispatchable only when `status/ready` AND both `agent-type/*`
and `mode/*` are present AND — for `Forge Ordered Task` sub-tasks — every
`depends_on` predecessor is `status/done`.

Setting `agent-type`/`mode` early is fine and doesn't imply readiness —
`status/ready` is always a separate, deliberate act. See
[human-in-the-loop.md](human-in-the-loop.md).
