import { z } from 'zod';
import type { RepoConfig } from '../types/repo.ts';

const PrincipleSchema = z.object({
  id: z.string(),
  statement: z.string(),
  doc: z.string().url().optional(),
});

const ConfluenceSpaceSchema = z
  .object({ id: z.string(), base_url: z.string().url(), space_key: z.string() })
  .transform((r) => ({ id: r.id, baseUrl: r.base_url, spaceKey: r.space_key }));

const JiraProjectSchema = z
  .object({ id: z.string(), base_url: z.string().url(), project_key: z.string(), jql: z.string().optional() })
  .transform((r) => ({ id: r.id, baseUrl: r.base_url, projectKey: r.project_key, jql: r.jql }));

const RepoRefSchema = z
  .object({
    id: z.string(),
    provider: z.enum(['gitlab', 'github']),
    project: z.string(),
    default_branch: z.string().default('main'),
    modules: z.array(z.string()).default([]),
  })
  .transform(
    (r): RepoConfig => ({ id: r.id, provider: r.provider, project: r.project, defaultBranch: r.default_branch, modules: r.modules }),
  );

const AwsAccountSchema = z
  .object({
    id: z.string(),
    account_id: z.string().regex(/^\d{12}$/, 'AWS account id must be 12 digits'),
    role_arn: z.string().optional(),
    regions: z.array(z.string()).default([]),
    required_permissions: z.array(z.string()).default([]),
  })
  .transform((r) => ({
    id: r.id,
    accountId: r.account_id,
    roleArn: r.role_arn,
    regions: r.regions,
    requiredPermissions: r.required_permissions,
  }));

const BinaryRequirementSchema = z
  .object({ name: z.string(), min_version: z.string().optional() })
  .transform((r) => ({ name: r.name, minVersion: r.min_version }));

const PermissionNeedSchema = z.object({ resource: z.string(), scope: z.array(z.string()).min(1) });

const McpServerRequirementSchema = z
  .object({ id: z.string(), package: z.string(), required_env: z.array(z.string()).default([]) })
  .transform((r) => ({ id: r.id, package: r.package, requiredEnv: r.required_env }));

const MemberSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    role: z.string().optional(),
    principles: z.array(PrincipleSchema).default([]),
  })
  .transform((r) => ({ id: r.id, name: r.name, role: r.role, principles: r.principles }));

const WaysOfWorkingSchema = z
  .object({
    branch_strategy: z.enum(['trunk-based', 'gitflow', 'github-flow']).optional(),
    merge_strategy: z.enum(['squash', 'merge', 'rebase']).optional(),
    requires_review: z.boolean().optional(),
    min_approvals: z.number().int().min(0).optional(),
    ci_required: z.boolean().optional(),
    deploy_cadence: z.enum(['continuous', 'daily', 'weekly', 'on-demand']).optional(),
    comms_channel: z.string().optional(),
    principles_doc: z.string().url().optional(),
  })
  .default({})
  .transform((r) => ({
    branchStrategy: r.branch_strategy,
    mergeStrategy: r.merge_strategy,
    requiresReview: r.requires_review,
    minApprovals: r.min_approvals,
    ciRequired: r.ci_required,
    deployCadence: r.deploy_cadence,
    commsChannel: r.comms_channel,
    principlesDoc: r.principles_doc,
  }));

export const RootSourceSchema = z
  .object({
    version: z.number().int().positive(),
    organization: z.string(),
    principles: z.array(PrincipleSchema).default([]),
    shared_resources: z
      .object({
        confluence: z.array(ConfluenceSpaceSchema).default([]),
        jira: z.array(JiraProjectSchema).default([]),
        aws_accounts: z.array(AwsAccountSchema).default([]),
      })
      .default({}),
    mcp_servers: z.array(McpServerRequirementSchema).default([]),
    teams: z.array(z.string()).default([]),
  })
  .transform((r) => ({
    version: r.version,
    organization: r.organization,
    principles: r.principles,
    sharedResources: {
      confluence: r.shared_resources.confluence,
      jira: r.shared_resources.jira,
      awsAccounts: r.shared_resources.aws_accounts,
    },
    mcpServers: r.mcp_servers,
    teams: r.teams,
  }));

export const TeamSourceSchema = z
  .object({
    id: z.string(),
    display_name: z.string(),
    principles: z.array(PrincipleSchema).default([]),
    ways_of_working: WaysOfWorkingSchema,
    confluence_spaces: z.array(ConfluenceSpaceSchema).default([]),
    jira_projects: z.array(JiraProjectSchema).default([]),
    gitlab_repos: z.array(RepoRefSchema).default([]),
    github_repos: z.array(RepoRefSchema).default([]),
    aws_accounts: z.array(AwsAccountSchema).default([]),
    binaries_needed: z.array(BinaryRequirementSchema).default([]),
    permissions_needed: z.array(PermissionNeedSchema).default([]),
    mcp_servers: z.array(McpServerRequirementSchema).default([]),
    members: z.array(MemberSchema).default([]),
  })
  .transform((r) => ({
    id: r.id,
    displayName: r.display_name,
    principles: r.principles,
    waysOfWorking: r.ways_of_working,
    confluenceSpaces: r.confluence_spaces,
    jiraProjects: r.jira_projects,
    gitlabRepos: r.gitlab_repos,
    githubRepos: r.github_repos,
    awsAccounts: r.aws_accounts,
    binariesNeeded: r.binaries_needed,
    permissionsNeeded: r.permissions_needed,
    mcpServers: r.mcp_servers,
    members: r.members,
  }));
