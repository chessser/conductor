import type { Command } from 'commander';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { defaultKgSourceDir, loadKnowledgeGraphSource } from '../lib/kg-source.ts';
import { createJiraClient } from '../lib/providers/jira.ts';
import { buildMcpServer } from '../mcp/server.ts';

export function registerMcpServer(program: Command): void {
  program
    .command('mcp-server')
    .description('Start the local MCP server (stdio) exposing team knowledge and guarded Jira tools — see docs/mcp-server.md')
    .option('--dir <path>', 'knowledge-graph source directory (default: .conductor/kg-source)')
    .action(async (options: { dir?: string }) => {
      const source = loadKnowledgeGraphSource(options.dir ? options.dir : defaultKgSourceDir());

      const jiraProject = [...source.teams.values()].flatMap((t) => t.jiraProjects)[0];
      if (!jiraProject) {
        throw new Error('No jira_projects declared anywhere in .conductor/kg-source/ — jira_* tools need at least one.');
      }
      const jiraEmail = process.env.JIRA_EMAIL;
      const jiraApiToken = process.env.JIRA_API_TOKEN;
      if (!jiraEmail || !jiraApiToken) {
        throw new Error('JIRA_EMAIL and JIRA_API_TOKEN must be set — see docs/how-it-works.md#credentials.');
      }

      const jiraClient = createJiraClient({ baseUrl: jiraProject.baseUrl, email: jiraEmail, apiToken: jiraApiToken });
      const server = buildMcpServer({ source, jiraClient, actingEmail: jiraEmail });

      const transport = new StdioServerTransport();
      await server.connect(transport);
      // Intentionally never resolves further — the process stays alive
      // for as long as the MCP client (Claude Code) keeps the stdio pipe
      // open, and exits when it closes. No polling loop of our own.
    });
}
