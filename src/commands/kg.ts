import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';

export function registerKg(program: Command): void {
  const kg = program.command('kg').description('Local knowledge graph — see docs/knowledge-graph.md');

  kg.command('update')
    .description('Rebuild the local knowledge graph from Jira + repo metadata')
    .option('--repos <ids>', 'comma-separated repo ids to scope the rebuild to')
    .option('--since <duration>', 'only consider activity in this window, e.g. 30d')
    .action(() => notImplemented('kg update', 'docs/knowledge-graph.md, docs/build-order.md (step 3)'));

  kg.command('summary')
    .description('Human-readable dump of what is currently indexed')
    .action(() => notImplemented('kg summary', 'docs/knowledge-graph.md'));
}
