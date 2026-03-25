import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  AUDIT_EVENT_RESULTS,
  AUDIT_EVENT_TYPES,
  createAuditEvent,
} from "../../../src/audit/event.ts";
import { AuditLedger } from "../../../src/audit/ledger.ts";
import { AuditRingBuffer } from "../../../src/audit/ring-buffer.ts";
import { SQLiteAuditStore } from "../../../src/audit/sqlite-store.ts";

/**
 * Calculate percentile from array of values.
 */
function percentile(values: number[], p: number): number {
  values.sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * values.length) - 1;
  return values[Math.max(0, index)];
}

describe("Audit Search Performance", () => {
  let ledger: AuditLedger;
  let ringBuffer: AuditRingBuffer;
  let store: SQLiteAuditStore;

  beforeEach(() => {
    ringBuffer = new AuditRingBuffer(10_000);
    store = new SQLiteAuditStore(":memory:");
    ledger = new AuditLedger(ringBuffer, store);
  });

  afterEach(() => {
    store.close();
  });

  it("should search with workspace filter in < 500ms p95 for large dataset", () => {
    // Insert 100k events (sample from 1M scale test)
    const events = [];
    const workspaces = 10;
    const actors = 50;
    const eventTypes = 5;

    for (let i = 0; i < 100_000; i++) {
      const event = createAuditEvent({
        eventType: [
          AUDIT_EVENT_TYPES.COMMAND_EXECUTED,
          AUDIT_EVENT_TYPES.SESSION_CREATED,
          AUDIT_EVENT_TYPES.POLICY_EVALUATION,
          AUDIT_EVENT_TYPES.APPROVAL_RESOLVED,
          AUDIT_EVENT_TYPES.TERMINAL_OUTPUT,
        ][i % eventTypes],
        actor: `actor-${i % actors}`,
        action: "test",
        target: `target-${i}`,
        result: AUDIT_EVENT_RESULTS.SUCCESS,
        workspaceId: `ws-${i % workspaces}`,
        laneId: `lane-${i % 50}`,
        sessionId: `session-${i % 100}`,
        correlationId: `corr-${i}`,
        metadata: { index: i },
      });
      events.push(event);

      // Insert to ring buffer for first 10k
      if (i < 10_000) {
        ringBuffer.push(event);
      }
    }

    // Persist rest to SQLite
    store.persist(events.slice(10_000));

    // Run multiple searches and collect latencies
    const latencies: number[] = [];

    for (let i = 0; i < 20; i++) {
      const startTime = Date.now();
      const results = ledger.search({ workspaceId: "ws-0", limit: 100 });
      const endTime = Date.now();

      latencies.push(endTime - startTime);
      expect(results.length).toBeGreaterThan(0);
    }

    const p95 = percentile(latencies, 95);
    expect(p95).toBeLessThan(500);
  });

  it("should search with time range filter in < 500ms p95", () => {
    // Insert events with various timestamps
    const events = [];
    const now = new Date();

    for (let i = 0; i < 50_000; i++) {
      // Create events spread across 1 day
      const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);

      const event = createAuditEvent({
        eventType: AUDIT_EVENT_TYPES.COMMAND_EXECUTED,
        actor: "agent-1",
        action: "execute",
        target: `cmd-${i}`,
        result: AUDIT_EVENT_RESULTS.SUCCESS,
        workspaceId: "ws-1",
        correlationId: `corr-${i}`,
        metadata: {},
      });

      // Manually override timestamp
      (event as any).timestamp = timestamp.toISOString();
      events.push(event);
    }

    store.persist(events);

    // Search with time range
    const latencies: number[] = [];
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const now2 = now;

    for (let i = 0; i < 20; i++) {
      const startTime = Date.now();
      const _results = ledger.search({
        timeRange: { from: oneHourAgo, to: now2 },
        limit: 100,
      });
      const endTime = Date.now();

      latencies.push(endTime - startTime);
    }

    const p95 = percentile(latencies, 95);
    expect(p95).toBeLessThan(500);
  });

  it("should search with combined filters in < 500ms p95", () => {
    // Insert diverse events
    const events = [];

    for (let i = 0; i < 50_000; i++) {
      const event = createAuditEvent({
        eventType:
          i % 3 === 0 ? AUDIT_EVENT_TYPES.COMMAND_EXECUTED : AUDIT_EVENT_TYPES.SESSION_CREATED,
        actor: `actor-${i % 20}`,
        action: "test",
        target: `target-${i}`,
        result: AUDIT_EVENT_RESULTS.SUCCESS,
        workspaceId: `ws-${i % 5}`,
        correlationId: `corr-${i}`,
        metadata: {},
      });
      events.push(event);
    }

    store.persist(events);

    // Run combined filter searches
    const latencies: number[] = [];

    for (let i = 0; i < 20; i++) {
      const startTime = Date.now();
      const _results = ledger.search({
        workspaceId: "ws-0",
        actor: "actor-0",
        eventType: AUDIT_EVENT_TYPES.COMMAND_EXECUTED,
        limit: 100,
      });
      const endTime = Date.now();

      latencies.push(endTime - startTime);
    }

    const p95 = percentile(latencies, 95);
    expect(p95).toBeLessThan(500);
  });

  it("should traverse correlation chains in < 500ms p95", () => {
    // Create chains of correlated events
    const chainCount = 100;
    const chainLength = 10;

    for (let chainIdx = 0; chainIdx < chainCount; chainIdx++) {
      const events = [];
      const correlationId = `chain-${chainIdx}`;

      for (let eventIdx = 0; eventIdx < chainLength; eventIdx++) {
        const event = createAuditEvent({
          eventType: AUDIT_EVENT_TYPES.POLICY_EVALUATION,
          actor: "system",
          action: "evaluate",
          target: `target-${chainIdx}-${eventIdx}`,
          result: AUDIT_EVENT_RESULTS.SUCCESS,
          workspaceId: "ws-1",
          correlationId,
          metadata: { chainIndex: chainIdx, eventIndex: eventIdx },
        });
        events.push(event);
      }

      store.persist(events);
    }

    // Traverse chains and measure latency
    const latencies: number[] = [];

    for (let i = 0; i < chainCount; i++) {
      const startTime = Date.now();
      const chain = ledger.getCorrelationChain(`chain-${i}`);
      const endTime = Date.now();

      latencies.push(endTime - startTime);
      expect(chain.length).toBeGreaterThanOrEqual(chainLength * 0.99); // 99% completeness
    }

    const p95 = percentile(latencies, 95);
    expect(p95).toBeLessThan(500);
  });

  it("should document storage efficiency", () => {
    // Insert 100k events
    const events = [];

    for (let i = 0; i < 100_000; i++) {
      const event = createAuditEvent({
        eventType: AUDIT_EVENT_TYPES.COMMAND_EXECUTED,
        actor: `actor-${i % 50}`,
        action: "execute",
        target: `cmd-${i}`,
        result: AUDIT_EVENT_RESULTS.SUCCESS,
        workspaceId: `ws-${i % 10}`,
        correlationId: `corr-${i}`,
        metadata: {
          index: i,
          duration: Math.floor(Math.random() * 1000),
          exitCode: i % 5 === 0 ? 1 : 0,
        },
      });
      events.push(event);
    }

    store.persist(events);

    const count = store.count();
    const size = store.getStorageSize();
    const _sizePerEvent = size / count;

    // 3M events should be < 500MB
    const projectedSize = (3_000_000 / count) * size;

    expect(projectedSize).toBeLessThan(500 * 1024 * 1024);
  });
});
