/**
 * MCP bridge tool execution tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createBridge, defaultMcpConfig } from "./mcp-bridge_test_helpers.js";

describe("MCP Bridge Adapter - Execution", () => {
  let adapter = createBridge().adapter;
  let bus = createBridge().bus;

  beforeEach(async () => {
    ({ adapter, bus } = createBridge());
    await adapter.init(defaultMcpConfig);
  });

  it("should execute a tool successfully", async () => {
    const result = await adapter.execute(
      {
        toolName: "read_file",
        arguments: { path: "/tmp/test.txt" },
      },
      "corr-123"
    );

    expect(result.isError).toBe(false);
    expect(result.result).toBeDefined();
  });

  it("should propagate correlation ID", async () => {
    const correlationId = "unique-trace-id";

    await adapter.execute(
      {
        toolName: "read_file",
        arguments: { path: "/tmp/test.txt" },
      },
      correlationId
    );

    const executeEvent = bus
      .getEvents()
      .find((e) => e.topic === "provider.mcp.tool.executed");
    expect(executeEvent?.payload?.correlationId).toBe(correlationId);
  });

  it("should emit execution completed event", async () => {
    bus.clearEvents();

    await adapter.execute(
      {
        toolName: "read_file",
        arguments: { path: "/tmp/test.txt" },
      },
      "corr-123"
    );

    const completedEvent = bus
      .getEvents()
      .find((e) => e.topic === "provider.mcp.tool.executed");
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.payload?.toolName).toBe("read_file");
    expect(completedEvent?.payload?.duration).toBeGreaterThanOrEqual(0);
  });

  it("should include correlation ID in all tool-related bus events", async () => {
    const correlationId = "unique-trace-id";

    bus.clearEvents();

    await adapter.execute(
      {
        toolName: "read_file",
        arguments: { path: "/tmp/test.txt" },
      },
      correlationId
    );

    const toolEvents = bus
      .getEvents()
      .filter((e) => e.topic?.startsWith("provider.mcp.tool"));

    toolEvents.forEach((event) => {
      expect(event.payload?.correlationId).toBe(correlationId);
    });
  });

  it("should handle multiple concurrent tool invocations", async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        adapter.execute(
          {
            toolName: "read_file",
            arguments: { path: `/file${i}.txt` },
          },
          `corr-${i}`
        )
      );
    }

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    results.forEach((result) => {
      expect(result.isError).toBe(false);
      expect(result.result).toBeDefined();
    });
  });
});
