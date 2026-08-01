import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ForgeTask } from '../types/task.ts';

/** .forge/tasks.json — derived, rebuildable, gitignored. Never the source of truth; Jira is. */
export function defaultTaskIndexPath(cwd: string = process.cwd()): string {
  return join(cwd, '.forge', 'tasks.json');
}

export function writeTaskIndex(tasks: ForgeTask[], path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const sorted = [...tasks].sort((a, b) => a.key.localeCompare(b.key));
  writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

export function loadTaskIndex(path: string): Map<string, ForgeTask> {
  if (!existsSync(path)) return new Map();
  const tasks = JSON.parse(readFileSync(path, 'utf8')) as ForgeTask[];
  return new Map(tasks.map((t) => [t.key, t]));
}
