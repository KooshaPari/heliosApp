/**
 * Policy Storage
 * Persists policy rules to disk with in-memory caching and hot-swap support.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { PolicyRuleSet } from "./rules";
import type { PolicyRule } from "./types";

export type RulesChangedCallback = (workspaceId: string, rules: PolicyRule[]) => void;

/**
 * Policy Storage with file persistence and hot-swap support.
 */
export class PolicyStorage {
  private cache: Map<string, PolicyRuleSet> = new Map();
  private policyDir: string;
  private watchers: Map<string, () => void> = new Map();
  private changeCallbacks: RulesChangedCallback[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(policyDir: string = join(process.env.HOME || "/tmp", ".helios/policies")) {
    this.policyDir = policyDir;
  }

  /**
   * Load or get cached rule set for a workspace.
   */
  async getRuleSet(workspaceId: string): Promise<PolicyRuleSet> {
    // Return cached rule set if available
    if (this.cache.has(workspaceId)) {
      const cached = this.cache.get(workspaceId);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Load from file
    const rules = await this.loadRules(workspaceId);
    const ruleSet = new PolicyRuleSet();

    for (const rule of rules) {
      ruleSet.addRule(rule);
    }

    this.cache.set(workspaceId, ruleSet);

    // Start watching for changes
    this.watchFile(workspaceId);

    return ruleSet;
  }

  /**
   * Load rules from file for a workspace.
   * Returns empty array if file doesn't exist.
   */
  async loadRules(workspaceId: string): Promise<PolicyRule[]> {
    const filePath = join(this.policyDir, `${workspaceId}.json`);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const rules = JSON.parse(content) as PolicyRule[];

      // Validate rules
      this.validateRules(rules);

      return rules;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist: return empty (deny-by-default)
        return [];
      }
      throw new Error(`Failed to load policy rules for ${workspaceId}: ${error}`);
    }
  }

  /**
   * Save rules to file for a workspace.
   * Uses atomic write: temp file + rename.
   */
  async saveRules(workspaceId: string, rules: PolicyRule[]): Promise<void> {
    // Validate before saving
    this.validateRules(rules);

    // Ensure directory exists
    await fs.mkdir(this.policyDir, { recursive: true });

    const filePath = join(this.policyDir, `${workspaceId}.json`);
    const tempPath = `${filePath}.tmp`;

    try {
      // Write to temp file
      const content = JSON.stringify(rules, null, 2);
      await fs.writeFile(tempPath, content, "utf-8");

      // Atomic rename
      await fs.rename(tempPath, filePath);

      // Update cache
      const ruleSet = new PolicyRuleSet();
      for (const rule of rules) {
        ruleSet.addRule(rule);
      }
      this.cache.set(workspaceId, ruleSet);

      // Notify callbacks (debounced)
      this.notifyChangedDebounced(workspaceId, rules);
    } catch (error) {
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Watch file for external changes and reload.
   */
  private watchFile(workspaceId: string): void {
    if (this.watchers.has(workspaceId)) {
      return; // Already watching
    }

    const filePath = join(this.policyDir, `${workspaceId}.json`);

    // Simple file watching using setInterval (cross-platform, no native watch needed)
    let lastMtime = 0;

    const checkFile = async () => {
      try {
        const stats = await fs.stat(filePath);
        const mtime = stats.mtime.getTime();

        if (mtime > lastMtime && lastMtime > 0) {
          // File changed
          try {
            const rules = await this.loadRules(workspaceId);
            const ruleSet = new PolicyRuleSet();
            for (const rule of rules) {
              ruleSet.addRule(rule);
            }
            this.cache.set(workspaceId, ruleSet);
            this.notifyChangedDebounced(workspaceId, rules);
          } catch (_error) {
            // Keep previous rules on error
          }
        }

        lastMtime = mtime;
      } catch {
        // File doesn't exist yet or error reading
      }
    };

    const timer = setInterval(checkFile, 500); // Check every 500ms

    this.watchers.set(workspaceId, () => clearInterval(timer));

    // Check immediately
    checkFile();
  }

  /**
   * Notify change callbacks with debouncing.
   */
  private notifyChangedDebounced(workspaceId: string, rules: PolicyRule[]): void {
    // Clear existing timer
    if (this.debounceTimers.has(workspaceId)) {
      const existingTimer = this.debounceTimers.get(workspaceId);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
      }
    }

    // Set new timer
    const timer = setTimeout(() => {
      for (const callback of this.changeCallbacks) {
        callback(workspaceId, rules);
      }
      this.debounceTimers.delete(workspaceId);
    }, 100); // Debounce 100ms

    this.debounceTimers.set(workspaceId, timer);
  }

  /**
   * Register a callback to be called when rules change.
   */
  onRulesChanged(callback: RulesChangedCallback): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * Validate rules conform to schema.
   */
  private validateRules(rules: PolicyRule[]): void {
    if (!Array.isArray(rules)) {
      throw new Error("Rules must be an array");
    }

    const isAllowedPatternType = (
      patternType: string | undefined
    ): patternType is "glob" | "regex" => patternType === "glob" || patternType === "regex";
    const isAllowedClassification = (
      classification: string | undefined
    ): classification is "safe" | "needs-approval" | "blocked" =>
      classification === "safe" ||
      classification === "needs-approval" ||
      classification === "blocked";

    for (const rule of rules) {
      const ruleId = rule.id;
      if (!ruleId || typeof ruleId !== "string") {
        throw new Error("Rule must have an id field");
      }

      if (!rule.pattern || typeof rule.pattern !== "string") {
        throw new Error(`Rule ${ruleId} must have a pattern field`);
      }

      if (!isAllowedPatternType(rule.patternType)) {
        throw new Error(`Rule ${ruleId} has invalid patternType`);
      }

      if (!isAllowedClassification(rule.classification)) {
        throw new Error(`Rule ${ruleId} has invalid classification`);
      }

      if (typeof rule.priority !== "number") {
        throw new Error(`Rule ${ruleId} must have a numeric priority`);
      }
    }
  }

  /**
   * Close all watchers.
   */
  close(): void {
    for (const stopWatching of this.watchers.values()) {
      stopWatching();
    }
    this.watchers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    this.cache.clear();
    this.changeCallbacks = [];
  }
}
