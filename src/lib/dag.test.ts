import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCycle, dispatchableTasks, layerOrder } from './dag.ts';
import type { ForgeTask } from '../types/task.ts';

function task(key: string, dependsOn: string[] = [], status: ForgeTask['labels']['status'] = 'ready'): ForgeTask {
  return {
    key,
    issueType: 'Forge Task',
    title: key,
    summary: '',
    labels: { status, hitlGate: 'none', agentType: 'claude', mode: 'background' },
    dependsOn,
  };
}

test('findCycle returns [] for an acyclic graph', () => {
  const tasks = new Map([
    ['A', task('A')],
    ['B', task('B', ['A'])],
    ['C', task('C', ['B'])],
  ].map(([k, v]) => [k as string, v as ForgeTask]));
  assert.deepEqual(findCycle(tasks), []);
});

test('findCycle detects a direct cycle', () => {
  const tasks = new Map<string, ForgeTask>([
    ['A', task('A', ['B'])],
    ['B', task('B', ['A'])],
  ]);
  const cycle = findCycle(tasks);
  assert.ok(cycle.includes('A') && cycle.includes('B'));
});

test('dispatchableTasks filters on status/labels/deps', () => {
  const tasks = new Map<string, ForgeTask>([
    ['A', task('A', [], 'done')],
    ['B', task('B', ['A'], 'ready')],
    ['C', task('C', ['A'], 'draft')],
  ]);
  const ready = dispatchableTasks(tasks).map((t) => t.key);
  assert.deepEqual(ready, ['B']);
});

test('layerOrder groups into dependency layers', () => {
  const tasks = new Map<string, ForgeTask>([
    ['A', task('A')],
    ['B', task('B', ['A'])],
    ['C', task('C', ['A'])],
    ['D', task('D', ['B', 'C'])],
  ]);
  const layers = layerOrder(tasks, ['A', 'B', 'C', 'D']);
  assert.deepEqual(layers[0], ['A']);
  assert.deepEqual(new Set(layers[1]), new Set(['B', 'C']));
  assert.deepEqual(layers[2], ['D']);
});

test('layerOrder throws on an unresolved cycle', () => {
  const tasks = new Map<string, ForgeTask>([
    ['A', task('A', ['B'])],
    ['B', task('B', ['A'])],
  ]);
  assert.throws(() => layerOrder(tasks, ['A', 'B']));
});
