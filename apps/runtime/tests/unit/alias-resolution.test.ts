describe("path alias resolution (requires external project setup)", () => {
  test("@helios/runtime resolves and exports VERSION", async () => {
    // @ts-ignore - the alias is intentionally unresolved inside this package
    const runtime = await import("@helios/runtime");
    expect(runtime.VERSION).toBe("0.1.1");
  });

  test("@helios/runtime exports healthCheck function", async () => {
    // @ts-ignore - the alias is intentionally unresolved inside this package
    const runtime = await import("@helios/runtime");
    expect(typeof runtime.healthCheck).toBe("function");
  });

  test("healthCheck returns valid HealthCheckResult", async () => {
    // @ts-ignore - the alias is intentionally unresolved inside this package
    const { healthCheck } = await import("@helios/runtime");
    const result = healthCheck();

    expect(result.ok).toBe(true);
    expect(typeof result.timestamp).toBe("number");
    expect(typeof result.uptimeMs).toBe("number");
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  test("@helios/runtime type exports are structurally correct", async () => {
    // @ts-ignore - the alias is intentionally unresolved inside this package
    const { healthCheck } = await import("@helios/runtime");
    const result = healthCheck();

    // Verify the shape matches HealthCheckResult interface
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(["ok", "timestamp", "uptimeMs"]);
  });
});
