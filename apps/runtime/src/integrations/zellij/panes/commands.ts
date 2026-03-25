import type { ZellijCli } from "../cli.js";
import { ZellijCliError } from "../errors.js";

export function buildCreatePaneArgs(
  sessionName: string,
  direction: "horizontal" | "vertical",
  cwd?: string,
): string[] {
  const args = ["--session", sessionName, "action", "new-pane"];
  args.push("--direction", direction === "horizontal" ? "down" : "right");
  if (cwd) {
    args.push("--cwd", cwd);
  }
  return args;
}

export function buildResizePaneArgs(
  sessionName: string,
  direction: "left" | "right" | "up" | "down",
  amount: number,
): string[] {
  return ["--session", sessionName, "action", "resize", direction, String(amount)];
}

export async function closePaneRaw(
  cli: ZellijCli,
  sessionName: string,
): Promise<void> {
  const result = await cli.run(["--session", sessionName, "action", "close-pane"]);

  if (result.exitCode !== 0) {
    if (!result.stderr.includes("no pane") && !result.stderr.includes("not found")) {
      throw new ZellijCliError(`close-pane --session ${sessionName}`, result.exitCode, result.stderr);
    }
  }
}
