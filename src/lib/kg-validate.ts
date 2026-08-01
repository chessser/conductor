import { execFileSync } from 'node:child_process';
import type { BinaryRequirement, KnowledgeGraphSource, McpServerRequirement } from '../types/kg-source.ts';

export interface McpServerGap {
  teamId: string;
  server: McpServerRequirement;
  missingEnv: string[];
}

export interface BinaryGap {
  teamId: string;
  binary: BinaryRequirement;
}

export interface ValidationReport {
  mcpServerGaps: McpServerGap[];
  binaryGaps: BinaryGap[];
}

/**
 * Pure: which of a server's required env vars aren't set. No I/O, so this
 * is exhaustively unit tested — see kg-validate.test.ts.
 */
export function missingEnvFor(server: McpServerRequirement, env: NodeJS.ProcessEnv): string[] {
  return server.requiredEnv.filter((name) => !env[name]);
}

/**
 * Checks every team's declared MCP servers against the given environment
 * (defaults to process.env, but injectable for tests). Servers are
 * deduped by id already at resolve time (kg-source.ts), so a shared
 * server only needs its env checked once per team that actually uses it.
 */
export function validateMcpServers(source: KnowledgeGraphSource, env: NodeJS.ProcessEnv = process.env): McpServerGap[] {
  const gaps: McpServerGap[] = [];
  for (const [teamId, team] of source.teams) {
    for (const server of team.mcpServers) {
      const missingEnv = missingEnvFor(server, env);
      if (missingEnv.length > 0) gaps.push({ teamId, server, missingEnv });
    }
  }
  return gaps;
}

/**
 * Injectable binary-presence check — defaults to a real `which`/`where`
 * lookup, but tests supply a fake so this stays deterministic and doesn't
 * depend on what's actually installed on the machine running the suite.
 */
export type BinaryChecker = (name: string) => boolean;

export function realBinaryChecker(name: string): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function validateBinaries(source: KnowledgeGraphSource, isAvailable: BinaryChecker = realBinaryChecker): BinaryGap[] {
  const gaps: BinaryGap[] = [];
  for (const [teamId, team] of source.teams) {
    for (const binary of team.binariesNeeded) {
      if (!isAvailable(binary.name)) gaps.push({ teamId, binary });
    }
  }
  return gaps;
}

export function validate(source: KnowledgeGraphSource, options: { env?: NodeJS.ProcessEnv; isAvailable?: BinaryChecker } = {}): ValidationReport {
  return {
    mcpServerGaps: validateMcpServers(source, options.env ?? process.env),
    binaryGaps: validateBinaries(source, options.isAvailable ?? realBinaryChecker),
  };
}
