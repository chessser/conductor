import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';

export function registerRun(program: Command): void {
  program
    .command('run [issueKey]')
    .description(
      'Background: unattended dispatch in an isolated git worktree. ' +
        'Omit issueKey with --all to dispatch everything currently ready, within cost/concurrency caps.',
    )
    .option('--all', 'dispatch every ready task, respecting headroom')
    .action((issueKey: string | undefined) =>
      notImplemented(issueKey ? `run ${issueKey}` : 'run --all', 'docs/build-order.md (step 5), docs/cost-and-concurrency.md'),
    );
}
