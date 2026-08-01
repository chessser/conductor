import type { ForgeTask, TaskStatus } from '../../types/task.ts';
import { mapJiraIssueToTask, replaceStatusLabel, type JiraIssueJson } from './jira-mapping.ts';

/**
 * Jira integration boundary. Design doc §1 recommends MCP servers where
 * available (e.g. an Atlassian MCP server) with a direct REST client as
 * fallback — this interface is intentionally transport-agnostic so either
 * backing implementation can satisfy it. `createJiraClient` below is the
 * REST fallback, speaking Jira Cloud's REST API v3 directly.
 */
export interface JiraClient {
  /** Search issues matching the configured JQL (design doc §4.3). */
  search(jql: string): Promise<ForgeTask[]>;
  /** Fetch a single issue by key. */
  get(key: string): Promise<ForgeTask>;
  /** Replaces the status/* label, mirroring this app's own status model (docs/jira-structure.md). */
  setStatus(key: string, status: TaskStatus): Promise<void>;
  /** Append a comment, e.g. linking the resulting MR/PR. */
  comment(key: string, body: string): Promise<void>;
}

export interface JiraClientOptions {
  baseUrl: string;
  email: string;
  apiToken: string;
  /** Injectable for tests — defaults to the global fetch. See jira.test.ts. */
  fetchImpl?: typeof fetch;
}

interface JiraSearchResponse {
  issues: JiraIssueJson[];
}

function authHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
}

async function requestJson<T>(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<T> {
  const res = await fetchImpl(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jira API ${init.method ?? 'GET'} ${url} -> ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const ISSUE_FIELDS = ['summary', 'description', 'issuetype', 'labels', 'issuelinks'];

/**
 * REST client against Jira Cloud API v3. Requires an API token — see
 * docs/testing.md for how to get a free one on a free-tier Atlassian site
 * for manual/local checks, and jira.fake-server.ts for the in-repo
 * stand-in used by CI so this client's behavior is verified without any
 * external account.
 */
export function createJiraClient(options: JiraClientOptions): JiraClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/$/, '');
  const headers = {
    Authorization: authHeader(options.email, options.apiToken),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  return {
    async search(jql: string): Promise<ForgeTask[]> {
      const data = await requestJson<JiraSearchResponse>(fetchImpl, `${base}/rest/api/3/search/jql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jql, fields: ISSUE_FIELDS, maxResults: 100 }),
      });
      return data.issues.map(mapJiraIssueToTask);
    },

    async get(key: string): Promise<ForgeTask> {
      const fieldsQuery = ISSUE_FIELDS.join(',');
      const issue = await requestJson<JiraIssueJson>(
        fetchImpl,
        `${base}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fieldsQuery}`,
        { method: 'GET', headers },
      );
      return mapJiraIssueToTask(issue);
    },

    async setStatus(key: string, status: TaskStatus): Promise<void> {
      const current = await requestJson<JiraIssueJson>(
        fetchImpl,
        `${base}/rest/api/3/issue/${encodeURIComponent(key)}?fields=labels`,
        { method: 'GET', headers },
      );
      const nextLabels = replaceStatusLabel(current.fields.labels ?? [], status);
      await requestJson(fetchImpl, `${base}/rest/api/3/issue/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ fields: { labels: nextLabels } }),
      });
    },

    async comment(key: string, body: string): Promise<void> {
      await requestJson(fetchImpl, `${base}/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          body: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
          },
        }),
      });
    },
  };
}
