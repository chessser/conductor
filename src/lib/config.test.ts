import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, repoRegistry } from './config.ts';

function writeTempConfig(yaml: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'conductor-config-'));
  const path = join(dir, 'config.yml');
  writeFileSync(path, yaml, 'utf8');
  return path;
}

test('loadConfig parses repos and defaults default_branch/modules', () => {
  const path = writeTempConfig(`
repos:
  - id: payments-api
    provider: gitlab
    project: mygroup/payments-api
`);
  const config = loadConfig(path);
  assert.equal(config.repos.length, 1);
  assert.equal(config.repos[0]?.defaultBranch, 'main');
  assert.deepEqual(config.repos[0]?.modules, []);
});

test('repoRegistry returns the parsed repo list', () => {
  const path = writeTempConfig(`
repos:
  - id: a
    provider: github
    project: org/a
    default_branch: trunk
    modules: [src/x]
`);
  const registry = repoRegistry(loadConfig(path));
  assert.equal(registry[0]?.id, 'a');
  assert.equal(registry[0]?.defaultBranch, 'trunk');
});

test('loadConfig throws with a helpful message when the file is missing', () => {
  assert.throws(() => loadConfig('/nonexistent/path/config.yml'), /No conductor config found/);
});
