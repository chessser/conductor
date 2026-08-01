# Suggested build order

This is the intended implementation sequence — each step should be usable
and mergeable on its own before the next one starts.

1. **`conductor sync`** against a real Jira project — pure Jira→local-index
   mapping (`src/lib/providers/jira-mapping.ts`'s `mapJiraIssueToTask`, the
   REST client in `src/lib/providers/jira.ts`, and `src/lib/task-index.ts`).
   **Done** — the mapping function is unit tested against fixtures, and the
   REST client is integration-tested against an in-repo fake Jira server
   (`src/lib/providers/jira.fake-server.ts`) so its request/response
   handling is verified in CI at zero cost. See
   [docs/testing.md](testing.md) for that approach and for the optional
   free Jira Cloud sandbox for manual/local checks beyond what the fake
   covers.

2. **Label-gate + DAG-resolution logic** (`conductor ready`) — **done**. Pure
   logic tested in `src/lib/dag.ts` / `src/types/task.ts`; `conductor ready`
   reads the local task index written by step 1. No
   live dispatch yet.

3. **Knowledge graph** `kg update` / `kg summary` / `context` against 1–2
   real repos. Pick the embedded store (Kuzu vs. SQLite) here — see
   [knowledge-graph.md](knowledge-graph.md).

4. **`conductor pair`** (foreground) via the Claude Agent SDK + Bedrock against
   a single sandboxed repo — validate the execution path end to end
   (session creation, tool permissions, streaming to the terminal) before
   attempting background mode.

5. **`conductor run`** (background, isolated git worktree per task) + cost
   logging + headroom gate (see [cost-and-concurrency.md](cost-and-concurrency.md)).

6. **`conductor mr-poll`** (status flip, label, never merge) + Jira comment-back
   (see [human-in-the-loop.md](human-in-the-loop.md)).

7. **`conductor triage`** (agent-assisted Request → Task/Ordered-Task
   decomposition, human-confirmed) — last, since it depends on everything
   above already working end to end.

## What not to build

- Don't put derived state (`.conductor/`) in git — it's a rebuildable cache,
  not a source of truth. No shared "state branch" is needed since this is
  a single-user, single-Mac tool.
- Don't unit-test the orchestration/integration layer into a false sense of
  security — mock-heavy tests of Jira/GitLab API calls and Bedrock sessions
  prove little. Validate those with real sandbox runs instead.
- Don't let `status/ready` or MR merging become inferred or automatic, no
  matter how tempting for "efficiency" — see
  [human-in-the-loop.md](human-in-the-loop.md).
- Don't build a shared/synced knowledge graph — per-user, access-scoped,
  regenerated on demand only. A shared graph either leaks access boundaries
  or needs its own auth/sync layer this project doesn't otherwise need.
