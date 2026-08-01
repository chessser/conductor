import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ConductorTask } from '../types/task.ts';

/** .conductor/tasks.json — derived, rebuildable, gitignored. Never the source of truth; Jira is. */
export function defaultTaskIndexPath(cwd: string = process.cwd()): string {
  return join(cwd, '.conductor', 'tasks.json');
}

export function writeTaskIndex(tasks: ConductorTask[], path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const sorted = [...tasks].sort((a, b) => a.key.localeCompare(b.key));
  writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

export function loadTaskIndex(path: string): Map<string, ConductorTask> {
  if (!existsSync(path)) return new Map();
  const tasks = JSON.parse(readFileSync(path, 'utf8')) as ConductorTask[];
  return new Map(tasks.map((t) => [t.key, t]));
}
