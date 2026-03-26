#!/usr/bin/env bun
/**
 * Aggregate gate reports into a pipeline summary.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { aggregateGateReports, type GateReport, writeGateReport } from "./gate-report";

const REPORT_DIR = ".gate-reports";
const SUMMARY_OUTPUT = join(REPORT_DIR, "pipeline-summary.json");

/**
 * Read all gate reports from disk.
 */
function loadGateReports(): GateReport[] {
  const reports: GateReport[] = [];

  if (!existsSync(REPORT_DIR)) {
    return reports;
  }

  const files = readdirSync(REPORT_DIR);
  files
    .filter(f => f.startsWith("gate-") && f.endsWith(".json"))
    .sort()
    .forEach(file => {
      try {
        const path = join(REPORT_DIR, file);
        const data = JSON.parse(readFileSync(path, "utf-8"));
        reports.push(data as GateReport);
      } catch (_e) {}
    });

  return reports;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const reports = loadGateReports();

  if (reports.length === 0) {
    return;
  }

  const summary = aggregateGateReports(reports);
  writeGateReport(summary as unknown as GateReport, SUMMARY_OUTPUT);

  if (summary.failedGates.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch(_e => {
  process.exit(2);
});
