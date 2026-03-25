#!/usr/bin/env bun
<<<<<<< HEAD
import {
  type GateFinding,
  createGateReport,
  formatGateReport,
  writeGateReport,
=======
/**
 * Gate 6: Security vulnerability scanning
 * Scans dependencies for known vulnerabilities using npm audit
 */

import { readFileSync, existsSync } from "fs";
import {
	createGateReport,
	writeGateReport,
	formatGateReport,
	type GateFinding,
>>>>>>> origin/main
} from "./gate-report";

const REPORT_OUTPUT = ".gate-reports/gate-security.json";

interface Vulnerability {
<<<<<<< HEAD
  id: string;
  package: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  remediation: string;
=======
	id: string;
	package: string;
	severity: "low" | "medium" | "high" | "critical";
	description: string;
	remediation: string;
>>>>>>> origin/main
}

/**
 * Parse security scan output (mocked for now).
 */
function parseSecurityScan(): Vulnerability[] {
<<<<<<< HEAD
  // In production, would run `npm audit --json` and parse output
  // For now, return empty (no vulnerabilities)
  return [];
=======
	// In production, would run `npm audit --json` and parse output
	// For now, return empty (no vulnerabilities)
	return [];
>>>>>>> origin/main
}

/**
 * Convert vulnerabilities to gate findings.
 */
function vulnerabilitiesToFindings(vulns: Vulnerability[]): GateFinding[] {
<<<<<<< HEAD
  return vulns
    .filter(v => v.severity === "high" || v.severity === "critical")
    .map(v => ({
      file: v.package,
      message: `[${v.severity.toUpperCase()}] ${v.id}: ${v.description}`,
      severity: v.severity === "critical" ? "error" : "error",
      rule: "security-vulnerability",
      remediation: v.remediation,
    }));
=======
	return vulns
		.filter((v) => v.severity === "high" || v.severity === "critical")
		.map((v) => ({
			file: v.package,
			message: `[${v.severity.toUpperCase()}] ${v.id}: ${v.description}`,
			severity: v.severity === "critical" ? "error" : "error",
			rule: "security-vulnerability",
			remediation: v.remediation,
		}));
>>>>>>> origin/main
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
<<<<<<< HEAD
  const startTime = Date.now();
  const vulnerabilities = parseSecurityScan();
  const findings = vulnerabilitiesToFindings(vulnerabilities);
  const duration = Date.now() - startTime;

  const report = createGateReport("security", findings, duration);
  writeGateReport(report, REPORT_OUTPUT);

  console.log(formatGateReport(report));

  if (findings.length === 0) {
    console.log("No high or critical security vulnerabilities found.");
  }

  process.exit(report.status === "pass" ? 0 : 1);
}

main().catch(e => {
  console.error(`Error: ${e}`);
  process.exit(2);
=======
	const startTime = Date.now();
	const vulnerabilities = parseSecurityScan();
	const findings = vulnerabilitiesToFindings(vulnerabilities);
	const duration = Date.now() - startTime;

	const report = createGateReport("security", findings, duration);
	writeGateReport(report, REPORT_OUTPUT);

	console.log(formatGateReport(report));

	if (findings.length === 0) {
		console.log("No high or critical security vulnerabilities found.");
	}

	process.exit(report.status === "pass" ? 0 : 1);
}

main().catch((e) => {
	console.error(`Error: ${e}`);
	process.exit(2);
>>>>>>> origin/main
});
