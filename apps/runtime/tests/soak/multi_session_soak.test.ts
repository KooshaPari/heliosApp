import { expect, test } from "bun:test";
import { InMemoryLocalBus } from "../../src/protocol/bus";

const LANE_ITERATIONS = 200;
const SESSION_ITERATIONS = 200;
const BACKLOG_ITERATIONS = 300;
const CONCURRENCY = 20;
const ACTIVE_SESSION_COUNT = 8;

const LANE_CREATE_P95_MAX_MS = 30;
const SESSION_RESTORE_P95_MAX_MS = 35;
const SESSION_RESTORE_RETRY_JITTER_MS = 3;
const BACKLOG_P95_MAX_COUNT = 64;

interface SoakReport {
  laneP95: number;
  restoreP95: number;
  backlogP95: number;
  backlogMax: number;
  backlogSessionCount: number;
  activeSessionCount: number;
}

async function runSoakScenario(): Promise<SoakReport> {
  const bus = new InMemoryLocalBus();
  const workspaceId = "workspace-soak";
  const activeSessionIds = new Set<string>();

  for (let i = 0; i < LANE_ITERATIONS; i += CONCURRENCY) {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, LANE_ITERATIONS - i) }, (_, index) => {
        const id = i + index;
        return bus.request({
          id: `lane-${id}`,
          type: "command",
          ts: new Date().toISOString(),
          workspace_id: workspaceId,
          correlation_id: `corr-lane-${id}`,
          method: "lane.create",
          payload: { id: `lane-${id}` }
        });
      })
    );
  }

  for (let i = 0; i < SESSION_ITERATIONS; i += CONCURRENCY) {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, SESSION_ITERATIONS - i) }, (_, index) => {
        const id = i + index;
        const laneId = `lane-${id % ACTIVE_SESSION_COUNT}`;
        const sessionId = `session-${id % ACTIVE_SESSION_COUNT}`;
        activeSessionIds.add(sessionId);
        return bus.request({
          id: `restore-${id}`,
          type: "command",
          ts: new Date().toISOString(),
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: sessionId,
          correlation_id: `corr-restore-${id}`,
          method: "session.attach",
          payload: { id: sessionId, restore: true }
        });
      })
    );
  }

  for (let i = 0; i < BACKLOG_ITERATIONS; i += CONCURRENCY) {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, BACKLOG_ITERATIONS - i) }, (_, index) => {
        const id = i + index;
        const laneId = `lane-${id % ACTIVE_SESSION_COUNT}`;
        const sessionId = `session-${id % ACTIVE_SESSION_COUNT}`;
        const baselineDepth = 24 + ((id * 7) % 34);
        const spikeDepth = id % 29 === 0 ? 72 + ((id % 4) * 4) : 0;
        const backlogDepth = baselineDepth + spikeDepth;

        return bus.publish({
          id: `output-${id}`,
          type: "event",
          ts: new Date().toISOString(),
          workspace_id: workspaceId,
          lane_id: laneId,
          session_id: sessionId,
          terminal_id: `terminal-${id % ACTIVE_SESSION_COUNT}`,
          correlation_id: `corr-output-${id}`,
          topic: "terminal.output",
          payload: {
            backlog_depth: backlogDepth,
            line: `line-${id}`
          }
        });
      })
    );
  }

  const report = bus.getMetricsReport();
  const lane = report.summaries.find((metric) => metric.metric === "lane_create_latency_ms");
  const restore = report.summaries.find((metric) => metric.metric === "session_restore_latency_ms");
  const backlog = report.summaries.find((metric) => metric.metric === "terminal_output_backlog_depth");
  const backlogSamples = report.samples.filter((metric) => metric.metric === "terminal_output_backlog_depth");
  const backlogSessionIds = new Set(
    backlogSamples.map((sample) => sample.tags?.session_id).filter((value): value is string => !!value)
  );
  const backlogMax = backlogSamples.reduce((max, sample) => Math.max(max, sample.value), 0);

  expect(lane).toBeDefined();
  expect(restore).toBeDefined();
  expect(backlog).toBeDefined();

  return {
    laneP95: lane?.p95 ?? Number.MAX_VALUE,
    restoreP95: restore?.p95 ?? Number.MAX_VALUE,
    backlogP95: backlog?.p95 ?? Number.MAX_VALUE,
    backlogMax,
    backlogSessionCount: backlogSessionIds.size,
    activeSessionCount: activeSessionIds.size
  };
}

test("soak: lane/session churn and backlog pressure stay within baseline thresholds", async () => {
  const firstRun = await runSoakScenario();

  expect(firstRun.backlogSessionCount).toBe(firstRun.activeSessionCount);
  expect(firstRun.backlogMax > BACKLOG_P95_MAX_COUNT).toBe(true);
  expect(firstRun.laneP95 <= LANE_CREATE_P95_MAX_MS).toBe(true);
  expect(firstRun.backlogP95 <= BACKLOG_P95_MAX_COUNT).toBe(true);

  if (firstRun.restoreP95 <= SESSION_RESTORE_P95_MAX_MS) {
    expect(firstRun.restoreP95 <= SESSION_RESTORE_P95_MAX_MS).toBe(true);
    return;
  }

  const withinJitterBand =
    firstRun.restoreP95 <= SESSION_RESTORE_P95_MAX_MS + SESSION_RESTORE_RETRY_JITTER_MS;

  expect(withinJitterBand).toBe(true);

  const retryRun = await runSoakScenario();
  expect(retryRun.laneP95 <= LANE_CREATE_P95_MAX_MS).toBe(true);
  expect(retryRun.backlogP95 <= BACKLOG_P95_MAX_COUNT).toBe(true);
  expect(retryRun.restoreP95 <= SESSION_RESTORE_P95_MAX_MS).toBe(true);
});
