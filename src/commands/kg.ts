import type { Command } from 'commander';
import { notImplemented } from '../lib/not-implemented.ts';
import { defaultKgSourceDir, loadKnowledgeGraphSource } from '../lib/kg-source.ts';
import { validate } from '../lib/kg-validate.ts';

export function registerKg(program: Command): void {
  const kg = program.command('kg').description('Local knowledge graph — see docs/knowledge-graph-source.md');

  kg.command('update')
    .description('Rebuild the local knowledge graph from the source config + Jira/GitLab/GitHub metadata')
    .option('--repos <ids>', 'comma-separated repo ids to scope the rebuild to')
    .option('--since <duration>', 'only consider activity in this window, e.g. 30d')
    .action(() => notImplemented('kg update', 'docs/knowledge-graph.md, docs/build-order.md (step 3)'));

  kg.command('summary')
    .description('Human-readable dump of what is currently indexed')
    .action(() => notImplemented('kg summary', 'docs/knowledge-graph.md'));

  kg.command('validate')
    .description('Check every team\'s required MCP server env vars and binaries against this machine')
    .option('--dir <path>', 'knowledge-graph source directory (default: .conductor/kg-source)')
    .action((options: { dir?: string }) => {
      const source = loadKnowledgeGraphSource(options.dir ? options.dir : defaultKgSourceDir());
      const report = validate(source);

      if (report.mcpServerGaps.length === 0 && report.binaryGaps.length === 0) {
        console.log(`All good — ${source.teams.size} team(s), no missing MCP env vars or binaries.`);
        return;
      }

      for (const gap of report.mcpServerGaps) {
        console.log(`[${gap.teamId}] MCP server "${gap.server.id}" missing env: ${gap.missingEnv.join(', ')}`);
      }
      for (const gap of report.binaryGaps) {
        console.log(`[${gap.teamId}] binary "${gap.binary.name}" not found on PATH`);
      }
      process.exitCode = 1;
    });
}
