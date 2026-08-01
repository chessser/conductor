# Background dispatch

This is the design for the "hand a scoped task off to a background Claude
Code session" addition flagged as deliberate future work in
[build-order.md](build-order.md) #5 and [architecture.md](architecture.md)
principle 5. It's the resolution of a question raised while comparing this
project to its sibling `orchestration-platform`: does Conductor need its
own orchestrator/dispatcher process? **No.** This doc explains what it
needs instead, and why that's a smaller, different thing.

## The question this answers

`orchestration-platform` hand-built a dispatcher: `orca-dispatch.js` polls
a task index, creates an isolated worktree, and launches an agent CLI in
it, tracked in a central `tasks.yml`. Conductor's `pair`/`run`/`mr-poll`
CLI commands attempted the same shape early on and were deliberately
removed (build-order.md's "explicitly abandoned" section) once it was
clear Claude Code already provides the conversational/session layer such a
dispatcher would have to reimplement.

That earlier removal was correct, but it left one real gap: Claude Code
itself now has native background-agent and worktree-isolation primitives
(spawn an isolated agent, optionally in the background), which is
*exactly* what a hand-built dispatcher exists to provide. So the missing
piece was never "an orchestrator" — Claude Code already is one. What was
missing is narrower: **a way for a background Claude Code session to be
handed a specific Jira issue with full context, and a durable record of
what's currently running, since that can't live in Jira and Claude Code's
own task tracking doesn't survive past the session that created it.**

## What's explicitly *not* being built

- **No daemon.** Every process in this repo is a subprocess of whatever's
  using it ([architecture.md](architecture.md), [how-it-works.md](how-it-works.md#the-mental-model-a-cli-not-a-service)).
  This doesn't change that. `conductor mcp-server` still only runs for as
  long as an MCP client has it open.
- **No dispatcher loop.** Nothing in Conductor polls Jira and decides on
  its own to start work. Dispatch is always initiated inside a live
  Claude Code conversation (interactively) or a scheduled Claude Code
  invocation (unattended, e.g. via cron) — never a bespoke coordinator
  process watching a queue.
- **No new write-guard surface.** The new tools below don't touch Jira
  directly except by chaining into the *existing* guarded
  `jira_propose_status_change`/`jira_confirm_write` pair. They add no new
  way to write to Jira, and no delete tool, ever
  ([human-in-the-loop.md](human-in-the-loop.md)).

## What is being built

### New MCP tools

| Tool | Kind | Input | Does |
|---|---|---|---|
| `task_search_ready` | read-only | — | Wraps `jira_search`, filtered to `status/ready`, scoped to `allowedProjectKeys` (same scoping as every other read tool) |
| `task_record_dispatch` | local write, no propose/confirm | `issueKey`, `worktreePath`, `branch` | Appends an entry to `.conductor/dispatched.json`. Called *after* Claude Code has already started the background agent itself — this tool only ever records that fact, it doesn't start anything |
| `task_list_dispatched` | read-only | — | Lists current entries; cross-checks each `issueKey`'s live Jira status against what's recorded and flags drift (e.g. the ticket was closed manually while an agent was still running) |
| `task_record_complete` | local write + optional chained Jira write | `issueKey`, `status` (`done`/`failed`/`abandoned`), `note?` | Updates the local entry, and if `status` implies a Jira transition, walks the caller through the *existing* `jira_propose_status_change` → `jira_confirm_write` pair rather than writing directly |

`task_record_dispatch` and `task_record_complete` don't use the
propose/confirm token flow from `src/mcp/write-guard.ts` — that mechanism
exists because a Jira write is remote, shared, and hard to undo without
going back to Jira. A `.conductor/dispatched.json` entry is local,
single-user, and trivially reversible (edit or delete the file). Applying
propose/confirm here would be guarding a risk that doesn't exist, not
extending the invariant — the same "don't optimize a gate away" logic in
human-in-the-loop.md cuts the other way once the thing being written isn't
remote/shared/hard-to-undo.

### State file: `.conductor/dispatched.json`

Gitignored, derived, rebuildable — same category as everything else under
`.conductor/` (`.conductor/tasks.json`, `.conductor/kg-source/`). If it's
deleted, nothing is lost except the ability to list what's currently
running; Jira remains the source of truth for the work itself.

```json
{
  "entries": [
    {
      "issueKey": "PAY-123",
      "worktreePath": "/abs/path/to/worktree",
      "branch": "conductor/pay-123",
      "startedAt": "2026-08-01T09:14:00Z",
      "status": "in-progress",
      "note": null
    }
  ]
}
```

Per [architecture.md](architecture.md) principle 4, this file's *content*
is whatever's running on your machine, under your account — it is never
synced or shared, same as `kg-source` and `.conductor/tasks.json`.

### The `dispatch-ready` skill

The orchestration logic — "list ready tickets, let the user pick one,
start a background agent in an isolated worktree, record it" — lives as a
Claude Code skill (`.claude/skills/dispatch-ready/`), not as code in the
MCP server. The skill:

1. Calls `task_search_ready`.
2. Presents candidates to the user; the user picks one (or several).
3. For each, calls Claude Code's own background-agent primitive with
   worktree isolation — Conductor does not do this itself, it has no
   mechanism to spawn or supervise a process.
4. Calls `task_record_dispatch` with the resulting worktree path.

This is deliberately the *only* named workflow mode being added right
now. `orchestration-platform`'s `design`/`pair` modes are mostly "have a
normal conversation with Claude Code with the right tools available,"
which already works without a skill; `dispatch-ready` is the one mode that
has a genuinely fixed procedure worth encoding once rather than re-typing
per conversation.

## Guardrail summary (extends [human-in-the-loop.md](human-in-the-loop.md))

This doc adds one gate to the existing list, sitting alongside it:

6. **Starting background work always happens inside a live or scheduled
   Claude Code session, never a standalone Conductor process.**
   `task_record_dispatch` only records that a session was started by
   Claude Code — it cannot itself start one. If a future change proposes
   giving Conductor the ability to spawn or supervise agent processes
   directly, that's the same category of decision as the abandoned
   `pair`/`run`/`mr-poll` commands and should be stopped and reconsidered,
   not treated as a natural extension of this doc.

## Unattended dispatch (if ever needed)

If dispatch needs to run with nobody at the keyboard, the shape is a
**scheduled subprocess** — a cron entry (or this environment's own
scheduling primitive) invoking Claude Code non-interactively with the
`dispatch-ready` skill, on a timer. This is still "every process is a
subprocess of whatever's using it," just triggered by a clock instead of a
person; it is not a new daemon and does not change any of the guardrails
above. Not built yet — noted here so the next person who wants unattended
dispatch designs it as a scheduled Claude Code invocation, not a revival
of `orca-dispatch.js`'s poll loop.
