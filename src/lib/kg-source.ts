import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { RootSourceSchema, TeamSourceSchema } from './kg-source-schema.ts';
import type {
  AwsAccount,
  ConfluenceSpace,
  JiraProject,
  KnowledgeGraphSource,
  McpServerRequirement,
  ResolvedTeam,
  RootSource,
  TeamSource,
} from '../types/kg-source.ts';

export function defaultKgSourceDir(cwd: string = process.cwd()): string {
  return join(cwd, '.conductor', 'kg-source');
}

export function loadRootSource(path: string): RootSource {
  if (!existsSync(path)) {
    throw new Error(
      `No knowledge-graph root source found at ${path}. See docs/knowledge-graph-source.md — ` +
        'copy .conductor/kg-source.example/ to get started.',
    );
  }
  const raw = parseYaml(readFileSync(path, 'utf8'));
  return RootSourceSchema.parse(raw ?? {});
}

export function loadTeamSource(path: string): TeamSource {
  if (!existsSync(path)) {
    throw new Error(`No team source found at ${path} — check root.yml's \`teams:\` list.`);
  }
  const raw = parseYaml(readFileSync(path, 'utf8'));
  return TeamSourceSchema.parse(raw ?? {});
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return [...byId.values()];
}

/**
 * Merges org-wide shared resources with a team's own — additive, never a
 * replacement. Team-declared entries win on id collision (a team can
 * narrow/override a shared entry by reusing its id).
 */
export function resolveTeam(
  team: TeamSource,
  sharedResources: RootSource['sharedResources'],
  orgMcpServers: McpServerRequirement[],
  orgPrinciples: RootSource['principles'],
): ResolvedTeam {
  const confluenceSpaces: ConfluenceSpace[] = dedupeById([...sharedResources.confluence, ...team.confluenceSpaces]);
  const jiraProjects: JiraProject[] = dedupeById([...sharedResources.jira, ...team.jiraProjects]);
  const awsAccounts: AwsAccount[] = dedupeById([...sharedResources.awsAccounts, ...team.awsAccounts]);
  const mcpServers: McpServerRequirement[] = dedupeById([...orgMcpServers, ...team.mcpServers]);

  return {
    ...team,
    confluenceSpaces,
    jiraProjects,
    awsAccounts,
    mcpServers,
    principles: {
      org: orgPrinciples,
      team: team.principles,
      users: Object.fromEntries(team.members.map((m) => [m.id, m.principles])),
    },
  };
}

/**
 * Loads root.yml plus every team file it references and resolves them
 * into one queryable model. This is what `conductor kg update` will feed
 * into the graph DB, and what `conductor kg validate` checks permissions/
 * MCP servers/binaries against. See docs/knowledge-graph-source.md.
 */
export function loadKnowledgeGraphSource(dir: string = defaultKgSourceDir()): KnowledgeGraphSource {
  const rootPath = join(dir, 'root.yml');
  const root = loadRootSource(rootPath);

  const teams = new Map<string, ResolvedTeam>();
  for (const teamId of root.teams) {
    const teamPath = join(dirname(rootPath), 'teams', `${teamId}.yml`);
    const team = loadTeamSource(teamPath);
    if (team.id !== teamId) {
      throw new Error(`${teamPath}: id "${team.id}" does not match the team key "${teamId}" from root.yml`);
    }
    teams.set(teamId, resolveTeam(team, root.sharedResources, root.mcpServers, root.principles));
  }

  return {
    version: root.version,
    organization: root.organization,
    orgPrinciples: root.principles,
    teams,
  };
}
