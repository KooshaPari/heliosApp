import type {
  RecoveryBootstrapResult,
  RecoveryMetadata,
  WatchdogScanResult,
} from "../sessions/types.js";

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

export interface TerminalBufferEntry {
  seq: number;
  data: string;
}

export interface TerminalBuffer {
  terminal_id: string;
  total_bytes: number;
  dropped_bytes: number;
  entries: TerminalBufferEntry[];
}

export type RuntimeStateSnapshot = {
  terminal: string;
};

export type RuntimeBootstrapSnapshot = {
  bootstrapResult: RecoveryBootstrapResult | null;
  recovery: {
    exportRecoveryMetadata(): RecoveryMetadata;
    bootstrapRecovery(metadata: RecoveryMetadata): RecoveryBootstrapResult;
    getOrphanReport(): WatchdogScanResult;
  };
};
