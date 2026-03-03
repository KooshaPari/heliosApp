import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProtocolBus as LocalBus } from "../protocol/bus.js";

export enum RecoveryStage {
  Crashed = "CRASHED",
  Detecting = "DETECTING",
  Inventorying = "INVENTORYING",
  Restoring = "RESTORING",
  Reconciling = "RECONCILING",
  Live = "LIVE",
  DetectionFailed = "DETECTION_FAILED",
  InventoryFailed = "INVENTORY_FAILED",
  RestorationFailed = "RESTORATION_FAILED",
  ReconciliationFailed = "RECONCILIATION_FAILED",
}

const recoveryStageEnumCompat = RecoveryStage as Record<string, RecoveryStage>;
recoveryStageEnumCompat.CRASHED = RecoveryStage.Crashed;
recoveryStageEnumCompat.DETECTING = RecoveryStage.Detecting;
recoveryStageEnumCompat.INVENTORYING = RecoveryStage.Inventorying;
recoveryStageEnumCompat.RESTORING = RecoveryStage.Restoring;
recoveryStageEnumCompat.RECONCILING = RecoveryStage.Reconciling;
recoveryStageEnumCompat.LIVE = RecoveryStage.Live;
recoveryStageEnumCompat.DETECTION_FAILED = RecoveryStage.DetectionFailed;
recoveryStageEnumCompat.INVENTORY_FAILED = RecoveryStage.InventoryFailed;
recoveryStageEnumCompat.RESTORATION_FAILED = RecoveryStage.RestorationFailed;
recoveryStageEnumCompat.RECONCILIATION_FAILED = RecoveryStage.ReconciliationFailed;

export interface RecoveryState {
  stage: RecoveryStage;
  timestamp: number;
  attemptCount: number;
  lastError?: string;
}

type StageChangeListener = (
  previous: RecoveryStage,
  current: RecoveryStage,
  attemptCount: number
) => void;

const LEGAL_TRANSITIONS: Record<RecoveryStage, RecoveryStage[]> = {
  [RecoveryStage.Crashed]: [RecoveryStage.Detecting],
  [RecoveryStage.Detecting]: [RecoveryStage.Inventorying, RecoveryStage.DetectionFailed],
  [RecoveryStage.Inventorying]: [RecoveryStage.Restoring, RecoveryStage.InventoryFailed],
  [RecoveryStage.Restoring]: [RecoveryStage.Reconciling, RecoveryStage.RestorationFailed],
  [RecoveryStage.Reconciling]: [RecoveryStage.Live, RecoveryStage.ReconciliationFailed],
  [RecoveryStage.Live]: [], // Terminal state
  [RecoveryStage.DetectionFailed]: [RecoveryStage.Detecting], // Retry
  [RecoveryStage.InventoryFailed]: [RecoveryStage.Inventorying],
  [RecoveryStage.RestorationFailed]: [RecoveryStage.Restoring],
  [RecoveryStage.ReconciliationFailed]: [RecoveryStage.Reconciling],
};

const MAX_RETRIES_PER_STAGE = 3;
const STAGE_TIMEOUT_MS = 30000; // 30 seconds
const RECOVERY_STATE_FILE = "recovery-state.json";
const RECOVERY_DIR = "recovery";

export class RecoveryStateMachine {
  private currentStage: RecoveryStage = RecoveryStage.Crashed;
  private currentState: RecoveryState;
  private recoveryDataDir: string;
  private bus?: LocalBus | undefined;
  private listeners: StageChangeListener[] = [];
  private stageTimeoutId?: NodeJS.Timeout | undefined;

  constructor(recoveryDataDir: string, bus?: LocalBus) {
    this.recoveryDataDir = recoveryDataDir;
    this.bus = bus;
    this.currentState = {
      stage: RecoveryStage.Crashed,
      timestamp: Date.now(),
      attemptCount: 0,
    };
  }

  async initialize(): Promise<void> {
    await this.loadState();
  }

  getCurrentStage(): RecoveryStage {
    return this.currentStage;
  }

  async transition(to: RecoveryStage): Promise<void> {
    const from = this.currentStage;

    // Validate transition
    const legalTransitions = LEGAL_TRANSITIONS[from] || [];
    if (!legalTransitions.includes(to)) {
      throw new Error(
        `Illegal transition from ${from} to ${to}. Legal: ${legalTransitions.join(", ")}`
      );
    }

    // Update state
    const isRetry = this.isFailureState(from) && this.isFailureState(to) === false;
    if (isRetry) {
      // Retrying - increment attempt count
      this.currentState.attemptCount++;
      if (this.currentState.attemptCount > MAX_RETRIES_PER_STAGE) {
        throw new Error(`Max retries (${MAX_RETRIES_PER_STAGE}) exceeded for stage ${from}`);
      }
    } else if (from !== to && !this.isFailureState(to)) {
      // New non-failure stage - reset attempt count
      this.currentState.attemptCount = 0;
    }

    this.currentStage = to;
    this.currentState.stage = to;
    this.currentState.timestamp = Date.now();

    // Persist state
    await this.persistState();

    // Publish event
    if (this.bus) {
      await this.bus.publish({
        id: randomUUID(),
        type: "event",
        ts: new Date().toISOString(),
        topic: "recovery.stage.changed",
        payload: {
          previous: from,
          current: to,
          timestamp: this.currentState.timestamp,
          attemptCount: this.currentState.attemptCount,
        },
      });
    }

    // Notify listeners
    this.notifyListeners(from, to, this.currentState.attemptCount);

    // Set stage timeout
    this.startStageTimeout();
  }

  async resume(): Promise<RecoveryStage> {
    await this.loadState();
    return this.currentStage;
  }

  async reset(): Promise<void> {
    this.currentStage = RecoveryStage.Crashed;
    this.currentState = {
      stage: RecoveryStage.Crashed,
      timestamp: Date.now(),
      attemptCount: 0,
    };
    await this.deleteState();
    this.clearStageTimeout();
  }

  onStageChange(listener: StageChangeListener): void {
    this.listeners.push(listener);
  }

  private isFailureState(stage: RecoveryStage): boolean {
    return stage.includes("FAILED");
  }

  private createDefaultState(): RecoveryState {
    return {
      stage: RecoveryStage.Crashed,
      timestamp: Date.now(),
      attemptCount: 0,
    };
  }

  private parsePersistedState(rawData: string): RecoveryState | undefined {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return undefined;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }

    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.stage !== "string") {
      return undefined;
    }

    const allowedStages = new Set(Object.values(RecoveryStage));
    if (!allowedStages.has(candidate.stage as RecoveryStage)) {
      return {
        stage: RecoveryStage.Crashed,
        timestamp: Date.now(),
        attemptCount: 0,
      };
    }

    if (!Number.isFinite(candidate.timestamp) || typeof candidate.timestamp !== "number") {
      return undefined;
    }

    if (
      !Number.isInteger(candidate.attemptCount) ||
      typeof candidate.attemptCount !== "number" ||
      candidate.attemptCount < 0
    ) {
      return undefined;
    }

    if (candidate.lastError !== undefined && typeof candidate.lastError !== "string") {
      return undefined;
    }

    const state: RecoveryState = {
      stage: candidate.stage as RecoveryStage,
      timestamp: candidate.timestamp,
      attemptCount: candidate.attemptCount,
    };
    if (typeof candidate.lastError === "string") {
      state.lastError = candidate.lastError;
    }
    return state;
  }

  private async loadState(): Promise<void> {
    try {
      const statePath = path.join(this.recoveryDataDir, RECOVERY_DIR, RECOVERY_STATE_FILE);
      const data = await fs.readFile(statePath, "utf-8");
      const state = this.parsePersistedState(data);
      if (!state) {
        throw new Error("Invalid persisted recovery state");
      }
      this.currentStage = state.stage;
      this.currentState = state;
    } catch {
      // No persisted state - start fresh
      const defaultState = this.createDefaultState();
      this.currentStage = defaultState.stage;
      this.currentState = defaultState;
    }
  }

  private async persistState(): Promise<void> {
    try {
      await fs.mkdir(path.join(this.recoveryDataDir, RECOVERY_DIR), {
        recursive: true,
      });

      const statePath = path.join(this.recoveryDataDir, RECOVERY_DIR, RECOVERY_STATE_FILE);
      const tempPath = `${statePath}.tmp`;

      // Atomic write
      await fs.writeFile(tempPath, JSON.stringify(this.currentState, null, 2));
      await fs.rename(tempPath, statePath);
    } catch (_error) {
      // Ignore persistence errors to keep recovery state machine bootable
      // if the file system is temporarily unavailable.
    }
  }

  private async deleteState(): Promise<void> {
    try {
      const statePath = path.join(this.recoveryDataDir, RECOVERY_DIR, RECOVERY_STATE_FILE);
      await fs.unlink(statePath);
    } catch {
      // File doesn't exist - ok
    }
  }

  private notifyListeners(from: RecoveryStage, to: RecoveryStage, attemptCount: number): void {
    for (const listener of this.listeners) {
      listener(from, to, attemptCount);
    }
  }

  private startStageTimeout(): void {
    this.clearStageTimeout();

    this.stageTimeoutId = setTimeout(() => {
      // Transition to failure state if not already in one
      if (!this.isFailureState(this.currentStage)) {
        const failureStage = this.getFailureStateFor(this.currentStage);
        if (failureStage) {
          this.currentState.lastError = `Stage timeout after ${STAGE_TIMEOUT_MS}ms`;
          this.transition(failureStage).catch(error => {
            // Stage transition failures are expected if the state changed concurrently.
            this.currentState.lastError =
              error instanceof Error
                ? `Recovery stage timeout transition failed: ${error.message}`
                : "Recovery stage timeout transition failed";
          });
        }
      }
    }, STAGE_TIMEOUT_MS);
  }

  private clearStageTimeout(): void {
    if (this.stageTimeoutId) {
      clearTimeout(this.stageTimeoutId);
      this.stageTimeoutId = undefined;
    }
  }

  private getFailureStateFor(stage: RecoveryStage): RecoveryStage | undefined {
    const failureMap: Record<RecoveryStage, RecoveryStage | undefined> = {
      [RecoveryStage.Detecting]: RecoveryStage.DetectionFailed,
      [RecoveryStage.Inventorying]: RecoveryStage.InventoryFailed,
      [RecoveryStage.Restoring]: RecoveryStage.RestorationFailed,
      [RecoveryStage.Reconciling]: RecoveryStage.ReconciliationFailed,
      [RecoveryStage.Crashed]: RecoveryStage.Crashed,
      [RecoveryStage.Live]: undefined,
      [RecoveryStage.DetectionFailed]: undefined,
      [RecoveryStage.InventoryFailed]: undefined,
      [RecoveryStage.RestorationFailed]: undefined,
      [RecoveryStage.ReconciliationFailed]: undefined,
    };
    return failureMap[stage];
  }
}
