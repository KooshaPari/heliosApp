<<<<<<< HEAD
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProtocolBus as LocalBus } from "../protocol/bus.js";
=======
import type { LocalBus } from "../protocol/bus.js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
>>>>>>> origin/main

export interface CrashRecord {
  timestamp: number;
}

export class CrashLoopDetector {
  private crashHistory: number[] = [];
  private crashDataDir: string;
  private thresholdCount: number;
  private windowMs: number;

<<<<<<< HEAD
  constructor(crashDataDir: string, thresholdCount = 3, windowMs = 60000) {
=======
  constructor(crashDataDir: string, thresholdCount: number = 3, windowMs: number = 60000) {
>>>>>>> origin/main
    this.crashDataDir = crashDataDir;
    this.thresholdCount = thresholdCount;
    this.windowMs = windowMs;
  }

  async initialize(): Promise<void> {
    await this.loadCrashHistory();
  }

  recordCrash(timestamp: number): void {
    this.crashHistory.push(timestamp);
    this.cleanOldCrashes();
    this.persistCrashHistory();
  }

  isLooping(): boolean {
    this.cleanOldCrashes();
    return this.crashHistory.length >= this.thresholdCount;
  }

  private cleanOldCrashes(): void {
    const now = Date.now();
    this.crashHistory = this.crashHistory.filter(ts => now - ts < this.windowMs);
  }

  private async loadCrashHistory(): Promise<void> {
    try {
      const historyPath = path.join(this.crashDataDir, "recovery", "crash-history.json");
      const data = await fs.readFile(historyPath, "utf-8");
      const parsed = JSON.parse(data) as number[];
      if (Array.isArray(parsed)) {
        this.crashHistory = parsed;
        this.cleanOldCrashes();
      }
    } catch {
      // History file doesn't exist or is corrupted - start with empty history
      this.crashHistory = [];
    }
  }

  private persistCrashHistory(): void {
    try {
<<<<<<< HEAD
      const dir = path.join(this.crashDataDir, "recovery");
      const historyPath = path.join(dir, "crash-history.json");
      const tempPath = `${historyPath}.tmp`;

      // Atomic write (ensure directory exists first)
      fs.mkdir(dir, { recursive: true })
        .then(() =>
          fs.writeFile(tempPath, JSON.stringify(this.crashHistory), { encoding: "utf-8" })
        )
        .then(() => fs.rename(tempPath, historyPath))
        .catch(_err => {});
    } catch (_err) {}
=======
      const historyPath = path.join(this.crashDataDir, "recovery", "crash-history.json");
      const tempPath = `${historyPath}.tmp`;

      // Atomic write
      fs.writeFile(tempPath, JSON.stringify(this.crashHistory), {
        encoding: "utf-8",
      })
        .then(() => fs.rename(tempPath, historyPath))
        .catch(err => {
          // Silently fail - don't let history persistence block operations
          console.error("Failed to persist crash history:", err);
        });
    } catch (err) {
      console.error("Failed to persist crash history:", err);
    }
>>>>>>> origin/main
  }
}

export interface SafeModeConfig {
  disableProviders?: boolean;
  disableShareSessions?: boolean;
  disableBackgroundCheckpoints?: boolean;
}

type SafeModeChangeListener = (active: boolean) => void;

export class SafeMode {
  private active = false;
<<<<<<< HEAD
  private bus?: LocalBus | undefined;
=======
  private bus?: LocalBus;
>>>>>>> origin/main
  private listeners: SafeModeChangeListener[] = [];
  private config: SafeModeConfig;

  constructor(bus?: LocalBus, config: SafeModeConfig = {}) {
    this.bus = bus;
    this.config = {
      disableProviders: config.disableProviders !== false,
      disableShareSessions: config.disableShareSessions !== false,
      disableBackgroundCheckpoints: config.disableBackgroundCheckpoints !== false,
    };
  }

  async enter(): Promise<void> {
<<<<<<< HEAD
    if (this.active) {
      return;
    }
=======
    if (this.active) return;
>>>>>>> origin/main

    this.active = true;

    // Publish event
    if (this.bus) {
      await this.bus.publish({
        id: randomUUID(),
        type: "event",
        ts: new Date().toISOString(),
        topic: "recovery.safemode.entered",
        payload: {
          timestamp: Date.now(),
          config: this.config,
        },
      });
    }

    // Notify listeners
    this.notifyListeners(true);
  }

  async exit(): Promise<void> {
<<<<<<< HEAD
    if (!this.active) {
      return;
    }
=======
    if (!this.active) return;
>>>>>>> origin/main

    this.active = false;

    // Publish event
    if (this.bus) {
      await this.bus.publish({
        id: randomUUID(),
        type: "event",
        ts: new Date().toISOString(),
        topic: "recovery.safemode.exited",
        payload: {
          timestamp: Date.now(),
        },
      });
    }

    // Notify listeners
    this.notifyListeners(false);
  }

  isActive(): boolean {
    return this.active;
  }

  onStateChange(listener: SafeModeChangeListener): void {
    this.listeners.push(listener);
  }

  private notifyListeners(active: boolean): void {
    for (const listener of this.listeners) {
      listener(active);
    }
  }

  // Query methods for subsystems to check if they should be active
  isProvidersEnabled(): boolean {
<<<<<<< HEAD
    return !(this.active && this.config.disableProviders);
  }

  isShareSessionsEnabled(): boolean {
    return !(this.active && this.config.disableShareSessions);
  }

  isBackgroundCheckpointsEnabled(): boolean {
    return !(this.active && this.config.disableBackgroundCheckpoints);
=======
    return !this.active || !this.config.disableProviders;
  }

  isShareSessionsEnabled(): boolean {
    return !this.active || !this.config.disableShareSessions;
  }

  isBackgroundCheckpointsEnabled(): boolean {
    return !this.active || !this.config.disableBackgroundCheckpoints;
>>>>>>> origin/main
  }
}
