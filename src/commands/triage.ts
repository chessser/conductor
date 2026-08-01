import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';

export function registerTriage(program: Command): void {
  program
    .command('triage')
    .description(
      'Walk un-triaged Forge Requests and assist decomposition into Forge Task / ' +
        'Forge Ordered Task. Always ends with a human confirming before Jira is written to.',
    )
    .action(() => notImplemented('triage', 'docs/jira-structure.md §3.1, docs/build-order.md (step 7)'));
}
