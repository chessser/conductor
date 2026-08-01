import type { ForgeTask } from '../../types/task.ts';

/**
 * Jira integration boundary. Design doc §1 recommends MCP servers where
 * available (e.g. an Atlassian MCP server) with a direct REST client as
 * fallback — this interface is intentionally transport-agnostic so either
 * backing implementation can satisfy it.
 */
export interface JiraClient {
  /** Search issues matching the configured JQL (design doc §4.3). */
  search(jql: string): Promise<ForgeTask[]>;
  /** Fetch a single issue by key. */
  get(key: string): Promise<ForgeTask>;
  /** Set the status/* label transition, mirroring Jira's own status field. */
  setStatus(key: string, status: ForgeTask['labels']['status']): Promise<void>;
  /** Append a comment, e.g. linking the resulting MR/PR. */
  comment(key: string, body: string): Promise<void>;
}

export function createJiraClient(_baseUrl: string): JiraClient {
  throw new Error(
    'createJiraClient is not implemented yet — wire this to an Atlassian MCP server or ' +
      'a REST client (e.g. jira.js) per docs/build-order.md (step 1).',
  );
}
