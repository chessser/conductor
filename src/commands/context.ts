import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';

export function registerContext(program: Command): void {
  program
    .command('context <issueKey>')
    .description('Preview the knowledge-graph context an agent would see for this issue')
    .action((issueKey: string) => notImplemented(`context ${issueKey}`, 'docs/knowledge-graph.md §4.4'));
}
