/**
 * @helios/runtime — Core runtime package for heliosApp.
 *
 * Exports foundational types and utilities consumed by all other packages.
 */

/** Semantic version of the runtime package. */
export const VERSION = "0.0.1" as const;

/** Result of a runtime health check. */
export interface HealthCheckResult {
  readonly ok: boolean;
  readonly timestamp: number;
  readonly uptimeMs: number;
}

const startTime = performance.now();

/** Returns the current health status of the runtime. */
export function healthCheck(): HealthCheckResult {
  return {
    ok: true,
    timestamp: Date.now(),
    uptimeMs: performance.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Runtime factory (stub — spec not yet delivered)
// ---------------------------------------------------------------------------

import type { LocalBus } from "./protocol/bus.js";
import type { LocalBusEnvelope } from "./protocol/types.js";

/** Response shape from terminal lifecycle commands. */
export interface TerminalCommandResponse {
  status: "ok" | "error";
  // biome-ignore lint/style/useNamingConvention: Protocol response uses wire-format snake_case.
  correlation_id?: string;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
}

/** Audit record shape. */
export interface AuditEntry {
  envelope?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Terminal buffer query result. */
export interface TerminalBufferInfo {
  // biome-ignore lint/style/useNamingConvention: Protocol field uses wire-format snake_case.
  total_bytes: number;
  // biome-ignore lint/style/useNamingConvelope: Protocol field uses wire-format snake_case.
  dropped_bytes: number;
  entries: Array<{ seq: number; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** Runtime event with topic and sequence. */
export interface RuntimeEvent extends LocalBusEnvelope {
  topic?: string;
  sequence?: number;
}

/** Bootstrap result from recovery. */
export interface BootstrapResult {
  // biome-ignore lint/style/useNamingConvention: Protocol field uses wire-format snake_case.
  recovered_session_ids: string[];
  issues: Array<{ state: string; remediation?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** Orphan report from watchdog. */
export interface OrphanReport {
  issues: Array<{ state: string; remediation?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** Audit bundle export result. */
export interface AuditBundleResult {
  count: number;
  records: Array<{ type?: string; payload?: Record<string, unknown>; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** Minimal runtime interface consumed by integration tests. */
export interface HeliosRuntime {
  bus: LocalBus;
  spawnTerminal(opts: Record<string, unknown>): Promise<TerminalCommandResponse>;
  inputTerminal(opts: Record<string, unknown>): Promise<TerminalCommandResponse>;
  resizeTerminal(opts: Record<string, unknown>): Promise<TerminalCommandResponse>;
  getEvents(): RuntimeEvent[];
  getAuditRecords(): Promise<AuditEntry[]>;
  getTerminalBuffer(terminalId: string): TerminalBufferInfo;
  getState(): Record<string, unknown>;
  fetch(request: Request): Promise<Response>;
  shutdown(): Promise<void>;
  getBootstrapResult(): BootstrapResult | null;
  bootstrapRecovery(metadata: Record<string, unknown>): void;
  getOrphanReport(): OrphanReport;
  exportRecoveryMetadata(): Record<string, unknown>;
  exportAuditBundle(filter?: Record<string, unknown>): AuditBundleResult;
  getTerminal(terminalId: string): Record<string, unknown> | undefined;
  [key: string]: unknown;
}

/** Runtime configuration options. */
export interface RuntimeOptions {
  terminalBufferCapBytes?: number;
  // biome-ignore lint/style/useNamingConvention: Protocol field uses wire-format snake_case.
  recovery_metadata?: Record<string, unknown>;
  harnessProbe?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Create a new Helios runtime instance.
 *
 * Stub implementation — throws until the runtime spec is delivered.
 */
export function createRuntime(_opts?: RuntimeOptions): HeliosRuntime {
  throw new Error("createRuntime is not yet implemented — waiting for runtime spec delivery");
}
