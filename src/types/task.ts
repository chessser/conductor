/**
 * Mirrors design-doc §3.1-3.3. IssueType distinguishes a repeatable,
 * single-repo Forge Task from a multi-repo, dependency-ordered Forge
 * Ordered Task — see docs/knowledge-graph.md and docs/jira-structure.md.
 */
export type IssueType = 'Forge Request' | 'Forge Task' | 'Forge Ordered Task';

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

export interface ForgeTask {
  /** Jira issue key, e.g. "PROJ-123". */
  key: string;
  issueType: IssueType;
  title: string;
  summary: string;
  labels: TaskLabels;
  /** Single target repo id (RepoConfig.id) for a Forge Task. Unset for Forge Ordered Task parents. */
  repo?: string;
  /** Template id + structured parameters, for repeatable Forge Tasks. See templates/. */
  template?: string;
  parameters?: Record<string, unknown>;
  /** Jira keys this task depends on (Forge Ordered Task sub-tasks only). */
  dependsOn: string[];
  prUrl?: string;
  branch?: string;
}

/**
 * An issue is dispatchable only when status is "ready" AND both agentType
 * and mode are set AND every dependency is "done". See design doc §3.3.
 */
export function isDispatchable(task: ForgeTask, allTasks: ReadonlyMap<string, ForgeTask>): boolean {
  if (task.labels.status !== 'ready') return false;
  if (!task.labels.agentType || !task.labels.mode) return false;
  return task.dependsOn.every((key) => allTasks.get(key)?.labels.status === 'done');
}
