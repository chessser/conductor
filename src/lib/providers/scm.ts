import type { RepoConfig } from '../../types/repo.ts';

export interface MergeRequestSummary {
  id: string;
  url: string;
  branch: string;
  title: string;
  ciStatus: 'pending' | 'passed' | 'failed';
  approved: boolean;
}

/**
 * Source-control boundary shared by GitLab and GitHub. Two repo providers
 * (design doc §5) means two implementations of this interface, not two
 * separate code paths through the rest of the app — every command above
 * should depend on this, never on `@gitbeaker` or `octokit` directly.
 */
export interface ScmClient {
  openMergeRequest(repo: RepoConfig, branch: string, title: string, body: string): Promise<MergeRequestSummary>;
  listOpenMergeRequests(repo: RepoConfig): Promise<MergeRequestSummary[]>;
  /** Labels only — mr-poll never calls a merge endpoint. See docs/human-in-the-loop.md. */
  addLabel(repo: RepoConfig, mrId: string, label: string): Promise<void>;
}

export function createScmClient(repo: RepoConfig): ScmClient {
  throw new Error(
    `createScmClient is not implemented yet (provider: ${repo.provider}) — wire this to ` +
      'GitLab/GitHub MCP servers or @gitbeaker/octokit per docs/build-order.md.',
  );
}
