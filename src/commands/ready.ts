import type { Command } from 'commander';
import { dispatchableTasks } from '../lib/dag.ts';
import { defaultTaskIndexPath, loadTaskIndex } from '../lib/task-index.ts';

export function registerReady(program: Command): void {
  program
    .command('ready')
    .description('List dispatchable tasks (label-gate satisfied), split foreground/background')
    .action(() => {
      const tasks = loadTaskIndex(defaultTaskIndexPath());
      if (tasks.size === 0) {
        console.log('No tasks in the local index yet — run `conductor sync` first.');
        return;
      }

      const ready = dispatchableTasks(tasks);
      const foreground = ready.filter((t) => t.labels.mode === 'foreground');
      const background = ready.filter((t) => t.labels.mode === 'background');

      const printGroup = (label: string, group: typeof ready) => {
        console.log(`\n${label} (${group.length})`);
        for (const t of group) console.log(`  ${t.key}  ${t.title}`);
      };

      if (ready.length === 0) {
        console.log('Nothing dispatchable right now.');
        return;
      }
      printGroup('Foreground (pair)', foreground);
      printGroup('Background (run)', background);
    });
}
