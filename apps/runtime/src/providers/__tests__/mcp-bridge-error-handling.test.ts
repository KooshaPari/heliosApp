/**
 * MCP bridge error handling tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { NormalizedProviderError } from "../errors.js";
import { createBridge, defaultMcpConfig } from "./mcp-bridge_test_helpers.js";

describe("MCP Bridge Adapter - Error Handling", () => {
  let adapter = createBridge().adapter;
  let bus = createBridge().bus;

  beforeEach(async () => {
    ({ adapter, bus } = createBridge());
    await adapter.init(defaultMcpConfig);
  });

  it("should throw NormalizedProviderError on tool not found", async () => {
    const error = await adapter
      .execute(
        {
          toolName: "nonexistent_tool",
          arguments: {},
        },
        "corr-123"
      )
      .catch(e => e);

    expect(error).toBeInstanceOf(NormalizedProviderError);
  });

  it("should emit error event on execution failure", async () => {
    bus.clearEvents();

    try {
      await adapter.execute(
        {
          toolName: "nonexistent_tool",
          arguments: {},
        },
        "corr-123"
      );
    } catch {
      // Expected.
    }

    const errorEvent = bus.getEvents().find(e => e.topic === "provider.mcp.tool.failed");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.payload?.toolName).toBe("nonexistent_tool");
  });
});
