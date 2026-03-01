/**
 * Renderer capability types.
 */

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
