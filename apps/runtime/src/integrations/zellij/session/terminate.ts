import type { ZellijCli } from "../cli.js";
import type { MuxRegistry } from "../registry.js";

export async function terminateZellijSession(args: {
  cli: ZellijCli;
  registry: MuxRegistry;
  sessionName: string;
}): Promise<void> {
  const { cli, registry, sessionName } = args;

  const result = await cli.run(["kill-session", sessionName]);
  if (
    result.exitCode !== 0 &&
    !result.stderr.includes("not found") &&
    !result.stderr.includes("No session")
  ) {
    await new Promise(resolve => setTimeout(resolve, 2_000));
    const retry = await cli.run(["kill-session", sessionName]);
    if (
      retry.exitCode !== 0 &&
      !retry.stderr.includes("not found") &&
      !retry.stderr.includes("No session")
    ) {
    }
  }

  const sessions = await cli.listSessions();
  if (sessions.some(s => s.name === sessionName)) {
  }

  registry.unbind(sessionName);
}
