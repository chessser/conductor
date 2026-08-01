# Schema changelog

Changes to the published MCP tool contract (`dist/conductor-schema.json`),
separate from the code changelog on purpose — this file is for people
writing clients against Conductor, who care about wire-format changes and
not about refactors. See [docs/schema-contract.md](docs/schema-contract.md)
for what the contract covers and how versions are assigned.

## 2.0.0 — unreleased

First published schema. Everything below is new by definition; the version
starts at 2.0.0 rather than 1.0.0 to stay aligned with the MCP server's own
generation (the pre-MCP CLI was 1.x).

### Tools

**Knowledge (3)** — `kg_list_teams`, `kg_get_team`, `kg_search_principles`

**Jira (6)** — `jira_search`, `jira_get_issue`, `jira_propose_comment`,
`jira_propose_status_change`, `jira_propose_create_issue`,
`jira_confirm_write`

**GitHub (6)** — `github_search`, `github_get_issue`,
`github_propose_comment`, `github_propose_status_change`,
`github_propose_create_issue`, `github_confirm_write`

> **Declared, not yet implemented.** The GitHub tools are in the schema so
> clients can be built against the final shape, but the backend behind them
> is not written yet — see [docs/build-order.md](docs/build-order.md). Calls
> will fail until it lands. This is the one place the schema currently
> describes more than the server does; it will be resolved by implementing
> the backend, not by removing the tools.

**Background dispatch (4)** — `task_search_ready`, `task_record_dispatch`,
`task_list_dispatched`, `task_record_complete`. Also declared-not-implemented;
see [docs/background-dispatch.md](docs/background-dispatch.md).

### Guaranteed properties

Asserted by `src/lib/schema-generator.test.ts`, so a future change that
breaks one of these fails the build rather than shipping:

- No tool matching `/delete|remove|destroy/` exists.
- Every backend has `*_propose_*` tools plus exactly one `*_confirm_write`.
- Every propose tool returns a required `token` and a `preview`.
- Every confirm tool's required input is exactly `['token']`.
- `*_propose_status_change` enums match the `TaskStatus` union exactly.
- `jira_search` and `github_search` both require a `projectKey`.
