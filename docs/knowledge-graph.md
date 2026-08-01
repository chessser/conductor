# Knowledge graph

## What it is

A local, per-user, deterministically-rebuilt graph stored under
`.forge/kg/` (gitignored), built by `forge kg update`. Not synced or shared
between users — the *generation logic* lives in this repo and is identical
for everyone; the *output* is not shared, because it's scoped to whatever
the invoking user's Jira/GitLab/GitHub tokens can actually see. Two
engineers running `forge kg update` get graphs with the same schema, built
by the same code, but different content.

Storage: an embedded graph-capable store (e.g. [Kuzu](https://kuzudb.com/),
an embedded property-graph DB with a TypeScript client, no server process
required) or, if that proves too heavy, a SQLite schema modeling
nodes/edges explicitly. Either is fine as long as it's embedded, file-based,
and gitignored — no shared infrastructure.

## Schema

Nodes:
- `Repo` — from the repo registry ([repo-registry.md](repo-registry.md))
- `JiraIssue` — synced fields: type, status, labels, description summary
- `File`/`Module` — coarse boundaries (top-level dirs or package
  boundaries per repo, not full AST — keep the rebuild fast)
- `Person` — Jira reporter/assignee, GitLab/GitHub author

Edges:
- `JiraIssue -[TARGETS]-> Repo`
- `JiraIssue -[DEPENDS_ON]-> JiraIssue` (ordered-task DAG)
- `JiraIssue -[RESULTED_IN]-> MergeRequest/PullRequest`
- `MergeRequest -[TOUCHED]-> Module`
- `Person -[OWNS]-> Module` (derived from commit/blame frequency, refreshed
  on each `kg update`, never hand-maintained)

## `forge kg update`

```
forge kg update [--repos=a,b,c] [--since=30d]
```

1. Pulls open + recently-closed Jira issues matching the JQL configured in
   `.forge/config.yml` (`jira.jql`) — this JQL *is* the scope boundary for
   what the graph, and therefore agent context, knows about.
2. Pulls repo metadata (branches, recent MRs/PRs, top-level module
   structure) for every repo in the registry the user has access to.
3. Re-derives all edges from scratch — an idempotent full rebuild, not an
   incremental patch. Determinism beats incremental-merge complexity at
   this scale; if the graph ever looks wrong, delete `.forge/kg/` and
   rebuild.
4. Writes the graph plus a human-readable summary (`forge kg summary`) so a
   user can sanity-check what got indexed without querying the DB directly.

## How it's used

Before dispatch, the relevant subgraph (the target repo, its recent
MRs/PRs, related past Jira issues, module ownership) is serialized into the
Claude Agent SDK session's system context — grounded, current context
without re-crawling the repo from scratch every run. `forge context
<issue-key>` previews exactly what an agent would see, so a human can sanity
check it before approving dispatch.
