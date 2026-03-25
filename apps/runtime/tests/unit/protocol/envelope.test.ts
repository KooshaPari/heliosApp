<<<<<<< HEAD
import { beforeEach, describe, expect, it } from "bun:test";
import {
  MAX_PAYLOAD_SIZE,
  createCommand,
  createEvent,
  createResponse,
  setMaxPayloadSize,
  validateEnvelope,
} from "../../../src/protocol/envelope.js";
import { isCommand, isEvent, isResponse } from "../../../src/protocol/types.js";
=======
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  createCommand,
  createResponse,
  createEvent,
  validateEnvelope,
  MAX_PAYLOAD_SIZE,
  setMaxPayloadSize,
} from "../../../src/protocol/envelope.js";
>>>>>>> origin/main
import type { CommandEnvelope } from "../../../src/protocol/types.js";

// FR-001: Canonical envelope schema
// FR-006: Strict validation rejects malformed envelopes
// FR-007: Error taxonomy

describe("createCommand", () => {
  it("generates a unique id with cmd_ prefix", () => {
    const env = createCommand("test.method", { data: 1 });
    expect(env.id).toMatch(/^cmd_/);
  });

  it("auto-generates correlation_id when not provided", () => {
<<<<<<< HEAD
    const env = createCommand("test.method", null);
=======
    const env = createCommand("test.method", {});
>>>>>>> origin/main
    expect(env.correlation_id).toMatch(/^cor_/);
  });

  it("uses provided correlationId", () => {
<<<<<<< HEAD
    const env = createCommand("test.method", null, "my_cor_123");
=======
    const env = createCommand("test.method", {}, "my_cor_123");
>>>>>>> origin/main
    expect(env.correlation_id).toBe("my_cor_123");
  });

  it("sets timestamp from monotonic clock (positive number)", () => {
<<<<<<< HEAD
    const env = createCommand("test.method", null);
=======
    const env = createCommand("test.method", {});
>>>>>>> origin/main
    expect(env.timestamp).toBeGreaterThan(0);
  });

  it('sets type to "command"', () => {
<<<<<<< HEAD
    const env = createCommand("test.method", null);
    expect(env.type).toBe("command");
  });

  it("passes type guard", () => {
    const env = createCommand("test.method", null);
    expect(isCommand(env)).toBe(true);
    expect(isResponse(env)).toBe(false);
    expect(isEvent(env)).toBe(false);
  });

  it("throws on empty method", () => {
    expect(() => createCommand("", null)).toThrow();
  });

  it("generates unique IDs across calls", () => {
    const a = createCommand("m", null);
    const b = createCommand("m", null);
=======
    const env = createCommand("test.method", {});
    expect(env.type).toBe("command");
  });

  it("passes type check", () => {
    const env = createCommand("test.method", {});
    expect(env.type).toBe("command");
    expect(env.type).not.toBe("response");
    expect(env.type).not.toBe("event");
  });

  it("throws on empty method", () => {
    expect(() => createCommand("", {})).toThrow();
  });

  it("generates unique IDs across calls", () => {
    const a = createCommand("m", {});
    const b = createCommand("m", {});
>>>>>>> origin/main
    expect(a.id).not.toBe(b.id);
  });
});

describe("createResponse", () => {
  let cmd: CommandEnvelope;

  beforeEach(() => {
    cmd = createCommand("test.method", { req: true });
  });

  it("carries the originating command correlation_id", () => {
    const res = createResponse(cmd, { ok: true });
    expect(res.correlation_id).toBe(cmd.correlation_id);
  });

  it("carries the originating command method", () => {
    const res = createResponse(cmd, null);
    expect(res.method).toBe("test.method");
  });

  it("generates a res_ prefixed id", () => {
    const res = createResponse(cmd, null);
    expect(res.id).toMatch(/^res_/);
  });

  it('sets type to "response"', () => {
    const res = createResponse(cmd, null);
    expect(res.type).toBe("response");
<<<<<<< HEAD
    expect(isResponse(res)).toBe(true);
=======
    expect(res.type).toBe("response");
>>>>>>> origin/main
  });

  it("includes error when provided", () => {
    const res = createResponse(cmd, null, {
      code: "HANDLER_ERROR",
      message: "oops",
    });
    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe("HANDLER_ERROR");
  });

  it("omits error when not provided", () => {
    const res = createResponse(cmd, null);
    expect(res.error).toBeUndefined();
  });
});

describe("createEvent", () => {
  it("generates an evt_ prefixed id", () => {
    const env = createEvent("ui.clicked", { x: 1 });
    expect(env.id).toMatch(/^evt_/);
  });

  it('sets type to "event"', () => {
<<<<<<< HEAD
    const env = createEvent("ui.clicked", null);
    expect(env.type).toBe("event");
    expect(isEvent(env)).toBe(true);
  });

  it("sets sequence to 0 (placeholder)", () => {
    const env = createEvent("ui.clicked", null);
=======
    const env = createEvent("ui.clicked", undefined);
    expect(env.type).toBe("event");
    expect(env.type).toBe("event");
  });

  it("sets sequence to 0 (placeholder)", () => {
    const env = createEvent("ui.clicked", undefined);
>>>>>>> origin/main
    expect(env.sequence).toBe(0);
  });

  it("auto-generates correlation_id", () => {
<<<<<<< HEAD
    const env = createEvent("ui.clicked", null);
=======
    const env = createEvent("ui.clicked", undefined);
>>>>>>> origin/main
    expect(env.correlation_id).toMatch(/^cor_/);
  });

  it("throws on empty topic", () => {
<<<<<<< HEAD
    expect(() => createEvent("", null)).toThrow();
=======
    expect(() => createEvent("", undefined)).toThrow();
>>>>>>> origin/main
  });
});

describe("validateEnvelope", () => {
  // --- Positive cases ---
  it("accepts a valid command envelope", () => {
    const cmd = createCommand("m", { x: 1 });
    const result = validateEnvelope(cmd);
    expect(result.valid).toBe(true);
  });

  it("accepts a valid response envelope", () => {
<<<<<<< HEAD
    const cmd = createCommand("m", null);
=======
    const cmd = createCommand("m", {});
>>>>>>> origin/main
    const res = createResponse(cmd, { ok: true });
    const result = validateEnvelope(res);
    expect(result.valid).toBe(true);
  });

  it("accepts a valid event envelope", () => {
    const evt = createEvent("topic", { data: 1 });
    const result = validateEnvelope(evt);
    expect(result.valid).toBe(true);
  });

  it("accepts payload of null", () => {
<<<<<<< HEAD
    const cmd = createCommand("m", null);
=======
    const cmd = createCommand("m", {});
>>>>>>> origin/main
    const result = validateEnvelope(cmd);
    expect(result.valid).toBe(true);
  });

  it("accepts payload of undefined", () => {
<<<<<<< HEAD
    const cmd = createCommand("m", undefined);
=======
    const cmd = createCommand("m", {});
>>>>>>> origin/main
    const result = validateEnvelope(cmd);
    expect(result.valid).toBe(true);
  });

  // --- Negative: missing base fields ---
  it("rejects null input", () => {
    const r = validateEnvelope(null);
    expect(r.valid).toBe(false);
  });

  it("rejects non-object input", () => {
    const r = validateEnvelope("string");
    expect(r.valid).toBe(false);
  });

  it("rejects missing id", () => {
    const r = validateEnvelope({
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: 1,
      method: "m",
      payload: null,
    });
    expect(r.valid).toBe(false);
<<<<<<< HEAD
    if (!r.valid) {
      expect(r.error.code).toBe("VALIDATION_ERROR");
    }
=======
    if (!r.valid) expect(r.error.code).toBe("VALIDATION_ERROR");
>>>>>>> origin/main
  });

  it("rejects empty id", () => {
    const r = validateEnvelope({
      id: "",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: 1,
      method: "m",
      payload: null,
    });
    expect(r.valid).toBe(false);
  });

  it("rejects missing correlation_id", () => {
    const r = validateEnvelope({
      id: "x",
      type: "command",
      timestamp: 1,
      method: "m",
      payload: null,
    });
    expect(r.valid).toBe(false);
  });

  it("rejects empty correlation_id", () => {
    const r = validateEnvelope({
      id: "x",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "",
      type: "command",
      timestamp: 1,
      method: "m",
      payload: null,
    });
    expect(r.valid).toBe(false);
  });

  it("rejects unknown type", () => {
<<<<<<< HEAD
    const r = validateEnvelope({ id: "x", correlation_id: "c", type: "unknown", timestamp: 1 });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.error.details).toEqual({ type: "unknown" });
    }
=======
    const r = validateEnvelope({
      id: "x",
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
      correlation_id: "c",
      type: "unknown",
      timestamp: 1,
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error.details).toEqual({ type: "unknown" });
>>>>>>> origin/main
  });

  it("rejects negative timestamp", () => {
    const r = validateEnvelope({
      id: "x",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: -1,
      method: "m",
      payload: null,
    });
    expect(r.valid).toBe(false);
  });

  it("rejects NaN timestamp", () => {
    const r = validateEnvelope({
      id: "x",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: Number.NaN,
      method: "m",
      payload: null,
    });
    expect(r.valid).toBe(false);
  });

  it("rejects zero timestamp", () => {
    const r = validateEnvelope({
      id: "x",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: 0,
      method: "m",
      payload: null,
    });
    expect(r.valid).toBe(false);
  });

  // --- Negative: type-specific fields ---
  it("rejects command without method", () => {
    const r = validateEnvelope({
      id: "x",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: 1,
      payload: null,
    });
    expect(r.valid).toBe(false);
  });

  it("rejects command with empty method", () => {
    const r = validateEnvelope({
      id: "x",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: 1,
      method: "",
      payload: null,
    });
    expect(r.valid).toBe(false);
  });

  it("rejects command without payload", () => {
    const r = validateEnvelope({
      id: "x",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: 1,
      method: "m",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects event without topic", () => {
    const r = validateEnvelope({
      id: "x",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "event",
      timestamp: 1,
      payload: null,
      sequence: 0,
    });
    expect(r.valid).toBe(false);
  });

  // --- Negative: payload size ---
  it("rejects oversized payload", () => {
    const saved = MAX_PAYLOAD_SIZE;
    setMaxPayloadSize(10);
    const r = validateEnvelope({
      id: "x",
<<<<<<< HEAD
=======
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: 1,
      method: "m",
      payload: "a".repeat(100),
    });
    setMaxPayloadSize(saved);
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.error.code).toBe("BACKPRESSURE");
    }
  });

  // --- Negative: circular payload ---
  it("rejects circular reference in payload", () => {
    const obj: Record<string, unknown> = {};
<<<<<<< HEAD
    obj.self = obj;
    const r = validateEnvelope({
      id: "x",
=======
    obj["self"] = obj;
    const r = validateEnvelope({
      id: "x",
      // biome-ignore lint/style/useNamingConvention: Protocol fixtures use wire-format snake_case keys.
>>>>>>> origin/main
      correlation_id: "c",
      type: "command",
      timestamp: 1,
      method: "m",
      payload: obj,
    });
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.error.message).toContain("circular");
    }
  });
});
