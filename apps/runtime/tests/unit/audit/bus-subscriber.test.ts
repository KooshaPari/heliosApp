<<<<<<< HEAD
import { describe, it, expect, beforeEach } from "bun:test";
import { BusAuditSubscriber, type BusEvent } from "../../../src/audit/bus-subscriber";
import { DefaultAuditSink, NoOpAuditStorage } from "../../../src/audit/sink";
import { type AuditEvent } from "../../../src/audit/event";

type MockBus = {
  subscribe: (topic: string, handler: (event: BusEvent) => Promise<void>) => () => void;
  emit: (event: BusEvent) => Promise<void>;
};

const AUDIT_EVENT_TYPES = {
  lane_created: "lane.created",
  session_created: "session.created",
  policy_evaluation_completed: "policy.evaluation.completed",
  approval_resolved: "approval.resolved",
  unknown_topic: "unknown.topic.that.does.not.exist",
} as const;
=======
import { describe, it, expect, beforeEach, mock } from "bun:test";
import { BusAuditSubscriber } from "../../../src/audit/bus-subscriber";
import type { BusEvent } from "../../../src/audit/bus-subscriber";
import { DefaultAuditSink, NoOpAuditStorage } from "../../../src/audit/sink";
import { AUDIT_EVENT_TYPES } from "../../../src/audit/event";
>>>>>>> origin/main

describe("BusAuditSubscriber", () => {
  let subscriber: BusAuditSubscriber;
  let sink: DefaultAuditSink;
  let mockBus: MockBus;

  beforeEach(() => {
    subscriber = new BusAuditSubscriber();
    sink = new DefaultAuditSink(new NoOpAuditStorage());

    // Create a mock bus with subscribe method
    let subscriptionHandler: ((event: BusEvent) => Promise<void>) | null = null;

    mockBus = {
      subscribe: (_topic: string, handler: (event: BusEvent) => Promise<void>) => {
        subscriptionHandler = handler;
        return () => {
          subscriptionHandler = null;
        };
      },
      emit: async (event: BusEvent) => {
        if (subscriptionHandler) {
          await subscriptionHandler(event);
        }
      },
    };
  });

  describe("subscribe", () => {
    it("should subscribe to bus events", () => {
      expect(() => subscriber.subscribe(mockBus, sink)).not.toThrow();
    });
  });

  describe("event mapping", () => {
    it("should map lane.created to lane.lifecycle audit event", async () => {
      subscriber.subscribe(mockBus, sink);

      const event: BusEvent = {
<<<<<<< HEAD
        topic: AUDIT_EVENT_TYPES.lane_created,
        payload: { laneId: "lane-1" },
        actor: 'operator-1',
        action: 'create',
        target: 'lane-1',
        workspaceId: 'workspace-1',
        correlationId: 'corr-1',
=======
        topic: "lane.created",
        payload: { laneId: "lane-1" },
        actor: "operator-1",
        action: "create",
        target: "lane-1",
        workspaceId: "workspace-1",
        correlationId: "corr-1",
>>>>>>> origin/main
      };

      await mockBus.emit(event);

      // Allow async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(sink.getBufferedCount()).toBeGreaterThan(0);
    });

    it("should map session.created to session.lifecycle audit event", async () => {
      subscriber.subscribe(mockBus, sink);

      const event: BusEvent = {
<<<<<<< HEAD
        topic: AUDIT_EVENT_TYPES.session_created,
        payload: { sessionId: "session-1" },
        actor: 'agent-1',
        action: 'create',
        target: 'session-1',
        workspaceId: 'workspace-1',
        correlationId: 'corr-2',
=======
        topic: "session.created",
        payload: { sessionId: "session-1" },
        actor: "agent-1",
        action: "create",
        target: "session-1",
        workspaceId: "workspace-1",
        correlationId: "corr-2",
>>>>>>> origin/main
      };

      await mockBus.emit(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(sink.getBufferedCount()).toBeGreaterThan(0);
    });

    it("should map policy.evaluation.completed to policy.evaluation audit event", async () => {
      subscriber.subscribe(mockBus, sink);

      const event: BusEvent = {
<<<<<<< HEAD
        topic: AUDIT_EVENT_TYPES.policy_evaluation_completed,
        payload: { policyId: "policy-1", result: "allowed" },
        actor: 'system',
        action: 'evaluate',
        target: 'policy-1',
        workspaceId: 'workspace-1',
        correlationId: 'corr-3',
=======
        topic: "policy.evaluation.completed",
        payload: { policyId: "policy-1", result: "allowed" },
        actor: "system",
        action: "evaluate",
        target: "policy-1",
        workspaceId: "workspace-1",
        correlationId: "corr-3",
>>>>>>> origin/main
      };

      await mockBus.emit(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(sink.getBufferedCount()).toBeGreaterThan(0);
    });

    it("should map approval.resolved to approval.lifecycle audit event", async () => {
      subscriber.subscribe(mockBus, sink);

      const event: BusEvent = {
<<<<<<< HEAD
        topic: AUDIT_EVENT_TYPES.approval_resolved,
        payload: { approvalId: "appr-1", decision: "approved" },
        actor: 'operator-1',
        action: 'resolve',
        target: 'appr-1',
        workspaceId: 'workspace-1',
        correlationId: 'corr-4',
=======
        topic: "approval.resolved",
        payload: { approvalId: "appr-1", decision: "approved" },
        actor: "operator-1",
        action: "resolve",
        target: "appr-1",
        workspaceId: "workspace-1",
        correlationId: "corr-4",
>>>>>>> origin/main
      };

      await mockBus.emit(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(sink.getBufferedCount()).toBeGreaterThan(0);
    });
  });

  describe("unknown topics", () => {
    it("should handle unknown bus topics gracefully without crashing", async () => {
      subscriber.subscribe(mockBus, sink);

      const event: BusEvent = {
<<<<<<< HEAD
        topic: AUDIT_EVENT_TYPES.unknown_topic,
=======
        topic: "unknown.topic.that.does.not.exist",
>>>>>>> origin/main
        payload: {},
        actor: "agent-1",
        workspaceId: "workspace-1",
        correlationId: "corr-5",
      };

      // Should not throw
      await expect(mockBus.emit(event)).resolves.toBeUndefined();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Unknown topics should not be persisted (skipped)
      expect(sink.getBufferedCount()).toBe(0);
    });
  });

<<<<<<< HEAD
  describe('correlation ID preservation', () => {
    it('should preserve correlation ID from bus event to audit event', async () => {
      let capturedEvent: AuditEvent | null = null;
=======
  describe("correlation ID preservation", () => {
    it("should preserve correlation ID from bus event to audit event", async () => {
      let capturedEvent: any = null;
>>>>>>> origin/main

      // Create a capturing storage to inspect events
      const capturingSink = new DefaultAuditSink({
        persist: async events => {
          if (events.length > 0) {
            capturedEvent = events[0];
          }
        },
      });

      subscriber.subscribe(mockBus, capturingSink);

      const event: BusEvent = {
<<<<<<< HEAD
        topic: AUDIT_EVENT_TYPES.session_created,
=======
        topic: "session.created",
>>>>>>> origin/main
        payload: {},
        actor: "agent-1",
        workspaceId: "workspace-1",
        correlationId: "special-corr-id-123",
      };

      await mockBus.emit(event);
      await capturingSink.flush();

      expect(capturedEvent).toBeTruthy();
<<<<<<< HEAD
      expect(capturedEvent?.correlationId).toBe('special-corr-id-123');
=======
      expect(capturedEvent.correlationId).toBe("special-corr-id-123");
>>>>>>> origin/main
    });
  });

  describe("unsubscribe", () => {
    it("should stop subscribing to bus events", async () => {
      subscriber.subscribe(mockBus, sink);

      const event1: BusEvent = {
<<<<<<< HEAD
        topic: AUDIT_EVENT_TYPES.lane_created,
=======
        topic: "lane.created",
>>>>>>> origin/main
        payload: {},
        actor: "operator-1",
        workspaceId: "workspace-1",
        correlationId: "corr-6",
      };

      await mockBus.emit(event1);
      await new Promise(resolve => setTimeout(resolve, 10));

      const count1 = sink.getBufferedCount();
      expect(count1).toBeGreaterThan(0);

      // Unsubscribe
      subscriber.unsubscribe_();

      // Clear sink for second test
      sink = new DefaultAuditSink(new NoOpAuditStorage());

      const event2: BusEvent = {
<<<<<<< HEAD
        topic: AUDIT_EVENT_TYPES.session_created,
=======
        topic: "session.created",
>>>>>>> origin/main
        payload: {},
        actor: "agent-1",
        workspaceId: "workspace-1",
        correlationId: "corr-7",
      };

      await mockBus.emit(event2);
      await new Promise(resolve => setTimeout(resolve, 10));

      // After unsubscribe, events should not be captured
      expect(sink.getBufferedCount()).toBe(0);
    });
  });
});
