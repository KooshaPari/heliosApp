/**
 * T002/T003/T004 - Session create, reattach, and terminate operations.
 *
 * Manages the lifecycle of zellij sessions bound to lanes.
 */

import type { ZellijCli } from "./cli.js";
import type { MuxEventEmitter } from "./events.js";
import type { MuxRegistry } from "./registry.js";
import { createZellijSession } from "./session/create.js";
import { reattachZellijSession } from "./session/reattach.js";
import { terminateZellijSession } from "./session/terminate.js";
import type { TopologyTracker } from "./topology.js";
import type { MuxSession, PtyManagerInterface, SessionOptions } from "./types.js";

/**
 * Generate the canonical session name for a lane.
 */
export function sessionNameForLane(laneId: string): string {
  return `helios-lane-${laneId}`;
}

export class ZellijSessionManager {
  private readonly cli: ZellijCli;
  private readonly registry: MuxRegistry;
  private readonly topology: TopologyTracker | undefined;
  private readonly ptyManager: PtyManagerInterface | undefined;
  private readonly emitter: MuxEventEmitter | undefined;

  constructor(
    cli: ZellijCli,
    registry: MuxRegistry,
    options?: {
      topology?: TopologyTracker;
      ptyManager?: PtyManagerInterface;
      emitter?: MuxEventEmitter;
    }
  ) {
    this.cli = cli;
    this.registry = registry;
    this.topology = options?.topology;
    this.ptyManager = options?.ptyManager;
    this.emitter = options?.emitter;
  }

  /**
   * T002 - Create a new zellij session bound to a lane.
   */
  async createSession(laneId: string, options?: SessionOptions): Promise<MuxSession> {
    return createZellijSession({
      cli: this.cli,
      registry: this.registry,
      laneId,
      sessionName: sessionNameForLane(laneId),
      options,
    });
  }

  /**
   * T003 / T012 - Reattach to an existing zellij session.
   *
   * When a TopologyTracker is available, recovers pane topology from
   * zellij dump-layout, rebuilds tracker state, and re-binds PTYs.
   * Emits mux.session.reattached when an emitter is configured.
   */
  async reattachSession(sessionName: string): Promise<MuxSession> {
    return reattachZellijSession({
      cli: this.cli,
      registry: this.registry,
      topology: this.topology,
      ptyManager: this.ptyManager,
      emitter: this.emitter,
      sessionName,
    });
  }

  /**
   * T004 - Terminate a zellij session and clean up.
   */
  async terminateSession(sessionName: string): Promise<void> {
    return terminateZellijSession({
      cli: this.cli,
      registry: this.registry,
      sessionName,
    });
  }
}
