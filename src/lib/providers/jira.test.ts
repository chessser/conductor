import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJiraClient } from './jira.ts';
import { startFakeJiraServer, type FakeJiraServer } from './jira.fake-server.ts';
import type { JiraIssueJson } from './jira-mapping.ts';

const SAMPLE_ISSUE: JiraIssueJson = {
  key: 'PROJ-1',
  fields: {
    summary: 'Add health-check endpoint',
    description: 'Standard health-check per template',
    issuetype: { name: 'Forge Task' },
    labels: ['status/ready', 'agent-type/claude', 'mode/background'],
  },
};

async function withServer(
  options: Parameters<typeof startFakeJiraServer>[0],
  fn: (server: FakeJiraServer) => Promise<void>,
): Promise<void> {
  const server = await startFakeJiraServer(options);
  try {
    await fn(server);
  } finally {
    await server.close();
  }
}

function clientFor(server: FakeJiraServer) {
  return createJiraClient({ baseUrl: server.url, email: 'bot@example.com', apiToken: 'fake-token' });
}

test('search maps every issue the fake server returns', async () => {
  await withServer({ issues: [SAMPLE_ISSUE] }, async (server) => {
    const client = clientFor(server);
    const tasks = await client.search('project = PROJ');
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.key, 'PROJ-1');
    assert.equal(tasks[0]?.labels.status, 'ready');

    const searchReq = server.requests.find((r) => r.path === '/rest/api/3/search/jql');
    assert.ok(searchReq);
    assert.equal((searchReq?.body as { jql: string }).jql, 'project = PROJ');
  });
});

test('get fetches and maps a single issue by key', async () => {
  await withServer({ issues: [SAMPLE_ISSUE] }, async (server) => {
    const client = clientFor(server);
    const task = await client.get('PROJ-1');
    assert.equal(task.title, 'Add health-check endpoint');
  });
});

test('get throws with a descriptive error on a 404', async () => {
  await withServer({ issues: [] }, async (server) => {
    const client = clientFor(server);
    await assert.rejects(() => client.get('PROJ-404'), /404/);
  });
});

test('setStatus replaces only the status/* label, preserving others', async () => {
  await withServer({ issues: [SAMPLE_ISSUE] }, async (server) => {
    const client = clientFor(server);
    await client.setStatus('PROJ-1', 'in-progress');

    const putReq = server.requests.find((r) => r.method === 'PUT');
    const labels = (putReq?.body as { fields: { labels: string[] } }).fields.labels;
    assert.ok(labels.includes('status/in-progress'));
    assert.ok(labels.includes('agent-type/claude'));
    assert.ok(!labels.includes('status/ready'));
  });
});

test('comment posts an ADF document containing the given text', async () => {
  await withServer({ issues: [SAMPLE_ISSUE] }, async (server) => {
    const client = clientFor(server);
    await client.comment('PROJ-1', 'Opened https://example.com/mr/1');

    const commentReq = server.requests.find((r) => r.path.endsWith('/comment'));
    assert.ok(commentReq);
    interface AdfComment {
      body: { content: Array<{ content: Array<{ text: string }> }> };
    }
    const text = (commentReq?.body as AdfComment).body.content[0]?.content[0]?.text;
    assert.equal(text, 'Opened https://example.com/mr/1');
  });
});
