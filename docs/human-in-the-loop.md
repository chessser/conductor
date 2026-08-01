# Human-in-the-loop gates

This is the explicit list. Every one of these is a deliberate design
decision, not an oversight to "optimize away" later — if a future change
proposes removing or automating one of these for efficiency, that's a sign
to stop and reconsider, not a green light.

1. **Every Jira write is a propose, then a separate confirm.** The MCP
   server never performs a write as a single tool call —
   `jira_propose_comment`/`jira_propose_status_change`/`jira_propose_create_issue`
   return a token and a human-readable preview; only `jira_confirm_write`
   with that token actually does it. This happens inside your Claude Code
   conversation, so the "human in the loop" is literally you, reading the
   proposal before it's confirmed. See [mcp-server.md](mcp-server.md#jira--write-propose-then-confirm).

2. **No delete operation exists, anywhere.** Not gated, not proposed —
   absent from `JiraClient` entirely (`src/lib/providers/jira.ts`). If an
   issue needs deleting, that happens in Jira directly, never through this
   server.

3. **Writes are scoped to declared projects, not "any project this token
   can reach."** A team must have the project in its resolved
   `jira_projects` (`.conductor/kg-source/teams/<id>.yml`, additive to
   `root.yml`'s shared ones) before any tool — read or write — will touch
   it. See [mcp-server.md](mcp-server.md#guardrails).

4. **Assignee mismatches are surfaced, never silently overridden.** Before
   proposing a write on an existing issue, the server checks its current
   assignee against `JIRA_EMAIL` and attaches a warning to the proposal if
   they differ — visible in the conversation, not swallowed.

5. **`kg-source` changes are always a real PR, never a chat side-effect.**
   Nothing in this server writes to `.conductor/kg-source/*.yml`. If a
   conversation with Claude produces a proposed change to a team's
   principles or ways-of-working, that has to land as an edited file and a
   normal git commit/PR — the same GitOps discipline
   ([CLAUDE.md](../CLAUDE.md)) as any other change to this repo.

If you're extending `src/mcp/server.ts` with new tools (GitLab/GitHub MR
tools are the obvious next addition, see
[mcp-server.md](mcp-server.md#whats-not-here-yet)), treat these five gates
as invariants to preserve, not defaults to work around — a merge tool, if
one's ever added, must follow the same propose-then-confirm shape and must
never itself click merge.
