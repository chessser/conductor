import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { JiraClient } from '../lib/providers/jira.ts';
import type { KnowledgeGraphSource } from '../types/kg-source.ts';
import { getTeam, listTeams, searchPrinciples, allowedProjectKeys } from '../lib/kg-query.ts';
import { WriteGuard } from './write-guard.ts';

export interface BuildMcpServerOptions {
  source: KnowledgeGraphSource;
  jiraClient: JiraClient;
  /** The identity making writes — compared against an issue's assignee for the mismatch warning. */
  actingEmail?: string;
}

function textResult(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

const STATUS_VALUES = ['draft', 'triaged', 'ready', 'in-progress', 'review', 'blocked', 'done'] as const;

/**
 * Builds (but does not connect) the MCP server exposing team knowledge
 * (docs/knowledge-graph-source.md) and guarded Jira read/write tools
 * (docs/mcp-server.md) to any MCP client — Claude Code, primarily.
 *
 * Kept transport-agnostic on purpose: `registerMcpServer`
 * (src/commands/mcp-server.ts) is the only place that decides *how*
 * clients connect (stdio today). This function and the tool handlers
 * inside it are the only parts worth unit testing without a live
 * transport — but they call out to a live JiraClient, so per this
 * project's established split (docs/testing.md), they're validated by
 * running the server for real, not mocked here.
 */
export function buildMcpServer(options: BuildMcpServerOptions): McpServer {
  const { source, jiraClient, actingEmail } = options;
  const guard = new WriteGuard(allowedProjectKeys(source));

  const server = new McpServer({ name: 'conductor', version: '0.1.0' });

  server.tool('kg_list_teams', 'List every team declared in the knowledge-graph source', {}, async () =>
    textResult(listTeams(source)),
  );

  server.tool(
    'kg_get_team',
    "Get a team's full resolved context: principles (org/team/user), ways of working, repos, AWS accounts, MCP servers",
    { teamId: z.string() },
    async ({ teamId }) => {
      const team = getTeam(source, teamId);
      if (!team) return textResult({ error: `No team "${teamId}". Call kg_list_teams for valid ids.` });
      return textResult(team);
    },
  );

  server.tool(
    'kg_search_principles',
    'Search org, team, and user-level principles by keyword',
    { query: z.string() },
    async ({ query }) => textResult(searchPrinciples(source, query)),
  );

  server.tool(
    'jira_search',
    'Search Jira issues in an allowed project. jql is ANDed with "project = <projectKey>".',
    { projectKey: z.string(), jql: z.string().optional() },
    async ({ projectKey, jql }) => {
      if (!guard.isProjectAllowed(projectKey)) {
        return textResult({ error: `Project "${projectKey}" is not declared in any team's jira_projects.` });
      }
      const fullJql = jql ? `project = ${projectKey} AND (${jql})` : `project = ${projectKey}`;
      return textResult(await jiraClient.search(fullJql));
    },
  );

  server.tool('jira_get_issue', 'Fetch a single Jira issue by key', { issueKey: z.string() }, async ({ issueKey }) => {
    const projectKey = WriteGuard.projectKeyOf(issueKey);
    if (!guard.isProjectAllowed(projectKey)) {
      return textResult({ error: `Project "${projectKey}" is not declared in any team's jira_projects.` });
    }
    return textResult(await jiraClient.get(issueKey));
  });

  async function assigneeWarningFor(issueKey: string): Promise<string | undefined> {
    if (!actingEmail) return undefined;
    const issue = await jiraClient.get(issueKey).catch(() => undefined);
    if (issue?.assignee && issue.assignee !== actingEmail) {
      return `Assigned to ${issue.assignee}, not ${actingEmail} — confirm this is intentional.`;
    }
    return undefined;
  }

  server.tool(
    'jira_propose_comment',
    'Propose a comment on an issue. Returns a token; call jira_confirm_write to actually post it.',
    { issueKey: z.string(), body: z.string() },
    async ({ issueKey, body }) => {
      const projectKey = WriteGuard.projectKeyOf(issueKey);
      const warning = await assigneeWarningFor(issueKey);
      const proposal = guard.propose('comment', projectKey, { issueKey, body }, `Comment on ${issueKey}: "${body}"`, warning);
      return textResult(proposal);
    },
  );

  server.tool(
    'jira_propose_status_change',
    'Propose replacing the status/* label on an issue. Returns a token; call jira_confirm_write to apply it.',
    { issueKey: z.string(), status: z.enum(STATUS_VALUES) },
    async ({ issueKey, status }) => {
      const projectKey = WriteGuard.projectKeyOf(issueKey);
      const warning = await assigneeWarningFor(issueKey);
      const proposal = guard.propose(
        'status_change',
        projectKey,
        { issueKey, status },
        `Set ${issueKey} status to "${status}"`,
        warning,
      );
      return textResult(proposal);
    },
  );

  server.tool(
    'jira_propose_create_issue',
    'Propose creating a new issue. Returns a token; call jira_confirm_write to actually create it. There is no delete tool — issues can only be created or updated, never removed, through this server.',
    {
      projectKey: z.string(),
      issueType: z.string(),
      summary: z.string(),
      description: z.string().optional(),
      labels: z.array(z.string()).optional(),
    },
    async ({ projectKey, issueType, summary, description, labels }) => {
      const proposal = guard.propose(
        'create_issue',
        projectKey,
        { projectKey, issueType, summary, description, labels },
        `Create ${issueType} in ${projectKey}: "${summary}"`,
      );
      return textResult(proposal);
    },
  );

  server.tool(
    'jira_confirm_write',
    'Executes a previously proposed write (comment, status change, or issue creation) by its token. Single-use; expires after 10 minutes.',
    { token: z.string() },
    async ({ token }) => {
      const proposal = guard.consume(token);
      if (!proposal) return textResult({ error: 'Unknown or expired token. Propose the write again.' });

      switch (proposal.kind) {
        case 'comment': {
          const { issueKey, body } = proposal.payload as { issueKey: string; body: string };
          await jiraClient.comment(issueKey, body);
          return textResult({ done: true, issueKey });
        }
        case 'status_change': {
          const { issueKey, status } = proposal.payload as { issueKey: string; status: (typeof STATUS_VALUES)[number] };
          await jiraClient.setStatus(issueKey, status);
          return textResult({ done: true, issueKey, status });
        }
        case 'create_issue': {
          const task = await jiraClient.createIssue(
            proposal.payload as Parameters<JiraClient['createIssue']>[0],
          );
          return textResult({ done: true, created: task });
        }
      }
    },
  );

  return server;
}
