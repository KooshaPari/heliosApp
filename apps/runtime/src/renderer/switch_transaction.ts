import { executeHotSwap } from "./hot_swap.js";
import type { RendererEventBus } from "./index.js";
import { executeRestartWithRestore } from "./restart_restore.js";
import { executeRollback } from "./rollback.js";
import { SwitchTerminalCreationQueue } from "./switch_transaction_queue.js";
import {
  ConcurrentSwitchError,
  InvalidTransitionError,
  type SwitchTransaction,
  type SwitchTransactionRequest,
  type SwitchTransactionState,
  VALID_TRANSITIONS,
} from "./switch_transaction_types.js";

export {
  ConcurrentSwitchError,
  InvalidTransitionError,
} from "./switch_transaction_types.js";

export type {
  SwitchTransaction,
  SwitchTransactionRequest,
  SwitchTransactionState,
} from "./switch_transaction_types.js";

// ---------------------------------------------------------------------------
// Switch transaction orchestrator
// ---------------------------------------------------------------------------

export class SwitchTransactionOrchestrator {
  private _activeTransaction: SwitchTransaction | undefined;
  private readonly _eventBus: RendererEventBus | undefined;
  private readonly _terminalCreationQueue = new SwitchTerminalCreationQueue();
  private readonly _queueTimeoutMs = 30000; // 30 second default timeout

  constructor(eventBus?: RendererEventBus) {
    this._eventBus = eventBus;
  }

  /**
   * Start a new renderer switch transaction.
   *
   * Validates that no switch is in progress, creates a new transaction,
   * and routes to hot-swap or restart based on capability matrix.
   *
   * @param request - Switch request with renderers, terminals, and buffers.
   * @returns The completed transaction.
   * @throws {ConcurrentSwitchError} if a switch is already in progress.
   */
  async startSwitch(request: SwitchTransactionRequest): Promise<SwitchTransaction> {
    // Check concurrent transaction guard
    if (
      this._activeTransaction !== undefined &&
      this._activeTransaction.state !== "committed" &&
      this._activeTransaction.state !== "rolled-back" &&
      this._activeTransaction.state !== "failed" &&
      this._activeTransaction.state !== "degraded"
    ) {
      throw new ConcurrentSwitchError(this._activeTransaction.id);
    }

    // Create new transaction
    const transaction: SwitchTransaction = {
      id: crypto.randomUUID(),
      state: "pending",
      sourceRendererId: request.sourceAdapter.id,
      targetRendererId: request.targetRendererId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      correlationId: crypto.randomUUID(),
    };

    this._activeTransaction = transaction;

    try {
      // Route to hot-swap (WP02 focus) or restart-with-restore (WP03)
      // For now, assume hot-swap capability check (in real impl, query capability matrix)
      const canHotSwap = true;

      let result: SwitchTransaction;
      if (canHotSwap) {
        result = await this._executeHotSwapPath(transaction, request);
      } else {
        result = await this._executeRestartRestorePath(transaction, request);
      }

      // Drain terminal creation queue after transaction completes
      if (
        result.state === "committed" ||
        result.state === "rolled-back" ||
        result.state === "degraded"
      ) {
        this._drainTerminalCreationQueue();
      }

      return result;
    } catch (error: unknown) {
      transaction.state = "failed";
      transaction.error = error instanceof Error ? error : new Error(String(error));
      this._drainTerminalCreationQueue();
      throw error;
    }
  }

  /**
   * Execute hot-swap transition path.
   * @private
   */
  private async _executeHotSwapPath(
    transaction: SwitchTransaction,
    request: SwitchTransactionRequest
  ): Promise<SwitchTransaction> {
    // Transition to hot-swapping
    this._transitionState(transaction, "hot-swapping");
    request.onProgress?.("hot-swapping");

    try {
      // Execute hot-swap
      const result = await executeHotSwap(
        request.sourceAdapter,
        request.targetAdapter,
        request.terminals,
        request.streamBuffer,
        request.config,
        request.surface,
        async (error: Error) => {
          // Rollback callback
          await executeRollback(
            request.sourceAdapter,
            request.targetAdapter,
            request.terminals,
            request.streamBuffer,
            error.message,
            this._eventBus
          );
        },
        this._eventBus
      );

      if (result.success) {
        // Transition to committing
        this._transitionState(transaction, "committing");
        request.onProgress?.("committing");

        // Transition to committed
        this._transitionState(transaction, "committed");
        request.onProgress?.("committed");

        return transaction;
      }
      // Hot-swap failed, rollback was triggered
      this._transitionState(transaction, "rolled-back");
      request.onProgress?.("rolled-back");

      transaction.error = result.error;
      return transaction;
    } catch (error: unknown) {
      // Unexpected error during hot-swap
      this._transitionState(transaction, "failed");
      request.onProgress?.("failed");

      transaction.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  /**
   * Execute restart-with-restore transition path (WP03).
   * @private
   */
  private async _executeRestartRestorePath(
    transaction: SwitchTransaction,
    request: SwitchTransactionRequest
  ): Promise<SwitchTransaction> {
    // Transition to restarting
    this._transitionState(transaction, "restarting");
    request.onProgress?.("restarting");

    try {
      // Execute restart-with-restore
      const result = await executeRestartWithRestore(
        request.sourceAdapter,
        request.targetAdapter,
        request.terminals,
        request.streamBuffer,
        request.config,
        request.surface,
        async (error: Error) => {
          // Rollback callback
          await executeRollback(
            request.sourceAdapter,
            request.targetAdapter,
            request.terminals,
            request.streamBuffer,
            error.message,
            this._eventBus
          );
        },
        this._eventBus
      );

      if (result.success) {
        // Transition to committing
        this._transitionState(transaction, "committing");
        request.onProgress?.("committing");

        // Transition to committed
        this._transitionState(transaction, "committed");
        request.onProgress?.("committed");

        return transaction;
      }
      // Restart-with-restore failed, rollback was triggered
      this._transitionState(transaction, "rolled-back");
      request.onProgress?.("rolled-back");

      transaction.error = result.error;
      return transaction;
    } catch (error: unknown) {
      // Unexpected error during restart-with-restore
      this._transitionState(transaction, "failed");
      request.onProgress?.("failed");

      transaction.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  /**
   * Transition the transaction to a new state with validation.
   * @private
   */
  private _transitionState(transaction: SwitchTransaction, toState: SwitchTransactionState): void {
    const validNextStates = VALID_TRANSITIONS[transaction.state];
    if (!validNextStates.includes(toState)) {
      throw new InvalidTransitionError(transaction.state, toState);
    }
    transaction.state = toState;
    transaction.updatedAt = Date.now();
  }

  /**
   * Get the active transaction, if any.
   */
  getActiveTransaction(): SwitchTransaction | undefined {
    return this._activeTransaction;
  }

  /**
   * Check if a switch is in progress.
   */
  isSwitchInProgress(): boolean {
    if (this._activeTransaction === undefined) {
      return false;
    }
    const { state } = this._activeTransaction;
    return (
      state !== "committed" && state !== "rolled-back" && state !== "failed" && state !== "degraded"
    );
  }

  /**
   * Queue a terminal creation request during an active transaction.
   *
   * If a switch is in progress, returns a promise that resolves after
   * the transaction completes. If no switch is active, executes immediately.
   *
   * @param params - Terminal creation parameters.
   * @returns Promise that resolves when the terminal creation completes.
   */
  queueTerminalCreation(params: unknown): Promise<unknown> {
    if (!this.isSwitchInProgress()) {
      // No switch active, would execute immediately (real impl would spawn terminal)
      return Promise.resolve(params);
    }

    return this._terminalCreationQueue.enqueue(params, this._queueTimeoutMs);
  }

  /**
   * Drain the terminal creation queue after transaction completion.
   *
   * Processes all queued creation requests in order, resolving each promise.
   * Called automatically when a transaction completes (committed, rolled-back, or degraded).
   *
   * @private
   */
  private _drainTerminalCreationQueue(): void {
    this._terminalCreationQueue.drain();
  }
}

/**
 * Create a new switch transaction orchestrator instance.
 */
export function createSwitchOrchestrator(
  eventBus?: RendererEventBus
): SwitchTransactionOrchestrator {
  return new SwitchTransactionOrchestrator(eventBus);
}
