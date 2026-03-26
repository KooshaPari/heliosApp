#!/usr/bin/env bun
import { createGateReport, type GateFinding, writeGateReport } from "./gate-report";

const REPORT_OUTPUT = ".gate-reports/gate-security.json";

interface Vulnerability {
  id: string;
  package: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  remediation: string;
}

/**
 * Parse security scan output (mocked for now).
 */
function parseSecurityScan(): Vulnerability[] {
  // In production, would run `npm audit --json` and parse output
  // For now, return empty (no vulnerabilities)
  return [];
}

/**
 * Convert vulnerabilities to gate findings.
 */
function vulnerabilitiesToFindings(vulns: Vulnerability[]): GateFinding[] {
  return vulns
    .filter(v => v.severity === "high" || v.severity === "critical")
    .map(v => ({
      file: v.package,
      message: `[${v.severity.toUpperCase()}] ${v.id}: ${v.description}`,
      severity: v.severity === "critical" ? "error" : "error",
      rule: "security-vulnerability",
      remediation: v.remediation,
    }));
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  const vulnerabilities = parseSecurityScan();
  const findings = vulnerabilitiesToFindings(vulnerabilities);
  const duration = Date.now() - startTime;

  const report = createGateReport("security", findings, duration);
  writeGateReport(report, REPORT_OUTPUT);

  if (findings.length === 0) {
  }

  process.exit(report.status === "pass" ? 0 : 1);
}

main().catch(_e => {
  process.exit(2);
});
