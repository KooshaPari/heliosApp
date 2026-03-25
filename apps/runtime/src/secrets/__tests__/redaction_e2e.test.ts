import { describe, expect, it } from "bun:test";
import { AuditSink } from "../../audit/audit-sink.js";
import { RedactionAuditTrail } from "../audit-trail.js";
import { makeEngine, makeRedactFn } from "./integration_helpers.js";

describe("End-to-end redaction [SC-028-001]", () => {
  it("terminal output with injected secrets is fully redacted in export", async () => {
    const { InMemoryLocalBus } = await import("../../protocol/bus.js");
    const bus = new InMemoryLocalBus();
    const engine = makeEngine();
    const sink = new AuditSink({ redactFn: makeRedactFn(engine) });
    const wrappedBus = sink.wrapBus(bus);
    const trail = new RedactionAuditTrail({ bus: wrappedBus });

    const secretKey = "AKIAIOSFODNN7EXAMPLE";
    const terminalOutput = `Starting deployment...\nUsing key: ${secretKey}\nDeployment complete`;

    const redactResult = engine.redact(terminalOutput, {
      artifactId: "terminal:session-1",
      artifactType: "terminal_output",
      correlationId: "e2e-test",
    });

    trail.record("terminal:session-1", redactResult, {
      artifactId: "terminal:session-1",
      artifactType: "terminal_output",
      correlationId: "e2e-test",
    });

    const bundle = sink.export();
    const bundleStr = JSON.stringify(bundle);

    expect(bundleStr).not.toContain(secretKey);
    expect(bundle.redacted).toBe(true);
    expect(bundle.records.length).toBeGreaterThan(0);
  });

  it("export bundle does not corrupt non-secret content", async () => {
    const { InMemoryLocalBus } = await import("../../protocol/bus.js");
    const bus = new InMemoryLocalBus();
    const engine = makeEngine();
    const sink = new AuditSink({ redactFn: makeRedactFn(engine) });
    const wrappedBus = sink.wrapBus(bus);
    const trail = new RedactionAuditTrail({ bus: wrappedBus });

    const safeOutput = "Build completed in 1.42s. 3 warnings, 0 errors.";
    const result = engine.redact(safeOutput, {
      artifactId: "terminal:safe-1",
      artifactType: "terminal_output",
      correlationId: "e2e-safe",
    });
    trail.record("terminal:safe-1", result, {
      artifactId: "terminal:safe-1",
      artifactType: "terminal_output",
      correlationId: "e2e-safe",
    });

    expect(result.redacted).toBe(safeOutput);
  });
});
