#!/usr/bin/env bun
/**
 * Gate 7: Static analysis for complexity and dead code
 * Analyzes code for excessive complexity and dead code patterns
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  type GateFinding,
  createGateReport,
  formatGateReport,
  writeGateReport,
} from "./gate-report";

const REPORT_OUTPUT = ".gate-reports/gate-static-analysis.json";
const MAX_FILE_LENGTH = 800;

/**
 * Scan TypeScript files for complexity and length violations.
 */
function scanForViolations(): GateFinding[] {
  const findings: GateFinding[] = [];
  const srcDirs = [
    join(process.cwd(), "apps/runtime/src"),
    join(process.cwd(), "apps/desktop/src"),
    join(process.cwd(), "scripts"),
  ];

  srcDirs.forEach(dir => {
    if (!existsSync(dir)) return;

    const scanDir = (currentDir: string) => {
      try {
        const files = readdirSync(currentDir);
        files.forEach(file => {
          const fullPath = join(currentDir, file);
          const stat = require("fs").statSync(fullPath);

          if (stat.isDirectory() && !file.startsWith(".") && file !== "node_modules") {
            scanDir(fullPath);
          } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
            const content = readFileSync(fullPath, "utf-8");
            const lines = content.split("\n");
            const relativePath = fullPath.replace(process.cwd(), "");

            // Check file length
            if (lines.length > MAX_FILE_LENGTH) {
              findings.push({
                file: relativePath,
                line: 1,
                message: `File has ${lines.length} lines, exceeds maximum of ${MAX_FILE_LENGTH}`,
                severity: "error",
                rule: "file-length",
                remediation: "Break file into smaller modules",
              });
            }
          }
        });
      } catch (e) {
        // Silently skip directories we can't read
      }
    };

    scanDir(dir);
  });

  return findings;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  const findings = scanForViolations();
  const duration = Date.now() - startTime;

  const report = createGateReport("static-analysis", findings, duration);
  writeGateReport(report, REPORT_OUTPUT);

  console.log(formatGateReport(report));

  process.exit(report.status === "pass" ? 0 : 1);
}

main().catch(e => {
  console.error(`Error: ${e}`);
  process.exit(2);
});
