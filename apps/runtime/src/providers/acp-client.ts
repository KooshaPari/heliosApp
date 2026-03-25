/**
 * ACP Client Boundary Adapter
 *
 * Implements the ACP protocol client adapter for Claude/agent task execution
 * with full run/cancel lifecycle, policy gate integration, and health monitoring.
 *
 * FR-025-003: ACP integration with run/cancel lifecycle and bus correlation.
 * FR-025-012: Policy gate pre-execute hook.
 * FR-025-009: Health checks with configurable intervals.
 */

import type { LocalBus } from "../protocol/bus.js";
import type {
  ProviderAdapter,
  ProviderHealthStatus,
  ACPConfig,
  ACPExecuteInput,
  ACPExecuteOutput,
} from "./adapter.js";
import { NormalizedProviderError, normalizeError } from "./errors.js";
import { publishAcpEvent } from "./acp-client/events.js";
import { resolveHealthCheckInterval, validateAcpConfig } from "./acp-client/config.js";
import { DefaultPolicyGate } from "./acp-client/policy-gate.js";
import type { PolicyGate } from "./acp-client/policy-gate.js";
import { probeEndpoint } from "./acp-client/probe.js";
import { buildACPRequest, sendACPRequest } from "./acp-client/plumbing.js";
import { runHealthCheck } from "./acp-client/health.js";

export type { PolicyGate } from "./acp-client/policy-gate.js";

/**
 * ACP Client Adapter
 *
 * Manages Claude task execution via the ACP protocol with:
 * - Run/cancel lifecycle
 * - Correlation ID propagation
 * - Policy gate integration
 * - Health monitoring
 * - Bus event publishing
 *
 * FR-025-003: ACP protocol client for Claude.
 */
export class ACPClientAdapter implements ProviderAdapter<ACPConfig, ACPExecuteInput, ACPExecuteOutput> {
  private config: ACPConfig | null = null;
  private terminated = false;
  private bus: LocalBus | null = null;
  private policyGate: PolicyGate;
  private healthStatus: ProviderHealthStatus = {
    state: "unavailable",
    lastCheck: new Date(),
    failureCount: 0,
  };
  private inFlightTasks = new Map<string, AbortController>();
  private healthCheckInterval = 30000;

  constructor(bus?: LocalBus, policyGate?: PolicyGate) {
    this.bus = bus || null;
    this.policyGate = policyGate || new DefaultPolicyGate();
  }

  async init(config: ACPConfig): Promise<void> {
    const startTime = Date.now();

    try {
      validateAcpConfig(config);

      const probeTimeout = config.timeoutMs || 10000;
      const probeResult = await Promise.race([
        probeEndpoint(config.endpoint),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error("Probe timeout")), probeTimeout)
        ),
      ]);

      if (!probeResult) {
        throw new Error("Endpoint unreachable");
      }

      this.config = config;
      this.terminated = false;
      this.healthCheckInterval = resolveHealthCheckInterval(config);
      this.healthStatus = {
        state: "healthy",
        lastCheck: new Date(),
        failureCount: 0,
      };

      const elapsed = Date.now() - startTime;
      if (elapsed > 5000) {
        throw new Error(`Init exceeded 5s timeout (${elapsed}ms)`);
      }

      await publishAcpEvent(this.bus, "provider.acp.initialized", {
        endpoint: config.endpoint,
        model: config.model,
      });
    } catch (error) {
      const normalized = normalizeError(error, "acp");
      throw new NormalizedProviderError(
        "PROVIDER_INIT_FAILED",
        `ACP client init failed: ${normalized.message}`,
        "acp",
        false
      );
    }
  }

  async health(): Promise<ProviderHealthStatus> {
    if (this.terminated) {
      return {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: 0,
        message: "Terminated",
      };
    }

    if (!this.config) {
      return {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: 0,
        message: "Not initialized",
      };
    }

    const config = this.config;
    const result = await runHealthCheck({
      current: this.healthStatus,
      probe: () => probeEndpoint(config.endpoint),
      providerId: "acp",
      timeoutMs: 5000,
    });

    this.healthStatus = result.status;
    if (result.transition !== undefined) {
      await publishAcpEvent(this.bus, "provider.acp.health.changed", result.transition);
    }

    return { ...this.healthStatus };
  }

  async execute(input: ACPExecuteInput, correlationId: string): Promise<ACPExecuteOutput> {
    if (!this.config || this.terminated) {
      throw new NormalizedProviderError(
        "PROVIDER_UNAVAILABLE",
        "ACP client unavailable or not initialized",
        "acp"
      );
    }

    try {
      const policyDecision = await this.policyGate.evaluate(
        "provider.acp.execute",
        { correlationId, prompt: input.prompt }
      );

      if (!policyDecision.allowed) {
        const reason = policyDecision.reason || "Policy denied";

        await publishAcpEvent(this.bus, "provider.acp.policy.denied", {
          correlationId,
          reason,
        });

        throw new NormalizedProviderError(
          "PROVIDER_POLICY_DENIED",
          `ACP policy denied: ${reason}`,
          "acp",
          false,
          correlationId
        );
      }

      const abortController = new AbortController();
      const timeoutMs = this.config.timeoutMs || 30000;
      const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
      this.inFlightTasks.set(correlationId, abortController);

      try {
        const startTime = Date.now();
        const acpRequest = buildACPRequest(this.config, input, correlationId);
        const result = await sendACPRequest(acpRequest, abortController.signal);
        const duration = Date.now() - startTime;

        await publishAcpEvent(this.bus, "provider.acp.execute.completed", {
          correlationId,
          taskId: result.taskId,
          duration,
          usage: result.usage,
        });

        return {
          content: result.content,
          stopReason: result.stopReason,
          usage: result.usage,
        };
      } finally {
        clearTimeout(timeoutHandle);
        this.inFlightTasks.delete(correlationId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        const normalized = new NormalizedProviderError(
          "PROVIDER_TIMEOUT",
          `ACP execution timeout after ${this.config.timeoutMs || 30000}ms`,
          "acp",
          true,
          correlationId
        );

        await publishAcpEvent(this.bus, "provider.acp.execute.failed", {
          correlationId,
          code: normalized.code,
          retryable: normalized.retryable,
          message: normalized.message,
        });

        throw normalized;
      }

      const normalized = normalizeError(error, "acp", correlationId);

      await publishAcpEvent(this.bus, "provider.acp.execute.failed", {
        correlationId,
        code: normalized.code,
        retryable: normalized.retryable,
        message: normalized.message,
      });

      throw normalized;
    }
  }

  async cancel(taskId: string): Promise<void> {
    if (!this.config || this.terminated) {
      throw new NormalizedProviderError(
        "PROVIDER_UNAVAILABLE",
        "ACP client unavailable or not initialized",
        "acp"
      );
    }

    try {
      for (const [correlationId, controller] of this.inFlightTasks) {
        if (correlationId === taskId) {
          controller.abort();
        }
      }

      await publishAcpEvent(this.bus, "provider.acp.execute.cancelled", {
        taskId,
      });
    } catch (error) {
      const normalized = normalizeError(error, "acp");
      throw new NormalizedProviderError(
        "PROVIDER_EXECUTE_FAILED",
        `Failed to cancel task ${taskId}: ${normalized.message}`,
        "acp"
      );
    }
  }

  async terminate(): Promise<void> {
    try {
      for (const controller of this.inFlightTasks.values()) {
        controller.abort();
      }
      this.inFlightTasks.clear();

      this.config = null;
      this.terminated = true;
      this.healthStatus = {
        state: "unavailable",
        lastCheck: new Date(),
        failureCount: 0,
        message: "Terminated",
      };

      await publishAcpEvent(this.bus, "provider.acp.terminated", {});
    } catch (error) {
      const normalized = normalizeError(error, "acp");
      throw new NormalizedProviderError(
        "PROVIDER_INIT_FAILED",
        `Failed to terminate ACP client: ${normalized.message}`,
        "acp",
        false
      );
    }
  }
}
