import { describe, expect, test } from "bun:test";
import { InMemoryLocalBus } from "../../../src/protocol/bus";
import { ProtocolValidationError, type LocalBusEnvelope } from "../../../src/protocol/types";
import { validateEnvelope } from "../../../src/protocol/validator";

function createLifecycleCommand(overrides: Partial<LocalBusEnvelope> = {}): LocalBusEnvelope {
  return {
    id: "cmd-1",
    type: "command",
    ts: "2026-02-26T00:00:00.000Z",
    workspace_id: "ws-1",
    lane_id: "lane-1",
    session_id: "session-1",
    correlation_id: "corr-1",
    method: "session.attach",
    payload: {},
    ...overrides
  };
}

describe("protocol validator", () => {
  test("rejects malformed envelope with stable error semantics", () => {
    expect(() => validateEnvelope({ id: "evt-1", ts: "2026-02-26T00:00:00.000Z" })).toThrow(
      ProtocolValidationError
    );
    expect(() => validateEnvelope({ id: "evt-1", ts: "2026-02-26T00:00:00.000Z" })).toThrow(
      "Envelope field 'type' is required"
    );
  });

  test("fails fast when lifecycle command is missing correlation_id", async () => {
    const bus = new InMemoryLocalBus();
    const command = createLifecycleCommand({ correlation_id: undefined });

    await expect(bus.request(command)).rejects.toMatchObject({
      name: "ProtocolValidationError",
      code: "MISSING_CORRELATION_ID"
    });
  });

  test("rejects timestamps without RFC3339 timezone", () => {
    expect(() =>
      validateEnvelope({
        id: "evt-1",
        type: "event",
        ts: "2026-02-26T00:00:00",
        topic: "workspace.opened",
        payload: {}
      })
    ).toThrow("Envelope field 'ts' must be an RFC3339 timestamp with timezone");
  });

  test("accepts RFC3339 timestamps with explicit timezone offset", () => {
    const envelope = validateEnvelope({
      id: "evt-1",
      type: "event",
      ts: "2026-02-26T00:00:00+00:00",
      topic: "workspace.opened",
      payload: {}
    });

    expect(envelope.ts).toBe("2026-02-26T00:00:00+00:00");
  });

  test("rejects optional timestamp without RFC3339 timezone", () => {
    expect(() =>
      validateEnvelope({
        id: "evt-1",
        type: "event",
        ts: "2026-02-26T00:00:00.000Z",
        timestamp: "2026-02-26T00:00:00",
        topic: "workspace.opened",
        payload: {}
      })
    ).toThrow("Envelope field 'timestamp' must be an RFC3339 timestamp with timezone");
  });

  test("accepts optional timestamp with RFC3339 timezone", () => {
    const envelope = validateEnvelope({
      id: "evt-1",
      type: "event",
      ts: "2026-02-26T00:00:00.000Z",
      timestamp: "2026-02-26T00:00:00+00:00",
      topic: "workspace.opened",
      payload: {}
    });

    expect(envelope.timestamp).toBe("2026-02-26T00:00:00+00:00");
  });
});

describe("protocol sequencing and audit", () => {
  test("stamps deterministic sequence for lifecycle events", async () => {
    const bus = new InMemoryLocalBus();
    const command = createLifecycleCommand();

    const response = await bus.request(command);
    expect(response.type).toBe("response");
    expect(response.status).toBe("ok");

    const events = bus.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.topic).toBe("session.attach.started");
    expect(events[1]?.topic).toBe("session.attached");
    expect(events[0]?.sequence).toBe(1);
    expect(events[1]?.sequence).toBe(2);
  });

  test("rejects out-of-order lifecycle topic events", async () => {
    const bus = new InMemoryLocalBus();
    await expect(
      bus.publish({
        id: "evt-1",
        type: "event",
        ts: "2026-02-26T00:00:00.000Z",
        workspace_id: "ws-1",
        lane_id: "lane-1",
        session_id: "session-1",
        correlation_id: "corr-1",
        topic: "session.attached",
        payload: {}
      })
    ).rejects.toMatchObject({
      name: "ProtocolValidationError",
      code: "ORDERING_VIOLATION"
    });
  });

  test("records accepted and rejected publish attempts in audit sink", async () => {
    const bus = new InMemoryLocalBus();
    await bus.publish({
      id: "evt-accepted",
      type: "event",
      ts: "2026-02-26T00:00:00.000Z",
      workspace_id: "ws-1",
      lane_id: "lane-1",
      correlation_id: "corr-accepted",
      topic: "lane.create.started",
      payload: {}
    });

    await expect(
      bus.publish({
        id: "evt-rejected",
        type: "event",
        ts: "2026-02-26T00:00:00.000Z",
        workspace_id: "ws-1",
        lane_id: "lane-1",
        correlation_id: "corr-accepted",
        topic: "lane.create.started",
        payload: {}
      })
    ).rejects.toMatchObject({
      name: "ProtocolValidationError",
      code: "ORDERING_VIOLATION"
    });

    const records = await bus.getAuditRecords();
    expect(records).toHaveLength(2);
    expect(records[0]?.outcome).toBe("accepted");
    expect(records[1]?.outcome).toBe("rejected");
  });

  test("keeps session detached when session.attach fails", async () => {
    const bus = new InMemoryLocalBus();
    const response = await bus.request(
      createLifecycleCommand({
        payload: { force_error: true }
      })
    );

    expect(response.type).toBe("response");
    expect(response.status).toBe("error");
    expect(bus.getState().session).toBe("detached");

    const events = bus.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.topic).toBe("session.attach.started");
    expect(events[1]?.topic).toBe("session.attach.failed");
  });
});
