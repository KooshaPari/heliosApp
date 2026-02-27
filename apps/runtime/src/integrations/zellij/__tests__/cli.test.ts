import { describe, expect, it, mock, beforeEach } from "bun:test";
import { ZellijCli } from "../cli.js";
import {
  ZellijNotFoundError,
  ZellijVersionError,
  ZellijTimeoutError,
} from "../errors.js";

/**
 * Unit tests for ZellijCli.
 *
 * These tests mock Bun.spawn to avoid requiring a real zellij installation.
 */

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

describe("ZellijCli", () => {
  let originalSpawn: typeof Bun.spawn;

  beforeEach(() => {
    originalSpawn = Bun.spawn;
  });

  describe("checkAvailability", () => {
    it("returns available=true with version when zellij is found", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("zellij 0.41.2\n", "", 0));

      const cli = new ZellijCli();
      const result = await cli.checkAvailability();

      expect(result.available).toBe(true);
      expect(result.version).toBe("0.41.2");

      Bun.spawn = originalSpawn;
    });

    it("returns available=false when zellij binary not found", async () => {
      // @ts-ignore mock override
      Bun.spawn = mock(() => {
        throw new Error("spawn ENOENT");
      });

      const cli = new ZellijCli();
      const result = await cli.checkAvailability();

      expect(result.available).toBe(false);

      Bun.spawn = originalSpawn;
    });

    it("throws ZellijVersionError when version is too old", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("zellij 0.39.0\n", "", 0));

      const cli = new ZellijCli();

      expect(cli.checkAvailability()).rejects.toThrow(ZellijVersionError);

      Bun.spawn = originalSpawn;
    });

    it("returns available=false on non-zero exit code", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("", "segfault", 139));

      const cli = new ZellijCli();
      const result = await cli.checkAvailability();

      expect(result.available).toBe(false);

      Bun.spawn = originalSpawn;
    });
  });

  describe("run", () => {
    it("returns stdout, stderr, and exitCode", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("output\n", "", 0));

      const cli = new ZellijCli();
      const result = await cli.run(["--version"]);

      expect(result.stdout).toBe("output\n");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);

      Bun.spawn = originalSpawn;
    });

    it("throws ZellijNotFoundError when binary not found", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => {
        throw new Error("ENOENT");
      });

      const cli = new ZellijCli();

      expect(cli.run(["--version"])).rejects.toThrow(ZellijNotFoundError);

      Bun.spawn = originalSpawn;
    });

    it("handles custom timeout option", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("output", "", 0));

      const cli = new ZellijCli({ defaultTimeout: 5000 });
      const result = await cli.run(["--version"], { timeout: 1000 });

      expect(result.stdout).toBe("output");

      Bun.spawn = originalSpawn;
    });

    it("uses custom zellijPath", async () => {
      const spawnMock = mock(() => makeMockProc("output", "", 0));
      // @ts-expect-error mock override
      Bun.spawn = spawnMock;

      const cli = new ZellijCli({ zellijPath: "/custom/path/zellij" });
      await cli.run(["--version"]);

      // Verify custom path was used
      expect(spawnMock).toHaveBeenCalled();
      const call = spawnMock.mock.calls[0];
      expect(call[0][0]).toBe("/custom/path/zellij");

      Bun.spawn = originalSpawn;
    });
  });

  describe("listSessions", () => {
    it("parses session lines correctly", async () => {
      const output = [
        "my-session  2026-02-27 10:00:00 (ATTACHED)",
        "another-session  2026-02-27 11:00:00",
      ].join("\n");

      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc(output, "", 0));

      const cli = new ZellijCli();
      const sessions = await cli.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.name).toBe("my-session");
      expect(sessions[0]?.attached).toBe(true);
      expect(sessions[1]?.name).toBe("another-session");
      expect(sessions[1]?.attached).toBe(false);

      Bun.spawn = originalSpawn;
    });

    it("returns empty array when no sessions", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() =>
        makeMockProc("No active zellij sessions found.", "", 1)
      );

      const cli = new ZellijCli();
      const sessions = await cli.listSessions();

      expect(sessions).toHaveLength(0);

      Bun.spawn = originalSpawn;
    });

    it("returns empty array on empty output with exit 0", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("", "", 0));

      const cli = new ZellijCli();
      const sessions = await cli.listSessions();

      expect(sessions).toHaveLength(0);

      Bun.spawn = originalSpawn;
    });

    it("returns empty array on empty output with exit 1", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("", "", 1));

      const cli = new ZellijCli();
      const sessions = await cli.listSessions();

      expect(sessions).toHaveLength(0);

      Bun.spawn = originalSpawn;
    });

    it("handles session names with various formats", async () => {
      const output = [
        "simple",
        "with-dashes",
        "with_underscores",
        "MixedCase123",
      ].join("\n");

      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc(output, "", 0));

      const cli = new ZellijCli();
      const sessions = await cli.listSessions();

      expect(sessions).toHaveLength(4);
      expect(sessions[0]?.name).toBe("simple");
      expect(sessions[1]?.name).toBe("with-dashes");
      expect(sessions[2]?.name).toBe("with_underscores");
      expect(sessions[3]?.name).toBe("MixedCase123");

      Bun.spawn = originalSpawn;
    });

    it("handles ATTACHED status in different formats", async () => {
      const output = [
        "session1  2026-02-27 10:00:00 (ATTACHED)",
        "session2  2026-02-27 10:00:00 ATTACHED",
        "session3  2026-02-27 10:00:00 (attached)",
      ].join("\n");

      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc(output, "", 0));

      const cli = new ZellijCli();
      const sessions = await cli.listSessions();

      expect(sessions).toHaveLength(3);
      expect(sessions[0]?.attached).toBe(true);
      expect(sessions[1]?.attached).toBe(true);
      expect(sessions[2]?.attached).toBe(true);

      Bun.spawn = originalSpawn;
    });

    it("skips empty lines", async () => {
      const output = [
        "session1",
        "",
        "session2",
        "   ",
        "session3",
      ].join("\n");

      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc(output, "", 0));

      const cli = new ZellijCli();
      const sessions = await cli.listSessions();

      expect(sessions).toHaveLength(3);
      expect(sessions[0]?.name).toBe("session1");
      expect(sessions[1]?.name).toBe("session2");
      expect(sessions[2]?.name).toBe("session3");

      Bun.spawn = originalSpawn;
    });

    it("handles session without date/time", async () => {
      const output = "session-no-date";

      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc(output, "", 0));

      const cli = new ZellijCli();
      const sessions = await cli.listSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.name).toBe("session-no-date");
      expect(sessions[0]?.created).toBeInstanceOf(Date);

      Bun.spawn = originalSpawn;
    });
  });

  describe("checkAvailability edge cases", () => {
    it("handles version with extra text", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() =>
        makeMockProc("zellij 0.41.2 (build 12345)\n", "", 0)
      );

      const cli = new ZellijCli();
      const result = await cli.checkAvailability();

      expect(result.available).toBe(true);
      expect(result.version).toBe("0.41.2");

      Bun.spawn = originalSpawn;
    });

    it("returns available=false when version string is malformed", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("zellij version unknown\n", "", 0));

      const cli = new ZellijCli();
      const result = await cli.checkAvailability();

      expect(result.available).toBe(false);

      Bun.spawn = originalSpawn;
    });

    it("accepts version exactly at minimum", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("zellij 0.40.0\n", "", 0));

      const cli = new ZellijCli();
      const result = await cli.checkAvailability();

      expect(result.available).toBe(true);
      expect(result.version).toBe("0.40.0");

      Bun.spawn = originalSpawn;
    });

    it("handles multi-digit version components", async () => {
      // @ts-expect-error mock override
      Bun.spawn = mock(() => makeMockProc("zellij 10.20.30\n", "", 0));

      const cli = new ZellijCli();
      const result = await cli.checkAvailability();

      expect(result.available).toBe(true);
      expect(result.version).toBe("10.20.30");

      Bun.spawn = originalSpawn;
    });
  });
});