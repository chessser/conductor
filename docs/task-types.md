# Task types

Repeatable tasks and ordered tasks are modeled as **structurally different
Jira issue types** (`Conductor Task` vs. `Conductor Ordered Task` — see
[jira-structure.md](jira-structure.md)), not as one issue type with a flag,
so the dispatcher's logic branches cleanly instead of accreting
conditionals.

## Repeatable, repo-agnostic tasks

A `Conductor Task` backed by a **template**: a named, versioned prompt plus a
required-parameter schema (e.g. "bump dependency X", "add a standard
health-check endpoint", "rotate a secret reference"). Templates live in
`templates/` in this repo, not per-user, so the same template run against
different repos produces consistent results. The Jira form's `template`
field is a dropdown sourced from this directory. See
[templates/README.md](../templates/README.md).

## Ordered, multi-repo tasks

A `Conductor Ordered Task` epic with `Conductor Task` sub-tasks linked by native
Jira issue links (`Blocks`/`Blocked by`). The dispatcher:

1. Resolves the DAG from those links on each `conductor sync` — pure logic,
   see `src/lib/dag.ts` (`findCycle`, `dispatchableTasks`, `layerOrder`),
   unit tested exhaustively.
2. Dispatches any sub-task whose predecessors are all `status/done`,
   respecting the concurrency/cost caps in
   [cost-and-concurrency.md](cost-and-concurrency.md).
3. On a sub-task's MR merging, `conductor mr-poll` re-evaluates the DAG to
   unblock the next layer — poll, flip status, check what's now unblocked.

`conductor ready` previews the current dispatchable set; for an ordered task,
`layerOrder()` can preview the full execution order before anything is
dispatched.
