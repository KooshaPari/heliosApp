import { describe, expect, it } from "bun:test";
import { makeEngine } from "./integration_helpers.js";

describe("Redaction latency [SC-028-003]", () => {
  it("p95 redaction latency < 5ms over 100 audit events", () => {
    const engine = makeEngine();
    const latencies: number[] = [];

    const sampleOutputs = [
      "Compiling TypeScript files... Done in 1.42s with 0 errors.",
      "Running test suite: 45 tests passed, 0 failed, 2 skipped.",
      "Deploying to staging environment... Build ID: abc123def456",
      "Fetching dependencies from npm registry...",
      "Starting HTTP server on port 3000",
      "Connected to PostgreSQL database at localhost:5432/mydb",
      "WebSocket connection established from 127.0.0.1:52341",
      "Cache hit rate: 94.2% (hit: 1204, miss: 72)",
    ];

    for (let i = 0; i < 100; i++) {
      const text = sampleOutputs[i % sampleOutputs.length];
      const result = engine.redact(text, {
        artifactId: `latency-test:${i}`,
        artifactType: "terminal_output",
        correlationId: `corr-${i}`,
      });
      latencies.push(result.latencyMs);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    expect(p95).toBeLessThan(5);
  });
});
