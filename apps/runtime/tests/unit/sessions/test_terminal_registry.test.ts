import { describe, expect, test } from "bun:test";

import { TerminalRegistry } from "../../../src/sessions/terminal_registry";

describe("TerminalRegistry", () => {
	test("stores and queries terminal context", () => {
		const registry = new TerminalRegistry();
		const terminal = registry.spawn({
			terminalId: "t-1",
			workspaceId: "ws-1",
			laneId: "lane-1",
			sessionId: "sess-1",
			title: "Alpha",
		});

		expect(terminal.state).toBe("spawning");
		expect(registry.get("t-1")?.sessionId).toBe("sess-1");
		expect(registry.listBySession("sess-1")).toHaveLength(1);
	});

	test("enforces ownership boundaries for workspace lane session", () => {
		const registry = new TerminalRegistry();
		registry.spawn({
			terminalId: "t-2",
			workspaceId: "ws-1",
			laneId: "lane-1",
			sessionId: "sess-1",
		});

		expect(
			registry.isOwnedBy("t-2", {
				workspaceId: "ws-1",
				laneId: "lane-1",
				sessionId: "sess-1",
			}),
		).toBe(true);
		expect(
			registry.isOwnedBy("t-2", {
				workspaceId: "ws-1",
				laneId: "lane-2",
				sessionId: "sess-1",
			}),
		).toBe(false);
	});

	test("cleans up session scoped terminals", () => {
		const registry = new TerminalRegistry();
		registry.spawn({
			terminalId: "t-3",
			workspaceId: "ws-1",
			laneId: "lane-1",
			sessionId: "sess-1",
		});
		registry.spawn({
			terminalId: "t-4",
			workspaceId: "ws-1",
			laneId: "lane-1",
			sessionId: "sess-1",
		});

		registry.removeBySession("sess-1");

		expect(registry.get("t-3")).toBeUndefined();
		expect(registry.get("t-4")).toBeUndefined();
		expect(registry.listBySession("sess-1")).toHaveLength(0);
	});

	test("re-indexes terminal ownership when terminal_id is reused", () => {
		const registry = new TerminalRegistry();
		registry.spawn({
			terminalId: "t-5",
			workspaceId: "ws-1",
			laneId: "lane-1",
			sessionId: "sess-1",
		});
		registry.spawn({
			terminalId: "t-5",
			workspaceId: "ws-1",
			laneId: "lane-2",
			sessionId: "sess-2",
		});

		expect(registry.listBySession("sess-1")).toHaveLength(0);
		expect(registry.listBySession("sess-2")).toHaveLength(1);
		expect(registry.listBySession("sess-2")[0]?.laneId).toBe("lane-2");
	});
});
