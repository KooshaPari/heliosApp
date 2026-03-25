import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { randomBytes } from "node:crypto";
import { rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CredentialStore } from "../credential-store.js";
import { InMemoryLocalBus } from "../../protocol/bus.js";
import { makeStore } from "./integration_helpers.js";
import { makeTestTempDir } from "./tempdir.js";

describe("Credential rotation [SC-028-002]", () => {
  let tmpDir: string;
  let store: CredentialStore;

  beforeEach(() => {
    tmpDir = makeTestTempDir("helios-integration-test-");
    store = makeStore(tmpDir, new InMemoryLocalBus());
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("old credential value is not recoverable from encrypted file after rotation", async () => {
    const oldValue = "old-secret-" + randomBytes(8).toString("hex");
    const newValue = "new-secret-" + randomBytes(8).toString("hex");

    await store.create("prov", "ws", "apiKey", oldValue, "corr-create");

    const credPath = join(tmpDir, "secrets", "prov", "ws", "apiKey.enc");
    const beforeRotation = readFileSync(credPath, "utf8");

    await store.rotate("prov", "ws", "apiKey", newValue, "corr-rotate");

    const afterRotation = readFileSync(credPath, "utf8");

    expect(afterRotation).not.toBe(beforeRotation);
    expect(afterRotation).not.toContain(oldValue);

    const retrieved = await store.retrieve("prov", "ws", "apiKey");
    expect(retrieved).toBe(newValue);
  });

  it("rotation emits audit event", async () => {
    const bus = new InMemoryLocalBus();
    store = makeStore(tmpDir, bus);

    await store.create("prov", "ws", "key", "old", "corr-1");
    await store.rotate("prov", "ws", "key", "new", "corr-2");

    const events = bus.getEvents();
    const rotatedEvent = events.find((e) => e.topic === "secrets.credential.rotated");
    expect(rotatedEvent).toBeDefined();
    expect(rotatedEvent?.payload?.name).toBe("key");
    const raw = JSON.stringify(rotatedEvent);
    expect(raw).not.toContain("old");
    expect(raw).not.toContain("new");
  });
});
