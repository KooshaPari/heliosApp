import type { LocalBus } from "../protocol/bus.js";
import { randomUUID } from "crypto";
import {
  deleteRecoveryState,
  loadRecoveryState,
  persistRecoveryState,
} from "./state-machine-persistence.js";
import {
  getFailureStateFor,
  isFailureState,
  LEGAL_TRANSITIONS,
} from "./state-machine-transitions.js";
import {
  MAX_RETRIES_PER_STAGE,
  RecoveryStage,
  type RecoveryState,
  STAGE_TIMEOUT_MS,
  type StageChangeListener,
} from "./state-machine-types.js";

<<<<<<< HEAD
export { RecoveryStage } from "./state-machine-types.js";
export type { RecoveryState, StageChangeListener } from "./state-machine-types.js";
=======
export enum RecoveryStage {
  CRASHED = "CRASHED",
  DETECTING = "DETECTING",
  INVENTORYING = "INVENTORYING",
  RESTORING = "RESTORING",
  RECONCILING = "RECONCILING",
  LIVE = "LIVE",
  DETECTION_FAILED = "DETECTION_FAILED",
  INVENTORY_FAILED = "INVENTORY_FAILED",
  RESTORATION_FAILED = "RESTORATION_FAILED",
  RECONCILIATION_FAILED = "RECONCILIATION_FAILED",
}

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
  [RecoveryStage.CRASHED]: [RecoveryStage.DETECTING],
  [RecoveryStage.DETECTING]: [RecoveryStage.INVENTORYING, RecoveryStage.DETECTION_FAILED],
  [RecoveryStage.INVENTORYING]: [RecoveryStage.RESTORING, RecoveryStage.INVENTORY_FAILED],
  [RecoveryStage.RESTORING]: [RecoveryStage.RECONCILING, RecoveryStage.RESTORATION_FAILED],
  [RecoveryStage.RECONCILING]: [RecoveryStage.LIVE, RecoveryStage.RECONCILIATION_FAILED],
  [RecoveryStage.LIVE]: [], // Terminal state
  [RecoveryStage.DETECTION_FAILED]: [RecoveryStage.DETECTING], // Retry
  [RecoveryStage.INVENTORY_FAILED]: [RecoveryStage.INVENTORYING],
  [RecoveryStage.RESTORATION_FAILED]: [RecoveryStage.RESTORING],
  [RecoveryStage.RECONCILIATION_FAILED]: [RecoveryStage.RECONCILING],
};

const MAX_RETRIES_PER_STAGE = 3;
const STAGE_TIMEOUT_MS = 30000; // 30 seconds
>>>>>>> origin/main

export class RecoveryStateMachine {
  private currentStage: RecoveryStage = RecoveryStage.CRASHED;
  private currentState: RecoveryState;
  private recoveryDataDir: string;
  private bus?: LocalBus;
  private listeners: StageChangeListener[] = [];
  private stageTimeoutId?: ReturnType<typeof setTimeout> | undefined;

  constructor(recoveryDataDir: string, bus?: LocalBus) {
    this.recoveryDataDir = recoveryDataDir;
    this.bus = bus;
    this.currentState = {
      stage: RecoveryStage.CRASHED,
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

    const legalTransitions = LEGAL_TRANSITIONS[from] || [];
    if (!legalTransitions.includes(to)) {
      throw new Error(
        `Illegal transition from ${from} to ${to}. Legal: ${legalTransitions.join(", ")}`,
      );
    }

    const isRetry = isFailureState(from) && isFailureState(to) === false;
    if (isRetry) {
      this.currentState.attemptCount++;
      if (this.currentState.attemptCount > MAX_RETRIES_PER_STAGE) {
        throw new Error(`Max retries (${MAX_RETRIES_PER_STAGE}) exceeded for stage ${from}`);
      }
    } else if (from !== to && !isFailureState(to)) {
      this.currentState.attemptCount = 0;
    }

    this.currentStage = to;
    this.currentState.stage = to;
    this.currentState.timestamp = Date.now();

    await persistRecoveryState(this.recoveryDataDir, this.currentState);

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

    this.notifyListeners(from, to, this.currentState.attemptCount);
    this.startStageTimeout();
  }

  async resume(): Promise<RecoveryStage> {
    await this.loadState();
    return this.currentStage;
  }

  async reset(): Promise<void> {
    this.currentStage = RecoveryStage.CRASHED;
    this.currentState = {
      stage: RecoveryStage.CRASHED,
      timestamp: Date.now(),
      attemptCount: 0,
    };
    await deleteRecoveryState(this.recoveryDataDir);
    this.clearStageTimeout();
  }

  onStageChange(listener: StageChangeListener): void {
    this.listeners.push(listener);
  }

  private async loadState(): Promise<void> {
    const state = await loadRecoveryState(this.recoveryDataDir);
    if (state) {
      this.currentStage = state.stage;
      this.currentState = state;
<<<<<<< HEAD
      return;
=======
    } catch {
      // No persisted state - start fresh
      this.currentStage = RecoveryStage.CRASHED;
      this.currentState = {
        stage: RecoveryStage.CRASHED,
        timestamp: Date.now(),
        attemptCount: 0,
      };
>>>>>>> origin/main
    }

    this.currentStage = RecoveryStage.CRASHED;
    this.currentState = {
      stage: RecoveryStage.CRASHED,
      timestamp: Date.now(),
      attemptCount: 0,
    };
  }

<<<<<<< HEAD
=======
  private async persistState(): Promise<void> {
    try {
      await fs.mkdir(path.join(this.recoveryDataDir, "recovery"), {
        recursive: true,
      });

      const statePath = path.join(this.recoveryDataDir, "recovery", "recovery-state.json");
      const tempPath = `${statePath}.tmp`;

      // Atomic write
      await fs.writeFile(tempPath, JSON.stringify(this.currentState, null, 2));
      await fs.rename(tempPath, statePath);
    } catch (err) {
      console.error("Failed to persist recovery state:", err);
    }
  }

  private async deleteState(): Promise<void> {
    try {
      const statePath = path.join(this.recoveryDataDir, "recovery", "recovery-state.json");
      await fs.unlink(statePath);
    } catch {
      // File doesn't exist - ok
    }
  }

>>>>>>> origin/main
  private notifyListeners(from: RecoveryStage, to: RecoveryStage, attemptCount: number): void {
    for (const listener of this.listeners) {
      listener(from, to, attemptCount);
    }
  }

  private startStageTimeout(): void {
    this.clearStageTimeout();

    this.stageTimeoutId = setTimeout(() => {
      if (!isFailureState(this.currentStage)) {
        const failureStage = getFailureStateFor(this.currentStage);
        if (failureStage) {
          this.currentState.lastError = `Stage timeout after ${STAGE_TIMEOUT_MS}ms`;
          this.transition(failureStage).catch(err => {
            console.error("Failed to transition to failure state:", err);
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
<<<<<<< HEAD
=======

  private getFailureStateFor(stage: RecoveryStage): RecoveryStage | undefined {
    const failureMap: Record<RecoveryStage, RecoveryStage | undefined> = {
      [RecoveryStage.DETECTING]: RecoveryStage.DETECTION_FAILED,
      [RecoveryStage.INVENTORYING]: RecoveryStage.INVENTORY_FAILED,
      [RecoveryStage.RESTORING]: RecoveryStage.RESTORATION_FAILED,
      [RecoveryStage.RECONCILING]: RecoveryStage.RECONCILIATION_FAILED,
      [RecoveryStage.CRASHED]: RecoveryStage.CRASHED,
      [RecoveryStage.LIVE]: undefined,
      [RecoveryStage.DETECTION_FAILED]: undefined,
      [RecoveryStage.INVENTORY_FAILED]: undefined,
      [RecoveryStage.RESTORATION_FAILED]: undefined,
      [RecoveryStage.RECONCILIATION_FAILED]: undefined,
    };
    return failureMap[stage];
  }
>>>>>>> origin/main
}
