import type { Command } from 'commander';
import { loadConfig } from '../lib/config.ts';
import { createJiraClient } from '../lib/providers/jira.ts';
import { defaultTaskIndexPath, writeTaskIndex } from '../lib/task-index.ts';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. forge sync needs JIRA_EMAIL and JIRA_API_TOKEN in the environment ` +
        '— see docs/testing.md for how to get a free Jira Cloud API token.',
    );
  }
  return value;
}

export function registerSync(program: Command): void {
  program
    .command('sync')
    .description('Pull Jira issues matching the configured JQL into the local task index')
    .action(async () => {
      const config = loadConfig();
      if (!config.jira) {
        throw new Error('No `jira:` section in .forge/config.yml — see docs/repo-registry.md.');
      }

      const client = createJiraClient({
        baseUrl: config.jira.base_url,
        email: requireEnv('JIRA_EMAIL'),
        apiToken: requireEnv('JIRA_API_TOKEN'),
      });

      const tasks = await client.search(config.jira.jql);
      const path = defaultTaskIndexPath();
      writeTaskIndex(tasks, path);
      console.log(`Synced ${tasks.length} task(s) from Jira -> ${path}`);
    });
}
