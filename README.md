# Conductor

A local MCP server that gives Claude Code on-demand access to your team's
knowledge — org/team/user principles, ways of working, repos, AWS
accounts, infra — and guarded read/write access to Jira, so you can plan
and orchestrate BAU work and improvements conversationally.

**Status: the MCP server is real and working end to end.**
`conductor mcp-server` registers nine tools — three knowledge-graph query
tools, two Jira read tools, and four guarded Jira write tools (propose,
then confirm) — verified with a real MCP client-server handshake over
stdio, not just unit tests. `conductor kg validate` checks a multi-team
YAML source against this machine's env vars and installed binaries.
GitLab/GitHub tools and a persistent graph store are not built yet. See
[docs/build-order.md](docs/build-order.md) for what's done and what's
next — including what was tried and explicitly abandoned along the way.

## Why this exists

Most new work starts as a rough idea, and turning it into a scoped,
correctly-labeled Jira ticket — in the right project, assigned sensibly,
linked to whatever it depends on — is tedious enough that it doesn't
happen carefully. Conductor's job is to give Claude Code the context to
do that well: which team owns what, what their principles and
ways-of-working actually are, and a safe, guarded way to act on Jira once
you've decided what to do — never a silent write, never a delete, always
scoped to projects your team has actually declared. See
[docs/human-in-the-loop.md](docs/human-in-the-loop.md).

## Documentation

- [docs/mcp-server.md](docs/mcp-server.md) — the MCP tool reference and guardrail policy
- [docs/how-it-works.md](docs/how-it-works.md) — the full lifecycle: install, credentials, what runs on each command, how the knowledge graph forms
- [docs/architecture.md](docs/architecture.md) — system overview and core principles
- [docs/jira-structure.md](docs/jira-structure.md) — issue types, the intake form, labels/flags
- [docs/knowledge-graph.md](docs/knowledge-graph.md) — the (not-yet-built) persistent graph store design
- [docs/knowledge-graph-source.md](docs/knowledge-graph-source.md) — the multi-team YAML source (teams, principles, repos, AWS, MCP servers)
- [docs/repo-registry.md](docs/repo-registry.md) — `.conductor/config.yml` schema
- [docs/task-types.md](docs/task-types.md) — repeatable tasks vs. ordered (DAG) tasks
- [docs/cost-and-concurrency.md](docs/cost-and-concurrency.md) — where cost actually lives now
- [docs/human-in-the-loop.md](docs/human-in-the-loop.md) — every gate, explicitly
- [docs/background-dispatch.md](docs/background-dispatch.md) — design for handing scoped work to a background Claude Code session, without a bespoke dispatcher
- [docs/build-order.md](docs/build-order.md) — what's done, what's next, what was abandoned
- [docs/testing.md](docs/testing.md) — fake-server CI testing + optional free Jira sandbox
- [templates/README.md](templates/README.md) — the repeatable-task template format

## CLI

```
conductor mcp-server               # start the local MCP server (stdio) — see docs/mcp-server.md
conductor sync                     # pull Jira issues matching configured JQL -> local index
conductor ready                    # list issues whose readiness labels are set
conductor kg validate              # check MCP-server env vars + binaries against this machine
conductor kg update / kg summary   # not implemented yet — see docs/knowledge-graph.md
conductor context <issue-key>      # not implemented yet
```

## Getting started

```bash
git clone https://github.com/chessser/conductor.git
cd conductor
npm install
cp -r .conductor/kg-source.example .conductor/kg-source   # edit: your teams, principles, AWS/MCP/repos, jira_projects
cp .env.example .env                                      # JIRA_EMAIL + JIRA_API_TOKEN — auto-loaded, see docs/how-it-works.md
npm run build
npm link                                                  # or: node dist/cli.js
conductor kg validate
```

Then add it to Claude Code's MCP config — see
[docs/mcp-server.md](docs/mcp-server.md#connecting-claude-code-to-it) for
the exact `.mcp.json` block — and ask Claude something that needs your
team's context.

`conductor sync`/`conductor ready` still work against the older
single-team `.conductor/config.yml` ([repo-registry.md](docs/repo-registry.md))
if you want the local task index without going through MCP.

## Development

```bash
npm install
npm test         # node's built-in test runner, no external framework
npm run typecheck
npm run lint
npm run dev -- kg validate   # run the CLI from source via tsx, no build step
```

### Testing philosophy

Pure logic — DAG/dependency resolution (`src/lib/dag.ts`), config parsing
(`src/lib/config.ts`, `src/lib/kg-source.ts`), knowledge-graph queries
(`src/lib/kg-query.ts`), the write-guard's propose/confirm token store
(`src/mcp/write-guard.ts`), Jira JSON mapping
(`src/lib/providers/jira-mapping.ts`) — is unit tested exhaustively with
Node's built-in `node:test`, no external test framework. The HTTP
integration layer (`src/lib/providers/jira.ts`) is verified against an
in-repo fake server (`src/lib/providers/jira.fake-server.ts`); the MCP
server itself (`src/mcp/server.ts`) is verified with a real MCP
client-server handshake over stdio during development — not mocked. See
[docs/testing.md](docs/testing.md) for why that distinction matters. Don't
add tests that mock away the thing under test just to hit a coverage
number; that proves nothing and this repo would rather have an honest gap
than a fake green check.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting process and
what's automatically checked in CI (`npm audit`, secret scanning, CodeQL,
dependency review).

## License

MIT — see [LICENSE](LICENSE).
