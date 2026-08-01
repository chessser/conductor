# Architecture

This doc covers the system's shape and principles. For a step-by-step walk
through what actually happens when you run each command, where credentials
live, and how Claude Code connects, see [how-it-works.md](how-it-works.md).
For the MCP tool reference itself, see [mcp-server.md](mcp-server.md).

## What this is

Conductor is a **local MCP server** that gives Claude Code on-demand
access to (a) your team's declared knowledge — principles, ways of
working, repos, AWS accounts, infra — from
[knowledge-graph-source.md](knowledge-graph-source.md), and (b) guarded
read/write access to Jira, so BAU work, scaling ideas, and improvements
can be planned and orchestrated conversationally instead of by hand-editing
tickets. It is not a task dispatcher and does not run agents on its own —
that's Claude Code's job; Conductor's job is making sure Claude has
accurate, current, scoped context and a safe way to act on Jira when you
ask it to.

## System overview

Every process below is a subprocess of whatever's using it — there is no
daemon and nothing syncs on its own. See
[how-it-works.md](how-it-works.md#the-mental-model-a-cli-not-a-service).

```
.conductor/kg-source/               .conductor/config.yml
  root.yml                          (single-team repo registry,
  teams/<id>.yml                     conductor sync / conductor ready)
       │  org/team/user                    │
       │  principles, repos,                │
       │  AWS, MCP servers,                 ▼
       │  ways_of_working            .conductor/tasks.json
       ▼                             (derived, rebuildable)
┌─────────────────────────────────────────────────────┐
│  conductor mcp-server (stdio subprocess)              │
│  - kg_list_teams / kg_get_team / kg_search_principles │
│  - jira_search / jira_get_issue                       │
│  - jira_propose_* -> token -> jira_confirm_write       │
│  guarded by src/mcp/write-guard.ts:                    │
│  project-scoped, no delete, assignee-mismatch warned,   │
│  single-use expiring tokens                             │
└───────────────────────┬───────────────────────────────┘
                         │  stdio
                         ▼
                  Claude Code session
             (you, talking to Claude, which
              calls tools on demand — not
              proactively loaded every turn)
```

## Core principles

1. **The knowledge-graph source is the declared source of truth for team
   structure; Jira is the source of truth for work state.** Neither is
   cached into a database Conductor owns — `kg-source` is read fresh on
   each MCP tool call (see [mcp-server.md](mcp-server.md#whats-not-here-yet)
   for when that might change), and Jira is queried live, never polled in
   the background.

2. **Every Jira write is guarded, never silent.** Project-scoped to what a
   team has declared, no delete operation exists anywhere in this
   codebase, assignee mismatches are surfaced not overridden, and every
   write is a propose-then-confirm pair with a single-use expiring token —
   see [mcp-server.md](mcp-server.md#guardrails) and
   [human-in-the-loop.md](human-in-the-loop.md).

3. **Repeatable tasks vs. ordered tasks are structurally different
   objects, not the same object with different data.** See
   [task-types.md](task-types.md) — this distinction still matters for
   how Jira issues are structured, independent of how work actually gets
   dispatched.

4. **Derived local state is reproducible and access-scoped, not shared.**
   `kg-source`'s *generation/resolution logic* (`src/lib/kg-source.ts`) is
   identical for everyone; its *content* is whatever your own
   `.conductor/kg-source/` declares and whatever your Jira token can
   actually see. See [knowledge-graph-source.md](knowledge-graph-source.md).

5. **Orchestration happens through Claude Code, not a bespoke dispatcher.**
   Earlier iterations of this project explored running agents directly
   (a `pair`/`run`/`mr-poll` CLI flow via the Claude Agent SDK). That was
   replaced by exposing the same underlying capabilities (Jira read/write,
   team context) as MCP tools — Claude Code already provides session
   continuity, conversational planning, and tool-calling; duplicating that
   in a custom chatbot/daemon wasn't worth building. See the design
   discussion that led here for the full tradeoff analysis.

6. **Coverage is deliberately split, not uniform.** Pure logic
   (`src/lib/dag.ts`, `src/lib/config.ts`, `src/lib/kg-source.ts`,
   `src/lib/kg-query.ts`, `src/mcp/write-guard.ts`) is unit tested
   exhaustively. The integration layer (`src/lib/providers/*`,
   `src/mcp/server.ts`'s tool wiring) is validated against real
   sandbox/fake services and a real MCP client-server handshake, not
   mocks — see [testing.md](testing.md) for why, and don't add coverage
   there just to hit a number.

## Module map

| Path | Responsibility |
|---|---|
| `src/cli.ts` | Commander entrypoint, registers every subcommand, loads `.env` before any command runs |
| `src/lib/env.ts` | Minimal `.env` parser/loader — never overwrites an already-set variable |
| `src/commands/*.ts` | One file per CLI verb — thin, delegates to `src/lib/*` and `src/mcp/*` |
| `src/commands/mcp-server.ts` | Wires `conductor mcp-server`: loads `kg-source`, builds a `JiraClient`, starts the stdio MCP server |
| `src/mcp/server.ts` | `buildMcpServer` — registers every MCP tool ([mcp-server.md](mcp-server.md)) |
| `src/mcp/write-guard.ts` | Propose/confirm token store + project-allowlist enforcement for every Jira write |
| `src/lib/kg-query.ts` | Pure queries over a resolved `KnowledgeGraphSource`: list/get teams, search principles, allowed project keys |
| `src/lib/config.ts` | Loads and validates `.conductor/config.yml` (the single-team repo registry, [repo-registry.md](repo-registry.md)) |
| `src/lib/dag.ts` | Pure dependency-graph resolution for ordered tasks |
| `src/lib/providers/jira.ts` | `JiraClient` interface + factory — Jira integration boundary, including guarded `createIssue` |
| `src/lib/providers/scm.ts` | `ScmClient` interface — GitLab/GitHub integration boundary, not implemented yet |
| `src/lib/kg-source-schema.ts` / `src/lib/kg-source.ts` | Zod schema + loader/resolver for `.conductor/kg-source/` ([knowledge-graph-source.md](knowledge-graph-source.md)) |
| `src/lib/kg-validate.ts` | Checks declared MCP-server env vars and binaries against the current machine (`conductor kg validate`) |
| `src/types/*.ts` | Shared types: `ConductorTask`, `RepoConfig`, `KnowledgeGraphSource`, label/status enums |
| `templates/*` | Repeatable-task prompt + parameter-schema definitions |
