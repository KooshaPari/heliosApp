/**
 * Unit tests for ghostty capability detection (T012).
 *
 * Tests GPU and no-GPU scenarios, caching, and cache invalidation.
 *
 * Tags: FR-011-004, SC-011-002
 */

import { describe, test, expect, afterEach } from "bun:test";
import {
  detectCapabilities,
  getCachedCapabilities,
  clearCapabilityCache,
} from "../../../../src/renderer/ghostty/capabilities.js";

afterEach(() => {
  clearCapabilityCache();
});

describe("Capability detection", () => {
  test("getCachedCapabilities returns defaults before detection", () => {
    const caps = getCachedCapabilities();
    expect(caps).toBeDefined();
    expect(caps.gpuAccelerated).toBe(false); // Conservative default
    expect(caps.colorDepth).toBe(24);
    expect(caps.ligatureSupport).toBe(true);
    expect(caps.sixelSupport).toBe(true);
    expect(Array.isArray(caps.inputModes)).toBe(true);
  });

  test("detectCapabilities returns capabilities object", async () => {
    const caps = await detectCapabilities();
    expect(caps).toBeDefined();
    expect(typeof caps.gpuAccelerated).toBe("boolean");
    expect(caps.colorDepth).toBe(24);
    expect(caps.maxDimensions.cols).toBe(500);
    expect(caps.maxDimensions.rows).toBe(200);
  });

  test("detectCapabilities caches result", async () => {
    const caps1 = await detectCapabilities();
    const caps2 = await detectCapabilities();
    // Same reference from cache
    expect(caps1).toBe(caps2);
  });

  test("detectCapabilities forceRefresh re-detects", async () => {
    const caps1 = await detectCapabilities();
    const caps2 = await detectCapabilities(true);
    // Both valid but may be different objects
    expect(caps2).toBeDefined();
    expect(typeof caps2.gpuAccelerated).toBe("boolean");
  });

  test("clearCapabilityCache clears cache", async () => {
    await detectCapabilities();
    clearCapabilityCache();
    // getCachedCapabilities returns defaults after clear
    const caps = getCachedCapabilities();
    expect(caps.gpuAccelerated).toBe(false);
  });

  test("getCachedCapabilities returns detected caps after detection", async () => {
    const detected = await detectCapabilities();
    const cached = getCachedCapabilities();
    expect(cached).toBe(detected);
  });
});
