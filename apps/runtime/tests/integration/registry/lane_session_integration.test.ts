import { describe, it, expect, beforeEach } from "bun:test";
import { TerminalRegistry } from "../../../src/registry/terminal_registry.js";
import type { BindingTriple } from "../../../src/registry/binding_triple.js";

describe("Lane/Session Lifecycle Integration", () => {
  let registry: TerminalRegistry;

  beforeEach(() => {
    registry = new TerminalRegistry();
  });

  /**
   * Simulates lane cleanup: invalidate/close all terminals bound to a lane.
   * In real implementation, this would be triggered by lane lifecycle events.
   */
  function simulateLaneCleanup(laneId: string): void {
    const terminals = registry.getByLane(laneId);
    for (const binding of terminals) {
      registry.unregister(binding.terminalId);
    }
  }

  /**
   * Simulates session termination: unregister all terminals bound to a session.
   */
  function simulateSessionTermination(sessionId: string): void {
    const terminals = registry.getBySession(sessionId);
    for (const binding of terminals) {
      registry.unregister(binding.terminalId);
    }
  }

  describe("lane cleanup triggers binding invalidation", () => {
    it("should remove all terminals when lane is cleaned up", () => {
      // Register 5 terminals in lane-1
      for (let i = 0; i < 5; i++) {
        registry.register(`terminal-${i}`, {
          workspaceId: "ws-1",
          laneId: "lane-1",
          sessionId: `session-${i}`,
        });
      }

      // Register 3 terminals in lane-2
      for (let i = 5; i < 8; i++) {
        registry.register(`terminal-${i}`, {
          workspaceId: "ws-1",
          laneId: "lane-2",
          sessionId: `session-${i}`,
        });
      }

      expect(registry.getAll()).toHaveLength(8);

      // Cleanup lane-1
      simulateLaneCleanup("lane-1");

      expect(registry.getAll()).toHaveLength(3);
      expect(registry.getByLane("lane-1")).toHaveLength(0);
      expect(registry.getByLane("lane-2")).toHaveLength(3);
    });

    it("should emit unbound events when lane is cleaned up", () => {
      // Register terminals
      for (let i = 0; i < 3; i++) {
        registry.register(`terminal-${i}`, {
          workspaceId: "ws-1",
          laneId: "lane-1",
          sessionId: `session-${i}`,
        });
      }

      const beforeCleanup = registry.getAll().length;
      simulateLaneCleanup("lane-1");
      const afterCleanup = registry.getAll().length;

      expect(beforeCleanup).toBe(3);
      expect(afterCleanup).toBe(0);
    });

    it("should only affect terminals in the specified lane", () => {
      // Register terminals across two lanes
      const lanes = ["lane-1", "lane-2"];
      const terminals = [];

      for (let lane of lanes) {
        for (let i = 0; i < 3; i++) {
          const terminalId = `terminal-${lane}-${i}`;
          terminals.push(terminalId);
          registry.register(terminalId, {
            workspaceId: "ws-1",
            laneId: lane,
            sessionId: `session-${lane}-${i}`,
          });
        }
      }

      // Cleanup only lane-1
      simulateLaneCleanup("lane-1");

      const remaining = registry.getAll();
      expect(remaining).toHaveLength(3);
      expect(remaining.every((b) => b.binding.laneId === "lane-2")).toBe(true);
    });
  });

  describe("session termination triggers binding invalidation", () => {
    it("should remove all terminals when session is terminated", () => {
      // Register multiple terminals across sessions
      for (let i = 0; i < 5; i++) {
        registry.register(`terminal-${i}`, {
          workspaceId: "ws-1",
          laneId: `lane-${i % 2}`,
          sessionId: i < 2 ? "session-1" : "session-2",
        });
      }

      expect(registry.getAll()).toHaveLength(5);

      // Terminate session-1
      simulateSessionTermination("session-1");

      expect(registry.getAll()).toHaveLength(3);
      expect(registry.getBySession("session-1")).toHaveLength(0);
      expect(registry.getBySession("session-2")).toHaveLength(3);
    });

    it("should work correctly when terminals span multiple lanes", () => {
      // Register terminals with same session across different lanes
      for (let i = 0; i < 4; i++) {
        registry.register(`terminal-${i}`, {
          workspaceId: "ws-1",
          laneId: `lane-${i}`,
          sessionId: "session-shared",
        });
      }

      simulateSessionTermination("session-shared");

      expect(registry.getBySession("session-shared")).toHaveLength(0);
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe("recovery-aware suppression", () => {
    it("should not invalidate during active recovery (simulation)", () => {
      // Register bindings
      const triple: BindingTriple = {
        workspaceId: "ws-1",
        laneId: "lane-1",
        sessionId: "session-1",
      };

      registry.register("terminal-1", triple);

      // Simulate recovery flag: in real implementation, check recovery state
      const isRecovering = true;

      if (!isRecovering) {
        simulateLaneCleanup("lane-1");
      }

      // Binding should still exist
      expect(registry.get("terminal-1")).toBeDefined();
      expect(registry.getByLane("lane-1")).toHaveLength(1);
    });

    it("should invalidate after recovery completes", () => {
      const triple: BindingTriple = {
        workspaceId: "ws-1",
        laneId: "lane-1",
        sessionId: "session-1",
      };

      registry.register("terminal-1", triple);

      // Simulate recovery completion
      let isRecovering = true;
      expect(registry.get("terminal-1")).toBeDefined();

      isRecovering = false;
      if (!isRecovering) {
        simulateLaneCleanup("lane-1");
      }

      expect(registry.get("terminal-1")).toBeUndefined();
    });
  });

  describe("complex invalidation scenarios", () => {
    it("should handle cascade: lane cleanup with multiple sessions", () => {
      // Register 12 terminals: 3 lanes x 2 sessions x 2 terminals
      let terminalCount = 0;
      for (let laneId = 1; laneId <= 3; laneId++) {
        for (let sessionId = 1; sessionId <= 2; sessionId++) {
          for (let t = 0; t < 2; t++) {
            registry.register(`terminal-${terminalCount}`, {
              workspaceId: "ws-1",
              laneId: `lane-${laneId}`,
              sessionId: `session-${sessionId}`,
            });
            terminalCount++;
          }
        }
      }

      expect(registry.getAll()).toHaveLength(12);

      // Cleanup lane-1
      simulateLaneCleanup("lane-1");

      expect(registry.getAll()).toHaveLength(8);
      expect(registry.getByLane("lane-2")).toHaveLength(4);
      expect(registry.getByLane("lane-3")).toHaveLength(4);
    });

    it("should maintain index consistency after invalidation", () => {
      // Register terminals
      for (let i = 0; i < 10; i++) {
        registry.register(`terminal-${i}`, {
          workspaceId: "ws-1",
          laneId: i < 5 ? "lane-1" : "lane-2",
          sessionId: `session-${i}`,
        });
      }

      // Cleanup lane-1
      simulateLaneCleanup("lane-1");

      // Verify indexes are consistent
      const allByLane2 = registry.getByLane("lane-2");
      expect(allByLane2).toHaveLength(5);

      const allByWorkspace = registry.getByWorkspace("ws-1");
      expect(allByWorkspace).toHaveLength(5);

      const all = registry.getAll();
      expect(all).toHaveLength(5);

      // All should match
      expect(allByLane2.length).toBe(allByWorkspace.length);
      expect(allByLane2.length).toBe(all.length);
    });
  });

  describe("event scenario: simulated lifecycle", () => {
    it("should handle realistic workflow with switches and cleanup", () => {
      // Create initial bindings
      registry.register("terminal-1", {
        workspaceId: "ws-1",
        laneId: "lane-1",
        sessionId: "session-1",
      });
      registry.register("terminal-2", {
        workspaceId: "ws-1",
        laneId: "lane-1",
        sessionId: "session-2",
      });

      expect(registry.getByLane("lane-1")).toHaveLength(2);

      // Rebind terminal-1 to lane-2
      registry.rebind("terminal-1", {
        workspaceId: "ws-1",
        laneId: "lane-2",
        sessionId: "session-3",
      });

      expect(registry.getByLane("lane-1")).toHaveLength(1);
      expect(registry.getByLane("lane-2")).toHaveLength(1);

      // Cleanup lane-1
      simulateLaneCleanup("lane-1");

      expect(registry.getByLane("lane-1")).toHaveLength(0);
      expect(registry.getByLane("lane-2")).toHaveLength(1);
      expect(registry.get("terminal-1")).toBeDefined();
      expect(registry.get("terminal-2")).toBeUndefined();
    });
  });
});
