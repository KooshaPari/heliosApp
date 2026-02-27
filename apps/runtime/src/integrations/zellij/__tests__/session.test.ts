import { describe, expect, it, mock, beforeEach } from "bun:test";
import { ZellijCli } from "../cli.js";
import { MuxRegistry } from "../registry.js";
import { ZellijSessionManager, sessionNameForLane } from "../session.js";
import {
  SessionAlreadyExistsError,
  SessionNotFoundError,
} from "../errors.js";

// Helper to create a mock spawn result
function makeMockProc(stdout: string, stderr: string, exitCode: number) {
  const stdoutStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(stdout));
      controller.close();
    },
  });
  const stderrStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(stderr));
      controller.close();
    },
  });

  return {
    stdout: stdoutStream,
    stderr: stderrStream,
    exited: Promise.resolve(exitCode),
    kill: mock(() => {}),
  };
}

describe("sessionNameForLane", () => {
  it("generates correct session name", () => {
    expect(sessionNameForLane("abc-123")).toBe("helios-lane-abc-123");
  });
});

describe("ZellijSessionManager", () => {
  let originalSpawn: typeof Bun.spawn;

  beforeEach(() => {
    originalSpawn = Bun.spawn;
  });

  describe("createSession", () => {
    it("creates a session and registers binding", async () => {
      let callCount = 0;
      // @ts-expect-error mock override
      Bun.spawn = mock(() => {
        callCount++;
        if (callCount === 1) {
          // listSessions - no existing sessions
          return makeMockProc("", "", 0);
        }
        if (callCount === 2) {
          // attach --create
          return makeMockProc("", "", 0);
        }
        // listSessions after create - session now exists
        return makeMockProc("helios-lane-test-1  2026-02-27 10:00:00", "", 0);
      });

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      const session = await manager.createSession("test-1");

      expect(session.sessionName).toBe("helios-lane-test-1");
      expect(session.laneId).toBe("test-1");
      expect(registry.getByLane("test-1")).toBeDefined();

      Bun.spawn = originalSpawn;
    });

    it("throws SessionAlreadyExistsError if session exists", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() =>
        makeMockProc("helios-lane-dup  2026-02-27 10:00:00", "", 0)
      );

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      expect(manager.createSession("dup")).rejects.toThrow(
        SessionAlreadyExistsError
      );

      Bun.spawn = originalSpawn;
    });
  });

  describe("reattachSession", () => {
    it("reattaches to an existing session", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() =>
        makeMockProc(
          "helios-lane-reattach  2026-02-27 10:00:00",
          "",
          0
        )
      );

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      const session = await manager.reattachSession("helios-lane-reattach");

      expect(session.sessionName).toBe("helios-lane-reattach");
      expect(session.laneId).toBe("reattach");
      expect(registry.getBySession("helios-lane-reattach")).toBeDefined();

      Bun.spawn = originalSpawn;
    });

    it("throws SessionNotFoundError if session does not exist", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("", "", 0));

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      expect(
        manager.reattachSession("helios-lane-missing")
      ).rejects.toThrow(SessionNotFoundError);

      Bun.spawn = originalSpawn;
    });
  });

  describe("terminateSession", () => {
    it("terminates a session and unbinds", async () => {
      let callCount = 0;
      // @ts-expect-error mock override
      Bun.spawn = mock(() => {
        callCount++;
        if (callCount <= 2) {
          // listSessions for reattach (called twice - panes + tabs query may also call)
          return makeMockProc(
            "helios-lane-term  2026-02-27 10:00:00",
            "",
            0
          );
        }
        if (callCount <= 5) {
          // kill-session or subsequent listSessions (empty)
          return makeMockProc("", "", 0);
        }
        return makeMockProc("", "", 0);
      });

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      // First reattach to bind it
      await manager.reattachSession("helios-lane-term");
      expect(registry.getBySession("helios-lane-term")).toBeDefined();

      // Now terminate
      await manager.terminateSession("helios-lane-term");
      expect(registry.getBySession("helios-lane-term")).toBeUndefined();

      Bun.spawn = originalSpawn;
    });

    it("is idempotent for non-existent sessions", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() =>
        makeMockProc("", "No session named 'foo' found.", 1)
      );

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      // Should not throw
      await manager.terminateSession("foo");

      Bun.spawn = originalSpawn;
    });

    it("unbinds even if kill command fails", async () => {
      let callCount = 0;
      // @ts-expect-error mock override
      Bun.spawn = mock(() => {
        callCount++;
        if (callCount === 1) {
          // listSessions for reattach
          return makeMockProc(
            "helios-lane-fail  2026-02-27 10:00:00",
            "",
            0
          );
        }
        if (callCount === 2 || callCount === 3) {
          // dump-layout calls
          return makeMockProc("", "", 1);
        }
        if (callCount === 4 || callCount === 5) {
          // kill-session fails both times
          return makeMockProc("", "Failed to kill", 1);
        }
        // listSessions after kill - session still exists
        return makeMockProc("helios-lane-fail  2026-02-27 10:00:00", "", 0);
      });

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      await manager.reattachSession("helios-lane-fail");
      expect(registry.getBySession("helios-lane-fail")).toBeDefined();

      // Should not throw, but should still unbind
      await manager.terminateSession("helios-lane-fail");
      expect(registry.getBySession("helios-lane-fail")).toBeUndefined();

      Bun.spawn = originalSpawn;
    });
  });

  describe("edge cases and private methods", () => {
    it("handles non-standard session names in extractLaneId", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() =>
        makeMockProc("non-standard-name  2026-02-27 10:00:00", "", 0)
      );

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      const session = await manager.reattachSession("non-standard-name");

      // Should fall back to the full session name as lane ID
      expect(session.laneId).toBe("non-standard-name");

      Bun.spawn = originalSpawn;
    });

    it("handles errors in queryPanes gracefully", async () => {
      let callCount = 0;
      // @ts-expect-error mock override
      Bun.spawn = mock(() => {
        callCount++;
        if (callCount === 1) {
          // listSessions
          return makeMockProc("test-session  2026-02-27 10:00:00", "", 0);
        }
        // dump-layout calls fail
        return makeMockProc("", "error", 1);
      });

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      const session = await manager.reattachSession("test-session");

      // Should have empty panes array
      expect(session.panes).toHaveLength(1); // Default pane
      expect(session.tabs).toHaveLength(1); // Default tab

      Bun.spawn = originalSpawn;
    });

    it("handles createSession with options", async () => {
      let callCount = 0;
      // @ts-expect-error mock override
      Bun.spawn = mock(() => {
        callCount++;
        if (callCount === 1) {
          // listSessions - no existing
          return makeMockProc("", "", 0);
        }
        if (callCount === 2) {
          // attach --create
          return makeMockProc("", "", 0);
        }
        // listSessions after create
        return makeMockProc("helios-lane-opts  2026-02-27 10:00:00", "", 0);
      });

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      const session = await manager.createSession("opts", {
        cwd: "/custom/dir",
        layout: "custom-layout",
      });

      expect(session.sessionName).toBe("helios-lane-opts");
      expect(session.laneId).toBe("opts");

      Bun.spawn = originalSpawn;
    });

    it("reattachSession unbinds stale binding before rebinding", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() =>
        makeMockProc("helios-lane-rebind  2026-02-27 10:00:00", "", 0)
      );

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      // Create an initial binding
      const session1 = await manager.reattachSession("helios-lane-rebind");
      const binding1 = registry.getBySession("helios-lane-rebind");

      // Reattach again
      const session2 = await manager.reattachSession("helios-lane-rebind");
      const binding2 = registry.getBySession("helios-lane-rebind");

      // Should have replaced the binding
      expect(binding2).toBeDefined();
      expect(binding2?.boundAt.getTime()).toBeGreaterThanOrEqual(
        binding1!.boundAt.getTime()
      );

      Bun.spawn = originalSpawn;
    });

    it("sessionNameForLane handles various lane ID formats", () => {
      expect(sessionNameForLane("simple")).toBe("helios-lane-simple");
      expect(sessionNameForLane("with-dashes")).toBe("helios-lane-with-dashes");
      expect(sessionNameForLane("with_underscores")).toBe(
        "helios-lane-with_underscores"
      );
      expect(sessionNameForLane("123")).toBe("helios-lane-123");
    });

    it("createSession fails if attach command fails", async () => {
      let callCount = 0;
      // @ts-expect-error mock override
      Bun.spawn = mock(() => {
        callCount++;
        if (callCount === 1) {
          // listSessions - no existing
          return makeMockProc("", "", 0);
        }
        // attach --create fails
        return makeMockProc("", "failed to attach", 1);
      });

      const cli = new ZellijCli();
      const registry = new MuxRegistry();
      const manager = new ZellijSessionManager(cli, registry);

      await expect(manager.createSession("fail")).rejects.toThrow();

      Bun.spawn = originalSpawn;
    });
  });
});