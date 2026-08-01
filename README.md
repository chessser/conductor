# task-forge

A Jira-driven agentic orchestrator: turns Jira issues into agent-executed
changes across GitLab and GitHub repos, backed by a locally-rebuilt
knowledge graph, with human-gated dispatch and merge review at every step.

**Status: project skeleton.** This repo has the intended architecture,
types, CLI surface, and pure logic (DAG resolution, config parsing) laid
out and tested, but no live Jira/GitLab/GitHub/Bedrock integration yet —
every `forge` command currently throws "not implemented yet" with a
pointer to the doc describing what it should do. See [docs/build-order.md](docs/build-order.md)
for the intended implementation sequence.

## Why this exists

Most new work starts as a rough idea. This tool's job is to take that idea
through: a structured Jira form → a scoped, labeled ticket → (optionally) a
human-confirmed decomposition into ordered sub-tasks across repos → agent
dispatch (paired or unattended) → a merge request a human actually reviews
and merges. Nothing merges itself. See [docs/human-in-the-loop.md](docs/human-in-the-loop.md).

## Documentation

- [docs/architecture.md](docs/architecture.md) — system overview and core principles
- [docs/jira-structure.md](docs/jira-structure.md) — issue types, the intake form, labels/flags
- [docs/knowledge-graph.md](docs/knowledge-graph.md) — what it is, how it's built, how it's used
- [docs/repo-registry.md](docs/repo-registry.md) — `.forge/config.yml` schema
- [docs/task-types.md](docs/task-types.md) — repeatable tasks vs. ordered (DAG) tasks
- [docs/cost-and-concurrency.md](docs/cost-and-concurrency.md) — Bedrock usage tracking and dispatch caps
- [docs/human-in-the-loop.md](docs/human-in-the-loop.md) — every gate, explicitly
- [docs/build-order.md](docs/build-order.md) — suggested implementation sequence
- [templates/README.md](templates/README.md) — the repeatable-task template format

## CLI

```
forge sync                     # pull Jira issues matching configured JQL -> local index
forge kg update [--repos=..]   # rebuild local knowledge graph
forge kg summary               # human-readable dump of what's indexed
forge context <issue-key>      # preview what an agent would see for this issue
forge ready                    # list dispatchable tasks, split foreground/background
forge triage                   # assist Forge Request -> Task/Ordered-Task decomposition
forge pair <issue-key>         # foreground: live paired session via Claude Agent SDK
forge run <issue-key>          # background: unattended dispatch, isolated git worktree
forge run --all                # dispatch everything currently ready, respecting caps
forge status                   # dashboard: in-progress/review/blocked, cost so far
forge mr-poll                  # poll open MRs/PRs, flip Jira status — never merges
```

## Getting started (once integrations are implemented)

```bash
git clone https://github.com/chessser/task-forge.git
cd task-forge
npm install
cp .forge/config.example.yml .forge/config.yml   # edit: your repos, Jira JQL, cost ceilings
npm run build
npm link                                          # or: node dist/cli.js
forge sync
forge ready
```

## Development

```bash
npm install
npm test         # node's built-in test runner, no external framework
npm run typecheck
npm run lint
npm run dev -- ready   # run the CLI from source via tsx, no build step
```

### Testing philosophy

Pure logic — DAG/dependency resolution (`src/lib/dag.ts`), config parsing
(`src/lib/config.ts`), label-gate checks (`src/types/task.ts`) — is unit
tested exhaustively with Node's built-in `node:test`, no external test
framework, matching the tests already in this repo. The Jira/GitLab/GitHub/
Bedrock integration layer (`src/lib/providers/*`, and the command
implementations once they exist) is intentionally **not** meant to be
covered by mock-heavy unit tests — validate those against a real sandbox
Jira project/repo instead. Don't add tests that mock away the entire
surface just to hit a coverage number; that proves nothing and this repo
would rather have an honest gap than a fake green check.

## License

MIT — see [LICENSE](LICENSE).
