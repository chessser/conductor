import type { AgentType, DispatchMode, ConductorTask, HitlGate, IssueType, TaskStatus } from '../../types/task.ts';

const STATUS_LABEL_PREFIX = 'status/';
const AGENT_TYPE_LABEL_PREFIX = 'agent-type/';
const MODE_LABEL_PREFIX = 'mode/';
const HITL_GATE_LABEL_PREFIX = 'hitl-gate/';

const TASK_STATUSES: readonly TaskStatus[] = [
  'draft',
  'triaged',
  'ready',
  'in-progress',
  'review',
  'blocked',
  'done',
];
const AGENT_TYPES: readonly AgentType[] = ['claude'];
const DISPATCH_MODES: readonly DispatchMode[] = ['background', 'foreground'];
const HITL_GATES: readonly HitlGate[] = ['none', 'design', 'mr-approval'];

const ISSUE_TYPE_NAMES: readonly IssueType[] = ['Conductor Request', 'Conductor Task', 'Conductor Ordered Task'];

/** Minimal shape of a Jira Cloud REST v3 issue this app reads. Extra fields are ignored. */
export interface JiraIssueJson {
  key: string;
  fields: {
    summary: string;
    description?: string | null;
    issuetype?: { name?: string };
    labels?: string[];
    issuelinks?: Array<{
      type: { inward: string; outward: string };
      inwardIssue?: { key: string };
      outwardIssue?: { key: string };
    }>;
  };
}

function labelValue<T extends string>(labels: string[], prefix: string, allowed: readonly T[]): T | undefined {
  for (const label of labels) {
    if (!label.startsWith(prefix)) continue;
    const value = label.slice(prefix.length);
    if ((allowed as readonly string[]).includes(value)) return value as T;
  }
  return undefined;
}

/**
 * Sub-task dependencies are modeled as "is blocked by" inward links —
 * see docs/jira-structure.md. Only inward links are treated as
 * dependencies; outward "blocks" links describe the reverse edge and are
 * intentionally ignored to avoid double-counting.
 */
function dependsOnFromLinks(links: JiraIssueJson['fields']['issuelinks']): string[] {
  if (!links) return [];
  const deps: string[] = [];
  for (const link of links) {
    if (link.type.inward.toLowerCase() === 'is blocked by' && link.inwardIssue) {
      deps.push(link.inwardIssue.key);
    }
  }
  return deps;
}

/**
 * Pure mapping, unit tested against fixtures — the only part of the Jira
 * integration that's meaningfully testable without a live/fake server.
 * See docs/testing.md.
 */
export function mapJiraIssueToTask(issue: JiraIssueJson): ConductorTask {
  const labels = issue.fields.labels ?? [];
  const issueTypeName = issue.fields.issuetype?.name;
  const issueType: IssueType = ISSUE_TYPE_NAMES.includes(issueTypeName as IssueType)
    ? (issueTypeName as IssueType)
    : 'Conductor Request';

  const agentType = labelValue(labels, AGENT_TYPE_LABEL_PREFIX, AGENT_TYPES);
  const mode = labelValue(labels, MODE_LABEL_PREFIX, DISPATCH_MODES);

  return {
    key: issue.key,
    issueType,
    title: issue.fields.summary,
    summary: issue.fields.description ?? '',
    labels: {
      status: labelValue(labels, STATUS_LABEL_PREFIX, TASK_STATUSES) ?? 'draft',
      hitlGate: labelValue(labels, HITL_GATE_LABEL_PREFIX, HITL_GATES) ?? 'none',
      ...(agentType !== undefined && { agentType }),
      ...(mode !== undefined && { mode }),
    },
    dependsOn: dependsOnFromLinks(issue.fields.issuelinks),
  };
}

/** Inverse of the status/* portion of mapJiraIssueToTask, for writing labels back. */
export function replaceStatusLabel(existingLabels: string[], status: TaskStatus): string[] {
  const withoutStatus = existingLabels.filter((l) => !l.startsWith(STATUS_LABEL_PREFIX));
  return [...withoutStatus, `${STATUS_LABEL_PREFIX}${status}`];
}
