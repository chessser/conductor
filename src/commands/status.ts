import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Dashboard: in-progress/review/blocked tasks, cost so far')
    .action(() => notImplemented('status', 'docs/cost-and-concurrency.md'));
}
