import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingEnvFor, validateMcpServers, validateBinaries } from './kg-validate.ts';
import type { KnowledgeGraphSource, McpServerRequirement, ResolvedTeam } from '../types/kg-source.ts';

function server(overrides: Partial<McpServerRequirement> = {}): McpServerRequirement {
  return { id: 'atlassian', package: '@example/atlassian-mcp', requiredEnv: ['ATLASSIAN_API_TOKEN'], ...overrides };
}

function team(overrides: Partial<ResolvedTeam> = {}): ResolvedTeam {
  return {
    id: 'payments',
    displayName: 'Payments',
    principles: { org: [], team: [], users: {} },
    waysOfWorking: {},
    confluenceSpaces: [],
    jiraProjects: [],
    gitlabRepos: [],
    githubRepos: [],
    awsAccounts: [],
    binariesNeeded: [],
    permissionsNeeded: [],
    mcpServers: [],
    members: [],
    ...overrides,
  };
}

function sourceWith(teams: ResolvedTeam[]): KnowledgeGraphSource {
  return {
    version: 1,
    organization: 'acme-corp',
    orgPrinciples: [],
    teams: new Map(teams.map((t) => [t.id, t])),
  };
}

test('missingEnvFor returns unset required env var names', () => {
  const missing = missingEnvFor(server({ requiredEnv: ['A', 'B'] }), { A: 'set' });
  assert.deepEqual(missing, ['B']);
});

test('missingEnvFor returns [] when everything is set', () => {
  const missing = missingEnvFor(server({ requiredEnv: ['A'] }), { A: 'set' });
  assert.deepEqual(missing, []);
});

test('validateMcpServers reports a gap per team with missing env', () => {
  const source = sourceWith([team({ mcpServers: [server()] })]);
  const gaps = validateMcpServers(source, {});
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]?.teamId, 'payments');
  assert.deepEqual(gaps[0]?.missingEnv, ['ATLASSIAN_API_TOKEN']);
});

test('validateMcpServers reports nothing when env is fully set', () => {
  const source = sourceWith([team({ mcpServers: [server()] })]);
  const gaps = validateMcpServers(source, { ATLASSIAN_API_TOKEN: 'x' });
  assert.deepEqual(gaps, []);
});

test('validateBinaries uses the injected checker, not the real environment', () => {
  const source = sourceWith([team({ binariesNeeded: [{ name: 'aws-cli' }, { name: 'docker' }] })]);
  const gaps = validateBinaries(source, (name) => name === 'docker');
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]?.binary.name, 'aws-cli');
});
