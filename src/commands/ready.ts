import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';

export function registerReady(program: Command): void {
  program
    .command('ready')
    .description('List dispatchable tasks (label-gate satisfied), split foreground/background')
    .action(() => notImplemented('ready', 'docs/jira-structure.md §3.3, src/lib/dag.ts'));
}
