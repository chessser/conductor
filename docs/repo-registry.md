# Repo registry

A single config file — `.forge/config.yml` (project-local) or
`~/.config/forge/repos.yml` (machine-wide fallback) — lists every
GitLab/GitHub repo this install is aware of. See `src/lib/config.ts` for
the loader and `.forge/config.example.yml` for a filled-in example.

```yaml
repos:
  - id: payments-api
    provider: gitlab            # gitlab | github
    project: mygroup/payments-api
    default_branch: main
    modules: [src/billing, src/ledger, src/webhooks]   # coarse boundaries for the knowledge graph

  - id: internal-docs
    provider: github
    project: myorg/internal-docs
    default_branch: main

jira:
  base_url: https://yourcompany.atlassian.net
  project_key: PROJ
  jql: 'project = PROJ AND labels in ("forge-task", "forge-ordered-task")'

cost:
  daily_ceiling_usd: 25
  weekly_ceiling_usd: 100
```

This is the single array the whole system reads from — the Jira intake
form's repo dropdown, the knowledge graph's scope, and the dispatcher's
worktree targets all resolve against this one file. Adding a repo is a
one-line config change, not a code change.

Resolution order (`resolveConfigPath` in `src/lib/config.ts`):
1. An explicit `--config <path>` flag, if a command supports one.
2. `./.forge/config.yml` (project-local).
3. `~/.config/forge/repos.yml` (machine-wide).
