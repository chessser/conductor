import type { KnowledgeGraphSource, Principle, ResolvedTeam } from '../types/kg-source.ts';

export interface TeamSummary {
  id: string;
  displayName: string;
}

export function listTeams(source: KnowledgeGraphSource): TeamSummary[] {
  return [...source.teams.values()].map((t) => ({ id: t.id, displayName: t.displayName }));
}

export function getTeam(source: KnowledgeGraphSource, teamId: string): ResolvedTeam | undefined {
  return source.teams.get(teamId);
}

export interface PrincipleMatch {
  principle: Principle;
  level: 'org' | 'team' | 'user';
  teamId: string;
  /** Set only when level is "user". */
  userId?: string;
}

/**
 * Substring, case-insensitive search across every principle this source
 * knows about — org-wide (attached to every team), each team's own, and
 * each member's. Pure and cheap; the knowledge graph itself isn't built
 * yet, so this is what `kg_search_principles` (docs/mcp-server.md) runs
 * against today.
 */
export function searchPrinciples(source: KnowledgeGraphSource, query: string): PrincipleMatch[] {
  const needle = query.toLowerCase();
  const matches = (p: Principle): boolean =>
    p.id.toLowerCase().includes(needle) || p.statement.toLowerCase().includes(needle);

  const results: PrincipleMatch[] = [];
  for (const team of source.teams.values()) {
    for (const p of team.principles.org) {
      if (matches(p)) results.push({ principle: p, level: 'org', teamId: team.id });
    }
    for (const p of team.principles.team) {
      if (matches(p)) results.push({ principle: p, level: 'team', teamId: team.id });
    }
    for (const [userId, userPrinciples] of Object.entries(team.principles.users)) {
      for (const p of userPrinciples) {
        if (matches(p)) results.push({ principle: p, level: 'user', teamId: team.id, userId });
      }
    }
  }
  return results;
}

/** Every Jira project key a team can act on, from its resolved (shared + own) jira_projects. */
export function allowedProjectKeysFor(team: ResolvedTeam): string[] {
  return team.jiraProjects.map((p) => p.projectKey);
}

/** Every Jira project key across every team — the MCP write-guard's allowlist. */
export function allowedProjectKeys(source: KnowledgeGraphSource): string[] {
  const keys = new Set<string>();
  for (const team of source.teams.values()) {
    for (const key of allowedProjectKeysFor(team)) keys.add(key);
  }
  return [...keys];
}
