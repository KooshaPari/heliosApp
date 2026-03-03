/**
 * Renderer capability types and comparison utilities.
 *
 * Capabilities describe what a renderer backend supports. They are used
 * for pre-flight checks before operations like renderer switching and for
 * surfacing feature availability to the UI.
 */

import type { RendererAdapter } from "./adapter.js";

// ---------------------------------------------------------------------------
// Capability types
// ---------------------------------------------------------------------------

/**
 * Full capability descriptor for a renderer backend.
 *
 * Matches the requirements of FR-010-007.
 */
export interface RendererCapabilities {
  /** Whether the renderer uses GPU-accelerated drawing. */
  gpuAccelerated: boolean;
  /** Colour depth in bits. */
  colorDepth: 8 | 16 | 24;
  /** Whether the renderer can draw font ligatures. */
  ligatureSupport: boolean;
  /** Maximum terminal dimensions the renderer supports. */
  maxDimensions: { cols: number; rows: number };
  /** Input modes the renderer can handle. */
  inputModes: ("raw" | "cooked" | "application")[];
  /** Whether the renderer supports Sixel graphics. */
  sixelSupport: boolean;
  /** Whether the renderer supports italic text rendering. */
  italicSupport: boolean;
  /** Whether the renderer supports strikethrough text. */
  strikethroughSupport: boolean;
}

// ---------------------------------------------------------------------------
// Capability diff
// ---------------------------------------------------------------------------

/** A single difference between two capability sets. */
export interface CapabilityDiffEntry {
  /** The capability field that differs. */
  field: string;
  /** Value from capability set A. */
  a: unknown;
  /** Value from capability set B. */
  b: unknown;
}

/** Result of comparing two {@link RendererCapabilities} objects. */
export interface CapabilityDiff {
  /** True when the two sets are identical. */
  equal: boolean;
  /** List of fields that differ. */
  differences: CapabilityDiffEntry[];
}

// ---------------------------------------------------------------------------
// Query helper
// ---------------------------------------------------------------------------

/**
 * Query capabilities for a specific adapter by ID via the registry.
 *
 * This is a convenience wrapper that delegates to `adapter.queryCapabilities()`.
 * Must return in p95 < 50 ms (NFR-010-003).
 *
 * @param adapter - The renderer adapter to query.
 * @returns The adapter's capability descriptor.
 */
export function queryCapabilities(adapter: RendererAdapter): RendererCapabilities {
  return adapter.queryCapabilities();
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Compare two {@link RendererCapabilities} objects and return the diff.
 *
 * Performs a shallow comparison of scalar fields and a deep comparison of
 * array/object fields.
 *
 * @param a - First capability set.
 * @param b - Second capability set.
 * @returns A diff describing all fields that differ.
 */
export function compareCapabilities(
  a: RendererCapabilities,
  b: RendererCapabilities,
): CapabilityDiff {
  const differences: CapabilityDiffEntry[] = [];

  // Scalar boolean/number fields
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

  // maxDimensions
  if (
    a.maxDimensions.cols !== b.maxDimensions.cols ||
    a.maxDimensions.rows !== b.maxDimensions.rows
  ) {
    differences.push({
      field: "maxDimensions",
      a: a.maxDimensions,
      b: b.maxDimensions,
    });
  }

  // inputModes (order-independent comparison)
  const sortedA = [...a.inputModes].sort();
  const sortedB = [...b.inputModes].sort();
  if (
    sortedA.length !== sortedB.length ||
    sortedA.some((v, i) => v !== sortedB[i])
  ) {
    differences.push({
      field: "inputModes",
      a: a.inputModes,
      b: b.inputModes,
    });
  }

  return { equal: differences.length === 0, differences };
}
