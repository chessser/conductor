import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';

export function registerPair(program: Command): void {
  program
    .command('pair <issueKey>')
    .description('Foreground: live paired session with the agent, via the Claude Agent SDK')
    .action((issueKey: string) => notImplemented(`pair ${issueKey}`, 'docs/build-order.md (step 4)'));
}
