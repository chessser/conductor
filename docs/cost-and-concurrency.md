# Cost & concurrency

**This doc used to describe Bedrock usage tracking for a bespoke agent
dispatcher (`conductor run`) that no longer exists** — see
[build-order.md](build-order.md)'s "explicitly abandoned" section. That
approach was replaced by exposing Jira/knowledge tools through
`conductor mcp-server` for Claude Code to call directly
([mcp-server.md](mcp-server.md)).

## Where cost actually lives now

There is no separate Conductor-managed billing account or cost ledger.
Every MCP tool call happens inside a Claude Code session, so token usage
is Claude Code's own usage — tracked and billed the same way any other
tool call in that session is, with no shadow accounting on Conductor's
side. `conductor mcp-server` itself makes plain REST calls to Jira (no
LLM calls of its own), so it has no token cost — only whatever ordinary
Jira Cloud API rate limits apply.

## Concurrency

`conductor mcp-server` is a single stdio subprocess per Claude Code
connection — there's no fan-out, no worker pool, and nothing to cap. If
GitLab/GitHub MR tools are added later ([build-order.md](build-order.md)),
they'd follow the same shape: synchronous tool calls answering a live
request, not background jobs needing a concurrency limit.

If a future addition genuinely needs cost tracking or concurrency limits
(e.g. an autonomous background-dispatch tool, explicitly called out as a
deliberate future decision in [build-order.md](build-order.md)), that's
the point to write this doc for real again — not before.
