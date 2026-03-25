/**
 * MCP bridge termination tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createBridge, defaultMcpConfig } from "./mcp-bridge_test_helpers.js";

describe("MCP Bridge Adapter - Termination", () => {
  let adapter = createBridge().adapter;
  let bus = createBridge().bus;

  beforeEach(async () => {
    ({ adapter, bus } = createBridge());
    await adapter.init(defaultMcpConfig);
  });

  it("should terminate successfully", async () => {
    let health = await adapter.health();
    expect(health.state).toBe("healthy");

    await adapter.terminate();

    health = await adapter.health();
    expect(health.state).toBe("unavailable");
    expect(health.message).toContain("Terminated");
  });

  it("should emit termination event", async () => {
    bus.clearEvents();

    await adapter.terminate();

    const terminatedEvent = bus
      .getEvents()
      .find((e) => e.topic === "provider.mcp.terminated");
    expect(terminatedEvent).toBeDefined();
  });

  it("should prevent execution after termination", async () => {
    await adapter.terminate();

    await expect(
      adapter.execute(
        {
          toolName: "read_file",
          arguments: { path: "/tmp/test.txt" },
        },
        "corr-123"
      )
    ).rejects.toThrow(/unavailable/i);
  });

  it("should cancel in-flight tools on terminate", async () => {
    const executePromise = adapter.execute(
      {
        toolName: "read_file",
        arguments: { path: "/tmp/test.txt" },
      },
      "corr-123"
    );

    await adapter.terminate();

    await expect(executePromise).rejects.toThrow();
  });
});
