import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { AuditSink } from "../../audit/audit-sink.js";
import { RedactionAuditTrail } from "../audit-trail.js";
import { makeAuditSink, makeEngine, makeRedactFn, makeStore } from "./integration_helpers.js";
import { makeTestTempDir } from "./tempdir.js";

describe("Audit completeness [SC-028-005]", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTestTempDir("helios-integration-test-");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("full lifecycle: create/access/rotate/revoke all have audit records", async () => {
    const { InMemoryLocalBus } = await import("../../protocol/bus.js");
    const bus = new InMemoryLocalBus();
    const engine = makeEngine();
    const sink = makeAuditSink(engine);
    const wrappedBus = sink.wrapBus(bus);
    const storeWithAudit = makeStore(tmpDir, wrappedBus);

    await storeWithAudit.create("prov", "ws", "key", "val", "corr-create");
    await storeWithAudit.retrieveWithContext(
      { requestingProviderId: "prov", requestingWorkspaceId: "ws", correlationId: "corr-access" },
      "prov",
      "ws",
      "key"
    );
    await storeWithAudit.rotate("prov", "ws", "key", "newval", "corr-rotate");
    await storeWithAudit.revoke("prov", "ws", "key", "corr-revoke");

    const created = sink.query({ topic: "secrets.credential.created" });
    const accessed = sink.query({ topic: "secrets.credential.accessed" });
    const rotated = sink.query({ topic: "secrets.credential.rotated" });
    const revoked = sink.query({ topic: "secrets.credential.revoked" });

    expect(created.length).toBeGreaterThan(0);
    expect(accessed.length).toBeGreaterThan(0);
    expect(rotated.length).toBeGreaterThan(0);
    expect(revoked.length).toBeGreaterThan(0);
  });

  it("redaction audit trail present for every persisted artifact", async () => {
    const { InMemoryLocalBus } = await import("../../protocol/bus.js");
    const bus = new InMemoryLocalBus();
    const engine = makeEngine();
    const sink = new AuditSink({ redactFn: makeRedactFn(engine) });
    const wrappedBus = sink.wrapBus(bus);
    const trail = new RedactionAuditTrail({ bus: wrappedBus });

    const artifactIds = ["artifact-1", "artifact-2", "artifact-3"];
    for (const id of artifactIds) {
      const result = engine.redact(`output for ${id}`, {
        artifactId: id,
        artifactType: "terminal_output",
        correlationId: "corr-completeness",
      });
      trail.record(id, result, {
        artifactId: id,
        artifactType: "terminal_output",
        correlationId: "corr-completeness",
      });
    }

    for (const id of artifactIds) {
      const hasRecord = trail.verify(id);
      expect(hasRecord).toBe(true);
    }

    const auditRecords = sink.query({ topic: "secrets.redaction.applied" });
    expect(auditRecords.length).toBe(artifactIds.length);
  });
});
