/**
 * @helios/runtime - Core runtime package for heliosApp.
 *
 * Exports foundational types, utilities, and service APIs consumed by other packages.
 */

import type { AuditBundle, AuditFilter, AuditSink } from "./audit/sink.ts";
import { type HarnessProbe, HarnessRouteSelector } from "./integrations/exec.ts";
import { createBoundaryDispatcher } from "./protocol/boundary_adapter.ts";
import { InMemoryLocalBus } from "./protocol/bus.ts";
import type { AuditRecord as BusAuditRecord } from "./protocol/bus.ts";
import type { LocalBusEnvelope } from "./protocol/types.ts";
import { matchAuditFilter, toAuditBundleRecord } from "./runtime/audit_bundle.ts";
import { createRuntimeHttpHandler } from "./runtime/http_dispatcher.ts";
import { createTerminalPlane } from "./runtime/terminal_plane.ts";
import { InMemorySessionRegistry, RecoveryRegistry } from "./sessions/registry.ts";
import { LaneLifecycleService } from "./sessions/state_machine.ts";
import type {
  RecoveryBootstrapResult,
  RecoveryMetadata,
  WatchdogScanResult,
} from "./sessions/types.ts";

/** Semantic version of the runtime package. */
export const VERSION = "0.0.1" as const;

/** Result of a runtime health check. */
export interface HealthCheckResult {
  readonly ok: boolean;
  readonly timestamp: number;
  readonly uptimeMs: number;
}

export type RuntimeAuditRecord = {
  recorded_at: string;
  type: "command" | "response" | "event";
  method?: string;
  topic?: string;
  correlation_id?: string;
  payload: Record<string, unknown>;
  error?: { code: string; message: string; retryable?: boolean } | null;
};

export type RuntimeAuditBundle = {
  count: number;
  records: RuntimeAuditRecord[];
  exported_at: string;
};

export type RuntimeOptions = {
  recovery_metadata?: RecoveryMetadata;
};

type RuntimeInstance = ReturnType<typeof createRuntime>;

const startTime = performance.now();
const METHOD_SET = new Set<string>(METHODS);

function normalizePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function redactStructuredValue(value: unknown, key?: string): unknown {
  const normalizedKey = key?.toLowerCase() ?? "";
  const shouldRedactKey =
    normalizedKey.includes("api_key") ||
    normalizedKey.includes("token") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("password");

  if (shouldRedactKey && typeof value === "string" && value.length > 0) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.map(item => redactStructuredValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactStructuredValue(entryValue, entryKey),
      ])
    );
  }

  return value;
}

function redactPayload(
  engine: RedactionEngine,
  payload: Record<string, unknown>,
  correlationId: string
): Record<string, unknown> {
  const structured = redactStructuredValue(payload) as Record<string, unknown>;
  const serialized = JSON.stringify(structured);
  const result = engine.redact(serialized, {
    artifactId: `audit-${correlationId}`,
    artifactType: "audit",
    correlationId,
  });
  return JSON.parse(result.redacted) as Record<string, unknown>;
}

/** Returns the current health status of the runtime. */
export function healthCheck(): HealthCheckResult {
  return {
    ok: true,
    timestamp: Date.now(),
    uptimeMs: performance.now() - startTime,
  };
}

export { InMemoryLocalBus } from "./protocol/bus.ts";
export type { LocalBus } from "./protocol/bus.ts";

type RuntimeOptions = {
  auditSink?: AuditSink;
  harnessProbe?: HarnessProbe;
  recovery_metadata?: RecoveryMetadata;
  terminalBufferCapBytes?: number;
  watchdog_interval_ms?: number;
};

type RuntimeEnvelope = LocalBusEnvelope & {
  method?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createRuntime(options: RuntimeOptions = {}) {
  const bus = new InMemoryLocalBus();
  const laneService = new LaneLifecycleService(bus);
  const sessionRegistry = new InMemorySessionRegistry();
  const recoveryRegistry = new RecoveryRegistry();
  const harnessRouter = new HarnessRouteSelector(bus, options.harnessProbe);
  const auditRecords: BusAuditRecord[] = [];
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  let recoveryResult: RecoveryBootstrapResult | null = null;

  if (options.recovery_metadata) {
    recoveryResult = recoveryRegistry.bootstrap(options.recovery_metadata);
  }

  if (options.watchdog_interval_ms && options.watchdog_interval_ms > 0) {
    watchdogTimer = setInterval(() => {
      void recoveryRegistry.scanForOrphans(new Date().toISOString());
    }, options.watchdog_interval_ms);
  }

  const originalRequest = bus.request.bind(bus);
  const originalPublish = bus.publish.bind(bus);
  const dispatchBoundaryCommand = createBoundaryDispatcher({
    dispatchLocal: command => bus.request(command),
  });
  const terminalPlane = createTerminalPlane({
    dispatchCommand: dispatchBoundaryCommand,
    publishEvent: event => bus.publish(event),
    terminalBufferCapBytes: options.terminalBufferCapBytes ?? 65_536,
  });
  const fetch = createRuntimeHttpHandler({
    bus,
    dispatchBoundaryCommand,
    harnessRouter,
    laneService,
    sessionRegistry,
  });

  const updateRecoveryFromResponse = (
    command: RuntimeEnvelope,
    response: Awaited<ReturnType<typeof originalRequest>>
  ): void => {
    if (response.type !== "response" || response.status !== "ok") {
      return;
    }

    const payload = isRecord(command.payload) ? command.payload : {};
    const result = isRecord(response.result) ? response.result : {};
    const workspaceId = command.workspace_id ?? "";
    const laneId = command.lane_id ?? "";
    const sessionId = command.session_id ?? "";

    switch (command.method) {
      case "lane.create": {
        recoveryRegistry.apply("lane.create", {
          workspace_id: workspaceId,
          lane_id: String(result.lane_id ?? payload.id ?? payload.lane_id ?? ""),
        });
        return;
      }
      case "lane.attach": {
        recoveryRegistry.apply("lane.attach", {
          workspace_id: workspaceId,
          lane_id: String(result.lane_id ?? payload.id ?? payload.lane_id ?? laneId),
        });
        return;
      }
      case "lane.cleanup": {
        recoveryRegistry.apply("lane.cleanup", {
          workspace_id: workspaceId,
          lane_id: String(result.lane_id ?? payload.id ?? payload.lane_id ?? laneId),
        });
        return;
      }
      case "session.attach": {
        recoveryRegistry.apply("session.attach", {
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: String(result.session_id ?? payload.id ?? payload.session_id ?? sessionId),
          codex_session_id:
            typeof payload.codex_session_id === "string" ? payload.codex_session_id : undefined,
        });
        return;
      }
      case "session.terminate": {
        recoveryRegistry.apply("session.terminate", {
          session_id: String(result.session_id ?? payload.id ?? payload.session_id ?? sessionId),
        });
        return;
      }
      case "terminal.spawn": {
        const terminalId = String(result.terminal_id ?? payload.id ?? payload.terminal_id ?? "");
        if (!terminalId) {
          return;
        }
        terminalPlane.registerTerminal(terminalId, workspaceId, laneId, sessionId);
        recoveryRegistry.apply("terminal.spawn", {
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: sessionId,
          terminal_id: terminalId,
        });
        return;
      }
      default:
        return;
    }
  };

  bus.request = async (command: LocalBusEnvelope): Promise<LocalBusEnvelope> => {
    const response = await originalRequest(command);
    auditRecords.push({
      envelope: command,
      outcome:
        response.type === "response" && response.status === "error" ? "rejected" : "accepted",
      error:
        response.type === "response" && response.status === "error"
          ? response.error?.message
          : undefined,
      recorded_at: new Date().toISOString(),
    });
    updateRecoveryFromResponse(command as RuntimeEnvelope, response);
    return response;
  };

  bus.publish = async (event: LocalBusEnvelope): Promise<void> => {
    try {
      await originalPublish(event);
      auditRecords.push({
        envelope: event,
        outcome: "accepted",
        recorded_at: new Date().toISOString(),
      });
    } catch (error) {
      auditRecords.push({
        envelope: event,
        outcome: "rejected",
        error: error instanceof Error ? error.message : String(error),
        recorded_at: new Date().toISOString(),
      });
      throw error;
    }

    if (!event.topic) {
      return;
    }

    const workspaceId = event.workspace_id ?? "";
    const laneId = event.lane_id ?? "";
    const sessionId = event.session_id ?? "";
    const terminalId = event.terminal_id ?? "";

    switch (event.topic) {
      case "lane.created": {
        recoveryRegistry.apply("lane.create", { workspace_id: workspaceId, lane_id: laneId });
        return;
      }
      case "lane.attached": {
        recoveryRegistry.apply("lane.attach", { workspace_id: workspaceId, lane_id: laneId });
        return;
      }
      case "lane.cleaned": {
        recoveryRegistry.apply("lane.cleanup", { workspace_id: workspaceId, lane_id: laneId });
        return;
      }
      case "session.attached": {
        recoveryRegistry.apply("session.attach", {
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: sessionId,
          codex_session_id:
            isRecord(event.payload) && typeof event.payload.codex_session_id === "string"
              ? event.payload.codex_session_id
              : undefined,
        });
        return;
      }
      case "session.terminated": {
        recoveryRegistry.apply("session.terminate", { session_id: sessionId });
        return;
      }
      case "terminal.spawned": {
        recoveryRegistry.apply("terminal.spawn", {
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: sessionId,
          terminal_id: terminalId,
        });
        terminalPlane.applyEvent(event);
        return;
      }
      case "terminal.state.changed": {
        terminalPlane.applyEvent(event);
        return;
      }
      default:
        return;
    }
  };

  return {
    bus,
    fetch,
    listLanes: (workspaceId: string) => laneService.list(workspaceId),
    cleanupLane: (workspaceId: string, laneId: string) => laneService.cleanup(workspaceId, laneId),
    getState: () => {
      const state = bus.getState();
      const terminalState = terminalPlane.getTerminalState();
      return terminalState ? { ...state, terminal: terminalState } : state;
    },
    getEvents: () => bus.getEvents(),
    getAuditRecords: async () => {
      const records = await bus.getAuditRecords();
      return records
        .map(record => ({
          ...record,
          recorded_at: record.recorded_at ?? record.envelope.ts ?? new Date().toISOString(),
        }))
        .sort((left, right) => left.recorded_at.localeCompare(right.recorded_at));
    },
    exportAuditBundle: (filter: AuditFilter = {}): AuditBundle => {
      const exported = auditRecords
        .map(toAuditBundleRecord)
        .filter(record => matchAuditFilter(record, filter));
      return {
        generated_at: new Date().toISOString(),
        filters: { ...filter },
        count: exported.length,
        records: exported,
      };
    },
    exportRecoveryMetadata: (): RecoveryMetadata => recoveryRegistry.snapshot(),
    getBootstrapResult: (): RecoveryBootstrapResult | null => recoveryResult,
    bootstrapRecovery: (metadata: RecoveryMetadata): RecoveryBootstrapResult => {
      recoveryResult = recoveryRegistry.bootstrap(metadata);
      return recoveryResult;
    },
    getOrphanReport: (): WatchdogScanResult =>
      recoveryRegistry.scanForOrphans(new Date().toISOString()),
    getTerminal: terminalPlane.getTerminal,
    getTerminalBuffer: terminalPlane.getTerminalBuffer,
    getMetricsReport: () => bus.getMetricsReport(),
    spawnTerminal: terminalPlane.spawnTerminal,
    inputTerminal: terminalPlane.inputTerminal,
    resizeTerminal: terminalPlane.resizeTerminal,
    getHarnessStatus: () => harnessRouter.getStatus(),
    getSession: (sessionId: string) => sessionRegistry.get(sessionId),
    shutdown: (): void => {
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      bus.destroy();
    },
  };
}
