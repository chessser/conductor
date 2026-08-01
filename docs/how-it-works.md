# How Conductor works, end to end

The other docs describe individual pieces (architecture, Jira structure,
the knowledge-graph source schema). This one walks through the whole
lifecycle in order: what you install, where your credentials live, what
actually happens when you type `conductor <command>`, whether anything
runs in the background, and how you'd stand up your own knowledge graph
from scratch. If you only read one doc to understand how this actually
behaves on your machine, read this one.

## The mental model: a CLI, not a service

**Conductor has no daemon, no persistent process, and no background
sync.** Every `conductor` command is a one-shot invocation: it runs, does
its work, prints a result, and exits. Nothing keeps running after the
process exits. Nothing polls Jira in the background while you're doing
something else. If you don't run `conductor sync`, your local task index
simply goes stale — silently, safely, with no side effects — until you run
it again.

This is a deliberate choice, not a gap to fill in later: it means there's
never a hidden process to lose track of, no daemon crash to debug, and no
"why did this run without me asking" surprise. If you want periodic
syncing, you schedule the CLI to run periodically yourself — see
[Scheduling, not a background daemon](#scheduling-not-a-background-daemon)
below.

## Install and where credentials live

```bash
git clone https://github.com/chessser/conductor.git
cd conductor
npm install
npm run build
npm link                # puts `conductor` on your PATH, or use `node dist/cli.js`
```

Three separate config surfaces, each with a distinct purpose and a
distinct trust level:

| File | Committed? | Purpose | Contains secrets? |
|---|---|---|---|
| `.env` | No (gitignored) | Credentials for live API calls | Yes — this is the *only* place secrets go |
| `.conductor/config.yml` | No (gitignored) | Single-team repo registry + Jira JQL ([repo-registry.md](repo-registry.md)) | No — refs and JQL only |
| `.conductor/kg-source/` | No (gitignored) | Multi-team org structure, principles, infra refs ([knowledge-graph-source.md](knowledge-graph-source.md)) | No — refs and required-scope metadata only, never values |

Each has a `.example` counterpart that *is* committed, so the schema is
documented in the repo without any real data ever being in it:
`.env.example`, `.conductor/config.example.yml`,
`.conductor/kg-source.example/`.

### Credentials: how they actually get used

```bash
cp .env.example .env
# edit .env:
#   JIRA_EMAIL=you@example.com
#   JIRA_API_TOKEN=<a real token, see docs/testing.md>
```

As of the CLI entrypoint (`src/cli.ts`), `.env` is loaded automatically
before any command runs — `loadEnvFile()` (`src/lib/env.ts`) reads it into
`process.env`, but **never overwrites a variable already set** by your
shell or by CI. That means:

- Local dev: put values in `.env`, they just work.
- CI/shared machines: `export JIRA_API_TOKEN=...` (or a CI secret) always
  wins over whatever's in a checked-out `.env` — which is itself gitignored
  and shouldn't exist there anyway.
- Nothing in this project ever writes a credential to disk on your behalf,
  logs one, or sends one anywhere except the API it's explicitly for
  (Jira's own auth header, built in `src/lib/providers/jira.ts`).

Every credential this project currently needs is a plain environment
variable, checked at the point of use with a clear error naming exactly
what's missing (see `requireEnv` in `src/commands/sync.ts`). There is no
credential file format, no keychain integration, and no vault integration
— by design, for a single-user CLI tool. If that changes (team-shared
credentials, a real secrets manager), that's a deliberate future decision,
not something to bolt on quietly.

**AWS accounts** declared in `.conductor/kg-source/` (`account_id`,
`role_arn`, `regions`) are references, not credentials — `conductor`
doesn't call AWS APIs today, and when it does, the intended model is your
existing AWS credential chain (`AWS_PROFILE`, SSO, an assumed role) — the
same one your AWS CLI already uses — not a new credential format
invented by this project.

**MCP servers** declared in `.conductor/kg-source/` (`mcp_servers[].
required_env`) work the same way: the YAML says *which* env vars a server
needs, never their values. `conductor kg validate` (below) checks they're
set; it never reads or prints their contents.

## What actually runs, command by command

### `conductor sync`

1. Loads `.conductor/config.yml` (`loadConfig`, `src/lib/config.ts`).
2. Reads `JIRA_EMAIL`/`JIRA_API_TOKEN` from the environment (`.env` or shell).
3. Makes **one** HTTP request: `POST /rest/api/3/search/jql` against your
   Jira site, with the JQL from `config.yml`'s `jira.jql`
   (`createJiraClient`, `src/lib/providers/jira.ts`).
4. Maps the response into `ConductorTask[]` (`mapJiraIssueToTask`,
   `src/lib/providers/jira-mapping.ts`) — pure, no side effects.
5. Writes `.conductor/tasks.json` (`writeTaskIndex`, `src/lib/task-index.ts`).
6. Exits.

No connection is held open. No retry loop. No websocket. If it fails, it
fails loudly with a specific error and a non-zero exit code — see
[human-in-the-loop.md](human-in-the-loop.md)'s general philosophy on not
silently retrying.

### `conductor ready`

Pure local computation, **zero network calls**: reads
`.conductor/tasks.json` (whatever `sync` last wrote) and filters it
through the label-gate + DAG logic (`dispatchableTasks`,
`src/lib/dag.ts`), splitting the dispatchable set into foreground/
background. If you haven't run `sync` recently, this is stale — `ready`
itself never reaches out to Jira to check.

### `conductor kg validate`

Also **zero network calls**, but does touch the local filesystem/PATH:

1. Loads `.conductor/kg-source/` (`loadKnowledgeGraphSource`,
   `src/lib/kg-source.ts`) — parses `root.yml` + every `teams/<id>.yml`,
   resolves inheritance.
2. For every team's declared `mcp_servers[]`, checks each `required_env`
   var is set in *this* process's environment (`validateMcpServers`,
   `src/lib/kg-validate.ts`) — reads `process.env`, never a remote call.
3. For every team's declared `binaries_needed[]`, shells out to
   `which`/`where` (`realBinaryChecker`) to check it resolves on `PATH` —
   the one piece of this command that's genuinely I/O, and the only part
   not unit-testable without mocking, so it's kept as one small isolated
   function.
4. Prints gaps, exits non-zero if anything's missing (CI/pre-flight-check
   friendly), zero otherwise.

### `conductor kg update` / `kg summary` / `context` — not implemented yet

These are the commands that will actually build the graph DB (see
[How the knowledge graph gets formed](#how-the-knowledge-graph-gets-formed)
below) — today they throw a clear "not implemented" error pointing at
[knowledge-graph.md](knowledge-graph.md) and
[build-order.md](build-order.md). Nothing about their *design* is
speculative — the source data (`kg-source`) and the live-data client
(`JiraClient`) they'll consume already exist and are tested; what's
missing is the graph-DB write step itself.

### `conductor pair` / `conductor run` / `conductor mr-poll` / `conductor triage` — not implemented yet

Same status: designed, documented, throwing a clear error. See
[build-order.md](build-order.md) for the intended sequence.

## Scheduling, not a background daemon

Since nothing runs on its own, "keeping the local index fresh" is your
call, on your schedule, using your OS's own scheduler — not something
Conductor manages for you. On macOS, that's `launchd`:

```xml
<!-- ~/Library/LaunchAgents/com.conductor.sync.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>com.conductor.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/conductor</string>
    <string>sync</string>
  </array>
  <key>WorkingDirectory</key><string>/absolute/path/to/your/conductor-config-dir</string>
  <key>StartInterval</key><integer>1800</integer>  <!-- every 30 min -->
  <key>StandardErrorPath</key><string>/tmp/conductor-sync.err.log</string>
</dict></plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.conductor.sync.plist
```

A plain `cron` entry works identically if you prefer it. Either way: this
is optional, explicit, and entirely yours to set up or tear down —
Conductor itself never installs a scheduled job on your behalf.

## How the knowledge graph gets formed

The graph (once `kg update` is implemented) is built from **two
categories of input**, merged into one embedded graph DB
(`.conductor/kg/`, gitignored, rebuilt from scratch each run — see
[knowledge-graph.md](knowledge-graph.md) for the full node/edge schema):

```
.conductor/kg-source/            live Jira/GitLab/GitHub APIs
  root.yml                       (scoped by each team's
  teams/<id>.yml                  resolved jira_projects[].jql
       │                          and gitlab_repos/github_repos)
       │  declared nodes:                │  live nodes:
       │  Team, Principle,               │  JiraIssue, Repo,
       │  AwsAccount, McpServer,         │  File/Module, Person
       │  ConfluenceSpace, JiraProject   │
       └────────────────┬────────────────┘
                         ▼
              conductor kg update
              (re-derives all edges
               from scratch, idempotent)
                         ▼
              .conductor/kg/ (embedded graph DB)
                         ▼
         conductor context <issue-key>
         (previews the subgraph an agent
          would see before dispatch)
```

Step by step, what `kg update` is designed to do (see
[knowledge-graph.md](knowledge-graph.md#conductor-kg-update) for the
authoritative version):

1. **Load the declared layer.** `loadKnowledgeGraphSource()` reads
   `.conductor/kg-source/`, resolving org → team → user principle
   inheritance and merging shared resources into each team (already
   implemented and tested — this part of the pipeline is real today,
   just not yet wired to a graph DB write).
2. **Pull the live layer, per team.** For each `ResolvedTeam`, query its
   `jira_projects[].jql` (via `JiraClient.search`, already implemented)
   and its `gitlab_repos`/`github_repos` (via the future `ScmClient` —
   not implemented yet, see [build-order.md](build-order.md)).
3. **Write nodes and edges.** Every declared and live entity becomes a
   node; relationships (`Team -[OWNS]-> Repo`, `JiraIssue -[TARGETS]->
   Repo`, `Principle -[APPLIES_TO]-> Team`, etc. — full list in
   [knowledge-graph.md](knowledge-graph.md)) become edges. This is a full
   rebuild every time, not an incremental patch — determinism over
   incremental-merge complexity.
4. **Serve context on demand.** `conductor context <issue-key>` (not yet
   implemented) will serialize the relevant subgraph — the target repo,
   its recent MRs/PRs, related past issues, module ownership, and the
   principles that apply to that team — into what an agent actually sees
   before `conductor pair`/`conductor run` dispatch it.

## How you'd form your own knowledge graph

1. **Copy the example.**
   ```bash
   cp -r .conductor/kg-source.example .conductor/kg-source
   ```
2. **Fill in `root.yml`**: your organization name, org-wide principles,
   any shared Confluence/Jira/AWS resources every team should inherit, and
   the list of team ids you're about to create.
3. **Write one `teams/<id>.yml` per team.** Each team owns its own file —
   no central approval step to add a team, just create the file and add
   its id to `root.yml`'s `teams:` list. Fill in only what's true for that
   team: its repos, its `ways_of_working` (structured fields for what's
   worth querying, `principles_doc` for everything else), its AWS
   accounts, the binaries its workflow needs, and its members' individual
   principles.
4. **Validate before you build anything.**
   ```bash
   conductor kg validate
   ```
   catches missing MCP-server env vars and missing binaries immediately,
   before those failures surface confusingly mid-`kg update` later.
5. **(Once implemented) build the graph:**
   ```bash
   conductor kg update
   conductor kg summary   # sanity-check what got indexed
   ```
6. **Iterate.** Add a repo, add a team, add a principle — it's all just
   editing YAML and re-running `kg validate`/`kg update`. Nothing here
   requires touching code; see [knowledge-graph-source.md](knowledge-graph-source.md)
   for the full field reference.
