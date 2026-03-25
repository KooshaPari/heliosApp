<<<<<<< HEAD
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ZellijCli } from "../cli.js";
import { PaneTooSmallError, PtyBindingError } from "../errors.js";
import { ZellijPaneManager } from "../panes.js";
import { TopologyTracker } from "../topology.js";
=======
import { describe, expect, it, mock, beforeEach } from "bun:test";
import { ZellijPaneManager } from "../panes.js";
import { TopologyTracker } from "../topology.js";
import { PaneTooSmallError, PtyBindingError } from "../errors.js";
import type { ZellijCli } from "../cli.js";
>>>>>>> origin/main
import type { PtyManagerInterface } from "../types.js";

/**
 * Unit tests for ZellijPaneManager.
 * Tests pane create/close/resize, PTY integration, and dimension enforcement.
 */

function makeMockCli(): ZellijCli {
  return {
    run: mock(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
<<<<<<< HEAD
    checkAvailability: mock(async () => ({ available: true, version: "0.41.2" })),
=======
    checkAvailability: mock(async () => ({
      available: true,
      version: "0.41.2",
    })),
>>>>>>> origin/main
    listSessions: mock(async () => []),
  } as unknown as ZellijCli;
}

function makeMockPtyManager(): PtyManagerInterface {
  let counter = 0;
  return {
<<<<<<< HEAD
    spawn: mock(async () => ({ ptyId: `pty-${++counter}`, pid: 1000 + counter })),
=======
    spawn: mock(async () => ({
      ptyId: `pty-${++counter}`,
      pid: 1000 + counter,
    })),
>>>>>>> origin/main
    terminate: mock(async () => {}),
    resize: mock(() => {}),
  };
}

describe("ZellijPaneManager", () => {
  let cli: ZellijCli;
  let topology: TopologyTracker;
  let ptyManager: PtyManagerInterface;
  let paneManager: ZellijPaneManager;

  beforeEach(() => {
    cli = makeMockCli();
    topology = new TopologyTracker(cli);
    ptyManager = makeMockPtyManager();
    paneManager = new ZellijPaneManager({ cli, topology, ptyManager });
  });

  describe("createPane", () => {
    it("creates a pane and returns a record with PTY binding", async () => {
      topology.initializeTopology("test-session");
      const record = await paneManager.createPane("test-session", "lane-1");

      expect(record.id).toBeGreaterThan(0);
      expect(record.ptyId).toBeDefined();
      expect(record.dimensions).toBeDefined();
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(ptyManager.spawn).toHaveBeenCalled();
    });

    it("creates a pane without PTY manager", async () => {
      const noPtyManager = new ZellijPaneManager({ cli, topology });
      topology.initializeTopology("test-session");
      const record = await noPtyManager.createPane("test-session", "lane-1");

      expect(record.id).toBeGreaterThan(0);
      expect(record.ptyId).toBeUndefined();
    });

    it("closes pane and throws PtyBindingError when PTY spawn fails", async () => {
      const failingPty: PtyManagerInterface = {
        spawn: mock(async () => {
          throw new Error("spawn failed");
        }),
        terminate: mock(async () => {}),
        resize: mock(() => {}),
      };
<<<<<<< HEAD
      const mgr = new ZellijPaneManager({ cli, topology, ptyManager: failingPty });
=======
      const mgr = new ZellijPaneManager({
        cli,
        topology,
        ptyManager: failingPty,
      });
>>>>>>> origin/main
      topology.initializeTopology("test-session");

      expect(mgr.createPane("test-session", "lane-1")).rejects.toThrow(PtyBindingError);
    });

    it("passes direction and cwd to CLI", async () => {
      topology.initializeTopology("test-session");
      await paneManager.createPane("test-session", "lane-1", {
        direction: "horizontal",
        cwd: "/tmp",
      });

      const runMock = cli.run as ReturnType<typeof mock>;
<<<<<<< HEAD
      const firstCall = runMock.mock.calls[0]?.[0] as string[];
=======
      const firstCall = runMock.mock.calls[0]![0] as string[];
>>>>>>> origin/main
      expect(firstCall).toContain("--direction");
      expect(firstCall).toContain("down");
      expect(firstCall).toContain("--cwd");
      expect(firstCall).toContain("/tmp");
    });
  });

  describe("closePane", () => {
    it("terminates PTY before closing pane", async () => {
      topology.initializeTopology("test-session");
      const record = await paneManager.createPane("test-session", "lane-1");

      await paneManager.closePane("test-session", record.id);

      expect(ptyManager.terminate).toHaveBeenCalled();
    });

    it("closes pane even when PTY terminate fails", async () => {
      const failTerminate: PtyManagerInterface = {
        spawn: mock(async () => ({ ptyId: "pty-1", pid: 1001 })),
        terminate: mock(async () => {
          throw new Error("already dead");
        }),
        resize: mock(() => {}),
      };
<<<<<<< HEAD
      const mgr = new ZellijPaneManager({ cli, topology, ptyManager: failTerminate });
=======
      const mgr = new ZellijPaneManager({
        cli,
        topology,
        ptyManager: failTerminate,
      });
>>>>>>> origin/main
      topology.initializeTopology("test-session");
      const record = await mgr.createPane("test-session", "lane-1");

      // Should not throw
      await mgr.closePane("test-session", record.id);
    });
  });

  describe("resizePane", () => {
    it("executes resize CLI command and relays to PTY", async () => {
      topology.initializeTopology("test-session");
      const record = await paneManager.createPane("test-session", "lane-1");

      await paneManager.resizePane("test-session", record.id, "right", 5);

      expect(cli.run).toHaveBeenCalled();
    });

    it("rejects resize that would violate minimum dimensions", async () => {
      topology.initializeTopology("test-session", { cols: 12, rows: 5 });

      // The pane is 12 cols, shrinking left by 5 would make it 7 < minCols (10)
      expect(paneManager.resizePane("test-session", 0, "left", 5)).rejects.toThrow(
        PaneTooSmallError
      );
    });
  });

  describe("T009 - dimension enforcement", () => {
    it("rejects vertical split when cols too small", () => {
      expect(() => paneManager.validateSplit({ cols: 20, rows: 24 }, "vertical")).not.toThrow();

      expect(() => paneManager.validateSplit({ cols: 18, rows: 24 }, "vertical")).toThrow(
        PaneTooSmallError
      );
    });

    it("rejects horizontal split when rows too small", () => {
      expect(() => paneManager.validateSplit({ cols: 80, rows: 6 }, "horizontal")).not.toThrow();

      expect(() => paneManager.validateSplit({ cols: 80, rows: 4 }, "horizontal")).toThrow(
        PaneTooSmallError
      );
    });

    it("validates dimensions against minimums", () => {
      expect(() => paneManager.validateDimensions({ cols: 10, rows: 3 })).not.toThrow();

      expect(() => paneManager.validateDimensions({ cols: 9, rows: 3 })).toThrow(PaneTooSmallError);

      expect(() => paneManager.validateDimensions({ cols: 10, rows: 2 })).toThrow(
        PaneTooSmallError
      );
    });

    it("supports configurable minimum dimensions", () => {
      const custom = new ZellijPaneManager({
        cli,
        topology,
        minDimensions: { minCols: 20, minRows: 5 },
      });

      expect(() => custom.validateDimensions({ cols: 19, rows: 10 })).toThrow(PaneTooSmallError);

      expect(() => custom.validateDimensions({ cols: 20, rows: 5 })).not.toThrow();
    });

    it("rejects split when session window is smaller than 2x minimum", async () => {
      // Session with pane at exactly minimum size
      topology.initializeTopology("tiny-session", { cols: 10, rows: 3 });

      expect(
<<<<<<< HEAD
        paneManager.createPane("tiny-session", "lane-1", { direction: "vertical" })
=======
        paneManager.createPane("tiny-session", "lane-1", {
          direction: "vertical",
        })
>>>>>>> origin/main
      ).rejects.toThrow(PaneTooSmallError);
    });
  });
});
