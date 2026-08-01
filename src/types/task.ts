/**
 * Mirrors design-doc §3.1-3.3. IssueType distinguishes a repeatable,
 * single-repo Conductor Task from a multi-repo, dependency-ordered Conductor
 * Ordered Task — see docs/knowledge-graph.md and docs/jira-structure.md.
 */
export type IssueType = 'Conductor Request' | 'Conductor Task' | 'Conductor Ordered Task';

export type TaskStatus =
  | 'draft'
  | 'triaged'
  | 'ready'
  | 'in-progress'
  | 'review'
  | 'blocked'
  | 'done';

export type AgentType = 'claude';
export type DispatchMode = 'background' | 'foreground';
export type HitlGate = 'none' | 'design' | 'mr-approval';

export interface TaskLabels {
  agentType?: AgentType;
  mode?: DispatchMode;
  status: TaskStatus;
  hitlGate: HitlGate;
}

export interface ConductorTask {
  /** Jira issue key, e.g. "PROJ-123". */
  key: string;
  issueType: IssueType;
  title: string;
  summary: string;
  labels: TaskLabels;
  /** Single target repo id (RepoConfig.id) for a Conductor Task. Unset for Conductor Ordered Task parents. */
  repo?: string;
  /** Template id + structured parameters, for repeatable Conductor Tasks. See templates/. */
  template?: string;
  parameters?: Record<string, unknown>;
  /** Jira keys this task depends on (Conductor Ordered Task sub-tasks only). */
  dependsOn: string[];
  prUrl?: string;
  branch?: string;
  /** Assignee's email/account id, if any — used by the MCP write-guard's assignee-mismatch warning. */
  assignee?: string;
}

/**
 * An issue is dispatchable only when status is "ready" AND both agentType
 * and mode are set AND every dependency is "done". See design doc §3.3.
 */
export function isDispatchable(task: ConductorTask, allTasks: ReadonlyMap<string, ConductorTask>): boolean {
  if (task.labels.status !== 'ready') return false;
  if (!task.labels.agentType || !task.labels.mode) return false;
  return task.dependsOn.every((key) => allTasks.get(key)?.labels.status === 'done');
}
