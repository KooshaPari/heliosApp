import type { ZellijCli } from "../cli.js";
import { ZellijCliError } from "../errors.js";
import type { CliResult } from "../types.js";

export async function runTabCommand(
  cli: ZellijCli,
  commandLabel: string,
  args: string[],
): Promise<CliResult> {
  const result = await cli.run(args);
  if (result.exitCode !== 0) {
    throw new ZellijCliError(commandLabel, result.exitCode, result.stderr);
  }
  return result;
}

export function isIgnorableMissingTabError(stderr: string): boolean {
  return stderr.includes("not found") || stderr.includes("no tab");
}
