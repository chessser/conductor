import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadKnowledgeGraphSource, loadRootSource, loadTeamSource, resolveTeam } from './kg-source.ts';
import { RootSourceSchema, TeamSourceSchema } from './kg-source-schema.ts';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'kg-source-'));
}

const ROOT_YML = `
version: 1
organization: acme-corp
principles:
  - id: security-first
    statement: "Least privilege by default"
    doc: https://acme.atlassian.net/wiki/security
shared_resources:
  confluence:
    - id: eng-space
      base_url: https://acme.atlassian.net/wiki
      space_key: ENG
  jira:
    - id: main-jira
      base_url: https://acme.atlassian.net
      project_key: ENG
  aws_accounts:
    - id: shared-tooling
      account_id: "123456789012"
      regions: [us-east-1]
      required_permissions: [readonly-tooling]
mcp_servers:
  - id: atlassian
    package: "@example/atlassian-mcp"
    required_env: [ATLASSIAN_API_TOKEN]
teams:
  - payments
`;

const TEAM_PAYMENTS_YML = `
id: payments
display_name: Payments
principles:
  - id: pci-scope
    statement: "Card data never leaves the payments AWS account"
ways_of_working:
  branch_strategy: trunk-based
  merge_strategy: squash
  requires_review: true
  min_approvals: 1
gitlab_repos:
  - id: payments-api
    provider: gitlab
    project: acme/payments-api
aws_accounts:
  - id: payments-prod
    account_id: "210987654321"
    regions: [us-east-1]
    required_permissions: [deploy-lambda]
binaries_needed:
  - name: aws-cli
mcp_servers:
  - id: gitlab
    package: "@example/gitlab-mcp"
    required_env: [GITLAB_TOKEN]
members:
  - id: alice
    role: lead
    principles:
      - id: alice-oncall
        statement: "Primary oncall for payments-api"
`;

function writeFixtures(dir: string): void {
  writeFileSync(join(dir, 'root.yml'), ROOT_YML, 'utf8');
  mkdirSync(join(dir, 'teams'), { recursive: true });
  writeFileSync(join(dir, 'teams', 'payments.yml'), TEAM_PAYMENTS_YML, 'utf8');
}

test('loadRootSource parses principles and shared resources', () => {
  const dir = tempDir();
  writeFixtures(dir);
  const root = loadRootSource(join(dir, 'root.yml'));
  assert.equal(root.organization, 'acme-corp');
  assert.equal(root.principles[0]?.id, 'security-first');
  assert.equal(root.sharedResources.confluence[0]?.spaceKey, 'ENG');
  assert.equal(root.sharedResources.awsAccounts[0]?.accountId, '123456789012');
  assert.deepEqual(root.teams, ['payments']);
});

test('loadRootSource throws with a helpful message when missing', () => {
  assert.throws(() => loadRootSource('/nonexistent/root.yml'), /No knowledge-graph root source found/);
});

test('loadTeamSource parses ways_of_working and resource lists', () => {
  const dir = tempDir();
  writeFixtures(dir);
  const team = loadTeamSource(join(dir, 'teams', 'payments.yml'));
  assert.equal(team.id, 'payments');
  assert.equal(team.waysOfWorking.branchStrategy, 'trunk-based');
  assert.equal(team.gitlabRepos[0]?.project, 'acme/payments-api');
  assert.equal(team.members[0]?.id, 'alice');
});

test('resolveTeam merges shared + team resources additively', () => {
  const root = RootSourceSchema.parse({
    version: 1,
    organization: 'acme-corp',
    shared_resources: {
      confluence: [{ id: 'eng-space', base_url: 'https://acme.atlassian.net/wiki', space_key: 'ENG' }],
    },
  });
  const team = TeamSourceSchema.parse({
    id: 'payments',
    display_name: 'Payments',
    confluence_spaces: [{ id: 'payments-space', base_url: 'https://acme.atlassian.net/wiki', space_key: 'PAY' }],
  });
  const resolved = resolveTeam(team, root.sharedResources, root.mcpServers, root.principles);
  assert.deepEqual(
    resolved.confluenceSpaces.map((c) => c.id).sort(),
    ['eng-space', 'payments-space'],
  );
});

test('resolveTeam lets a team override a shared resource by reusing its id', () => {
  const root = RootSourceSchema.parse({
    version: 1,
    organization: 'acme-corp',
    shared_resources: {
      jira: [{ id: 'main-jira', base_url: 'https://acme.atlassian.net', project_key: 'ENG' }],
    },
  });
  const team = TeamSourceSchema.parse({
    id: 'payments',
    display_name: 'Payments',
    jira_projects: [{ id: 'main-jira', base_url: 'https://acme.atlassian.net', project_key: 'PAY' }],
  });
  const resolved = resolveTeam(team, root.sharedResources, root.mcpServers, root.principles);
  assert.equal(resolved.jiraProjects.length, 1);
  assert.equal(resolved.jiraProjects[0]?.projectKey, 'PAY');
});

test('resolveTeam builds the org/team/user principle hierarchy', () => {
  const dir = tempDir();
  writeFixtures(dir);
  const source = loadKnowledgeGraphSource(dir);
  const payments = source.teams.get('payments');
  assert.ok(payments);
  assert.equal(payments?.principles.org[0]?.id, 'security-first');
  assert.equal(payments?.principles.team[0]?.id, 'pci-scope');
  assert.equal(payments?.principles.users['alice']?.[0]?.id, 'alice-oncall');
});

test('loadKnowledgeGraphSource dedupes mcp servers by id across org and team', () => {
  const dir = tempDir();
  writeFixtures(dir);
  const source = loadKnowledgeGraphSource(dir);
  const payments = source.teams.get('payments');
  const ids = payments?.mcpServers.map((s) => s.id).sort();
  assert.deepEqual(ids, ['atlassian', 'gitlab']);
});

test('loadKnowledgeGraphSource throws when a team file id does not match its key in root.yml', () => {
  const dir = tempDir();
  writeFixtures(dir);
  writeFileSync(
    join(dir, 'teams', 'payments.yml'),
    TEAM_PAYMENTS_YML.replace('id: payments', 'id: not-payments'),
    'utf8',
  );
  assert.throws(() => loadKnowledgeGraphSource(dir), /does not match the team key/);
});
