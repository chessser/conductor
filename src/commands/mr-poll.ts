import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';

export function registerMrPoll(program: Command): void {
  program
    .command('mr-poll')
    .description(
      'Poll open MRs/PRs, flip Jira status, label ready-for-review. ' +
        'Never merges — see docs/human-in-the-loop.md.',
    )
    .action(() => notImplemented('mr-poll', 'docs/human-in-the-loop.md, docs/build-order.md (step 6)'));
}
