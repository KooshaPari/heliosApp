import type { ZellijCli } from "../cli.js";
import { ZellijCliError } from "../errors.js";
import type { TopologyTracker } from "../topology.js";
import type { PtyManagerInterface } from "../types.js";
import { buildResizePaneArgs } from "./commands.js";
import { calculateResizedDimensions } from "./dimensions.js";

export async function resizeZellijPane(args: {
  cli: ZellijCli;
  topology: TopologyTracker;
  ptyManager: PtyManagerInterface | undefined;
  sessionName: string;
  paneId: number;
  direction: "left" | "right" | "up" | "down";
  amount: number;
  validateDimensions: (dimensions: { cols: number; rows: number }) => void;
}): Promise<void> {
  const { cli, topology, ptyManager, sessionName, paneId, direction, amount, validateDimensions } =
    args;
  const startMs = performance.now();

  const paneTopology = topology.findPane(sessionName, paneId);
  if (paneTopology) {
    const resultingDimensions = calculateResizedDimensions(
      paneTopology.dimensions,
      direction,
      amount
    );
    validateDimensions(resultingDimensions);
  }

  const result = await cli.run(buildResizePaneArgs(sessionName, direction, amount));
  if (result.exitCode !== 0) {
    throw new ZellijCliError(`resize --session ${sessionName}`, result.exitCode, result.stderr);
  }

  await topology.refreshTopology(sessionName);

  if (ptyManager) {
    const updatedPane = topology.findPane(sessionName, paneId);
    if (updatedPane?.ptyId) {
      ptyManager.resize(
        updatedPane.ptyId,
        updatedPane.dimensions.cols,
        updatedPane.dimensions.rows
      );
    }
  }

  const _durationMs = performance.now() - startMs;
}
