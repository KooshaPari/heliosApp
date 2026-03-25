import type { ProtectedPathPattern } from "./protected-paths.types.js";

export const DEFAULT_PATTERNS: ProtectedPathPattern[] = [
  {
    id: "dotenv",
    pattern: ".env",
    description: ".env files (exact and variants like .env.local, .env.production)",
    enabled: true,
    isDefault: true,
  },
  {
    id: "credentials-json",
    pattern: "credentials.json",
    description: "Generic credentials.json files",
    enabled: true,
    isDefault: true,
  },
  {
    id: "credentials-yaml",
    pattern: "credentials.yaml",
    description: "Generic credentials.yaml files",
    enabled: true,
    isDefault: true,
  },
  {
    id: "credentials-yml",
    pattern: "credentials.yml",
    description: "Generic credentials.yml files",
    enabled: true,
    isDefault: true,
  },
  {
    id: "secrets-dir",
    pattern: "**/secrets/**",
    description: "Any path containing a secrets directory",
    enabled: true,
    isDefault: true,
  },
  {
    id: "ssh-private-key",
    pattern: "~/.ssh/id_*",
    description: "SSH private key files",
    enabled: true,
    isDefault: true,
  },
  {
    id: "aws-credentials",
    pattern: "~/.aws/credentials",
    description: "AWS credentials file",
    enabled: true,
    isDefault: true,
  },
  {
    id: "aws-config",
    pattern: "~/.aws/config",
    description: "AWS config file",
    enabled: true,
    isDefault: true,
  },
  {
    id: "gcloud-adc",
    pattern: "~/.config/gcloud/application_default_credentials.json",
    description: "GCP application default credentials",
    enabled: true,
    isDefault: true,
  },
  {
    id: "gcp-service-account",
    pattern: "**/service-account*.json",
    description: "GCP service account key files",
    enabled: true,
    isDefault: true,
  },
];

export function matchesPattern(filePath: string, pattern: string): boolean {
  // Normalize home directory references
  const expandedPattern = pattern.replace(/^~\//, "");
  const expandedPath = filePath.replace(/^~\//, "").replace(/^\/home\/[^/]+\//, "");

  // For .env pattern: match .env and .env.* variants
  if (pattern === ".env") {
    const base = filePath.split("/").pop() ?? filePath;
    return base === ".env" || base.startsWith(".env.");
  }

  // Direct filename match (no glob)
  if (!pattern.includes("*") && !pattern.includes("?")) {
    const base = filePath.split("/").pop() ?? filePath;
    const patBase = pattern.split("/").pop() ?? pattern;
    if (base === patBase) return true;
    // Full path match
    if (filePath.endsWith(pattern) || filePath === pattern) return true;
    if (expandedPath.endsWith(expandedPattern) || expandedPath === expandedPattern) return true;
    return false;
  }

  // Convert glob pattern to regex
  const regexSource = globToRegex(pattern);
  const regex = new RegExp(regexSource, "i");
  return regex.test(filePath) || regex.test(expandedPath);
}

function globToRegex(glob: string): string {
  // Escape special regex characters except * and ?
  let result = "";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      result += ".*";
      i += 2;
      if (glob[i] === "/") i++; // consume optional slash after **
    } else if (ch === "*") {
      result += "[^/]*";
      i++;
    } else if (ch === "?") {
      result += "[^/]";
      i++;
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      result += "\\" + ch;
      i++;
    } else {
      result += ch;
      i++;
    }
  }
  return "(^|/|^.*[/\\\\])" + result + "($|[/\\\\])";
}
