/**
 * Policy Rule Engine
 * Evaluates commands against policy rules with denylist-wins conflict resolution.
 */

import {
  type CommandContext,
  PolicyClassification,
  type PolicyEvaluationResult,
  PolicyPatternType,
  type PolicyRule,
} from "./types";

/**
 * Pattern matcher for glob and regex patterns.
 */
class PatternMatcher {
  private regexCache: Map<string, RegExp> = new Map();

  /**
   * Test if a command matches a pattern.
   */
  matches(command: string, pattern: string, type: PolicyPatternType): boolean {
    if (type === PolicyPatternType.Regex) {
      try {
        // Cache compiled regex for performance
        if (!this.regexCache.has(pattern)) {
          this.regexCache.set(pattern, new RegExp(pattern));
        }
        const regex = this.regexCache.get(pattern);
        if (regex === undefined) {
          return false;
        }
        return regex.test(command);
      } catch {
        return false;
      }
    } else {
      // Simple glob matching (glob via wildcard expansion)
      return this.globMatch(command, pattern);
    }
  }

  /**
   * Simple glob pattern matching.
   * Supports * for any characters.
   */
  private globMatch(text: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex chars
      .replace(/\*/g, ".*"); // * becomes .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(text);
  }
}

/**
 * Policy Rule Set
 * Holds and evaluates an ordered collection of rules for a workspace.
 */
export class PolicyRuleSet {
  private rules: PolicyRule[] = [];
  private patternMatcher = new PatternMatcher();

  /**
   * Add a rule to the set, maintaining sort order by priority.
   */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a rule by ID.
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /**
   * Update an existing rule, maintaining sort order.
   */
  updateRule(ruleId: string, updates: Partial<PolicyRule>): void {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules[index] = { ...this.rules[index], ...updates };
      this.rules.sort((a, b) => a.priority - b.priority);
    }
  }

  /**
   * Evaluate a command against all rules.
   * Applies denylist-wins conflict resolution:
   * 1. If any matching rule is "blocked", result is blocked.
   * 2. Among remaining matches, most restrictive wins (needs-approval > safe).
   * 3. If no rules match, returns "blocked" (deny-by-default).
   */
  evaluate(command: string, context: CommandContext): PolicyEvaluationResult {
    const startTime = performance.now();
    const matchedRules = this.getMatchingRules(command, context);
    const classification = this.resolveClassification(matchedRules);
    const deniedByDefault = matchedRules.length === 0;

    const evaluationMs = performance.now() - startTime;

    return {
      classification,
      matchedRules,
      evaluationMs,
      deniedByDefault,
    };
  }

  private getMatchingRules(command: string, context: CommandContext): PolicyRule[] {
    return this.rules.filter(rule => this.matchesRule(command, context, rule));
  }

  private matchesRule(command: string, context: CommandContext, rule: PolicyRule): boolean {
    if (!this.patternMatcher.matches(command, rule.pattern, rule.patternType)) {
      return false;
    }
    return this.matchesTargets(context, rule.targets);
  }

  private matchesTargets(context: CommandContext, targets: string[] | undefined): boolean {
    if (!targets || targets.length === 0) {
      return true;
    }
    const affectedPaths = context.affectedPaths;
    if (!affectedPaths || affectedPaths.length === 0) {
      return false;
    }
    return this.hasMatchingTarget(context, targets);
  }

  private resolveClassification(matchedRules: PolicyRule[]): PolicyClassification {
    let hasBlockedRule = false;
    let hasApprovalRule = false;
    for (const rule of matchedRules) {
      if (rule.classification === PolicyClassification.Blocked) {
        hasBlockedRule = true;
      } else if (rule.classification === PolicyClassification.NeedsApproval) {
        hasApprovalRule = true;
      }
    }
    if (hasBlockedRule || matchedRules.length === 0) {
      return PolicyClassification.Blocked;
    }
    if (hasApprovalRule) {
      return PolicyClassification.NeedsApproval;
    }
    return PolicyClassification.Safe;
  }

  /**
   * Get the number of rules in this set.
   */
  getRuleCount(): number {
    return this.rules.length;
  }

  /**
   * Get all rules (for testing/inspection).
   */
  getRules(): PolicyRule[] {
    return [...this.rules];
  }

  private hasMatchingTarget(context: CommandContext, targets: string[] | undefined): boolean {
    if (!targets || targets.length === 0) {
      return false;
    }
    const affectedPaths = context.affectedPaths ?? [];
    return affectedPaths.some(path => this.matchesTarget(path, targets));
  }

  private matchesTarget(path: string, targets: string[]): boolean {
    return targets.some(target =>
      this.patternMatcher.matches(path, target, PolicyPatternType.Glob)
    );
  }
}
