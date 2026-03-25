import type { ZellijCli } from "../cli.js";
import { SessionAlreadyExistsError } from "../errors.js";
import type { MuxRegistry } from "../registry.js";
import type { MuxSession, SessionOptions } from "../types.js";

export async function createZellijSession(args: {
  cli: ZellijCli;
  registry: MuxRegistry;
  laneId: string;
  sessionName: string;
  options?: SessionOptions;
}): Promise<MuxSession> {
  const { cli, registry, laneId, sessionName, options } = args;
  const startMs = performance.now();

  const existing = await cli.listSessions();
  if (existing.some(s => s.name === sessionName)) {
    throw new SessionAlreadyExistsError(sessionName);
  }

  if (options?.cwd) {
  }

  const result = await cli.run(["attach", sessionName, "--create", "--force-run-client"], {
    timeout: 10_000,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to create zellij session ${sessionName}: ${result.stderr}`);
  }

  const postSessions = await cli.listSessions();
  const created = postSessions.find(s => s.name === sessionName);

  const _durationMs = performance.now() - startMs;

  const muxSession: MuxSession = {
    sessionName,
    laneId,
    createdAt: created?.created ?? new Date(),
    panes: [],
    tabs: [],
  };

  registry.bind(sessionName, laneId, muxSession);
  return muxSession;
}
