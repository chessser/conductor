import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';

export function registerSync(program: Command): void {
  program
    .command('sync')
    .description('Pull Jira issues matching the configured JQL into the local task index')
    .action(() => notImplemented('sync', 'docs/build-order.md (step 1)'));
}
