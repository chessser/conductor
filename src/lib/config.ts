import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';
import type { RepoConfig } from '../types/repo.ts';

const RepoConfigSchema = z
  .object({
    id: z.string(),
    provider: z.enum(['gitlab', 'github']),
    project: z.string(),
    default_branch: z.string().default('main'),
    modules: z.array(z.string()).default([]),
  })
  .transform(
    (raw): RepoConfig => ({
      id: raw.id,
      provider: raw.provider,
      project: raw.project,
      defaultBranch: raw.default_branch,
      modules: raw.modules,
    }),
  );

const JiraConfigSchema = z.object({
  base_url: z.string().url(),
  project_key: z.string(),
  /** JQL fragment appended to the base search; defines the knowledge-graph scope (design doc §4.3). */
  jql: z.string(),
});

const ConductorConfigSchema = z.object({
  repos: z.array(RepoConfigSchema).default([]),
  jira: JiraConfigSchema.optional(),
  cost: z
    .object({
      daily_ceiling_usd: z.number().positive().optional(),
      weekly_ceiling_usd: z.number().positive().optional(),
    })
    .default({}),
});

export type ConductorConfig = z.infer<typeof ConductorConfigSchema>;

/**
 * Resolves the config path: explicit override > ./.conductor/config.yml >
 * ~/.config/conductor/repos.yml. See design doc §5.
 */
export function resolveConfigPath(explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  const projectLocal = join(process.cwd(), '.conductor', 'config.yml');
  if (existsSync(projectLocal)) return projectLocal;
  return join(homedir(), '.config', 'conductor', 'repos.yml');
}

export function loadConfig(path?: string): ConductorConfig {
  const resolved = resolveConfigPath(path);
  if (!existsSync(resolved)) {
    throw new Error(
      `No conductor config found at ${resolved}. Create one — see docs/repo-registry.md for the schema.`,
    );
  }
  const raw = parseYaml(readFileSync(resolved, 'utf8'));
  return ConductorConfigSchema.parse(raw ?? {});
}

export function repoRegistry(config: ConductorConfig): RepoConfig[] {
  return config.repos;
}
