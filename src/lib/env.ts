import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Minimal .env parser — KEY=value per line, `#` comments, blank lines
 * skipped, optional surrounding quotes stripped. Not a full dotenv
 * implementation (no multiline values, no variable expansion) — this
 * project has zero external runtime dependencies beyond commander/
 * js-yaml/zod (see CLAUDE.md), and this is all `conductor` actually needs.
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Loads .env into `target` (defaults to process.env), never overwriting a
 * variable that's already set — an explicit `export` or CI secret always
 * wins over the file. Silently does nothing if no .env exists; conductor
 * commands that need a var still fail with their own clear error either
 * way (see src/commands/sync.ts's requireEnv).
 */
export function loadEnvFile(path: string = join(process.cwd(), '.env'), target: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return;
  const parsed = parseEnvFile(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (target[key] === undefined) target[key] = value;
  }
}
