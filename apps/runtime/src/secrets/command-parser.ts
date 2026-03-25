/**
 * Command parsing utilities for protected path detection.
 *
 * Extracts file paths from shell commands and redacts sensitive values
 * from commands before audit persistence.
 */

// Commands that reference files as arguments
const FILE_ARG_COMMANDS = [
  "cat",
  "less",
  "more",
  "head",
  "tail",
  "vim",
  "vi",
  "nano",
  "emacs",
  "code",
  "cp",
  "mv",
  "scp",
  "rsync",
  "source",
  ".",
];

/**
 * Extract file paths referenced in a shell command.
 */
export function extractFilePaths(command: string): string[] {
  const paths: string[] = [];
  const tokens = tokenizeCommand(command);

  if (tokens.length === 0) return paths;

  const cmd = tokens[0];

  // Handle `curl -d @file` or `curl --data @file`
  if (cmd === "curl") {
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i];
      if ((tok === "-d" || tok === "--data" || tok === "--data-binary") && i + 1 < tokens.length) {
        const next = tokens[i + 1];
        if (next.startsWith("@")) paths.push(next.slice(1));
        i++;
      } else if (tok.startsWith("@")) {
        paths.push(tok.slice(1));
      }
    }
    return paths;
  }

  // Handle scp: source and dest can be remote:path or local path
  if (cmd === "scp") {
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.startsWith("-")) continue;
      // Skip remote:path patterns (contain colon)
      if (tok.includes(":")) continue;
      paths.push(tok);
    }
    return paths;
  }

  // For common file-reading commands, treat all non-flag tokens as paths
  if (FILE_ARG_COMMANDS.includes(cmd)) {
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok.startsWith("-")) {
        paths.push(tok);
      }
    }
    return paths;
  }

  // For any other command, extract tokens that look like file paths
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok.startsWith("-") && looksLikeFilePath(tok)) {
      paths.push(tok);
    }
  }

  return paths;
}

/**
 * Tokenize a shell command, respecting single and double quotes.
 */
export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

function looksLikeFilePath(tok: string): boolean {
  return (
    tok.startsWith("/") ||
    tok.startsWith("~/") ||
    tok.startsWith("./") ||
    tok.startsWith("../") ||
    tok.includes(".") ||
    tok.includes("/")
  );
}

/**
 * Strips inline secret-looking values from a command before audit persistence.
 * Covers common patterns like `export FOO=secret` or `curl -H "Authorization: Bearer token"`.
 */
export function redactCommandForAudit(command: string): string {
  return command
    .replace(/(?:AKIA[0-9A-Z]{16})/g, "[REDACTED:AWS_ACCESS_KEY]")
    .replace(/(?:AIza[0-9A-Za-z\-_]{35})/g, "[REDACTED:GCP_API_KEY]")
    .replace(/(?:sk-[A-Za-z0-9]{48,})/g, "[REDACTED:OPENAI_KEY]")
    .replace(/(?:gh[ps]_[A-Za-z0-9_]{36,})/g, "[REDACTED:GITHUB_TOKEN]")
    .replace(/(?:Bearer [A-Za-z0-9\-._~+/]+=*)/g, "Bearer [REDACTED:TOKEN]")
    .replace(
      /(?:(?:api_key|apikey|API_KEY)\s*[=:]\s*["']?)([A-Za-z0-9\-_]{16,})["']?/gi,
      (_, _k) => "[REDACTED:API_KEY]"
    );
}
