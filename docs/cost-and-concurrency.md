# Cost & concurrency

Bedrock billing is per-account, metered by token usage per model. Every
Claude Agent SDK session's token usage (available from the SDK's response
metadata) should be logged to a local CSV or SQLite table, keyed by Jira
issue key, repo, and template/task type — the same shape as `conductor`'s
predecessor's cost tracking, aimed at Bedrock's usage numbers instead of a
third-party metered API.

`conductor run --all` and individual `conductor run <issue-key>` calls must check
headroom before dispatching: a configurable daily/weekly spend ceiling
(`cost.daily_ceiling_usd` / `cost.weekly_ceiling_usd` in
`.conductor/config.yml`, see [repo-registry.md](repo-registry.md)). If a
dispatch would exceed the ceiling, it's skipped and reported, not silently
throttled or queued.

`conductor status` is the dashboard: what's in-progress/review/blocked, and
cost so far against the configured ceilings.

Concurrency: cap the number of simultaneously running background sessions
(a `--max-concurrent` flag or a config value) so a large `conductor run --all`
doesn't spin up more Bedrock sessions, git worktrees, or file-system load
than the Mac can handle at once.
