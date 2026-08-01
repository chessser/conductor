import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WriteGuard } from './write-guard.ts';

test('projectKeyOf splits "PROJ-123" into "PROJ"', () => {
  assert.equal(WriteGuard.projectKeyOf('PROJ-123'), 'PROJ');
});

test('isProjectAllowed reflects the configured allowlist', () => {
  const guard = new WriteGuard(['PAY']);
  assert.equal(guard.isProjectAllowed('PAY'), true);
  assert.equal(guard.isProjectAllowed('OTHER'), false);
});

test('propose throws for a project not in the allowlist', () => {
  const guard = new WriteGuard(['PAY']);
  assert.throws(() => guard.propose('comment', 'OTHER', { body: 'x' }, 'preview'), /not in the allowed project list/);
});

test('propose then consume returns the same payload exactly once', () => {
  const guard = new WriteGuard(['PAY']);
  const proposal = guard.propose('comment', 'PAY', { body: 'hello' }, 'Comment on PAY-1: hello');

  const consumed = guard.consume(proposal.token);
  assert.deepEqual(consumed?.payload, { body: 'hello' });

  const second = guard.consume(proposal.token);
  assert.equal(second, null);
});

test('consume returns null for an unknown token', () => {
  const guard = new WriteGuard(['PAY']);
  assert.equal(guard.consume('not-a-real-token'), null);
});

test('consume returns null once the proposal has expired', () => {
  let time = 1_000_000;
  const guard = new WriteGuard(['PAY'], { ttlMs: 1000, now: () => time });
  const proposal = guard.propose('comment', 'PAY', {}, 'preview');

  time += 2000; // past expiry
  assert.equal(guard.consume(proposal.token), null);
});

test('propose carries an assigneeWarning through to the proposal when given', () => {
  const guard = new WriteGuard(['PAY']);
  const proposal = guard.propose('status_change', 'PAY', { status: 'ready' }, 'preview', 'Assigned to bob, not you');
  assert.equal(proposal.assigneeWarning, 'Assigned to bob, not you');
});

test('propose omits assigneeWarning when not given', () => {
  const guard = new WriteGuard(['PAY']);
  const proposal = guard.propose('status_change', 'PAY', { status: 'ready' }, 'preview');
  assert.equal('assigneeWarning' in proposal, false);
});
