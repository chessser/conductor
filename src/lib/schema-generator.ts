/**
 * Generates JSON Schema for MCP tools from TypeScript type definitions.
 * Runs via: npm run build:schema
 * Output: dist/conductor-schema.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface JSONSchema {
  $schema?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

interface ToolSchema {
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
}

interface ConductorSchema {
  version: string;
  name: string;
  description: string;
  metadata: {
    backends: string[];
    guardrails: string[];
  };
  tools: Record<string, ToolSchema>;
}

/**
 * Manually define schemas for all MCP tools.
 * In a production system, these would be generated from TypeScript types
 * using ts-json-schema-generator, but for MVP we define them explicitly
 * to ensure type safety and clarity.
 */
function generateToolSchemas(): Record<string, ToolSchema> {
  return {
    kg_list_teams: {
      description: 'List all teams in .conductor/kg-source/',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      outputSchema: {
        type: 'object',
        properties: {
          teams: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                displayName: { type: 'string' },
              },
              required: ['id', 'displayName'],
            },
          },
        },
        required: ['teams'],
      },
    },

    kg_get_team: {
      description: 'Get a single team with full resolved resources',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: { type: 'string', description: 'Team ID to fetch' },
        },
        required: ['teamId'],
      },
      outputSchema: {
        type: 'object',
        description: 'ResolvedTeam with org + team + user principles, ways-of-working, all resources',
        properties: {
          id: { type: 'string' },
          displayName: { type: 'string' },
          principles: {
            type: 'object',
            properties: {
              org: { type: 'array' },
              team: { type: 'array' },
              users: { type: 'object' },
            },
          },
          jiraProjects: { type: 'array' },
          githubRepos: { type: 'array' },
          awsAccounts: { type: 'array' },
        },
        required: ['id', 'displayName', 'principles'],
      },
    },

    kg_search_principles: {
      description: 'Search all principles across org, teams, and users',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term (matches id or statement)' },
        },
        required: ['query'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                principle: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    statement: { type: 'string' },
                    doc: { type: 'string' },
                  },
                },
                level: { type: 'string', enum: ['org', 'team', 'user'] },
                userId: { type: 'string' },
              },
            },
          },
        },
        required: ['results'],
      },
    },

    jira_search: {
      description: 'Search Jira issues by JQL (project-scoped to declared projects)',
      inputSchema: {
        type: 'object',
        properties: {
          projectKey: { type: 'string', description: 'Jira project key' },
          jql: { type: 'string', description: 'Additional JQL filter (optional)' },
        },
        required: ['projectKey'],
      },
      outputSchema: {
        type: 'array',
        items: { $ref: '#/definitions/ConductorTask' },
      },
    },

    jira_get_issue: {
      description: 'Get a single Jira issue',
      inputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string', description: 'Jira issue key, e.g. PROJ-123' },
        },
        required: ['issueKey'],
      },
      outputSchema: { $ref: '#/definitions/ConductorTask' },
    },

    jira_propose_comment: {
      description: 'Propose a comment on a Jira issue (does not execute, returns token for confirmation)',
      inputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string' },
          body: { type: 'string', description: 'Markdown comment text' },
        },
        required: ['issueKey', 'body'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Single-use token (expires in 10 minutes)' },
          kind: { type: 'string', enum: ['comment'] },
          preview: { type: 'string', description: 'Human-readable summary for review' },
          assigneeWarning: { type: 'string', description: 'Optional warning if assignee ≠ acting email' },
          expiresAt: { type: 'number', description: 'Unix timestamp (ms)' },
        },
        required: ['token', 'kind', 'preview', 'expiresAt'],
      },
    },

    jira_propose_status_change: {
      description: 'Propose a status change on a Jira issue',
      inputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string' },
          status: {
            type: 'string',
            enum: ['draft', 'triaged', 'ready', 'in-progress', 'review', 'blocked', 'done'],
          },
        },
        required: ['issueKey', 'status'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          kind: { type: 'string', enum: ['status_change'] },
          preview: { type: 'string' },
          assigneeWarning: { type: 'string' },
          expiresAt: { type: 'number' },
        },
        required: ['token', 'kind', 'preview', 'expiresAt'],
      },
    },

    jira_propose_create_issue: {
      description: 'Propose creating a new Jira issue',
      inputSchema: {
        type: 'object',
        properties: {
          projectKey: { type: 'string' },
          issueType: { type: 'string', enum: ['Conductor Request', 'Conductor Task', 'Conductor Ordered Task'] },
          summary: { type: 'string', description: 'Issue title' },
          description: { type: 'string', description: 'Issue body (markdown)' },
          labels: { type: 'array', items: { type: 'string' } },
        },
        required: ['projectKey', 'issueType', 'summary'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          kind: { type: 'string', enum: ['create_issue'] },
          preview: { type: 'string' },
          expiresAt: { type: 'number' },
        },
        required: ['token', 'kind', 'preview', 'expiresAt'],
      },
    },

    jira_confirm_write: {
      description: 'Confirm and execute a proposed Jira write (single-use token)',
      inputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Token from a jira_propose_* call' },
        },
        required: ['token'],
      },
      outputSchema: { $ref: '#/definitions/ConductorTask' },
    },

    github_search: {
      description: 'Search GitHub issues (project-scoped to declared repos)',
      inputSchema: {
        type: 'object',
        properties: {
          projectKey: { type: 'string', description: 'GitHub project key' },
          filter: { type: 'string', description: 'Optional search filter' },
        },
        required: ['projectKey'],
      },
      outputSchema: {
        type: 'array',
        items: { $ref: '#/definitions/ConductorTask' },
      },
    },

    github_get_issue: {
      description: 'Get a single GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string', description: 'GitHub issue key, e.g. PLATFORM-123' },
        },
        required: ['issueKey'],
      },
      outputSchema: { $ref: '#/definitions/ConductorTask' },
    },

    github_propose_comment: {
      description: 'Propose a comment on a GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['issueKey', 'body'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          kind: { type: 'string', enum: ['comment'] },
          preview: { type: 'string' },
          expiresAt: { type: 'number' },
        },
        required: ['token', 'kind', 'preview', 'expiresAt'],
      },
    },

    github_propose_status_change: {
      description: 'Propose a status change on a GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string' },
          status: {
            type: 'string',
            enum: ['draft', 'triaged', 'ready', 'in-progress', 'review', 'blocked', 'done'],
          },
        },
        required: ['issueKey', 'status'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          kind: { type: 'string', enum: ['status_change'] },
          preview: { type: 'string' },
          expiresAt: { type: 'number' },
        },
        required: ['token', 'kind', 'preview', 'expiresAt'],
      },
    },

    github_propose_create_issue: {
      description: 'Propose creating a new GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          projectKey: { type: 'string' },
          issueType: { type: 'string', enum: ['Conductor Request', 'Conductor Task', 'Conductor Ordered Task'] },
          summary: { type: 'string' },
          description: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
        },
        required: ['projectKey', 'issueType', 'summary'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          kind: { type: 'string', enum: ['create_issue'] },
          preview: { type: 'string' },
          expiresAt: { type: 'number' },
        },
        required: ['token', 'kind', 'preview', 'expiresAt'],
      },
    },

    github_confirm_write: {
      description: 'Confirm and execute a proposed GitHub write',
      inputSchema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
        },
        required: ['token'],
      },
      outputSchema: { $ref: '#/definitions/ConductorTask' },
    },

    task_search_ready: {
      description: 'List tasks with status=ready and both agentType and mode set',
      inputSchema: {
        type: 'object',
        properties: {
          projectKey: { type: 'string', description: 'Optional project filter' },
        },
        required: [],
      },
      outputSchema: {
        type: 'array',
        items: { $ref: '#/definitions/ConductorTask' },
      },
    },

    task_record_dispatch: {
      description: 'Record that a Claude Code session started background work for an issue',
      inputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string' },
          worktreePath: { type: 'string', description: 'Absolute path to the git worktree' },
          branch: { type: 'string', description: 'Git branch name' },
        },
        required: ['issueKey', 'worktreePath', 'branch'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string' },
          worktreePath: { type: 'string' },
          branch: { type: 'string' },
          startedAt: { type: 'string', description: 'ISO 8601 timestamp' },
          status: { type: 'string', enum: ['in-progress', 'done', 'failed', 'abandoned'] },
          note: { type: 'string' },
        },
        required: ['issueKey', 'worktreePath', 'branch', 'startedAt', 'status'],
      },
    },

    task_list_dispatched: {
      description: 'List all currently dispatched background work',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      outputSchema: {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                issueKey: { type: 'string' },
                worktreePath: { type: 'string' },
                branch: { type: 'string' },
                startedAt: { type: 'string' },
                status: { type: 'string' },
                note: { type: 'string' },
                drift: { type: 'string', description: 'Warning if Jira status differs from recorded' },
              },
            },
          },
        },
        required: ['entries'],
      },
    },

    task_record_complete: {
      description: 'Mark a dispatched task as done/failed/abandoned',
      inputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string' },
          status: { type: 'string', enum: ['done', 'failed', 'abandoned'] },
          note: { type: 'string', description: 'Optional completion notes' },
        },
        required: ['issueKey', 'status'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          issueKey: { type: 'string' },
          worktreePath: { type: 'string' },
          branch: { type: 'string' },
          startedAt: { type: 'string' },
          status: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['issueKey', 'status'],
      },
    },
  };
}

export function generateConductorSchema(): ConductorSchema {
  return {
    version: '2.0.0',
    name: 'conductor',
    description: 'Unified task orchestration MCP server with multi-backend support (Jira + GitHub)',
    metadata: {
      backends: ['jira', 'github'],
      guardrails: ['propose-then-confirm', 'project-scoped', 'no-delete'],
    },
    tools: generateToolSchemas(),
  };
}

export async function main() {
  const schema = generateConductorSchema();
  const outputPath = path.join(process.cwd(), 'dist', 'conductor-schema.json');

  // Ensure dist directory exists
  const distDir = path.dirname(outputPath);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Write schema to file
  fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2));

  console.log(`✓ Generated schema: ${outputPath}`);
  console.log(`✓ Version: ${schema.version}`);
  console.log(`✓ Tools: ${Object.keys(schema.tools).length}`);
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Schema generation failed:', err);
    process.exit(1);
  });
}
