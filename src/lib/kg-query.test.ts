import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadKnowledgeGraphSource } from './kg-source.ts';
import { listTeams, getTeam, searchPrinciples, allowedProjectKeys, allowedProjectKeysFor } from './kg-query.ts';

const ROOT_YML = `
version: 1
organization: acme-corp
principles:
  - id: security-first
    statement: "Least privilege by default"
shared_resources:
  jira:
    - id: main-jira
      base_url: https://acme.atlassian.net
      project_key: ENG
teams:
  - payments
`;

const TEAM_YML = `
id: payments
display_name: Payments
principles:
  - id: pci-scope
    statement: "Card data never leaves the payments AWS account"
jira_projects:
  - id: payments-jira
    base_url: https://acme.atlassian.net
    project_key: PAY
members:
  - id: alice
    role: lead
    principles:
      - id: alice-oncall
        statement: "Primary oncall for payments-api"
`;

function loadFixtureSource() {
  const dir = mkdtempSync(join(tmpdir(), 'kg-query-'));
  writeFileSync(join(dir, 'root.yml'), ROOT_YML, 'utf8');
  mkdirSync(join(dir, 'teams'), { recursive: true });
  writeFileSync(join(dir, 'teams', 'payments.yml'), TEAM_YML, 'utf8');
  return loadKnowledgeGraphSource(dir);
}

test('listTeams returns id + displayName for every team', () => {
  const source = loadFixtureSource();
  assert.deepEqual(listTeams(source), [{ id: 'payments', displayName: 'Payments' }]);
});

test('getTeam returns the resolved team, undefined if unknown', () => {
  const source = loadFixtureSource();
  assert.equal(getTeam(source, 'payments')?.id, 'payments');
  assert.equal(getTeam(source, 'nonexistent'), undefined);
});

test('searchPrinciples finds org, team, and user-level matches', () => {
  const source = loadFixtureSource();
  const security = searchPrinciples(source, 'privilege');
  assert.equal(security.length, 1);
  assert.equal(security[0]?.level, 'org');

  const pci = searchPrinciples(source, 'card data');
  assert.equal(pci[0]?.level, 'team');

  const oncall = searchPrinciples(source, 'oncall');
  assert.equal(oncall[0]?.level, 'user');
  assert.equal(oncall[0]?.userId, 'alice');
});

test('searchPrinciples is case-insensitive and matches on id too', () => {
  const source = loadFixtureSource();
  assert.equal(searchPrinciples(source, 'PCI-SCOPE').length, 1);
});

test('searchPrinciples returns [] for no match', () => {
  const source = loadFixtureSource();
  assert.deepEqual(searchPrinciples(source, 'nothing-matches-this'), []);
});

test('allowedProjectKeysFor includes shared + team-specific jira projects', () => {
  const source = loadFixtureSource();
  const team = getTeam(source, 'payments');
  assert.ok(team);
  assert.deepEqual(allowedProjectKeysFor(team!).sort(), ['ENG', 'PAY'].sort());
});

test('allowedProjectKeys dedupes across all teams', () => {
  const source = loadFixtureSource();
  assert.deepEqual(allowedProjectKeys(source).sort(), ['ENG', 'PAY'].sort());
});
