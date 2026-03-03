/**
 * Renderer capability types and comparison utilities.
 */

import type { RendererAdapter } from "./adapter.js";

// ---------------------------------------------------------------------------
// Capability types
// ---------------------------------------------------------------------------

export interface RendererCapabilities {
  gpuAccelerated: boolean;
  colorDepth: 8 | 16 | 24;
  ligatureSupport: boolean;
  maxDimensions: { cols: number; rows: number };
  inputModes: ("raw" | "cooked" | "application")[];
  sixelSupport: boolean;
  italicSupport: boolean;
  strikethroughSupport: boolean;
}

// ---------------------------------------------------------------------------
// Query helper
// ---------------------------------------------------------------------------

export function queryCapabilities(adapter: RendererAdapter): RendererCapabilities {
  return adapter.queryCapabilities();
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface CapabilityDiffEntry {
  field: string;
  a: unknown;
  b: unknown;
}

export interface CapabilityDiff {
  equal: boolean;
  differences: CapabilityDiffEntry[];
}

export function compareCapabilities(
  a: RendererCapabilities,
  b: RendererCapabilities,
): CapabilityDiff {
  const differences: CapabilityDiffEntry[] = [];

  const scalarKeys = [
    "gpuAccelerated",
    "colorDepth",
    "ligatureSupport",
    "sixelSupport",
    "italicSupport",
    "strikethroughSupport",
  ] as const;

  for (const key of scalarKeys) {
    if (a[key] !== b[key]) {
      differences.push({ field: key, a: a[key], b: b[key] });
    }
  }

  if (
    a.maxDimensions.cols !== b.maxDimensions.cols ||
    a.maxDimensions.rows !== b.maxDimensions.rows
  ) {
    differences.push({ field: "maxDimensions", a: a.maxDimensions, b: b.maxDimensions });
  }

  const sortedA = [...a.inputModes].sort();
  const sortedB = [...b.inputModes].sort();
  if (sortedA.length !== sortedB.length || sortedA.some((v, i) => v !== sortedB[i])) {
    differences.push({ field: "inputModes", a: a.inputModes, b: b.inputModes });
  }

  return { equal: differences.length === 0, differences };
}
