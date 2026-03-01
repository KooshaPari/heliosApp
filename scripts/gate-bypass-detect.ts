#!/usr/bin/env bun
/**
 * Bypass Detection Scanner - Gate 8
 * Detects and reports all forms of quality gate suppression directives
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createGateReport, writeGateReport, formatGateReport, type GateFinding } from './gate-report';

const REPORT_OUTPUT = '.gate-reports/gate-bypass-detect.json';

// Patterns to detect as suppression directives
const SUPPRESSION_PATTERNS = [
  { regex: /@ts-ignore/, name: '@ts-ignore' },
  { regex: /@ts-expect-error/, name: '@ts-expect-error' },
  { regex: /@ts-nocheck/, name: '@ts-nocheck' },
  { regex: /eslint-disable(-line|-next-line)?/, name: 'eslint-disable' },
  { regex: /biome-ignore/, name: 'biome-ignore' },
];

const TEST_MARKERS = [
  { regex: /\.skip\s*\(/, name: '.skip()' },
  { regex: /\.only\s*\(/, name: '.only()' },
  { regex: /\.todo\s*\(/, name: '.todo()' },
];

interface ScannerOptions {
  root?: string;
  exclude?: string[];
  json?: boolean;
}

/**
 * Scan for suppression directives in source files.
 */
export function scanBypassDirectives(options: ScannerOptions = {}): GateFinding[] {
  const findings: GateFinding[] = [];
  const root = options.root || process.cwd();
  const exclude = options.exclude || ['node_modules', 'dist', '.git', '.worktrees'];

  function shouldExclude(filePath: string): boolean {
    return exclude.some((pattern) => filePath.includes(pattern));
  }

  function scanDir(dir: string) {
    if (shouldExclude(dir)) return;

    try {
      const files = readdirSync(dir);
      files.forEach((file) => {
        const fullPath = join(dir, file);
        const stat = require('fs').statSync(fullPath);

        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
          scanFile(fullPath, file);
        }
      });
    } catch (e) {
      // Silently skip unreadable directories
    }
  }

  function scanFile(filePath: string, fileName: string) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(fileName);
    const relativePath = filePath.replace(process.cwd(), '');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Skip lines that are entirely within comments (lazy check)
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      // Check TypeScript and other suppression patterns
      SUPPRESSION_PATTERNS.forEach((pattern) => {
        if (pattern.regex.test(line)) {
          findings.push({
            file: relativePath,
            line: lineNum,
            message: `Suppression directive found: ${pattern.name}`,
            severity: 'error',
            rule: 'no-suppression-directive',
            remediation: `Remove ${pattern.name} and fix the underlying issue`,
          });
        }
      });

      // Check test markers
      if (isTestFile) {
        TEST_MARKERS.forEach((marker) => {
          if (marker.regex.test(line)) {
            findings.push({
              file: relativePath,
              line: lineNum,
              message: `Test marker found: ${marker.name}`,
              severity: 'error',
              rule: 'no-test-marker',
              remediation: `Remove ${marker.name} from test`,
            });
          }
        });
      }
    });
  }

  scanDir(root);
  return findings;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');

  const startTime = Date.now();
  const findings = scanBypassDirectives({ exclude: ['node_modules', 'dist', '.git', '.worktrees'] });
  const duration = Date.now() - startTime;

  const report = createGateReport('bypass-detect', findings, duration);

  if (jsonFlag) {
    writeGateReport(report, REPORT_OUTPUT);
  }

  console.log(formatGateReport(report));

  process.exit(report.status === 'pass' ? 0 : 1);
}

main().catch((e) => {
  console.error(`Error: ${e}`);
  process.exit(2);
});
