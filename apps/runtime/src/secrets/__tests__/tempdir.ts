import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";

const BASE_DIR = join(process.cwd(), ".tmp", "runtime-secrets-tests");

export function makeTestTempDir(prefix: string): string {
  mkdirSync(BASE_DIR, { recursive: true });
  return mkdtempSync(join(BASE_DIR, prefix));
}
