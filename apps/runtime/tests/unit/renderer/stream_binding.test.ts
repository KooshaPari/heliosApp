/**
 * Unit tests for StreamBindingManager and SwitchBuffer.
 * @see FR-010-005, NFR-010-002
 */
import { describe, expect, it } from "bun:test";
import {
  StreamBindingManager,
  SwitchBuffer,
} from "../../../src/renderer/stream_binding.js";
import type { BufferOverflowEvent } from "../../../src/renderer/stream_binding.js";
import { MockGhosttyAdapter, MockRioAdapter } from "../../helpers/mock_adapter.js";

describe("StreamBindingManager", () => {
  it("binds a stream to a renderer", () => {
    const mgr = new StreamBindingManager();
    const renderer = new MockGhosttyAdapter();
    const stream = new ReadableStream<Uint8Array>();

    mgr.bind("pty-1", stream, renderer);

    expect(mgr.count()).toBe(1);
    expect(mgr.getBindings().get("pty-1")?.ptyId).toBe("pty-1");
    expect(renderer.boundStreams.has("pty-1")).toBe(true);
  });

  it("unbinds a stream without closing it", () => {
    const mgr = new StreamBindingManager();
    const renderer = new MockGhosttyAdapter();
    const stream = new ReadableStream<Uint8Array>();

    mgr.bind("pty-1", stream, renderer);
    mgr.unbind("pty-1");

    expect(mgr.count()).toBe(0);
    expect(renderer.unboundPtyIds).toContain("pty-1");
    // Stream is NOT closed - it's still a valid ReadableStream
  });

  it("unbind is no-op for unbound PTY", () => {
    const mgr = new StreamBindingManager();
    mgr.unbind("nonexistent"); // should not throw
    expect(mgr.count()).toBe(0);
  });

  it("replaces existing binding on duplicate bind", () => {
    const mgr = new StreamBindingManager();
    const renderer = new MockGhosttyAdapter();
    const stream1 = new ReadableStream<Uint8Array>();
    const stream2 = new ReadableStream<Uint8Array>();

    mgr.bind("pty-1", stream1, renderer);
    mgr.bind("pty-1", stream2, renderer);

    expect(mgr.count()).toBe(1);
    const binding = mgr.getBindings().get("pty-1")!;
    expect(binding.stream).toBe(stream2);
  });

  it("rebindAll transfers all bindings to new renderer", () => {
    const mgr = new StreamBindingManager();
    const oldRenderer = new MockGhosttyAdapter();
    const newRenderer = new MockRioAdapter();

    mgr.bind("pty-1", new ReadableStream(), oldRenderer);
    mgr.bind("pty-2", new ReadableStream(), oldRenderer);

    mgr.rebindAll(newRenderer);

    expect(mgr.count()).toBe(2);
    expect(newRenderer.boundStreams.has("pty-1")).toBe(true);
    expect(newRenderer.boundStreams.has("pty-2")).toBe(true);
    expect(oldRenderer.unboundPtyIds.sort()).toEqual(["pty-1", "pty-2"]);

    // All bindings now point to new renderer
    for (const [, binding] of mgr.getBindings()) {
      expect(binding.renderer).toBe(newRenderer);
    }
  });

  it("rebindAll is no-op with zero bindings", () => {
    const mgr = new StreamBindingManager();
    const newRenderer = new MockRioAdapter();
    mgr.rebindAll(newRenderer); // should not throw
    expect(mgr.count()).toBe(0);
  });

  it("measures relay latency (NFR-010-002)", () => {
    const mgr = new StreamBindingManager();
    const renderer = new MockGhosttyAdapter();
    mgr.bind("pty-1", new ReadableStream(), renderer);

    const latency = mgr.getRelayLatency("pty-1");
    expect(latency).toBeDefined();
    expect(latency!).toBeLessThan(16.7); // < 1 frame
  });

  it("getBindings returns a copy", () => {
    const mgr = new StreamBindingManager();
    const renderer = new MockGhosttyAdapter();
    mgr.bind("pty-1", new ReadableStream(), renderer);

    const bindings = mgr.getBindings();
    bindings.delete("pty-1");
    expect(mgr.count()).toBe(1); // original unchanged
  });
});

describe("SwitchBuffer", () => {
  it("starts not buffering", () => {
    const buf = new SwitchBuffer();
    expect(buf.isBuffering).toBe(false);
    expect(buf.getBufferedBytes()).toBe(0);
  });

  it("captures data during buffering", () => {
    const buf = new SwitchBuffer();
    buf.startBuffering();

    buf.write("pty-1", new Uint8Array([1, 2, 3]));
    buf.write("pty-1", new Uint8Array([4, 5]));

    expect(buf.isBuffering).toBe(true);
    expect(buf.getBufferedBytes()).toBe(5);
  });

  it("ignores writes when not buffering", () => {
    const buf = new SwitchBuffer();
    buf.write("pty-1", new Uint8Array([1, 2, 3]));
    expect(buf.getBufferedBytes()).toBe(0);
  });

  it("flushes buffered data to new renderer on stopBuffering", () => {
    const buf = new SwitchBuffer();
    const renderer = new MockGhosttyAdapter();

    buf.startBuffering();
    buf.write("pty-1", new Uint8Array([1, 2, 3]));
    buf.write("pty-2", new Uint8Array([4, 5]));
    buf.stopBuffering(renderer);

    expect(buf.isBuffering).toBe(false);
    expect(buf.getBufferedBytes()).toBe(0);
    expect(renderer.boundStreams.has("pty-1")).toBe(true);
    expect(renderer.boundStreams.has("pty-2")).toBe(true);
  });

  it("stopBuffering is no-op when not buffering", () => {
    const buf = new SwitchBuffer();
    const renderer = new MockGhosttyAdapter();
    buf.stopBuffering(renderer); // should not throw
    expect(renderer.boundStreams.size).toBe(0);
  });

  it("instant switch with no buffered data: flush is no-op", () => {
    const buf = new SwitchBuffer();
    const renderer = new MockGhosttyAdapter();
    buf.startBuffering();
    buf.stopBuffering(renderer);
    expect(renderer.boundStreams.size).toBe(0);
  });

  it("respects capacity limits and drops oldest data", () => {
    const events: BufferOverflowEvent[] = [];
    const bus = { publish: (e: BufferOverflowEvent) => events.push(e) };
    const buf = new SwitchBuffer(10, bus); // 10 byte limit

    buf.startBuffering();
    buf.write("pty-1", new Uint8Array(6));
    buf.write("pty-1", new Uint8Array(6)); // exceeds 10, should drop oldest

    expect(buf.getBufferedBytes()).toBeLessThanOrEqual(10);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.type).toBe("renderer.switch.buffer_overflow");
    expect(events[0]!.ptyId).toBe("pty-1");
  });

  it("buffers independently per PTY", () => {
    const buf = new SwitchBuffer();
    buf.startBuffering();

    buf.write("pty-1", new Uint8Array(100));
    buf.write("pty-2", new Uint8Array(200));

    expect(buf.getBufferedBytes()).toBe(300);
  });

  it("publishes overflow event when data is dropped", () => {
    const events: BufferOverflowEvent[] = [];
    const bus = { publish: (e: BufferOverflowEvent) => events.push(e) };
    const buf = new SwitchBuffer(5, bus);

    buf.startBuffering();
    buf.write("pty-1", new Uint8Array(3));
    buf.write("pty-1", new Uint8Array(4)); // total 7 > 5

    expect(events.some((e) => e.droppedBytes > 0)).toBe(true);
  });
});
