// T007-T009 - Remediation engine with confirmation gates and recovery suppression

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LocalBus } from "../../protocol/bus.js";
import type { LaneRegistry } from "../registry.js";
import { CleanupExecutor, type CleanupResult } from "./cleanup_executor.js";
import type { ClassifiedOrphan } from "./resource_classifier.js";

export interface RemediationSuggestion {
  id: string;
  resource: ClassifiedOrphan;
  suggestedAction: string;
  requiresConfirmation: boolean;
  createdAt: string;
}

interface CooldownEntry {
  resourceKey: string;
  expiresAt: number; // milliseconds since epoch
}

export class RemediationEngine {
  private suggestions = new Map<string, RemediationSuggestion>();
  private cooldownMap = new Map<string, CooldownEntry>();
  private readonly cleanupExecutor = new CleanupExecutor();
  private readonly cooldownDurationMs = 24 * 60 * 60 * 1000; // 24 hours
  private readonly cooldownPath = path.join(
    os.homedir(),
    ".helios",
    "data",
    "remediation_cooldown.json"
  );

  constructor(
    private readonly laneRegistry: LaneRegistry,
    private readonly bus: LocalBus
  ) {
    this.loadCooldownMap();
  }

  async generateSuggestions(orphans: ClassifiedOrphan[]): Promise<RemediationSuggestion[]> {
    const suggestions: RemediationSuggestion[] = [];

    // Expire old cooldown entries
    this.expireCooldownEntries();

    for (const orphan of orphans) {
      // Check if resource is in cooldown
      const resourceKey = this.getResourceKey(orphan);
      if (this.cooldownMap.has(resourceKey)) {
        continue; // Skip resources in cooldown
      }

      // Suppress suggestions while the owning lane is in a transient cleanup state.
      if (orphan.estimatedOwner !== "unknown") {
        try {
          const lane = this.laneRegistry.get(orphan.estimatedOwner);
          if (lane && lane.state === "cleaning") {
            continue;
          }
        } catch {
          // Lane not found or error - proceed with suggestion
        }
      }

      const suggestion: RemediationSuggestion = {
        id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        resource: orphan,
        suggestedAction: this.getSuggestedAction(orphan),
        requiresConfirmation: true,
        createdAt: new Date().toISOString(),
      };

      suggestions.push(suggestion);
      this.suggestions.set(suggestion.id, suggestion);

      // Emit suggestion event
      await this.bus.publish({
        id: `remediation-suggested-${suggestion.id}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "orphan.remediation.suggested",
        payload: {
          suggestionId: suggestion.id,
          resourceType: orphan.type,
          resourcePath: orphan.path || orphan.pid,
          riskLevel: orphan.riskLevel,
          estimatedOwner: orphan.estimatedOwner,
        },
      });
    }

    return suggestions;
  }

  getSuggestions(): RemediationSuggestion[] {
    return Array.from(this.suggestions.values());
  }

  async confirmCleanup(suggestionId: string): Promise<CleanupResult> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      return {
        resourceId: suggestionId,
        success: false,
        message: "Suggestion not found",
        resourceType: "worktree",
      };
    }

    // Emit confirmation event
    await this.bus.publish({
      id: `remediation-confirmed-${suggestionId}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "orphan.remediation.confirmed",
      payload: {
        suggestionId,
        resourceType: suggestion.resource.type,
        resourcePath: suggestion.resource.path || suggestion.resource.pid,
      },
    });

    // Execute cleanup based on resource type
    const result = await this.cleanupExecutor.executeCleanup(suggestion.resource);

    // Remove suggestion after cleanup
    this.suggestions.delete(suggestionId);

    // Emit completion event
    await this.bus.publish({
      id: `remediation-completed-${suggestionId}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "orphan.remediation.completed",
      payload: {
        suggestionId,
        ...result,
      },
    });

    return result;
  }

  declineCleanup(suggestionId: string): void {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      return;
    }

    // Add resource to cooldown
    const resourceKey = this.getResourceKey(suggestion.resource);
    this.cooldownMap.set(resourceKey, {
      resourceKey,
      expiresAt: Date.now() + this.cooldownDurationMs,
    });

    // Persist cooldown
    this.saveCooldownMap();

    // Remove suggestion
    this.suggestions.delete(suggestionId);

    // Emit declined event
    this.bus.publish({
      id: `remediation-declined-${suggestionId}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "orphan.remediation.declined",
      payload: {
        suggestionId,
        resourcePath: suggestion.resource.path || suggestion.resource.pid,
        cooldownUntil: new Date(Date.now() + this.cooldownDurationMs).toISOString(),
      },
    });
  }

  private getSuggestedAction(orphan: ClassifiedOrphan): string {
    switch (orphan.type) {
      case "worktree":
        return `Delete orphaned worktree at ${orphan.path}`;
      case "zellij_session":
        return `Terminate stale zellij session: ${orphan.path}`;
      case "pty_process":
        return `Terminate leaked PTY process (PID ${orphan.pid})`;
      default:
        return "Unknown cleanup action";
    }
  }

  private getResourceKey(orphan: ClassifiedOrphan): string {
    if (orphan.path) {
      return `${orphan.type}:${orphan.path}`;
    }
    if (orphan.pid) {
      return `${orphan.type}:${orphan.pid}`;
    }
    return `${orphan.type}:unknown`;
  }

  private expireCooldownEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cooldownMap.entries()) {
      if (entry.expiresAt <= now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cooldownMap.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.saveCooldownMap();
    }
  }

  private async loadCooldownMap(): Promise<void> {
    try {
      const content = await fs.readFile(this.cooldownPath, "utf-8");
      const entries = JSON.parse(content) as CooldownEntry[];
      for (const entry of entries) {
        this.cooldownMap.set(entry.resourceKey, entry);
      }
      // Expire old entries
      this.expireCooldownEntries();
    } catch {
      // File doesn't exist or is corrupt - start fresh
    }
  }

  private saveCooldownMap(): void {
    try {
      const dir = path.dirname(this.cooldownPath);
      fs.mkdir(dir, { recursive: true }).then(() => {
        const entries = Array.from(this.cooldownMap.values());
        fs.writeFile(this.cooldownPath, JSON.stringify(entries, null, 2));
      });
    } catch (_error) {}
  }
}
