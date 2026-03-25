import type { ZellijSession } from "../types.js";

/**
 * Parse a single line from `zellij list-sessions` output.
 * Format varies but typically: "session-name [Created ...ago] (ATTACHED)" or similar.
 */
export function parseSessionLine(line: string): ZellijSession | undefined {
  const trimmed = line.trim();
  if (trimmed === "") return undefined;

  // The session name is the first whitespace-delimited token
  const parts = trimmed.split(/\s+/);
  const name = parts[0];
  if (!name) return undefined;

  const attached = /\(ATTACHED\)/i.test(trimmed) || trimmed.includes("ATTACHED");

  // Try to extract creation date/time if present; otherwise use now
  const dateMatch = trimmed.match(
    /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/,
  );
  const created = dateMatch
    ? new Date(`${dateMatch[1]}T${dateMatch[2]}`)
    : new Date();

  return { name, created, attached };
}
