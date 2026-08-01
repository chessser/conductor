/**
 * Explicit MCP tool input/output types for schema generation.
 * These are separate from domain models (ConductorTask, etc.) to clearly
 * define what clients send to and receive from MCP tools.
 */

import type { ConductorTask, TaskStatus } from './task.ts';
import type { ResolvedTeam, Principle } from './kg-source.ts';

/**
 * Knowledge-graph tools (read-only, no authentication needed)
 */

export interface KgListTeamsOutput {
  teams: Array<{ id: string; displayName: string }>;
}

export interface KgGetTeamInput {
  teamId: string;
}

export type KgGetTeamOutput = ResolvedTeam;

export interface KgSearchPrinciplesInput {
  query: string;
}

export interface KgSearchPrinciplesOutput {
  results: Array<{
    principle: Principle;
    level: 'org' | 'team' | 'user';
    userId?: string;
  }>;
}

/**
 * Jira tools (read)
 */

export interface JiraSearchInput {
  projectKey: string;
  jql?: string;
}

export type JiraSearchOutput = ConductorTask[];

export interface JiraGetIssueInput {
  issueKey: string;
}

export type JiraGetIssueOutput = ConductorTask;

/**
 * Jira tools (write: propose/confirm pattern)
 */

export interface JiraProposeCommentInput {
  issueKey: string;
  body: string;
}

export interface ProposalResponse {
  token: string;
  kind: 'comment' | 'status_change' | 'create_issue';
  preview: string;
  assigneeWarning?: string;
  expiresAt: number;
}

export type JiraProposeCommentOutput = ProposalResponse;

export interface JiraProposeStatusChangeInput {
  issueKey: string;
  status: TaskStatus;
}

export type JiraProposeStatusChangeOutput = ProposalResponse;

export interface JiraProposeCreateIssueInput {
  projectKey: string;
  issueType: string;
  summary: string;
  description?: string;
  labels?: string[];
}

export type JiraProposeCreateIssueOutput = ProposalResponse;

export interface JiraConfirmWriteInput {
  token: string;
}

export type JiraConfirmWriteOutput = ConductorTask;

/**
 * GitHub tools (same structure as Jira, for consistency)
 */

export interface GitHubSearchInput {
  projectKey: string;
  filter?: string;
}

export type GitHubSearchOutput = ConductorTask[];

export interface GitHubGetIssueInput {
  issueKey: string;
}

export type GitHubGetIssueOutput = ConductorTask;

export interface GitHubProposeCommentInput {
  issueKey: string;
  body: string;
}

export type GitHubProposeCommentOutput = ProposalResponse;

export interface GitHubProposeStatusChangeInput {
  issueKey: string;
  status: TaskStatus;
}

export type GitHubProposeStatusChangeOutput = ProposalResponse;

export interface GitHubProposeCreateIssueInput {
  projectKey: string;
  issueType: string;
  summary: string;
  description?: string;
  labels?: string[];
}

export type GitHubProposeCreateIssueOutput = ProposalResponse;

export interface GitHubConfirmWriteInput {
  token: string;
}

export type GitHubConfirmWriteOutput = ConductorTask;

/**
 * Background dispatch tools (from background-dispatch.md design)
 */

export interface TaskSearchReadyInput {
  // No required inputs, optional filters
  projectKey?: string;
}

export type TaskSearchReadyOutput = ConductorTask[];

export interface TaskRecordDispatchInput {
  issueKey: string;
  worktreePath: string;
  branch: string;
}

export interface DispatchedEntry {
  issueKey: string;
  worktreePath: string;
  branch: string;
  startedAt: string;
  status: 'in-progress' | 'done' | 'failed' | 'abandoned';
  note?: string;
}

export type TaskRecordDispatchOutput = DispatchedEntry;

export interface TaskListDispatchedOutput {
  entries: Array<
    DispatchedEntry & {
      drift?: string; // Warning if Jira status differs from recorded status
    }
  >;
}

export interface TaskRecordCompleteInput {
  issueKey: string;
  status: 'done' | 'failed' | 'abandoned';
  note?: string;
}

export type TaskRecordCompleteOutput = DispatchedEntry;

/**
 * Tool metadata for schema generation (not used by callers, used by schema generator)
 */

export interface MCP_ToolMetadata {
  name: string;
  description: string;
  inputType: string; // TypeScript type name
  outputType: string; // TypeScript type name
}

export const MCP_TOOLS: MCP_ToolMetadata[] = [
  // Knowledge tools
  { name: 'kg_list_teams', description: 'List all teams in .conductor/kg-source/', inputType: 'void', outputType: 'KgListTeamsOutput' },
  { name: 'kg_get_team', description: 'Get a single team with full resolved resources', inputType: 'KgGetTeamInput', outputType: 'KgGetTeamOutput' },
  { name: 'kg_search_principles', description: 'Search all principles across org, teams, and users', inputType: 'KgSearchPrinciplesInput', outputType: 'KgSearchPrinciplesOutput' },

  // Jira read tools
  { name: 'jira_search', description: 'Search Jira issues by JQL (project-scoped)', inputType: 'JiraSearchInput', outputType: 'JiraSearchOutput' },
  { name: 'jira_get_issue', description: 'Get a single Jira issue', inputType: 'JiraGetIssueInput', outputType: 'JiraGetIssueOutput' },

  // Jira write tools (propose/confirm)
  { name: 'jira_propose_comment', description: 'Propose a comment on a Jira issue (returns token)', inputType: 'JiraProposeCommentInput', outputType: 'JiraProposeCommentOutput' },
  { name: 'jira_propose_status_change', description: 'Propose a status change on a Jira issue (returns token)', inputType: 'JiraProposeStatusChangeInput', outputType: 'JiraProposeStatusChangeOutput' },
  { name: 'jira_propose_create_issue', description: 'Propose creating a new Jira issue (returns token)', inputType: 'JiraProposeCreateIssueInput', outputType: 'JiraProposeCreateIssueOutput' },
  { name: 'jira_confirm_write', description: 'Confirm and execute a proposed Jira write (single-use token)', inputType: 'JiraConfirmWriteInput', outputType: 'JiraConfirmWriteOutput' },

  // GitHub read tools
  { name: 'github_search', description: 'Search GitHub issues (project-scoped)', inputType: 'GitHubSearchInput', outputType: 'GitHubSearchOutput' },
  { name: 'github_get_issue', description: 'Get a single GitHub issue', inputType: 'GitHubGetIssueInput', outputType: 'GitHubGetIssueOutput' },

  // GitHub write tools (propose/confirm)
  { name: 'github_propose_comment', description: 'Propose a comment on a GitHub issue (returns token)', inputType: 'GitHubProposeCommentInput', outputType: 'GitHubProposeCommentOutput' },
  { name: 'github_propose_status_change', description: 'Propose a status change on a GitHub issue (returns token)', inputType: 'GitHubProposeStatusChangeInput', outputType: 'GitHubProposeStatusChangeOutput' },
  { name: 'github_propose_create_issue', description: 'Propose creating a new GitHub issue (returns token)', inputType: 'GitHubProposeCreateIssueInput', outputType: 'GitHubProposeCreateIssueOutput' },
  { name: 'github_confirm_write', description: 'Confirm and execute a proposed GitHub write (single-use token)', inputType: 'GitHubConfirmWriteInput', outputType: 'GitHubConfirmWriteOutput' },

  // Background dispatch tools
  { name: 'task_search_ready', description: 'List tasks with status=ready and both agentType and mode set', inputType: 'TaskSearchReadyInput', outputType: 'TaskSearchReadyOutput' },
  { name: 'task_record_dispatch', description: 'Record that a background agent was started for an issue', inputType: 'TaskRecordDispatchInput', outputType: 'TaskRecordDispatchOutput' },
  { name: 'task_list_dispatched', description: 'List all currently dispatched background work', inputType: 'void', outputType: 'TaskListDispatchedOutput' },
  { name: 'task_record_complete', description: 'Mark a dispatched task as done/failed/abandoned', inputType: 'TaskRecordCompleteInput', outputType: 'TaskRecordCompleteOutput' },
];
