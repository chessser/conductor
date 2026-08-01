import type { RepoConfig } from './repo.ts';

/**
 * A single stated principle, at org, team, or user level. `doc` points at
 * the fuller write-up (Confluence, markdown, whatever) — the statement
 * here is the queryable summary, not a replacement for it. See
 * docs/knowledge-graph-source.md.
 */
export interface Principle {
  id: string;
  statement: string;
  doc?: string | undefined;
}

export interface ConfluenceSpace {
  id: string;
  baseUrl: string;
  spaceKey: string;
}

export interface JiraProject {
  id: string;
  baseUrl: string;
  projectKey: string;
  jql?: string | undefined;
}

export interface AwsAccount {
  id: string;
  accountId: string;
  roleArn?: string | undefined;
  regions: string[];
  /**
   * Named permission sets this account needs, not raw IAM policy JSON —
   * `conductor kg validate` checks presence/shape, not full policy
   * semantics. See docs/knowledge-graph-source.md.
   */
  requiredPermissions: string[];
}

export interface BinaryRequirement {
  name: string;
  minVersion?: string | undefined;
}

export interface PermissionNeed {
  /** e.g. "gitlab:payments-api" or "aws:payments-prod" — resource kind:id. */
  resource: string;
  scope: string[];
}

export interface McpServerRequirement {
  id: string;
  package: string;
  requiredEnv: string[];
}

export interface Member {
  id: string;
  name?: string | undefined;
  role?: string | undefined;
  principles: Principle[];
}

export interface WaysOfWorking {
  branchStrategy?: 'trunk-based' | 'gitflow' | 'github-flow' | undefined;
  mergeStrategy?: 'squash' | 'merge' | 'rebase' | undefined;
  requiresReview?: boolean | undefined;
  minApprovals?: number | undefined;
  ciRequired?: boolean | undefined;
  deployCadence?: 'continuous' | 'daily' | 'weekly' | 'on-demand' | undefined;
  commsChannel?: string | undefined;
  /** Pointer to the fuller prose doc for whatever doesn't fit a structured field. */
  principlesDoc?: string | undefined;
}

/** Parsed contents of root.yml — org-wide principles and shared resources. */
export interface RootSource {
  version: number;
  organization: string;
  principles: Principle[];
  sharedResources: {
    confluence: ConfluenceSpace[];
    jira: JiraProject[];
    awsAccounts: AwsAccount[];
  };
  mcpServers: McpServerRequirement[];
  /** Team ids; each resolves to teams/<id>.yml relative to root.yml. */
  teams: string[];
}

/** Parsed contents of one teams/<id>.yml file. */
export interface TeamSource {
  id: string;
  displayName: string;
  principles: Principle[];
  waysOfWorking: WaysOfWorking;
  confluenceSpaces: ConfluenceSpace[];
  jiraProjects: JiraProject[];
  gitlabRepos: RepoConfig[];
  githubRepos: RepoConfig[];
  awsAccounts: AwsAccount[];
  binariesNeeded: BinaryRequirement[];
  permissionsNeeded: PermissionNeed[];
  mcpServers: McpServerRequirement[];
  members: Member[];
}

/**
 * A team merged with the org-wide shared resources — what `conductor kg
 * update` (once it writes to the graph DB) and `conductor kg validate`
 * actually operate on per team. Team-specific resources are additive to
 * shared ones, never a replacement; each of the fields below already
 * includes both.
 */
export interface ResolvedTeam extends Omit<TeamSource, 'principles'> {
  confluenceSpaces: ConfluenceSpace[]; // shared + team-specific
  jiraProjects: JiraProject[]; // shared + team-specific
  awsAccounts: AwsAccount[]; // shared + team-specific
  mcpServers: McpServerRequirement[]; // shared + team-specific, deduped by id
  principles: {
    org: Principle[];
    team: Principle[];
    users: Record<string, Principle[]>;
  };
}

/** The fully loaded and resolved multi-team knowledge-graph source. */
export interface KnowledgeGraphSource {
  version: number;
  organization: string;
  orgPrinciples: Principle[];
  teams: Map<string, ResolvedTeam>;
}
