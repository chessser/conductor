# Suggested build order

This is the intended implementation sequence — each step should be usable
and mergeable on its own before the next one starts.

## Done

1. **`.conductor/kg-source/` schema + loader.** `root.yml` + `teams/<id>.yml`,
   org → team → user principle inheritance, additive shared resources. See
   [knowledge-graph-source.md](knowledge-graph-source.md). Pure logic,
   fully unit tested (`src/lib/kg-source.ts`, `src/lib/kg-query.ts`).

2. **Jira read/write client**, including `createIssue` (no delete). REST
   client against Jira Cloud API v3, verified against an in-repo fake
   server ([testing.md](testing.md)). `src/lib/providers/jira.ts`,
   `src/lib/providers/jira-mapping.ts`.

3. **`conductor mcp-server`** — the local MCP server itself
   ([mcp-server.md](mcp-server.md)): knowledge tools (`kg_list_teams`,
   `kg_get_team`, `kg_search_principles`), Jira read tools (`jira_search`,
   `jira_get_issue`), and guarded Jira write tools
   (`jira_propose_comment`/`jira_propose_status_change`/`jira_propose_create_issue`
   + `jira_confirm_write`), enforced by `src/mcp/write-guard.ts`
   (project-scoped, no delete, assignee-mismatch warnings, single-use
   expiring tokens). Verified with a real MCP client-server handshake over
   stdio, not just unit tests of the pure pieces.

4. **`.env` auto-loading** (`src/lib/env.ts`) and the single-team
   `.conductor/config.yml` repo registry (`conductor sync`/`conductor ready`)
   — predates the MCP pivot, still used for the local task index.

## Not done yet

5. **Background dispatch tools** (`task_search_ready`,
   `task_record_dispatch`, `task_list_dispatched`, `task_record_complete`)
   and the `dispatch-ready` skill. Design is written —
   [background-dispatch.md](background-dispatch.md) — implementation
   isn't. This is the "deliberate new addition on top of the MCP tools
   that already exist" flagged in the "explicitly abandoned" section
   below, now scoped: no daemon, no dispatcher loop, local rebuildable
   state only (`.conductor/dispatched.json`), Claude Code's own
   background-agent/worktree-isolation primitives do the actual
   spawning — Conductor only records what was started.

6. **GitLab/GitHub MR tools.** `ScmClient` (`src/lib/providers/scm.ts`) is
   still an interface only. The natural next addition: `mr_list`,
   `mr_get`, and guarded `mr_propose_comment`/`mr_confirm_write` following
   the exact same shape as the Jira write tools — **never** a merge tool,
   per [human-in-the-loop.md](human-in-the-loop.md).

7. **A real knowledge-graph store**, if `kg-source` ever outgrows
   "reparse the whole directory on every MCP tool call." See
   [knowledge-graph.md](knowledge-graph.md) —
   [Graphiti](https://github.com/getzep/graphiti) is the leading
   candidate (built specifically for low-token, incremental agent
   queries), not a generic graph DB. Don't build this speculatively;
   build it when reparsing actually becomes slow.

8. **Extending `conductor kg validate`** to also validate
   `permissions_needed[]` against live AWS/GitLab/GitHub permissions
   (rather than just documenting intent) would be a deliberate future
   decision, not a default — see
   [knowledge-graph-source.md](knowledge-graph-source.md#validating-permissions-and-mcp-servers).

## Explicitly abandoned, not just deferred

Earlier design work explored a CLI-driven agent dispatcher —
`conductor pair`/`conductor run`/`conductor mr-poll`/`conductor triage`,
built on the Claude Agent SDK against Bedrock, running agents directly in
isolated git worktrees. That direction was replaced by the MCP approach
above: Claude Code already provides the conversational/session-continuity
layer those commands would have had to reimplement, so building a
parallel dispatcher wasn't worth it. Those command files have been
removed from the repo, not left as stubs — if autonomous,
no-human-at-the-keyboard background dispatch is wanted later, design it
as a deliberate new addition on top of the MCP tools that already exist
(likely: an MCP tool that hands a scoped task off to a background Claude
Code session), not a revival of the old command shape. See
[background-dispatch.md](background-dispatch.md) for that design —
written after comparing this project directly against `orchestration-platform`,
a sibling project that *did* build a bespoke dispatcher
(`orca-dispatch.js` + a central `tasks.yml`), to make sure the
conclusion above still held rather than assuming it did.

## What not to build

- Don't put derived state (`.conductor/`) in git — it's a rebuildable cache,
  not a source of truth.
- Don't unit-test the integration layer into a false sense of
  security — mock-heavy tests of Jira/GitLab API calls prove little.
  Validate those with real sandbox runs and real MCP handshakes instead.
- Don't let a Jira write skip the propose-then-confirm shape, no matter
  how tempting for "efficiency" — see [human-in-the-loop.md](human-in-the-loop.md).
- Don't add a delete tool. Ever. If this needs restating in a future PR,
  that's a sign to re-read this doc, not to add one.
