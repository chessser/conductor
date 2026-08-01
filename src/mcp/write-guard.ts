import { randomUUID } from 'node:crypto';

/**
 * Enforces this project's write-access policy for MCP tools that touch
 * Jira (docs/mcp-server.md): every write is proposed first (validated,
 * previewed, given a single-use token) and only takes effect on a
 * separate confirm call with that token — mirroring the human-in-the-loop
 * gates the rest of this project already commits to (docs/human-in-the-loop.md),
 * just enforced at the tool-call layer instead of a CLI command.
 *
 * No delete operation is modeled anywhere in this file, or in the Jira
 * client it guards — that's a deliberate omission, not an oversight. See
 * docs/mcp-server.md's "Guardrails" section.
 */
export type ProposalKind = 'create_issue' | 'comment' | 'status_change';

export interface Proposal<TPayload = unknown> {
  token: string;
  kind: ProposalKind;
  projectKey: string;
  payload: TPayload;
  preview: string;
  createdAt: number;
  expiresAt: number;
  /** Set when the target issue's assignee doesn't match the acting identity — surfaced, never silently overridden. */
  assigneeWarning?: string;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export class WriteGuard {
  private readonly proposals = new Map<string, Proposal>();
  private readonly allowedProjectKeys: ReadonlySet<string>;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(allowedProjectKeys: readonly string[], options: { ttlMs?: number; now?: () => number } = {}) {
    this.allowedProjectKeys = new Set(allowedProjectKeys);
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  /** True only for project keys declared in a team's kg-source jira_projects — see docs/mcp-server.md. */
  isProjectAllowed(projectKey: string): boolean {
    return this.allowedProjectKeys.has(projectKey);
  }

  /** Extracts the project key from an issue key like "PROJ-123" -> "PROJ". */
  static projectKeyOf(issueKey: string): string {
    return issueKey.split('-')[0] ?? issueKey;
  }

  propose<TPayload>(
    kind: ProposalKind,
    projectKey: string,
    payload: TPayload,
    preview: string,
    assigneeWarning?: string,
  ): Proposal<TPayload> {
    if (!this.isProjectAllowed(projectKey)) {
      throw new Error(
        `Project "${projectKey}" is not in the allowed project list for this MCP server. ` +
          'Add it to a team\'s jira_projects in .conductor/kg-source/ if this is intentional.',
      );
    }
    const now = this.now();
    const proposal: Proposal<TPayload> = {
      token: randomUUID(),
      kind,
      projectKey,
      payload,
      preview,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      ...(assigneeWarning !== undefined && { assigneeWarning }),
    };
    this.proposals.set(proposal.token, proposal as Proposal);
    return proposal;
  }

  /** Consumes (single-use) and returns the proposal for `token`, or null if unknown/expired. */
  consume(token: string): Proposal | null {
    const proposal = this.proposals.get(token);
    if (!proposal) return null;
    this.proposals.delete(token);
    if (proposal.expiresAt < this.now()) return null;
    return proposal;
  }

  /** For diagnostics/tests — does not consume. */
  peek(token: string): Proposal | null {
    return this.proposals.get(token) ?? null;
  }
}
