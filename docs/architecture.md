# Architecture

## System overview

```
Jira (source of truth)
   │  forge sync
   ▼
Local task index (.forge/tasks/*.json)   — derived, rebuildable, gitignored
   │
   ├──► Repo registry (.forge/config.yml)
   │
   ▼
Knowledge graph (.forge/kg/*)  ◄── forge kg update
   │  context for
   ▼
Dispatcher (forge ready / forge run / forge pair)
   │  resolves DAG order, checks label gates
   ▼
Claude Agent SDK session (foreground or background), isolated git worktree
   │
   ▼
GitLab/GitHub: branch, commit, open MR/PR
   │
   ▼
forge mr-poll — labels ready-for-review when CI is green, flips Jira status,
                never merges
```

## Core principles

1. **The task tracker is the source of truth; local state is a derived,
   rebuildable cache.** Jira is authoritative for what work exists and its
   status. `.forge/tasks/*.json` is rebuilt from Jira on every `forge sync`
   — never hand-edited, never itself authoritative. Everything under
   `.forge/` is gitignored; if it's ever inconsistent, delete it and
   `forge sync && forge kg update` again.

2. **Human-gated at two points, never fully silent.**
   - Jira issues only become dispatchable once explicitly marked
     `status/ready` with both `agent-type/*` and `mode/*` labels present —
     never inferred from ambiguous state. See [jira-structure.md](jira-structure.md).
   - MRs/PRs are **never auto-merged**. `forge mr-poll`'s job stops at
     labeling something ready for human review. A failing pipeline is a
     stop-and-look situation, not a retry loop. See
     [human-in-the-loop.md](human-in-the-loop.md).

3. **Repeatable tasks vs. ordered tasks are structurally different
   objects, not the same object with different data.** See
   [task-types.md](task-types.md).

4. **Derived local state is reproducible and access-scoped, not shared.**
   The knowledge graph's *generation logic* is documented and identical for
   every user; its *output* is not shared, because it's scoped to whatever
   Jira/GitLab/GitHub permissions the invoking user actually has. See
   [knowledge-graph.md](knowledge-graph.md).

5. **Execution is in-process via the Claude Agent SDK, not a subprocess CLI
   wrapper.** This app owns its own execution path end to end — session
   creation, tool permissions, streaming — talking to Bedrock directly,
   rather than shelling out to and parsing the output of a third-party CLI.

6. **Coverage is deliberately split, not uniform.** Pure logic
   (`src/lib/dag.ts`, `src/lib/config.ts`, `src/types/task.ts`) is unit
   tested exhaustively. The integration layer
   (`src/lib/providers/*`, command implementations once they exist) is
   validated against real sandbox services, not mocks — see the README's
   "Testing philosophy" section for why, and don't add coverage there just
   to hit a number.

## Module map

| Path | Responsibility |
|---|---|
| `src/cli.ts` | Commander entrypoint, registers every subcommand |
| `src/commands/*.ts` | One file per CLI verb — thin, delegates to `src/lib/*` |
| `src/lib/config.ts` | Loads and validates `.forge/config.yml` (the repo registry, §5) |
| `src/lib/dag.ts` | Pure dependency-graph resolution for ordered tasks |
| `src/lib/providers/jira.ts` | `JiraClient` interface + factory — Jira integration boundary |
| `src/lib/providers/scm.ts` | `ScmClient` interface + factory — GitLab/GitHub integration boundary |
| `src/types/*.ts` | Shared types: `ForgeTask`, `RepoConfig`, label/status enums |
| `templates/*` | Repeatable-task prompt + parameter-schema definitions |
