export type RepoProvider = 'gitlab' | 'github';

export interface RepoConfig {
  id: string;
  provider: RepoProvider;
  /** e.g. "mygroup/payments-api" (GitLab) or "myorg/internal-docs" (GitHub) */
  project: string;
  defaultBranch: string;
  /** Coarse module/directory boundaries used to scope the knowledge graph. */
  modules: string[];
}
