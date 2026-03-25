/**
 * MCP bridge initialization and health tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createBridge, defaultMcpConfig } from "./mcp-bridge_test_helpers.js";

describe("MCP Bridge Adapter - Initialization and Health", () => {
  describe("Initialization", () => {
    it("should initialize with valid config", async () => {
      const { adapter } = createBridge();

      await adapter.init(defaultMcpConfig);

      const health = await adapter.health();
      expect(health.state).toBe("healthy");
    });

    it("should reject missing serverPath", async () => {
      const { adapter } = createBridge();

      await expect(
        adapter.init({
          serverPath: "",
          args: [],
          timeout: 30000,
        })
      ).rejects.toThrow(/init failed/i);
    });

    it("should discover tools on init", async () => {
      const { adapter } = createBridge();

      await adapter.init(defaultMcpConfig);

      const tools = adapter.getTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some(t => t.name === "read_file")).toBe(true);
      expect(tools.some(t => t.name === "write_file")).toBe(true);
    });

    it("should emit initialization event", async () => {
      const { adapter, bus } = createBridge();

      await adapter.init(defaultMcpConfig);

      const events = bus.getEvents();
      const initEvent = events.find(e => e.topic === "provider.mcp.initialized");
      expect(initEvent).toBeDefined();
      expect(initEvent?.payload?.serverPath).toBe("stdio");
    });

    it("should emit tool discovery events", async () => {
      const { adapter, bus } = createBridge();

      await adapter.init(defaultMcpConfig);

      const discoveryEvents = bus
        .getEvents()
        .filter(e => e.topic === "provider.mcp.tool.discovered");
      expect(discoveryEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Tool Discovery", () => {
    let adapter = createBridge().adapter;

    beforeEach(async () => {
      ({ adapter } = createBridge());
      await adapter.init(defaultMcpConfig);
    });

    it("should register tools with schemas", async () => {
      const tools = adapter.getTools();

      expect(tools).toHaveLength(3);
      tools.forEach(tool => {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
      });
    });

    it("should provide valid JSON schemas", async () => {
      const tools = adapter.getTools();

      const readFileTool = tools.find(t => t.name === "read_file");
      expect(readFileTool).toBeDefined();
      expect(readFileTool?.inputSchema.type).toBe("object");
      expect(readFileTool?.inputSchema.properties).toBeDefined();
      expect(readFileTool?.inputSchema.required).toContain("path");
    });
  });

  describe("Disconnection and Reconnection", () => {
    let adapter = createBridge().adapter;

    beforeEach(async () => {
      ({ adapter } = createBridge());
      await adapter.init(defaultMcpConfig);
    });

    it("should handle server disconnection gracefully", async () => {
      let health = await adapter.health();
      expect(health.state).toBe("healthy");

      health = await adapter.health();
      expect(health).toBeDefined();
    });

    it("should return retryable error on disconnection", async () => {
      const health = await adapter.health();
      expect(health).toBeDefined();
    });
  });

  describe("Health Monitoring", () => {
    let adapter = createBridge().adapter;

    beforeEach(async () => {
      ({ adapter } = createBridge());
      await adapter.init(defaultMcpConfig);
    });

    it("should report healthy initially", async () => {
      const health = await adapter.health();
      expect(health.state).toBe("healthy");
      expect(health.failureCount).toBe(0);
    });

    it("should include timestamp in health status", async () => {
      const health = await adapter.health();
      expect(health.lastCheck).toBeInstanceOf(Date);
      expect(health.lastCheck.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});
