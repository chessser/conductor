#!/usr/bin/env node
import { Command } from 'commander';
import { loadEnvFile } from './lib/env.ts';
import { registerSync } from './commands/sync.ts';
import { registerKg } from './commands/kg.ts';
import { registerContext } from './commands/context.ts';
import { registerReady } from './commands/ready.ts';
import { registerMcpServer } from './commands/mcp-server.ts';

// Load .env before any command runs, so JIRA_EMAIL/JIRA_API_TOKEN etc. are
// available without the user having to `export` them by hand. Never
// overwrites a variable already set in the shell/CI — see src/lib/env.ts.
loadEnvFile();

const program = new Command();

program
  .name('conductor')
  .description(
    'Local MCP server exposing team knowledge (org/team/user principles, ' +
      'repos, infra) and guarded Jira read/write tools to Claude Code — see ' +
      'docs/ for the full design, docs/mcp-server.md for the tool surface.',
  )
  .version('0.1.0');

registerSync(program);
registerKg(program);
registerContext(program);
registerReady(program);
registerMcpServer(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
