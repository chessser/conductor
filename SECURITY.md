# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately via
[GitHub Security Advisories](https://github.com/chessser/conductor/security/advisories/new)
rather than a public issue. Include what you found, how to reproduce it,
and its impact if you can. This is a small, single-maintainer project —
expect an initial response within a few days, not an SLA.

Please don't file a public issue for anything that could let someone
bypass the guardrails described in
[docs/mcp-server.md](docs/mcp-server.md#guardrails) (project scoping,
write confirmation, the absence of a delete tool) — report those
privately too, the same as any other vulnerability.

## What's in scope

- Anything in this repo: the MCP server (`src/mcp/`), the Jira client
  (`src/lib/providers/`), the `kg-source` loader, the CLI.
- Ways the write-guard (`src/mcp/write-guard.ts`) could be bypassed —
  writing to a project not declared in `kg-source`, a proposal being
  reusable after confirm, a token surviving past its TTL, etc.
- Credential handling — anything that could cause `JIRA_API_TOKEN` (or a
  future credential) to be logged, written to disk unexpectedly, or sent
  somewhere other than the Jira API it's for.

Out of scope: vulnerabilities in Jira Cloud itself, in
`@modelcontextprotocol/sdk` or other third-party dependencies (report
those upstream — though flagging them here so a version bump can happen
is still welcome), or in Claude Code itself.

## How this project tries to prevent problems in the first place

- **No delete operation exists anywhere in the codebase** — not gated,
  not proposed, simply absent from `JiraClient`
  ([human-in-the-loop.md](docs/human-in-the-loop.md)).
- **Every Jira write is propose-then-confirm**, never a single call, with
  single-use expiring tokens ([mcp-server.md](docs/mcp-server.md#guardrails)).
- **Credentials are environment variables only** — no credential file
  format, no keychain/vault integration, nothing this project could leak
  from a config file. See [how-it-works.md](docs/how-it-works.md#credentials-how-they-actually-get-used).
- **Dependency and secret scanning run in CI** on every push and PR
  (`.github/workflows/security.yml`): `npm audit`, gitleaks, CodeQL, and
  dependency review on PRs. Dependabot opens PRs for outdated/vulnerable
  dependencies weekly.
- **`main` is protected**: CI must pass before merge, no force-pushes, no
  branch deletion.

## Supported versions

Pre-1.0, single-branch project — only `main` (the latest commit) is
supported. There are no maintained release branches to backport fixes to.
