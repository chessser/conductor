# Jira structure

## Issue types

| Issue type | Purpose | Key fields |
|---|---|---|
| `Conductor Request` | The intake form issue — what a human files. | Free-text description, target repo(s), urgency, requester |
| `Conductor Task` | A single repeatable, repo-agnostic unit of work — one repo, one agent run. | `repo` (single), `template`, `parameters`, labels below |
| `Conductor Ordered Task` (epic-level) | A DAG of `Conductor Task` sub-tasks spanning multiple repos, executed in dependency order. | `depends_on` via native Jira issue links (`Blocks`/`Blocked by`) |

A `Conductor Request` is triage input. On grooming it's converted into
either a single `Conductor Task` or decomposed into a `Conductor Ordered
Task` plus sub-tasks — today that's a conversation with Claude Code using
the MCP server's Jira tools ([mcp-server.md](mcp-server.md)), which can
propose the decomposition but always requires a separate `jira_confirm_write`
before anything is actually created — never auto-created and
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
  or config values, which template applies (for a `Conductor Task`), acceptance
  criteria, whether this needs a design HITL gate.
- **System-derived** (written by `conductor`, never hand-edited): knowledge-
  graph links to related past issues/PRs, suggested `agent-type`/`mode`
  labels, a rough cost-estimate band.

## Labels/flags (the readiness gate)

- `agent-type/<claude>` / `mode/<background|foreground>` — historical from
  an earlier CLI-dispatcher design ([build-order.md](build-order.md)'s
  "explicitly abandoned" section); kept because `isDispatchable` still
  uses them as a readiness signal, but nothing currently automates on
  them — they're informational for whoever (human or Claude, via chat)
  decides to act on a "ready" issue.
- `status/<draft|triaged|ready|in-progress|review|blocked|done>` — issue
  lifecycle, mirrored into the local task index on every `conductor sync`,
  and the only status value `jira_propose_status_change`
  ([mcp-server.md](mcp-server.md)) will accept.
- `hitl-gate/<none|design|mr-approval>` — whether this task requires a
  human checkpoint before being acted on, in addition to the propose-then-confirm
  gate every MCP write already has.

**Readiness rule** (implemented in `isDispatchable`, `src/types/task.ts`,
used by `conductor ready`): an issue is "ready" only when `status/ready`
AND both `agent-type/*` and `mode/*` are present AND — for `Conductor
Ordered Task` sub-tasks — every `depends_on` predecessor is `status/done`.

Setting `agent-type`/`mode` early is fine and doesn't imply readiness —
`status/ready` is always a separate, deliberate act. See
[human-in-the-loop.md](human-in-the-loop.md).
