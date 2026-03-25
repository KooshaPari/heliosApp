/**
 * T011 - Path alias resolution validation tests.
 *
 * Verifies that @helios/* path aliases resolve correctly in the Bun runtime
 * context, matching the paths configured in tsconfig.base.json.
 */
import { describe, expect, test } from "bun:test";
import { VERSION, healthCheck, type HealthCheckResult } from "@helios/runtime";

describe("path alias resolution", () => {
  test("@helios/runtime resolves and exports VERSION", () => {
    expect(VERSION).toBe("0.0.1");
  });

  test("@helios/runtime exports healthCheck function", () => {
    expect(typeof healthCheck).toBe("function");
  });

  test("healthCheck returns valid HealthCheckResult", () => {
    const result = healthCheck();

    expect(result.ok).toBe(true);
    expect(typeof result.timestamp).toBe("number");
    expect(typeof result.uptimeMs).toBe("number");
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  test("@helios/runtime type exports are structurally correct", async () => {
    const { healthCheck } = await import("@helios/runtime");
    const result = healthCheck();

    // Verify the shape matches HealthCheckResult interface
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(["ok", "timestamp", "uptimeMs"]);
  });
});
