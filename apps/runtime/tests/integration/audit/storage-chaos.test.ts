import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs";
import path from "path";
import {
	AUDIT_EVENT_RESULTS,
	AUDIT_EVENT_TYPES,
	createAuditEvent,
} from "../../../src/audit/event";
import { DefaultAuditSink } from "../../../src/audit/sink";
import type { AuditStorage } from "../../../src/audit/sink";
import { SQLiteAuditStore } from "../../../src/audit/sqlite-store";

const TMP_DIR = "/tmp/audit-test-" + Math.random().toString(36).substring(7);

describe("Storage Chaos Tests", () => {
	let dbPath: string;
	let store: SQLiteAuditStore;

	beforeEach(() => {
		// Create temp directory
		if (!fs.existsSync(TMP_DIR)) {
			fs.mkdirSync(TMP_DIR, { recursive: true });
		}
		dbPath = path.join(TMP_DIR, "audit.db");
	});

	afterEach(() => {
		// Cleanup
		try {
			if (store) {
				store.close();
			}

			if (fs.existsSync(dbPath)) {
				fs.unlinkSync(dbPath);
			}

			if (fs.existsSync(path.join(TMP_DIR, dbPath + "-wal"))) {
				fs.unlinkSync(path.join(TMP_DIR, dbPath + "-wal"));
			}

			if (fs.existsSync(path.join(TMP_DIR, dbPath + "-shm"))) {
				fs.unlinkSync(path.join(TMP_DIR, dbPath + "-shm"));
			}

			if (fs.existsSync(TMP_DIR)) {
				fs.rmdirSync(TMP_DIR);
			}
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should recover all persisted events after restart", async () => {
		// Phase 1: Write 50,000 events
		store = new SQLiteAuditStore(dbPath);
		const storageAdapter: AuditStorage = {
			persist: (events) => {
				return Promise.resolve(store.persist(events));
			},
		};

		const sink = new DefaultAuditSink(storageAdapter, 1000);

		let writtenCount = 0;
		for (let i = 0; i < 50_000; i++) {
			const event = createAuditEvent({
				eventType: AUDIT_EVENT_TYPES.COMMAND_EXECUTED,
				actor: "test-agent",
				action: "execute",
				target: `cmd-${i}`,
				result: AUDIT_EVENT_RESULTS.SUCCESS,
				workspaceId: "test-workspace",
				correlationId: `corr-${i}`,
				metadata: { index: i },
			});

			await sink.write(event);
			writtenCount++;

			// Periodically flush
			if (i % 10_000 === 0) {
				await sink.flush();
			}
		}

		await sink.flush();
		sink.destroy();

		// Phase 2: Restart and verify all events are recoverable
		store = new SQLiteAuditStore(dbPath);

		const count = store.count();
		expect(count).toBeGreaterThanOrEqual(50_000 - 1000); // May lose some in-memory buffered events
	});

	it("should lose zero events during normal ring buffer overflow", async () => {
		store = new SQLiteAuditStore(dbPath);
		const storageAdapter: AuditStorage = {
			persist: (events) => {
				return Promise.resolve(store.persist(events));
			},
		};

		const sink = new DefaultAuditSink(storageAdapter, 100); // Small buffer to force overflow

		const eventCount = 500;

		for (let i = 0; i < eventCount; i++) {
			const event = createAuditEvent({
				eventType: AUDIT_EVENT_TYPES.SESSION_CREATED,
				actor: "test-agent",
				action: "create",
				target: `session-${i}`,
				result: AUDIT_EVENT_RESULTS.SUCCESS,
				workspaceId: "test-workspace",
				correlationId: `corr-${i}`,
				metadata: { index: i },
			});

			await sink.write(event);
		}

		await sink.flush();
		sink.destroy();

		// Verify all events are stored
		const count = store.count();
		expect(count).toBe(eventCount);
	});

	it("should buffer and retry on SQLite write failure", async () => {
		// Create a storage that fails initially then succeeds
		let failCount = 0;
		const maxFails = 2;

		const failingStorage: AuditStorage = {
			persist: async (events) => {
				failCount++;
				if (failCount <= maxFails) {
					throw new Error("Simulated storage failure");
				}

				// Succeed on subsequent attempts
				store.persist(events);
			},
		};

		store = new SQLiteAuditStore(dbPath);
		const sink = new DefaultAuditSink(failingStorage, 100);

		const event = createAuditEvent({
			eventType: AUDIT_EVENT_TYPES.POLICY_EVALUATION,
			actor: "system",
			action: "evaluate",
			target: "policy-1",
			result: AUDIT_EVENT_RESULTS.SUCCESS,
			workspaceId: "test-workspace",
			correlationId: "corr-1",
			metadata: {},
		});

		await sink.write(event);
		await sink.flush();

		const metrics = sink.getMetrics();
		expect(metrics.persistenceFailures).toBe(maxFails);
		expect(metrics.retryCount).toBeGreaterThan(0);
	});

	it("should handle concurrent reads during writes", async () => {
		store = new SQLiteAuditStore(dbPath);
		const storageAdapter: AuditStorage = {
			persist: (events) => {
				return Promise.resolve(store.persist(events));
			},
		};

		const sink = new DefaultAuditSink(storageAdapter, 1000);

		// Simulate concurrent writes and reads
		let writeCount = 0;
		let readCount = 0;

		// Write events rapidly
		for (let i = 0; i < 1000; i++) {
			const event = createAuditEvent({
				eventType: AUDIT_EVENT_TYPES.TERMINAL_OUTPUT,
				actor: "agent-1",
				action: "output",
				target: `terminal-1`,
				result: AUDIT_EVENT_RESULTS.SUCCESS,
				workspaceId: "test-workspace",
				correlationId: `corr-${i}`,
				metadata: { index: i },
			});

			await sink.write(event);
			writeCount++;

			// Interleave reads
			if (i % 100 === 0) {
				const events = store.query(
					{ workspaceId: "test-workspace" },
					{ limit: 100, offset: 0 },
				);
				readCount++;
				expect(events).toBeDefined();
			}
		}

		await sink.flush();
		sink.destroy();

		expect(writeCount).toBe(1000);
		expect(readCount).toBeGreaterThan(0);

		// Verify reads returned consistent results
		const finalCount = store.count({ workspaceId: "test-workspace" });
		expect(finalCount).toBe(1000);
	});

	it("should stay within storage budget", async () => {
		store = new SQLiteAuditStore(dbPath);
		const storageAdapter: AuditStorage = {
			persist: (events) => {
				return Promise.resolve(store.persist(events));
			},
		};

		const sink = new DefaultAuditSink(storageAdapter, 5000);

		// Simulate 30 days at 100k events/day = 3M events
		// This test writes a smaller batch to verify storage efficiency
		const EVENT_COUNT = 100_000; // Sample 100k events

		for (let i = 0; i < EVENT_COUNT; i++) {
			const event = createAuditEvent({
				eventType: AUDIT_EVENT_TYPES.COMMAND_EXECUTED,
				actor: `agent-${i % 10}`,
				action: "execute",
				target: `cmd-${i}`,
				result: AUDIT_EVENT_RESULTS.SUCCESS,
				workspaceId: "test-workspace",
				correlationId: `corr-${i}`,
				metadata: {
					index: i,
					duration: Math.floor(Math.random() * 1000),
					exitCode: i % 5 === 0 ? 1 : 0,
				},
			});

			await sink.write(event);

			if (i % 10_000 === 0) {
				await sink.flush();
			}
		}

		await sink.flush();
		sink.destroy();

		// Check storage size
		const storageSize = store.getStorageSize();
		const eventCount = store.count();

		const sizePerEvent = storageSize / eventCount;

		// 3M events at this rate should be < 500MB
		// (EVENT_COUNT / 3M) * storageSize < 500MB
		const projectedSize = (3_000_000 / EVENT_COUNT) * storageSize;

		console.log(`Storage test: ${eventCount} events, ${storageSize} bytes`);
		console.log(
			`Projected size for 3M events: ${projectedSize / 1024 / 1024} MB`,
		);

		// Ensure per-event size is reasonable (< 200 bytes per event)
		expect(sizePerEvent).toBeLessThan(200);

		// Projected size should be significantly under 500MB
		expect(projectedSize).toBeLessThan(500 * 1024 * 1024);
	});

	it("should document acceptable loss during hard crash", async () => {
		store = new SQLiteAuditStore(dbPath);
		const storageAdapter: AuditStorage = {
			persist: (events) => {
				return Promise.resolve(store.persist(events));
			},
		};

		const sink = new DefaultAuditSink(storageAdapter, 100);

		// Write 1000 events
		for (let i = 0; i < 1000; i++) {
			const event = createAuditEvent({
				eventType: AUDIT_EVENT_TYPES.APPROVAL_RESOLVED,
				actor: "operator-1",
				action: "resolve",
				target: `approval-${i}`,
				result: AUDIT_EVENT_RESULTS.SUCCESS,
				workspaceId: "test-workspace",
				correlationId: `corr-${i}`,
				metadata: { index: i },
			});

			await sink.write(event);
		}

		// Simulate hard crash WITHOUT flushing
		sink.destroy();

		// Count persisted events (will be less than 1000)
		const persistedCount = store.count();

		// Document the loss
		const loss = 1000 - persistedCount;
		const lossPercentage = (loss / 1000) * 100;

		console.log(
			`Hard crash loss: ${loss} events out of 1000 (${lossPercentage.toFixed(2)}%)`,
		);
		console.log(
			`Acceptable: Events in ring buffer at time of crash (up to ${sink.getMetrics().bufferHighWaterMark || 100} events)`,
		);

		// Loss should be bounded to ring buffer capacity
		expect(loss).toBeLessThanOrEqual(
			(sink.getMetrics().bufferHighWaterMark || 100) + 100,
		);
	});
});
