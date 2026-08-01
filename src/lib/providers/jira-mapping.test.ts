import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapJiraIssueToTask, replaceStatusLabel, type JiraIssueJson } from './jira-mapping.ts';

function issue(overrides: Partial<JiraIssueJson['fields']> = {}, key = 'PROJ-1'): JiraIssueJson {
  return {
    key,
    fields: {
      summary: 'Example issue',
      description: 'Some description',
      issuetype: { name: 'Conductor Task' },
      labels: [],
      ...overrides,
    },
  };
}

test('maps basic fields', () => {
  const task = mapJiraIssueToTask(issue());
  assert.equal(task.key, 'PROJ-1');
  assert.equal(task.issueType, 'Conductor Task');
  assert.equal(task.title, 'Example issue');
  assert.equal(task.summary, 'Some description');
});

test('defaults status to draft and hitlGate to none with no labels', () => {
  const task = mapJiraIssueToTask(issue({ labels: [] }));
  assert.equal(task.labels.status, 'draft');
  assert.equal(task.labels.hitlGate, 'none');
  assert.equal(task.labels.agentType, undefined);
  assert.equal(task.labels.mode, undefined);
});

test('reads status/agent-type/mode/hitl-gate labels', () => {
  const task = mapJiraIssueToTask(
    issue({ labels: ['status/ready', 'agent-type/claude', 'mode/background', 'hitl-gate/design', 'unrelated'] }),
  );
  assert.deepEqual(task.labels, {
    status: 'ready',
    hitlGate: 'design',
    agentType: 'claude',
    mode: 'background',
  });
});

test('ignores an unrecognized status label value', () => {
  const task = mapJiraIssueToTask(issue({ labels: ['status/not-a-real-status'] }));
  assert.equal(task.labels.status, 'draft');
});

test('unknown issuetype.name falls back to Conductor Request', () => {
  const task = mapJiraIssueToTask(issue({ issuetype: { name: 'Bug' } }));
  assert.equal(task.issueType, 'Conductor Request');
});

test('dependsOn comes only from "is blocked by" inward links', () => {
  const task = mapJiraIssueToTask(
    issue({
      issuelinks: [
        {
          type: { inward: 'is blocked by', outward: 'blocks' },
          inwardIssue: { key: 'PROJ-2' },
        },
        {
          type: { inward: 'is blocked by', outward: 'blocks' },
          outwardIssue: { key: 'PROJ-3' }, // outward edge from this issue's perspective — not a dependency
        },
      ],
    }),
  );
  assert.deepEqual(task.dependsOn, ['PROJ-2']);
});

test('replaceStatusLabel swaps the status/* label and preserves others', () => {
  const result = replaceStatusLabel(['agent-type/claude', 'status/draft', 'mode/background'], 'ready');
  assert.deepEqual(result.sort(), ['agent-type/claude', 'mode/background', 'status/ready'].sort());
});

test('replaceStatusLabel adds the status label when none was present', () => {
  const result = replaceStatusLabel(['agent-type/claude'], 'ready');
  assert.deepEqual(result.sort(), ['agent-type/claude', 'status/ready'].sort());
});
