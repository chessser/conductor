# Human-in-the-loop gates

This is the explicit list. Every one of these is a deliberate design
decision, not an oversight to "optimize away" later — if a future change
proposes removing or automating one of these for efficiency, that's a sign
to stop and reconsider, not a green light.

1. **Request → Task/Ordered-Task decomposition.** `conductor triage` may
   *suggest* a decomposition of a `Conductor Request` into a `Conductor Task` or a
   `Conductor Ordered Task` with sub-tasks, but a human must confirm before
   anything is actually created or linked in Jira.

2. **`status/ready`.** Never set automatically by `conductor sync` or
   `conductor kg update` — always a deliberate human (or explicitly-delegated
   team-lead) action. Setting `agent-type`/`mode` labels early does not
   imply readiness; see [jira-structure.md](jira-structure.md).

3. **`hitl-gate/design`** (optional, per-issue). If set, dispatch is
   blocked until a separate "design approved" flag or comment is present —
   for tasks where the shape of the change itself needs sign-off before an
   agent starts writing code.

4. **MR/PR approval.** `conductor mr-poll` only ever labels and reports — it
   flips Jira status and adds a `ready-for-review` label when CI is green,
   and comments/flags on failure. **It never merges, and never retries a
   failing pipeline automatically.** A human clicks merge in GitLab/GitHub.
   A broken pipeline is a stop-and-look situation.

If you're implementing `conductor mr-poll` or `conductor run`, treat these four
gates as invariants to preserve, not defaults to work around.
