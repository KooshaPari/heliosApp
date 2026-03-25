import type { PaneDimensions, MinPaneDimensions } from "../types.js";
import { PaneTooSmallError } from "../errors.js";

export function calculateResizedDimensions(
  current: PaneDimensions,
  direction: "left" | "right" | "up" | "down",
  amount: number,
): PaneDimensions {
  const result = { ...current };
  switch (direction) {
    case "left":
      result.cols = Math.max(1, result.cols - amount);
      break;
    case "right":
      result.cols = result.cols + amount;
      break;
    case "up":
      result.rows = Math.max(1, result.rows - amount);
      break;
    case "down":
      result.rows = result.rows + amount;
      break;
  }
  return result;
}

export function validatePaneDimensions(
  dimensions: PaneDimensions,
  minDimensions: MinPaneDimensions,
): void {
  const { minCols, minRows } = minDimensions;
  if (dimensions.cols < minCols || dimensions.rows < minRows) {
    throw new PaneTooSmallError(
      dimensions.cols,
      dimensions.rows,
      minCols,
      minRows,
    );
  }
}
