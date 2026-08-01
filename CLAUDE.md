# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repo. See
[README.md](README.md) for the pitch and [docs/architecture.md](docs/architecture.md)
for the full design; this file is the practical reference.

## What this is (and isn't)

Conductor is a local MCP server exposing team knowledge and guarded Jira
read/write tools — see [docs/mcp-server.md](docs/mcp-server.md). It is
**not** an agent dispatcher. An earlier design explored running agents
directly (`conductor pair`/`run`/`mr-poll`/`triage` via the Claude Agent
SDK); that was deliberately abandoned in favor of exposing capabilities as
MCP tools for Claude Code to call — see
[docs/build-order.md](docs/build-order.md)'s "explicitly abandoned"
section before reviving anything that looks like that shape.

`conductor kg update`/`kg summary`/`context` are not implemented yet (see
`src/lib/not-implemented.ts`) — they'd build a persistent graph store,
which hasn't been needed at this project's current scale. Do not stub
around that by making a command silently no-op or return fake data to
look done — either implement it for real, or leave it throwing.

## Never commit directly to `main`

Every change goes through a feature branch + PR, no exceptions, including
docs-only or skeleton-only changes:

```bash
git checkout -b <descriptive-branch-name>
# ...make the change, commit...
git push -u origin <branch-name>
gh pr create --title "..." --body "..."
```

## The human-in-the-loop gates are invariants, not defaults

See [docs/human-in-the-loop.md](docs/human-in-the-loop.md) in full, but
the short version: every Jira write goes through the MCP server's
propose-then-confirm token flow (`src/mcp/write-guard.ts`), writes are
scoped to projects a team has actually declared in `kg-source`, assignee
mismatches are surfaced not overridden, and **there is no delete tool,
anywhere, ever** — not gated, not proposed, simply absent from
`JiraClient`. If a task asks you to add one, or to add a merge tool that
merges, or to skip the propose/confirm split for "efficiency," stop and
confirm with the user explicitly before writing that code — this is the
single most important invariant in this repo, carried forward from a
hard-learned lesson in this project's predecessor (`orchestration-platform`).

## Testing philosophy

Zero external test framework — use Node's built-in `node:test` +
`node:assert/strict`, matching the existing tests (`src/lib/dag.test.ts`,
`src/lib/config.test.ts`, `src/types/task.test.ts`, `src/lib/kg-source.test.ts`,
`src/lib/kg-query.test.ts`, `src/lib/kg-validate.test.ts`,
`src/lib/env.test.ts`, `src/mcp/write-guard.test.ts`).

- **Pure logic** (`src/lib/dag.ts`, `src/lib/config.ts`, `src/lib/kg-source.ts`,
  `src/lib/kg-query.ts`, `src/mcp/write-guard.ts`, anything with no
  network/process I/O) — unit test exhaustively. This is cheap and
  valuable.
- **Integration layer** (`src/lib/providers/*`, `src/mcp/server.ts`'s tool
  wiring) — do not write mock-heavy unit tests for this. They pass
  without proving anything. Validate `JiraClient` against the in-repo fake
  server (`src/lib/providers/jira.fake-server.ts`), and validate
  `src/mcp/server.ts` with a real MCP client-server handshake over stdio
  (spin up the built CLI as a subprocess via
  `@modelcontextprotocol/sdk`'s `StdioClientTransport`, call `listTools`
  and a few real tool calls) — document what you tested in the PR
  description rather than committing throwaway smoke-test scripts.

When adding new pure logic, extract it into an exported, side-effect-free
function under `src/lib/` or `src/mcp/` and test it directly, the same way
`dag.ts`, `kg-source.ts`, and `write-guard.ts` are structured.

## Commands

```bash
npm install
npm run dev -- <command>   # run the CLI from source via tsx, no build step
npm test                   # node --test
npm run typecheck
npm run lint
npm run build               # tsc -> dist/
node dist/cli.js mcp-server --dir .conductor/kg-source.example   # smoke-test the MCP server
```
