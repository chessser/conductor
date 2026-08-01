# Knowledge graph

## What it is

A local, per-user, deterministically-rebuilt graph stored under
`.conductor/kg/` (gitignored), built by `conductor kg update`. Not synced or shared
between users — the *generation logic* lives in this repo and is identical
for everyone; the *output* is not shared, because it's scoped to whatever
the invoking user's Jira/GitLab/GitHub tokens can actually see. Two
engineers running `conductor kg update` get graphs with the same schema, built
by the same code, but different content.

Storage: an embedded graph-capable store (e.g. [Kuzu](https://kuzudb.com/),
an embedded property-graph DB with a TypeScript client, no server process
required) or, if that proves too heavy, a SQLite schema modeling
nodes/edges explicitly. Either is fine as long as it's embedded, file-based,
and gitignored — no shared infrastructure.

## Schema

Nodes fall into two categories: **live**, pulled from Jira/repo APIs on
every rebuild, and **declared**, read from the knowledge-graph source
config ([knowledge-graph-source.md](knowledge-graph-source.md)) — team
structure, principles, and infrastructure don't come from an API, they're
stated once by the team that owns them.

Live nodes:
- `Repo` — from the repo registry ([repo-registry.md](repo-registry.md)) or a team's `gitlab_repos`/`github_repos`
- `JiraIssue` — synced fields: type, status, labels, description summary
- `File`/`Module` — coarse boundaries (top-level dirs or package
  boundaries per repo, not full AST — keep the rebuild fast)
- `Person` — Jira reporter/assignee, GitLab/GitHub author

Declared nodes (from `.conductor/kg-source/`):
- `Team` — one per `teams/<id>.yml`
- `Principle` — org/team/user-level, with the level preserved (see
  [knowledge-graph-source.md](knowledge-graph-source.md)'s inheritance rules)
- `AwsAccount`, `ConfluenceSpace`, `JiraProject`, `McpServer` — declared
  infrastructure/tooling a team depends on

Edges:
- `JiraIssue -[TARGETS]-> Repo`
- `JiraIssue -[DEPENDS_ON]-> JiraIssue` (ordered-task DAG)
- `JiraIssue -[RESULTED_IN]-> MergeRequest/PullRequest`
- `MergeRequest -[TOUCHED]-> Module`
- `Person -[OWNS]-> Module` (derived from commit/blame frequency, refreshed
  on each `kg update`, never hand-maintained)
- `Team -[OWNS]-> Repo`, `Team -[DEPENDS_ON]-> AwsAccount`, `Team -[USES]-> McpServer`
- `Person -[MEMBER_OF]-> Team`
- `Principle -[APPLIES_TO]-> Team` (org-level principles apply to every `Team` node)

## `conductor kg update`

```
conductor kg update [--repos=a,b,c] [--since=30d]
```

1. Loads `.conductor/kg-source/` ([knowledge-graph-source.md](knowledge-graph-source.md))
   — every team's declared repos, principles, and infrastructure become
   the declared-node set described above.
2. Pulls open + recently-closed Jira issues matching each team's resolved
   `jira_projects[].jql` — this JQL *is* the scope boundary for what the
   graph, and therefore agent context, knows about for that team.
3. Pulls repo metadata (branches, recent MRs/PRs, top-level module
   structure) for every repo declared across all teams the user has access to.
4. Re-derives all edges from scratch — an idempotent full rebuild, not an
   incremental patch. Determinism beats incremental-merge complexity at
   this scale; if the graph ever looks wrong, delete `.conductor/kg/` and
   rebuild.
5. Writes the graph plus a human-readable summary (`conductor kg summary`) so a
   user can sanity-check what got indexed without querying the DB directly.

Before any of this runs, `conductor kg validate` is worth running once —
it catches missing MCP-server env vars or missing binaries up front,
rather than failing mid-rebuild. See
[knowledge-graph-source.md](knowledge-graph-source.md#validating-permissions-and-mcp-servers).

## How it's used

Before dispatch, the relevant subgraph (the target repo, its recent
MRs/PRs, related past Jira issues, module ownership) is serialized into the
Claude Agent SDK session's system context — grounded, current context
without re-crawling the repo from scratch every run. `conductor context
<issue-key>` previews exactly what an agent would see, so a human can sanity
check it before approving dispatch.
