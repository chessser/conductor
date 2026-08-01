import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateConductorSchema } from './schema-generator.ts';
import { MCP_TOOLS } from '../types/mcp-schema.ts';

test('every tool declared in MCP_TOOLS has a generated schema', () => {
  const schema = generateConductorSchema();
  for (const tool of MCP_TOOLS) {
    assert.ok(schema.tools[tool.name], `missing schema for ${tool.name}`);
  }
});

test('every generated tool has a description and both input and output schemas', () => {
  const schema = generateConductorSchema();
  for (const [name, tool] of Object.entries(schema.tools)) {
    assert.ok(tool.description, `${name} has no description`);
    assert.ok(tool.inputSchema, `${name} has no inputSchema`);
    assert.ok(tool.outputSchema, `${name} has no outputSchema`);
  }
});

test('no delete tool exists in the schema', () => {
  const schema = generateConductorSchema();
  const deleteTools = Object.keys(schema.tools).filter((name) => /delete|remove|destroy/i.test(name));
  assert.deepEqual(deleteTools, []);
});

test('every write is split into a propose tool and a confirm tool', () => {
  const schema = generateConductorSchema();
  const names = Object.keys(schema.tools);

  for (const backend of schema.metadata.backends) {
    const proposals = names.filter((n) => n.startsWith(`${backend}_propose_`));
    assert.ok(proposals.length > 0, `${backend} has no propose tools`);
    assert.ok(names.includes(`${backend}_confirm_write`), `${backend} has no confirm tool`);
  }
});

test('every propose tool returns a single-use token and a human-readable preview', () => {
  const schema = generateConductorSchema();
  const proposeTools = Object.entries(schema.tools).filter(([name]) => name.includes('_propose_'));

  assert.ok(proposeTools.length > 0);
  for (const [name, tool] of proposeTools) {
    const props = tool.outputSchema.properties ?? {};
    assert.ok(props['token'], `${name} does not return a token`);
    assert.ok(props['preview'], `${name} does not return a preview`);
    assert.ok(tool.outputSchema.required?.includes('token'), `${name}'s token is not required`);
  }
});

test('every confirm tool requires exactly a token', () => {
  const schema = generateConductorSchema();
  const confirmTools = Object.entries(schema.tools).filter(([name]) => name.endsWith('_confirm_write'));

  assert.ok(confirmTools.length > 0);
  for (const [name, tool] of confirmTools) {
    assert.deepEqual(tool.inputSchema.required, ['token'], `${name} does not require a token`);
  }
});

test('status enums match the TaskStatus union exactly', () => {
  const schema = generateConductorSchema();
  const expected = ['draft', 'triaged', 'ready', 'in-progress', 'review', 'blocked', 'done'];

  const statusTools = Object.entries(schema.tools).filter(([name]) => name.includes('_propose_status_change'));
  assert.ok(statusTools.length > 0);
  for (const [name, tool] of statusTools) {
    assert.deepEqual(tool.inputSchema.properties?.['status']?.enum, expected, `${name} has a drifted status enum`);
  }
});

test('read tools are scoped by a project key', () => {
  const schema = generateConductorSchema();
  for (const name of ['jira_search', 'github_search']) {
    assert.ok(
      schema.tools[name]?.inputSchema.required?.includes('projectKey'),
      `${name} does not require a projectKey`,
    );
  }
});
