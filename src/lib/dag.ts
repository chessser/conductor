import type { ConductorTask } from '../types/task.ts';
import { isDispatchable } from '../types/task.ts';

export interface DagError {
  key: string;
  reason: string;
}

/**
 * Detects cycles in the dependsOn graph. Returns the keys involved in the
 * first cycle found, or an empty array if the graph is acyclic.
 */
export function findCycle(tasks: ReadonlyMap<string, ConductorTask>): string[] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const path: string[] = [];

  function visit(key: string): string[] | null {
    color.set(key, GRAY);
    path.push(key);
    const task = tasks.get(key);
    for (const dep of task?.dependsOn ?? []) {
      const depColor = color.get(dep) ?? WHITE;
      if (depColor === GRAY) {
        const cycleStart = path.indexOf(dep);
        return path.slice(cycleStart);
      }
      if (depColor === WHITE && tasks.has(dep)) {
        const found = visit(dep);
        if (found) return found;
      }
    }
    path.pop();
    color.set(key, BLACK);
    return null;
  }

  for (const key of tasks.keys()) {
    if ((color.get(key) ?? WHITE) === WHITE) {
      const cycle = visit(key);
      if (cycle) return cycle;
    }
  }
  return [];
}

/** All tasks currently dispatchable, given the full task set (design doc §3.3). */
export function dispatchableTasks(tasks: ReadonlyMap<string, ConductorTask>): ConductorTask[] {
  return [...tasks.values()].filter((t) => isDispatchable(t, tasks));
}

/**
 * Given a Conductor Ordered Task's sub-task keys, returns them grouped into
 * dependency layers (layer 0 has no unfinished deps within the set, layer 1
 * depends only on layer 0, etc). Used to preview execution order before
 * dispatch; not itself a scheduler.
 */
export function layerOrder(tasks: ReadonlyMap<string, ConductorTask>, subtaskKeys: string[]): string[][] {
  const remaining = new Set(subtaskKeys);
  const done = new Set<string>();
  const layers: string[][] = [];

  while (remaining.size > 0) {
    const layer = [...remaining].filter((key) => {
      const deps = tasks.get(key)?.dependsOn ?? [];
      return deps.every((d) => !remaining.has(d) || done.has(d));
    });
    if (layer.length === 0) {
      throw new Error(`layerOrder: unresolved dependency cycle among ${[...remaining].join(', ')}`);
    }
    layers.push(layer);
    for (const key of layer) {
      remaining.delete(key);
      done.add(key);
    }
  }
  return layers;
}
