import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnvFile, loadEnvFile } from './env.ts';

test('parseEnvFile reads KEY=value pairs, skipping blanks and comments', () => {
  const result = parseEnvFile(['# a comment', '', 'FOO=bar', 'BAZ=qux'].join('\n'));
  assert.deepEqual(result, { FOO: 'bar', BAZ: 'qux' });
});

test('parseEnvFile strips matching surrounding quotes', () => {
  const result = parseEnvFile('A="quoted"\nB=\'single\'\nC=unquoted');
  assert.deepEqual(result, { A: 'quoted', B: 'single', C: 'unquoted' });
});

test('parseEnvFile ignores lines with no "="', () => {
  const result = parseEnvFile('not-a-valid-line\nFOO=bar');
  assert.deepEqual(result, { FOO: 'bar' });
});

test('loadEnvFile does nothing when the file does not exist', () => {
  const target: NodeJS.ProcessEnv = {};
  loadEnvFile('/nonexistent/.env', target);
  assert.deepEqual(target, {});
});

test('loadEnvFile sets unset variables from the file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'env-'));
  const path = join(dir, '.env');
  writeFileSync(path, 'JIRA_EMAIL=me@example.com\nJIRA_API_TOKEN=secret\n', 'utf8');

  const target: NodeJS.ProcessEnv = {};
  loadEnvFile(path, target);
  assert.equal(target.JIRA_EMAIL, 'me@example.com');
  assert.equal(target.JIRA_API_TOKEN, 'secret');
});

test('loadEnvFile never overwrites a variable already set in the target', () => {
  const dir = mkdtempSync(join(tmpdir(), 'env-'));
  const path = join(dir, '.env');
  writeFileSync(path, 'JIRA_EMAIL=from-file@example.com\n', 'utf8');

  const target: NodeJS.ProcessEnv = { JIRA_EMAIL: 'from-shell@example.com' };
  loadEnvFile(path, target);
  assert.equal(target.JIRA_EMAIL, 'from-shell@example.com');
});
