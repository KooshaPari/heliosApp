#!/usr/bin/env bun
/**
 * Gate 2: Biome Lint report generator
 * Parses Biome linter output and generates structured JSON report
 */

import { existsSync, readFileSync } from "node:fs";
import { createGateReport, type GateFinding, writeGateReport } from "./gate-report";

const REPORT_OUTPUT = ".gate-reports/gate-lint.json";

/**
 * Parse Biome lint output from log file.
 * Biome output format:
 *   file.ts:line:col rule ━━━━━
 *   ...
 *   > line │ content
 *     ...
 */
function parseLintLog(): GateFinding[] {
  const findings: GateFinding[] = [];
  const logPath = "/tmp/lint.log";

  if (!existsSync(logPath)) {
    return findings;
  }

  const output = readFileSync(logPath, "utf-8");
  const lines = output.split("\n");

  // Biome error format: file.ts:line:col rule ━━━━━━━━━━━━━━━━━━━━
  // The rule name is prefixed with "lint/" (e.g., "lint/a11y/useButtonType")
  const biomePattern = /^(.+?):(\d+):(\d+)\s+(lint\/\S+)\s+/i;

  // Build findings from matching lines
  lines.forEach(line => {
    const match = line.match(biomePattern);
    if (match) {
      const [, file, lineNum, col, rule] = match;
      // Extract message from following lines if available
      const lineIdx = lines.indexOf(line);
      let message = "Biome lint error";
      if (lineIdx + 1 < lines.length) {
        const nextLine = lines[lineIdx + 1];
        // Messages often start with "!" or describe the issue
        const msgMatch = nextLine.match(/^\s+[!~] (.+)$/);
        if (msgMatch) {
          message = msgMatch[1];
        }
      }
      findings.push({
        file,
        line: Number.parseInt(lineNum, 10),
        column: Number.parseInt(col, 10) - 1,
        message,
        severity: "error",
        rule: rule.replace("lint/", ""),
      });
    }
  });

  return findings;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  const findings = parseLintLog();
  const duration = Date.now() - startTime;

  const report = createGateReport("lint", findings, duration);
  writeGateReport(report, REPORT_OUTPUT);
  process.exit(report.status === "pass" ? 0 : 1);
}

main().catch(_e => {
  process.exit(2);
});
