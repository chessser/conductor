/**
 * Marks a command as skeleton-only. Every `forge` command wired up so far
 * has the right shape (flags, config loading, error handling) but no real
 * Jira/GitLab/Bedrock integration yet — see docs/build-order.md for the
 * intended implementation sequence. This throws instead of silently
 * no-op'ing so a skeleton command is never mistaken for a working one.
 */
export function notImplemented(command: string, docsRef: string): never {
  throw new Error(
    `\`forge ${command}\` is not implemented yet — this is a project skeleton. See ${docsRef}.`,
  );
}
