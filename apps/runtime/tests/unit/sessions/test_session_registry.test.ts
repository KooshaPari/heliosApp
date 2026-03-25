import { describe, expect, test } from "bun:test";

import {
  InMemorySessionRegistry,
  SessionRegistryError,
} from "../../../src/sessions/registry";

describe("InMemorySessionRegistry", () => {
  test("creates and reuses lane sessions", () => {
    const registry = new InMemorySessionRegistry();

    const first = registry.ensure({
      lane_id: "lane-1",
      transport: "native_openai",
      codex_session_id: "codex-1",
    });
    expect(first.created).toBe(true);
    expect(first.session.status).toBe("attached");

    const second = registry.ensure({
      lane_id: "lane-1",
      transport: "cliproxy_harness",
      codex_session_id: "codex-1",
    });
    expect(second.created).toBe(false);
    expect(second.session.transport).toBe("cliproxy_harness");
  });

  test("rejects lane collisions with different codex sessions", () => {
    const registry = new InMemorySessionRegistry();
    registry.ensure({
      lane_id: "lane-1",
      transport: "native_openai",
      codex_session_id: "codex-1",
    });

    expect(() =>
      registry.ensure({
        lane_id: "lane-1",
        transport: "cliproxy_harness",
        codex_session_id: "codex-2",
      })
    ).toThrow(SessionRegistryError);
  });

  test("tracks heartbeat and termination", () => {
    const registry = new InMemorySessionRegistry();
    const { session } = registry.ensure({
      lane_id: "lane-1",
      transport: "native_openai",
      codex_session_id: "codex-1",
    });

    const heartbeat = registry.heartbeat(session.session_id);
    expect(heartbeat.last_heartbeat_at).toBeDefined();

    const terminated = registry.terminate(session.session_id);
    expect(terminated.status).toBe("terminated");
    expect(registry.get(session.session_id)?.status).toBe("terminated");
  });
});
