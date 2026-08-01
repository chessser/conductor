import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDispatchable, type ForgeTask } from './task.ts';

function baseTask(overrides: Partial<ForgeTask> = {}): ForgeTask {
  return {
    key: 'PROJ-1',
    issueType: 'Forge Task',
    title: 'Example',
    summary: '',
    labels: { status: 'ready', hitlGate: 'none', agentType: 'claude', mode: 'background' },
    dependsOn: [],
    ...overrides,
  };
}

test('not dispatchable when status is not ready', () => {
  const t = baseTask({ labels: { status: 'draft', hitlGate: 'none', agentType: 'claude', mode: 'background' } });
  assert.equal(isDispatchable(t, new Map()), false);
});

test('not dispatchable without agentType or mode', () => {
  const t = baseTask({ labels: { status: 'ready', hitlGate: 'none' } });
  assert.equal(isDispatchable(t, new Map()), false);
});

test('dispatchable when ready, labeled, and no dependencies', () => {
  const t = baseTask();
  assert.equal(isDispatchable(t, new Map()), true);
});

test('not dispatchable when a dependency is not done', () => {
  const dep = baseTask({ key: 'PROJ-2', labels: { status: 'in-progress', hitlGate: 'none' } });
  const t = baseTask({ dependsOn: ['PROJ-2'] });
  const all = new Map([[dep.key, dep], [t.key, t]]);
  assert.equal(isDispatchable(t, all), false);
});

test('dispatchable when all dependencies are done', () => {
  const dep = baseTask({ key: 'PROJ-2', labels: { status: 'done', hitlGate: 'none' } });
  const t = baseTask({ dependsOn: ['PROJ-2'] });
  const all = new Map([[dep.key, dep], [t.key, t]]);
  assert.equal(isDispatchable(t, all), true);
});
