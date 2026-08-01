# Knowledge-graph source

The knowledge graph itself ([knowledge-graph.md](knowledge-graph.md)) is a
rebuilt-on-demand graph DB scoped to Jira/repo activity. This doc covers a
different, prerequisite layer: **the structured, human-maintained YAML that
tells the graph (and any agent) what exists in the first place** — which
Confluence spaces, Jira projects, GitLab/GitHub repos, AWS accounts,
binaries, permissions, and MCP servers a team depends on, and what
principles and ways-of-working govern how that team operates. `conductor kg
update` reads this alongside live Jira/repo data when it builds the graph;
`conductor kg validate` checks it against the machine it's running on right
now.

This is deliberately **not org-secret data** — no tokens, no credentials,
no anything you wouldn't put in a design doc. It's structure and
references. Secrets stay in environment variables (see
[testing.md](testing.md), [.env.example](../.env.example)).

## Why this layer exists

An agent (or a human) picking up a task needs two different kinds of
context: **what happened** (Jira history, past PRs — the live graph) and
**what's true by design** (which repo is this, what AWS account does it
deploy to, does this team squash-merge or not, who's oncall). The second
kind doesn't come from crawling APIs — it has to be declared, once, by the
team that owns it. This file format is that declaration.

## Multi-team structure

```
.conductor/kg-source/
  root.yml              # org-wide principles + shared resources
  teams/
    payments.yml
    platform.yml
    ...
```

A committed **example** lives at
[.conductor/kg-source.example/](../.conductor/kg-source.example/) — copy it
to `.conductor/kg-source/` (gitignored, since real org structure is
specific to your install, not this public skeleton) and edit.

`root.yml` lists team ids under `teams:`; each resolves to
`teams/<id>.yml` in the same directory. Adding a team is: create the file,
add its id to `root.yml`'s list. No code change.

## Inheritance: org → team → user

Principles compose top-down and never overwrite:

- **Org-level** (`root.yml`'s `principles:`) apply to every team.
- **Team-level** (`teams/<id>.yml`'s `principles:`) apply on top, specific
  to that team.
- **User-level** (`members[].principles`) apply on top of both, specific
  to that person (e.g. "primary oncall for X").

`resolveTeam()` (`src/lib/kg-source.ts`) builds this into
`ResolvedTeam.principles = { org, team, users }` — nothing is merged into
one flat list, so a consumer can always tell which level a principle came
from.

Resources (Confluence spaces, Jira projects, AWS accounts, MCP servers)
follow a similar but different rule: **additive, not layered** — a team
gets every org-wide shared resource *plus* its own. If a team declares a
resource with the same `id` as a shared one, the team's version wins (lets
a team narrow or override something shared without forking the whole
entry). See `resolveTeam`'s tests in `src/lib/kg-source.test.ts` for the
exact behavior.

## Schema

### `root.yml`

| Field | Type | Notes |
|---|---|---|
| `version` | number | Schema version, bump on breaking changes |
| `organization` | string | |
| `principles[]` | `{ id, statement, doc? }` | Org-wide, inherited by every team |
| `shared_resources.confluence[]` | `{ id, base_url, space_key }` | |
| `shared_resources.jira[]` | `{ id, base_url, project_key, jql? }` | |
| `shared_resources.aws_accounts[]` | `{ id, account_id, role_arn?, regions[], required_permissions[] }` | `account_id` must be 12 digits |
| `mcp_servers[]` | `{ id, package, required_env[] }` | Org-wide MCP servers; `conductor kg validate` checks `required_env` |
| `teams[]` | string[] | Team ids, resolved to `teams/<id>.yml` |

### `teams/<id>.yml`

| Field | Type | Notes |
|---|---|---|
| `id` | string | Must match the key used in `root.yml`'s `teams:` list |
| `display_name` | string | |
| `principles[]` | `{ id, statement, doc? }` | Team-level, in addition to org-level |
| `ways_of_working` | see below | Structured fields + a `principles_doc` escape hatch |
| `confluence_spaces[]`, `jira_projects[]`, `aws_accounts[]` | same shape as `shared_resources.*` | Additive to shared, see inheritance above |
| `gitlab_repos[]`, `github_repos[]` | `{ id, provider, project, default_branch?, modules[]? }` | Same shape as [repo-registry.md](repo-registry.md)'s `RepoConfig` |
| `binaries_needed[]` | `{ name, min_version? }` | Checked by `conductor kg validate` against `which`/`where` |
| `permissions_needed[]` | `{ resource, scope[] }` | `resource` is `kind:id`, e.g. `gitlab:payments-api` — documents intent; not itself enforced yet |
| `mcp_servers[]` | `{ id, package, required_env[] }` | Team-specific, merged with org-wide by id |
| `members[]` | `{ id, name?, role?, principles[] }` | User-level principles |

### `ways_of_working`

All fields optional — declare what's meaningful for the team, nothing
forces every field. Anything that doesn't fit a structured field goes in
`principles_doc` instead of being crammed into one.

| Field | Type |
|---|---|
| `branch_strategy` | `trunk-based \| gitflow \| github-flow` |
| `merge_strategy` | `squash \| merge \| rebase` |
| `requires_review` | boolean |
| `min_approvals` | number |
| `ci_required` | boolean |
| `deploy_cadence` | `continuous \| daily \| weekly \| on-demand` |
| `comms_channel` | string |
| `principles_doc` | URL — the prose version for whatever doesn't fit a field |

## Validating permissions and MCP servers

```
conductor kg validate [--dir <path>]
```

Loads the resolved source and checks, per team:

1. **MCP servers** — every `required_env` var is actually set in this
   process's environment (`missingEnvFor` / `validateMcpServers` in
   `src/lib/kg-validate.ts`, pure and unit tested).
2. **Binaries** — every `binaries_needed[].name` resolves via `which`
   (`where` on Windows) on this machine (`realBinaryChecker` — the one
   piece of this that's genuinely I/O, injectable in tests so the suite
   doesn't depend on what's actually installed on the CI runner).

It does **not** call out to AWS/GitLab/GitHub to check that
`required_permissions`/`permissions_needed` actually hold — that would
mean live credentialed calls in a `validate` command, which this project's
[human-in-the-loop.md](human-in-the-loop.md) philosophy treats as a
deliberate decision, not a default. `permissions_needed` today is
documentation the graph can query ("what does this team need to touch
prod?"), not yet an enforced check. If that becomes a checked step later,
model it as an explicit opt-in, not baked into `validate`.

Exit code is non-zero if anything's missing, so it's CI/pre-flight-check
friendly.

## Relationship to `.conductor/config.yml`

[repo-registry.md](repo-registry.md)'s `.conductor/config.yml` is the
single-team MVP config `conductor sync` currently reads (one `jira:`
block, one flat `repos:` list). This file format supersedes it in scope —
multi-team, multi-resource-type, principle-aware — but nothing has been
migrated yet; that's a deliberate follow-up, not done here. When it
happens, `.conductor/config.yml` should fold into a single team's
`teams/<id>.yml` rather than the two formats living in parallel
indefinitely.
