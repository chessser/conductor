# Testing without a real Jira/GitLab/GitHub account

This project needs to validate real HTTP-shaped behavior (request bodies,
auth headers, response mapping) without paying for or depending on live
third-party services in CI. Two layers, used for different things:

## 1. Fake servers, in-repo, run in CI (primary mechanism)

`src/lib/providers/jira.fake-server.ts` is a small `node:http` server that
implements just the handful of Jira Cloud REST API v3 routes
`createJiraClient` (`src/lib/providers/jira.ts`) actually calls:
`POST /rest/api/3/search/jql`, `GET`/`PUT /rest/api/3/issue/:key`, and
`POST /rest/api/3/issue/:key/comment`. It's not a general Jira mock — it
doesn't parse JQL or validate auth — it just returns canned fixture data
and records every request it received so a test can assert on the request
shape the client actually sent.

`src/lib/providers/jira.test.ts` spins this server up on `127.0.0.1` on a
random free port, points `createJiraClient` at it, and asserts on both
directions: what the client sends (JQL in the search body, which label got
replaced by `setStatus`, the ADF shape of a comment) and what it returns
(mapped `ForgeTask` fields). This runs in CI with **zero external network
access and zero cost** — see `.github/workflows/ci.yml`.

When a second provider (GitLab/GitHub `ScmClient`) is implemented, follow
the same pattern: a `scm.fake-server.ts` per provider, wired into a
`scm.test.ts` the same way.

This is deliberately **not** a mock of `createJiraClient` itself — mocking
the thing under test proves nothing. The fake is a real HTTP server; the
client under test makes real HTTP calls to it.

## 2. A free Jira Cloud sandbox, for manual/local checks (optional)

The fake server can't catch everything — real Jira's actual JQL semantics,
real auth failure modes, real rate limiting, custom field quirks on your
own site. For that, Atlassian's free tier (up to 10 users, no credit card,
free forever — not a trial) is enough:

1. Go to https://www.atlassian.com/software/jira/free and create a site
   (e.g. `your-name.atlassian.net`).
2. Create a project with issue types `Forge Request`, `Forge Task`,
   `Forge Ordered Task` (Jira admin → issue types), or reuse the defaults
   and adjust `docs/jira-structure.md` labels accordingly for your test.
3. Generate an API token: https://id.atlassian.com/manage-profile/security/api-tokens
4. Copy `.env.example` to `.env` (gitignored) and fill in:
   ```
   JIRA_EMAIL=you@example.com
   JIRA_API_TOKEN=<the token from step 3>
   ```
5. Point `.forge/config.yml`'s `jira.base_url` at your site and run
   `forge sync` for real.

This is a manual, local-only check — never wire real credentials into CI.
If a future CI job needs live-service validation, that's a deliberate,
separate decision (a scheduled job against a dedicated test site, secrets
scoped to it) — not something to bolt onto the PR-triggered `ci.yml`.
