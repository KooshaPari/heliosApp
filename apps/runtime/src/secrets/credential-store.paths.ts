import { join, resolve, sep } from "node:path";

const FORBIDDEN_PATTERNS = ["..", "/", "\\", "\0"];

export function validateId(label: string, value: string): void {
  for (const pat of FORBIDDEN_PATTERNS) {
    if (value.includes(pat)) {
      throw new Error(`Invalid ${label}: contains forbidden character sequence '${pat}'`);
    }
  }
  if (value.length === 0) {
    throw new Error(`Invalid ${label}: must not be empty`);
  }
}

export function credentialDir(dataDir: string, providerId: string, workspaceId: string): string {
  const root = resolve(join(dataDir, "secrets"));
  const dir = resolve(join(root, providerId, workspaceId));
  if (!dir.startsWith(root + sep) && dir !== root) {
    throw new Error("Path traversal detected");
  }
  return dir;
}

export function credentialPath(
  dataDir: string,
  providerId: string,
  workspaceId: string,
  name: string
): string {
  return join(credentialDir(dataDir, providerId, workspaceId), `${name}.enc`);
}
