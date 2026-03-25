import { describe, it, expect } from "bun:test";
import { AuditSink } from "../../audit/audit-sink.js";
import { ProtectedPathDetector } from "../protected-paths.js";
import { makeEngine, makeRedactFn } from "./integration_helpers.js";

describe("Protected path audit integration [SC-028-005]", () => {
  it("protected path access events are persisted in audit sink", async () => {
    const { InMemoryLocalBus } = await import("../../protocol/bus.js");
    const bus = new InMemoryLocalBus();
    const engine = makeEngine();
    const sink = new AuditSink({ redactFn: makeRedactFn(engine) });
    const wrappedBus = sink.wrapBus(bus);

    const detector = new ProtectedPathDetector({ bus: wrappedBus });
    detector.check("cat .env", { terminalId: "term-1", correlationId: "corr-path" });

    await new Promise((r) => setTimeout(r, 5));

    const records = sink.query({ topic: "secrets.protected_path.accessed" });
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].payload?.matchedPath).toBe(".env");
  });

  it("protected path event in audit sink does not contain raw command secrets", async () => {
    const { InMemoryLocalBus } = await import("../../protocol/bus.js");
    const bus = new InMemoryLocalBus();
    const engine = makeEngine();
    const sink = new AuditSink({ redactFn: makeRedactFn(engine) });
    const wrappedBus = sink.wrapBus(bus);

    const detector = new ProtectedPathDetector({ bus: wrappedBus });
    detector.check("cat .env AKIAIOSFODNN7EXAMPLE", {
      terminalId: "term-1",
      correlationId: "corr-sensitive",
    });

    await new Promise((r) => setTimeout(r, 5));

    const bundle = sink.export();
    const bundleStr = JSON.stringify(bundle);
    expect(bundleStr).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });
});
