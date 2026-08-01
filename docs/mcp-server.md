# MCP server

`conductor mcp-server` is the core of this project: a local MCP server
that gives Claude Code (or any MCP client) on-demand access to your team's
declared knowledge ([knowledge-graph-source.md](knowledge-graph-source.md))
and guarded read/write access to Jira, so you can plan and orchestrate BAU
work and improvements conversationally instead of hand-editing tickets.

This doc is the tool reference and the guardrail policy. For what actually
happens when it runs, see
[how-it-works.md](how-it-works.md#conductor-mcp-server).

## Connecting Claude Code to it

Add to your project's `.mcp.json` (or global MCP config):

```json
{
  "mcpServers": {
    "conductor": {
      "command": "conductor",
      "args": ["mcp-server"],
      "env": {
        "JIRA_EMAIL": "you@example.com",
        "JIRA_API_TOKEN": "${JIRA_API_TOKEN}"
      }
    }
  }
}
```

Transport is **stdio** — Claude Code spawns `conductor mcp-server` itself
as a subprocess and talks to it over stdin/stdout. There's no port, no
networking, nothing to expose. The process lives exactly as long as the
MCP connection is open; when Claude Code disconnects, it exits. See
[how-it-works.md](how-it-works.md#the-mental-model-a-cli-not-a-service) —
this doesn't change the "no daemon" principle, it's still just a
subprocess of whatever's using it.

Once connected, tools are available on demand — Claude calls them when a
question actually needs them, not proactively on every message. See the
[earlier discussion in this doc's history](how-it-works.md) for that
distinction if you're unsure how much context this actually consumes.

## Tool reference

### Knowledge (read-only, no guardrails needed — nothing here can change state)

| Tool | Input | Returns |
|---|---|---|
| `kg_list_teams` | — | `{id, displayName}[]` for every team in `.conductor/kg-source/` |
| `kg_get_team` | `teamId` | The full resolved team: principles (org/team/user), `ways_of_working`, repos, AWS accounts, MCP servers |
| `kg_search_principles` | `query` | Every principle (any level) whose id or statement matches, tagged with which level it came from |

### Jira — read

| Tool | Input | Returns |
|---|---|---|
| `jira_search` | `projectKey`, `jql?` | Issues matching `project = <projectKey> AND (<jql>)` — rejected if `projectKey` isn't declared in any team's `jira_projects` |
| `jira_get_issue` | `issueKey` | A single issue — same project-scope check, derived from the key's prefix |

### Jira — write (propose, then confirm)

Every write is **two calls**, never one:

1. A `jira_propose_*` tool validates the request and returns a `token` +
   human-readable `preview` — **nothing has happened yet**.
2. `jira_confirm_write` with that `token` actually performs it.

| Tool | Input | Proposes |
|---|---|---|
| `jira_propose_comment` | `issueKey`, `body` | Adding a comment |
| `jira_propose_status_change` | `issueKey`, `status` | Replacing the `status/*` label (one of `draft/triaged/ready/in-progress/review/blocked/done`) |
| `jira_propose_create_issue` | `projectKey`, `issueType`, `summary`, `description?`, `labels?` | Creating a new issue |
| `jira_confirm_write` | `token` | Executes whatever was proposed |

This isn't a CLI-level confirmation prompt — the *point* is that the two
calls happen inside one Claude Code conversation. You see the proposal
(and any warning) in the chat, and either ask Claude to confirm it or
don't. The separation exists so a write is never a single, un-previewable
tool call.

## The generated schema

`npm run build:schema` produces `dist/conductor-schema.json` — every tool
above as JSON Schema, generated from `src/types/mcp-schema.ts` so it can't
drift from the types. Claude Code doesn't need it (MCP discovers tools at
runtime), but programmatic clients like
[chess-board](https://github.com/chessser/chess-board) do, to validate
inputs and generate typed calls before making one. See
[schema-contract.md](schema-contract.md) for what it guarantees and how it's
versioned.

## Guardrails

These are enforced in `src/mcp/write-guard.ts`, not left to tool
descriptions or prompt instructions — a client can't bypass them just by
phrasing a request differently.

- **Project scoping.** Every read and write tool checks the target
  project key against the union of every team's declared
  `jira_projects[].projectKey` in `.conductor/kg-source/`
  (`allowedProjectKeys`, `src/lib/kg-query.ts`). A project no team has
  declared is refused outright — this is what "scoped to projects" means
  in practice: it's not a suggestion, it's a hard check before any API
  call is made.
- **No delete, anywhere.** There is no `jira_delete_*` tool, and
  `JiraClient` (`src/lib/providers/jira.ts`) has no delete method at all —
  not gated, not proposed, simply absent. If deleting an issue is ever
  needed, do it in Jira directly.
- **Assignee-mismatch warning, never a silent override.** Every proposed
  write on an existing issue checks its current assignee against the
  identity running the server (`JIRA_EMAIL`). A mismatch is surfaced as
  `assigneeWarning` on the proposal — visible in the chat before you'd
  confirm it — never silently skipped or silently allowed.
- **Tokens are single-use and expire.** `WriteGuard.consume` removes a
  proposal on first use and rejects it once past its TTL (10 minutes by
  default) — a stale or already-executed proposal can't be replayed.
- **No status value outside the known set.** `jira_propose_status_change`
  validates against the same `TaskStatus` enum the rest of this project
  uses (`src/types/task.ts`), not an arbitrary string.

None of this replaces human judgment — it constrains *what's possible*
through this server, not what's *wise*. A human still reads the proposal
before asking Claude to confirm it.

## What's not here yet

- **Background dispatch tools** (`task_search_ready`,
  `task_record_dispatch`, `task_list_dispatched`, `task_record_complete`)
  — design written, not implemented. See
  [background-dispatch.md](background-dispatch.md). These don't add a new
  category of Jira write; `task_record_dispatch`/`task_record_complete`
  write only to a local `.conductor/dispatched.json`, so they skip the
  propose/confirm flow deliberately (that mechanism guards remote/shared
  risk, which local state doesn't carry) — any Jira status transition
  still chains into the existing `jira_propose_status_change` tool.
- **GitLab/GitHub MR tools.** `ScmClient` (`src/lib/providers/scm.ts`) is
  still just an interface — no implementation, no MCP tools for it yet.
  "Interact with MRs" (checking status, commenting) is the natural next
  addition, following the same read-then-propose-then-confirm shape as
  the Jira tools above.
- **The knowledge graph DB itself.** These tools query `.conductor/kg-source/`
  directly, in memory, on every call — there's no persistent graph store
  yet (see [knowledge-graph.md](knowledge-graph.md)). That's fine at
  today's scale (a handful of teams, small YAML files); if the declared
  layer grows large enough that reparsing on every tool call becomes
  slow, that's the trigger to actually build the graph store, not before.
