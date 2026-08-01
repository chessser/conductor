# Task types

Repeatable tasks and ordered tasks are modeled as **structurally different
Jira issue types** (`Conductor Task` vs. `Conductor Ordered Task` — see
[jira-structure.md](jira-structure.md)), not as one issue type with a flag.
This still matters even without a bespoke dispatcher
([build-order.md](build-order.md)'s "explicitly abandoned" section) — it's
what `src/lib/dag.ts`'s dependency resolution and `conductor ready`'s
readiness listing branch on, and what a Claude Code conversation reasons
about when planning an ordered piece of work through
[mcp-server.md](mcp-server.md)'s Jira tools.

## Repeatable, repo-agnostic tasks

A `Conductor Task` backed by a **template**: a named, versioned prompt plus a
required-parameter schema (e.g. "bump dependency X", "add a standard
health-check endpoint", "rotate a secret reference"). Templates live in
`templates/` in this repo, not per-user, so the same template run against
different repos produces consistent results. The Jira form's `template`
field is a dropdown sourced from this directory. See
[templates/README.md](../templates/README.md).

## Ordered, multi-repo tasks

A `Conductor Ordered Task` epic with `Conductor Task` sub-tasks linked by
native Jira issue links (`Blocks`/`Blocked by`):

1. The DAG resolves from those links via pure logic — `src/lib/dag.ts`
   (`findCycle`, `dispatchableTasks`, `layerOrder`), unit tested
   exhaustively.
2. `conductor ready` previews the currently-dispatchable set (every
   sub-task whose predecessors are all `status/done`); `layerOrder()` can
   preview the full execution order for an ordered task before anything's
   touched.
3. Actually moving work forward — flipping status, commenting, creating
   the next sub-task — happens through Claude Code calling the guarded
   Jira tools in [mcp-server.md](mcp-server.md), not an automated poll
   loop. There's no `conductor mr-poll` re-evaluating the DAG on its own;
   a human, working with Claude, decides when a layer is actually
   unblocked and acts on it.
