/**
 * Share backend adapter tests.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { TmateAdapter, UptermAdapter, getBackendAdapter } from "../adapters.js";

describe("Upterm Backend Adapter", () => {
  let adapter: UptermAdapter;

  beforeEach(() => {
    adapter = new UptermAdapter();
  });

  it("should report availability", async () => {
    const available = await adapter.checkAvailability();
    expect(typeof available).toBe("boolean");
  });

  it("should start share with upterm command", async () => {
    const result = await adapter.startShare("terminal-123", "main-session");

    expect(result.link).toBeTruthy();
    expect(result.link).toContain("upterm.io");
    expect(result.process).toBeDefined();
  });

  it("should validate inputs before starting share", async () => {
    await expect(adapter.startShare("", "main-session")).rejects.toThrow(/missing/i);

    await expect(adapter.startShare("terminal-123", "")).rejects.toThrow(/missing/i);
  });

  it("should stop share gracefully", async () => {
    const result = await adapter.startShare("terminal-123", "main-session");
    await adapter.stopShare(result.process);
  });

  it("should support custom upterm server", async () => {
    const customAdapter = new UptermAdapter({
      server: "custom.upterm.io",
    });

    const result = await customAdapter.startShare("terminal-123", "main-session");

    expect(result.link).toBeTruthy();
  });
});

describe("Tmate Backend Adapter", () => {
  let adapter: TmateAdapter;

  beforeEach(() => {
    adapter = new TmateAdapter();
  });

  it("should report availability", async () => {
    const available = await adapter.checkAvailability();
    expect(typeof available).toBe("boolean");
  });

  it("should start share with tmate command", async () => {
    const result = await adapter.startShare("terminal-123", "main-session");

    expect(result.link).toBeTruthy();
    expect(result.link).toContain("tmate.io");
    expect(result.process).toBeDefined();
  });

  it("should validate inputs before starting share", async () => {
    await expect(adapter.startShare("", "main-session")).rejects.toThrow(/missing/i);
  });

  it("should stop share gracefully", async () => {
    const result = await adapter.startShare("terminal-123", "main-session");
    await adapter.stopShare(result.process);
  });
});

describe("Backend Adapter Factory", () => {
  it("should get upterm adapter", () => {
    const adapter = getBackendAdapter("upterm");
    expect(adapter).toBeInstanceOf(UptermAdapter);
  });

  it("should get tmate adapter", () => {
    const adapter = getBackendAdapter("tmate");
    expect(adapter).toBeInstanceOf(TmateAdapter);
  });

  it("should throw for unknown backend", () => {
    expect(() => getBackendAdapter("unknown")).toThrow(/unknown backend/i);
  });

  it("should accept backend-specific config", () => {
    const adapter = getBackendAdapter("upterm", { server: "custom.io" });
    expect(adapter).toBeInstanceOf(UptermAdapter);
  });
});
