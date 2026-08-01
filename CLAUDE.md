# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repo. See
[README.md](README.md) for the pitch and [docs/architecture.md](docs/architecture.md)
for the full design; this file is the practical reference.

## This is a skeleton, not a working tool yet

Every `conductor` command currently throws "not implemented yet" (see
`src/lib/not-implemented.ts`). Do not stub around that by making a command
silently no-op or return fake data to look done — either implement it for
real against a real Jira/GitLab/GitHub/Bedrock sandbox, or leave it
throwing. See [docs/build-order.md](docs/build-order.md) for the intended
sequence; implement in that order so each step is independently testable
and mergeable.

## Never commit directly to `main`

Every change goes through a feature branch + PR, no exceptions, including
docs-only or skeleton-only changes:

```bash
git checkout -b <descriptive-branch-name>
# ...make the change, commit...
git push -u origin <branch-name>
gh pr create --title "..." --body "..."
```

## The four human-in-the-loop gates are invariants, not defaults

See [docs/human-in-the-loop.md](docs/human-in-the-loop.md) in full, but the
short version: Jira decomposition, `status/ready`, the optional design gate,
and MR/PR approval are all points where a human must act. **`conductor mr-poll`
must never call a merge endpoint, under any flag or configuration.** If a
task asks you to add auto-merge or auto-retry-on-red-CI, stop and confirm
with the user explicitly before writing that code — this was a hard-learned
lesson from this project's predecessor (`orchestration-platform`) and is
the single most important invariant here.

## Testing philosophy

Zero external test framework — use Node's built-in `node:test` +
`node:assert/strict`, matching the existing tests (`src/lib/dag.test.ts`,
`src/lib/config.test.ts`, `src/types/task.test.ts`, `src/lib/kg-source.test.ts`,
`src/lib/kg-validate.test.ts`).

- **Pure logic** (`src/lib/dag.ts`, `src/lib/config.ts`, `src/types/task.ts`,
  anything with no network/process I/O) — unit test exhaustively. This is
  cheap and valuable.
- **Integration layer** (`src/lib/providers/*`, command implementations
  once they're real) — do not write mock-heavy unit tests for this. They
  pass without proving anything. Validate against a real sandbox Jira
  project / GitLab or GitHub group / Bedrock account instead, and document
  what you tested in the PR description.

When adding new pure logic, extract it into an exported, side-effect-free
function under `src/lib/` or `src/types/` and test it directly, the same
way `dag.ts` and `config.ts` are structured.

## Commands

```bash
npm install
npm run dev -- <command>   # run the CLI from source via tsx, no build step
npm test                   # node --test
npm run typecheck
npm run lint
npm run build               # tsc -> dist/
```
