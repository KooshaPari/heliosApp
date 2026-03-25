#!/usr/bin/env bun
/**
 * Atomic rollback command: reverts a broken prerelease dependency to last known-good pin.
 * Usage: bun run deps:rollback <package>
 */

import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appendChangelogEntry } from "./deps-changelog-util.ts";
import type { ChangelogEntry, DepsRegistry } from "./deps-types.ts";

const REPO_ROOT = process.cwd();
const REGISTRY_PATH = join(REPO_ROOT, "deps-registry.json");
const LOCKFILE_PATH = join(REPO_ROOT, "bun.lockb");
const PACKAGE_JSON_PATH = join(REPO_ROOT, "package.json");
const BACKUP_DIR = join(REPO_ROOT, ".deps-rollback-backup");

interface BackupFiles {
  lockfile?: string;
  packageJson?: string;
}

/**
 * Create atomic backup of critical files.
 */
function createBackup(): BackupFiles {
  const backup: BackupFiles = {};
  require("node:fs").mkdirSync(BACKUP_DIR, { recursive: true });

  if (existsSync(LOCKFILE_PATH)) {
    backup.lockfile = join(BACKUP_DIR, `bun.lockb.${Date.now()}`);
    copyFileSync(LOCKFILE_PATH, backup.lockfile);
  }

  if (existsSync(PACKAGE_JSON_PATH)) {
    backup.packageJson = join(BACKUP_DIR, `package.json.${Date.now()}`);
    copyFileSync(PACKAGE_JSON_PATH, backup.packageJson);
  }

  return backup;
}

/**
 * Restore from backup on failure.
 */
function restoreBackup(backup: BackupFiles): void {
  try {
    if (backup.lockfile && existsSync(backup.lockfile)) {
      copyFileSync(backup.lockfile, LOCKFILE_PATH);
    }
    if (backup.packageJson && existsSync(backup.packageJson)) {
      copyFileSync(backup.packageJson, PACKAGE_JSON_PATH);
    }
  } catch (_e) {}
}

/**
 * Clean up backup directory.
 */
function cleanupBackup(backup: BackupFiles): void {
  try {
    if (backup.lockfile && existsSync(backup.lockfile)) {
      unlinkSync(backup.lockfile);
    }
    if (backup.packageJson && existsSync(backup.packageJson)) {
      unlinkSync(backup.packageJson);
    }
  } catch (_e) {
    // Ignore cleanup errors
  }
}

/**
 * Perform atomic rollback of a dependency.
 */
async function rollback(packageName: string): Promise<void> {
  // Load registry
  let registry: DepsRegistry;
  try {
    registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  } catch (_e) {
    process.exit(2);
  }

  // Find dependency
  const dep = registry.dependencies.find(d => d.name === packageName);
  if (!dep) {
    process.exit(1);
  }

  // Find known-good version different from current
  let rollbackVersion: string | null = null;
  if (dep.knownGoodHistory.length > 1) {
    rollbackVersion = dep.knownGoodHistory[dep.knownGoodHistory.length - 2].version;
  }

  if (!rollbackVersion) {
    process.exit(1);
  }

  // Create backup
  const backup = createBackup();

  try {
    // Update package.json to pin the known-good version
    let packageJson;
    try {
      packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
    } catch (e) {
      throw new Error(`Failed to read package.json: ${e}`);
    }

    // Update in dependencies or devDependencies
    if (packageJson.dependencies?.[packageName]) {
      packageJson.dependencies[packageName] = rollbackVersion;
    } else if (packageJson.devDependencies?.[packageName]) {
      packageJson.devDependencies[packageName] = rollbackVersion;
    } else {
      throw new Error(`Package '${packageName}' not found in package.json`);
    }

    writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2));

    // Update registry
    dep.currentPin = rollbackVersion;
    dep.lastUpdated = new Date().toISOString();
    writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

    // Append changelog entry
    const previousVersion =
      dep.knownGoodHistory[dep.knownGoodHistory.length - 1]?.version || dep.currentPin;
    const entry: ChangelogEntry = {
      timestamp: new Date().toISOString(),
      package: packageName,
      fromVersion: previousVersion,
      toVersion: rollbackVersion,
      channel: dep.channel,
      gateResults: { typecheck: true },
      outcome: "success",
      actor: "user",
    };
    appendChangelogEntry(entry);
    process.exit(0);
  } catch (_e) {
    restoreBackup(backup);
    process.exit(2);
  } finally {
    cleanupBackup(backup);
  }
}

// Main entry point
const args = process.argv.slice(2);
if (args.length === 0) {
  process.exit(1);
}

const packageName = args[0];
rollback(packageName).catch(_e => {
  process.exit(2);
});
