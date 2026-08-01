#!/usr/bin/env node
import { Command } from 'commander';
import { registerSync } from './commands/sync.ts';
import { registerKg } from './commands/kg.ts';
import { registerContext } from './commands/context.ts';
import { registerReady } from './commands/ready.ts';
import { registerTriage } from './commands/triage.ts';
import { registerPair } from './commands/pair.ts';
import { registerRun } from './commands/run.ts';
import { registerStatus } from './commands/status.ts';
import { registerMrPoll } from './commands/mr-poll.ts';

const program = new Command();

program
  .name('conductor')
  .description(
    'Jira-driven agentic orchestrator. Turns Jira issues into agent-executed ' +
      'changes across GitLab/GitHub repos, gated by human review at every ' +
      'merge. See docs/ for the full design.',
  )
  .version('0.1.0');

registerSync(program);
registerKg(program);
registerContext(program);
registerReady(program);
registerTriage(program);
registerPair(program);
registerRun(program);
registerStatus(program);
registerMrPoll(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
