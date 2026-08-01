import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeTaskIndex, loadTaskIndex } from './task-index.ts';
import type { ForgeTask } from '../types/task.ts';

function task(key: string): ForgeTask {
  return {
    key,
    issueType: 'Forge Task',
    title: key,
    summary: '',
    labels: { status: 'ready', hitlGate: 'none' },
    dependsOn: [],
  };
}

test('loadTaskIndex returns an empty map when no file exists yet', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-index-'));
  const index = loadTaskIndex(join(dir, 'tasks.json'));
  assert.equal(index.size, 0);
});

test('writeTaskIndex then loadTaskIndex round-trips, sorted by key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-index-'));
  const path = join(dir, 'nested', 'tasks.json');
  writeTaskIndex([task('B-2'), task('A-1')], path);

  const index = loadTaskIndex(path);
  assert.deepEqual([...index.keys()], ['A-1', 'B-2']);
});
