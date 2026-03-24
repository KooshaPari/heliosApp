import { expect, test } from "bun:test";
import { InMemoryLocalBus } from "../../src/protocol/bus";

const LANE_CREATE_P95_MS = 30;
const SESSION_RESTORE_P95_MS = 35;
const BACKLOG_DEPTH_P95 = 64;
const TERMINAL_COUNT = 25;

function getSummary(bus: InMemoryLocalBus, metric: string) {
  return bus.getMetricsReport().summaries.find((entry) => entry.metric === metric);
}

async function runBatches(total: number, batchSize: number, work: (index: number) => Promise<void>) {
  for (let offset = 0; offset < total; offset += batchSize) {
    const limit = Math.min(total, offset + batchSize);
    await Promise.all(
      Array.from({ length: limit - offset }, (_, batchIndex) => work(offset + batchIndex)),
    );
  }
}

test("soak: lane/session churn and backlog pressure stay within baseline thresholds", async () => {
  const bus = new InMemoryLocalBus();

  await runBatches(200, TERMINAL_COUNT, async (index) => {
    await bus.request({
      id: `lane-create-${index}`,
      type: "command",
      ts: new Date().toISOString(),
      workspace_id: "workspace-soak",
      correlation_id: `corr-lane-${index}`,
      method: "lane.create",
      payload: { id: `lane-${index}` },
    });
  });

  await runBatches(200, TERMINAL_COUNT, async (index) => {
    const laneId = `lane-${index % TERMINAL_COUNT}`;
    const sessionId = `session-${index % 40}`;
    await bus.request({
      id: `session-restore-${index}`,
      type: "command",
      ts: new Date().toISOString(),
      workspace_id: "workspace-soak",
      lane_id: laneId,
      session_id: sessionId,
      correlation_id: `corr-restore-${index}`,
      method: "session.attach",
      payload: { id: sessionId, restore: true },
    });
  });

  for (let index = 0; index < 300; index++) {
    const backlogDepth =
      index % 75 === 0 ? 96 : index % 50 === 0 ? 80 : (index % 48) + 1;
    await bus.publish({
      id: `terminal-output-${index}`,
      type: "event",
      ts: new Date().toISOString(),
      workspace_id: "workspace-soak",
      lane_id: `lane-${index % TERMINAL_COUNT}`,
      session_id: `session-${index % 40}`,
      terminal_id: `terminal-${index % TERMINAL_COUNT}`,
      correlation_id: `corr-output-${index}`,
      topic: "terminal.output",
      payload: {
        line: `sample-output-${index}`,
        backlog_depth: backlogDepth,
      },
    });
  }

  const laneCreate = getSummary(bus, "lane_create_latency_ms");
  const sessionRestore = getSummary(bus, "session_restore_latency_ms");
  const backlog = getSummary(bus, "terminal_output_backlog_depth");

  expect(laneCreate).toBeDefined();
  expect(sessionRestore).toBeDefined();
  expect(backlog).toBeDefined();

  expect(laneCreate?.count).toBe(200);
  expect(sessionRestore?.count).toBe(200);
  expect(backlog?.count).toBe(300);

  expect(laneCreate?.p95 ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(LANE_CREATE_P95_MS);
  expect(sessionRestore?.p95 ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    SESSION_RESTORE_P95_MS,
  );
  expect(backlog?.p95 ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(BACKLOG_DEPTH_P95);
});
