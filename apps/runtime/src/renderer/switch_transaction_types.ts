import type { RendererAdapter, RendererConfig, RenderSurface } from "./adapter.js";
import type { SwitchBuffer } from "./stream_binding.js";
import type { RendererEventBus } from "./index.js";
import type { TerminalContext } from "./hot_swap.js";

export type SwitchTransactionState =
  | "pending"
  | "hot-swapping"
  | "restarting"
  | "committing"
  | "rolled-back"
  | "committed"
  | "degraded"
  | "failed";

export class ConcurrentSwitchError extends Error {
  constructor(activeTransactionId: string) {
    super(`Cannot start switch: transaction ${activeTransactionId} is already active`);
    this.name = "ConcurrentSwitchError";
  }
}

export class InvalidTransitionError extends Error {
  constructor(fromState: SwitchTransactionState, toState: SwitchTransactionState) {
    super(`Invalid switch transaction transition: ${fromState} -> ${toState}`);
    this.name = "InvalidTransitionError";
  }
}

export interface SwitchTransaction {
  id: string;
  state: SwitchTransactionState;
  sourceRendererId: string;
  targetRendererId: string;
  createdAt: number;
  updatedAt: number;
  correlationId: string;
  error?: Error;
}

export interface SwitchTransactionRequest {
  targetRendererId: string;
  sourceAdapter: RendererAdapter;
  targetAdapter: RendererAdapter;
  terminals: Map<string, TerminalContext>;
  streamBuffer: SwitchBuffer;
  config: RendererConfig;
  surface: RenderSurface;
  onProgress?: (state: SwitchTransactionState) => void;
}

export const VALID_TRANSITIONS: Record<SwitchTransactionState, SwitchTransactionState[]> = {
  pending: ["hot-swapping", "restarting"],
  "hot-swapping": ["committing", "rolled-back", "degraded"],
  restarting: ["committing", "rolled-back", "degraded"],
  committing: ["committed", "degraded"],
  committed: [],
  "rolled-back": [],
  degraded: ["committed", "rolled-back", "failed"],
  failed: [],
};
