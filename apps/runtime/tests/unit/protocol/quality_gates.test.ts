import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

const TRACE_GATE = "tools/gates/requirement-traceability.mjs";
const COVERAGE_GATE = "tools/gates/runtime-coverage.mjs";

describe("quality gates fail-closed fixtures", () => {
  test("requirement traceability gate passes with complete fixture mapping", () => {
    const run = spawnSync("node", [TRACE_GATE], {
      env: {
        ...process.env,
        TRACE_SPEC_PATH: "tools/gates/fixtures/traceability/spec-fixture.md",
        TRACE_MATRIX_PATH: "tools/gates/fixtures/traceability/matrix-pass.json",
      },
      stdio: "pipe",
    });

    expect(run.status).toBe(0);
  });

  test("requirement traceability gate fails closed when mappings are missing", () => {
    const run = spawnSync("node", [TRACE_GATE], {
      env: {
        ...process.env,
        TRACE_SPEC_PATH: "tools/gates/fixtures/traceability/spec-fixture.md",
        TRACE_MATRIX_PATH: "tools/gates/fixtures/traceability/matrix-missing.json",
      },
      stdio: "pipe",
    });

    expect(run.status).toBe(1);
  });

  test("coverage gate passes at and above 85 percent", () => {
    const run = spawnSync("node", [COVERAGE_GATE], {
      env: {
        ...process.env,
        COVERAGE_REPORT_PATH: "tools/gates/fixtures/coverage-pass.txt",
        COVERAGE_MIN: "85",
      },
      stdio: "pipe",
    });

    expect(run.status).toBe(0);
  });

  test("coverage gate fails closed below 85 percent", () => {
    const run = spawnSync("node", [COVERAGE_GATE], {
      env: {
        ...process.env,
        COVERAGE_REPORT_PATH: "tools/gates/fixtures/coverage-fail.txt",
        COVERAGE_MIN: "85",
      },
      stdio: "pipe",
    });

    expect(run.status).toBe(1);
  });
});
