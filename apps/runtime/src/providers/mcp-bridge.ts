/**
 * MCP Tool Bridge and Sandboxing
 *
 * Implements the MCP protocol client adapter for tool discovery, schema registration,
 * sandboxed invocation, and result capture with reconnection resilience.
 *
 * FR-025-004: MCP tool discovery, schema registration, sandboxed invocation.
 * FR-025-007: Process-level isolation for tool execution.
 */

import type { LocalBus } from "../protocol/bus.js";
import type {
  MCPConfig,
  MCPExecuteInput,
  MCPExecuteOutput,
  MCPTool,
  ProviderAdapter,
  ProviderHealthStatus,
} from "./adapter.js";
import { NormalizedProviderError, normalizeError } from "./errors.js";
import {
  connectToServer,
  createHealthyStatus,
  createInitialMcpConnection,
  createUnavailableStatus,
  discoverTools,
  invokeTool,
  type MCPConnection,
  normalizeMcpError,
  publishEvent,
  reconnectToServer,
  type ToolEntry,
} from "./mcp-bridge-support.js";

/**
 * MCP Bridge Adapter
 *
 * Connects to MCP servers, discovers tools, registers schemas,
 * and sandboxes tool invocations in child processes.
 *
 * FR-025-004: MCP tool discovery and sandboxed invocation.
 */
export class MCPBridgeAdapter
  implements ProviderAdapter<MCPConfig, MCPExecuteInput, MCPExecuteOutput>
{
  private config: MCPConfig | null = null;
  private bus: LocalBus | null = null;
  private connection: MCPConnection = {
    connected: false,
    lastConnectionAttempt: new Date(),
    reconnectAttempts: 0,
    reconnectBackoffMs: 1000,
  };
  private toolCatalog = new Map<string, ToolEntry>();
  private inFlightTools = new Map<string, AbortController>();
  private healthStatus: ProviderHealthStatus = {
    state: "unavailable",
    lastCheck: new Date(),
    failureCount: 0,
  };

  constructor(bus?: LocalBus) {
    this.bus = bus || null;
  }

  /**
   * Initialize MCP bridge with configuration.
   *
   * FR-025-004: MCP bridge initialization.
   *
   * @param config MCP configuration
   * @throws NormalizedProviderError if init fails
   */
  async init(config: MCPConfig): Promise<void> {
    try {
      // Validate config
      if (!config.serverPath || typeof config.serverPath !== "string") {
        throw new Error("Missing or invalid serverPath");
      }

      this.config = config;

      // Connect to MCP server
      await this.connectToServer();

      // Discover and register tools
      await this.discoverTools();

      this.healthStatus = {
        state: "healthy",
        lastCheck: new Date(),
        failureCount: 0,
      };

      await this.publishEvent("provider.mcp.initialized", {
        serverPath: config.serverPath,
        toolCount: this.toolCatalog.size,
      });
    } catch (error) {
      const normalized = normalizeError(error, "mcp");

      throw new NormalizedProviderError(
        "PROVIDER_INIT_FAILED",
        `MCP bridge init failed: ${normalized.message}`,
        "mcp",
        false
      );
    }
  }

  /**
   * Get current health status.
   *
   * @returns Current health status
   */
  async health(): Promise<ProviderHealthStatus> {
    if (!this.config) {
      return {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: 0,
        message: "Not initialized",
      };
    }

    try {
      // Check connection
      if (!this.connection.connected) {
        // Attempt reconnection with exponential backoff
        await this.reconnectToServer();
      }

      if (this.connection.connected) {
        this.healthStatus = {
          state: "healthy",
          lastCheck: new Date(),
          failureCount: 0,
        };
      } else {
        this.healthStatus.failureCount++;
        const newState = this.healthStatus.failureCount >= 5 ? "unavailable" : "degraded";
        this.healthStatus = {
          state: newState,
          lastCheck: new Date(),
          failureCount: this.healthStatus.failureCount,
          message: "MCP server disconnected",
        };
      }
    } catch (error) {
      this.healthStatus.failureCount++;
      this.healthStatus = {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: this.healthStatus.failureCount,
        message: `Health check failed: ${normalizeError(error, "mcp").message}`,
      };
    }

    return { ...this.healthStatus };
  }

  /**
   * Execute a tool invocation.
   *
   * FR-025-004: Tool invocation with result capture.
   *
   * @param input Tool invocation input
   * @param correlationId Correlation ID for tracing
   * @returns Tool result
   * @throws NormalizedProviderError on failure
   */
  async execute(input: MCPExecuteInput, correlationId: string): Promise<MCPExecuteOutput> {
    if (!this.config || !this.connection.connected) {
      throw new NormalizedProviderError(
        "PROVIDER_UNAVAILABLE",
        "MCP bridge not initialized or disconnected",
        "mcp"
      );
    }

    try {
      // Check tool exists
      const tool = this.toolCatalog.get(input.toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${input.toolName}`);
      }

      // Create abort controller for timeout
      const abortController = new AbortController();
      const timeoutMs = this.config.timeout || 30000;
      const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
      this.inFlightTools.set(correlationId, abortController);

      try {
        const startTime = Date.now();

        // Execute tool (mock implementation)
        const result = await invokeTool(input.toolName, input.arguments, abortController.signal);

        const duration = Date.now() - startTime;

        // Publish success event
        await this.publishEvent("provider.mcp.tool.executed", {
          correlationId,
          toolName: input.toolName,
          duration,
        });

        return {
          result,
          isError: false,
        };
      } finally {
        clearTimeout(timeoutHandle);
        this.inFlightTools.delete(correlationId);
      }
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === "AbortError") {
        const normalized = new NormalizedProviderError(
          "PROVIDER_TIMEOUT",
          `Tool execution timeout after ${this.config?.timeout || 30000}ms`,
          "mcp",
          true,
          correlationId
        );

        await this.publishEvent("provider.mcp.tool.failed", {
          correlationId,
          toolName: input.toolName,
          code: normalized.code,
          message: normalized.message,
        });

        throw normalized;
      }

      // Handle disconnection
      if (error instanceof Error && error.message.includes("disconnected")) {
        this.connection.connected = false;

        const normalized = new NormalizedProviderError(
          "PROVIDER_UNAVAILABLE",
          `MCP server disconnected: ${normalizeError(error, "mcp").message}`,
          "mcp",
          true,
          correlationId
        );

        await this.publishEvent("provider.mcp.tool.failed", {
          correlationId,
          toolName: input.toolName,
          code: normalized.code,
          retryable: true,
        });

        throw normalized;
      }

      // Handle other errors
      const normalized = normalizeError(error, "mcp", correlationId);

      await this.publishEvent("provider.mcp.tool.failed", {
        correlationId,
        toolName: input.toolName,
        code: normalized.code,
        message: normalized.message,
      });

      throw normalized;
    }
  }

  /**
   * Terminate MCP bridge and cleanup resources.
   */
  async terminate(): Promise<void> {
    try {
      // Cancel all in-flight tools
      for (const controller of this.inFlightTools.values()) {
        controller.abort();
      }
      this.inFlightTools.clear();

      // Disconnect from server
      this.connection.connected = false;

      // Clear tool catalog
      this.toolCatalog.clear();

      this.config = null;

      this.healthStatus = {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: 0,
        message: "Terminated",
      };

      await this.publishEvent("provider.mcp.terminated", {});
    } catch (error) {
      const normalized = normalizeError(error, "mcp");

      throw new NormalizedProviderError(
        "PROVIDER_INIT_FAILED",
        `Failed to terminate MCP bridge: ${normalized.message}`,
        "mcp",
        false
      );
    }
  }

  /**
   * Get registered tools.
   *
   * @returns Array of registered tools
   */
  getTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const tool of this.toolCatalog.values()) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }
    return tools;
  }
}
