/**
 * Constitution Compliance Checker
 * Validates PRs against the constitution review checklist.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";

interface Finding {
  check: string;
  filePath: string;
  line?: number;
  description: string;
  constitutionSection: string;
  constitutionLine?: number;
  remediationHint: string;
}

interface CheckResult {
  passed: boolean;
  findings: Finding[];
  timestamp: string;
}

/**
 * Per-file line limits (in lines). Files not listed use the default (500).
 * This allows principled exceptions for files that have legitimate reasons
 * to exceed the standard limit.
 */
const FILE_LINE_LIMITS: Record<string, number> = {
  'src/bus.ts': 900,
  'src/lanes/index.ts': 600,
  'src/providers/acp-client.ts': 600,
  'src/providers/mcp-bridge.ts': 600,
  'src/renderer/ghostty/backend.ts': 600,
  'src/secrets/protected-paths.ts': 600,
};

const DEFAULT_LINE_LIMIT = 500;
const DEFAULT_TEST_LINE_LIMIT = 800;

/**
 * File extensions that are exempt from the line-limit check.
 * Non-code files (docs, configs, lockfiles, test fixtures, etc.) should
 * not be subject to code-size limits.
 */
const LINE_LIMIT_EXEMPT_EXTENSIONS = new Set([
  '.md', '.json', '.yaml', '.yml', '.toml', '.lock', '.lockb',
  '.css', '.html', '.svg', '.xml', '.txt', '.csv', '.env',
  '.gitignore', '.dockerignore',
]);

/**
 * Path fragments that exempt a file from line-limit checks.
 */
const LINE_LIMIT_EXEMPT_PATTERNS = [
  'bun.lock',
  'package-lock.json',
  'node_modules/',
  '__fixtures__/',
  '.archive/',
];

const CONSTITUTION_PATH = path.join(
  path.dirname(path.dirname(import.meta.url)).replace("file://", ""),
  ".kittify/memory/constitution.md"
);

/**
 * Load and parse the constitution.
 */
async function loadConstitution(): Promise<string> {
  try {
    return await fs.readFile(CONSTITUTION_PATH, "utf-8");
  } catch (_error) {
    return "";
  }
}

/**
 * Extract section headings from constitution markdown.
 */
function extractSections(constitution: string): Map<string, number> {
  const sections = new Map<string, number>();
  const lines = constitution.split("\n");

  lines.forEach((line, index) => {
    if (line.startsWith("## ")) {
      const sectionName = line.substring(3).trim();
      sections.set(sectionName, index + 1);
    }
  });

  return sections;
}

/**
 * Get the configured line limit for a file, using per-file overrides or the default.
 */
function getLineLimit(filePath: string): number {
  // Check for exact match or normalized path match
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const [configPath, limit] of Object.entries(FILE_LINE_LIMITS)) {
    const normalizedConfig = configPath.replace(/\\/g, '/');
    if (normalizedPath.endsWith(normalizedConfig) || normalizedPath === normalizedConfig) {
      return limit;
    }
  }

  // Test files get a higher default limit
  if (normalizedPath.includes('.test.') || normalizedPath.includes('.spec.')) {
    return DEFAULT_TEST_LINE_LIMIT;
  }
  return DEFAULT_LINE_LIMIT;
}

/**
 * Whether a file should be exempt from line-limit checks.
 */
function isLineLimitExempt(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (LINE_LIMIT_EXEMPT_EXTENSIONS.has(ext)) return true;

  const normalized = filePath.replace(/\\/g, '/');
  return LINE_LIMIT_EXEMPT_PATTERNS.some(p => normalized.includes(p));
}

/**
 * Check for files exceeding configured line limits.
 */
async function checkFileSizes(files: string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  const sections = await loadConstitution().then(extractSections);
  const section = "Code Structure and Maintainability";
  const sectionLine = sections.get(section) || 0;

  for (const filePath of files) {
    if (isLineLimitExempt(filePath)) continue;

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n").length;

      if (lines > 500) {
        findings.push({
          check: "File Size Limit",
          filePath,
          line: 1,
          description: `File exceeds ${limit}-line limit (${lines} lines)`,
          constitutionSection: section,
          constitutionLine: sectionLine,
          remediationHint:
            "Split file into smaller modules following single-responsibility principle",
        });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return findings;
}

/**
 * Check if a test file imports the source file (reverse lookup).
 * Handles common import patterns from the test perspective.
 */
async function testImportsSourceFile(testFilePath: string, sourceFilePath: string): Promise<boolean> {
  try {
    const testContent = await fs.readFile(testFilePath, 'utf-8');
    const normalizedSourcePath = sourceFilePath.replace(/\\/g, '/').replace(/\.(tsx?|mjs)$/, '');
    const sourceFileName = path.basename(sourceFilePath, path.extname(sourceFilePath));

    // Check for various import patterns
    const importPatterns = [
      new RegExp(`from\\s+['"]\\.?/?.*${sourceFileName}['"]`, 'i'),
      new RegExp(`from\\s+['"]${normalizedSourcePath}['"]`, 'i'),
      new RegExp(`require\\(['"]\\.?/?.*${sourceFileName}['"]`, 'i'),
      new RegExp(`import\\(\\s*['"]\\.?/?.*${sourceFileName}['"]`, 'i'),
    ];

    return importPatterns.some(pattern => pattern.test(testContent));
  } catch {
    return false;
  }
}

/**
 * Find test files that import the given source file.
 */
async function findTestsImportingSource(
  sourceFilePath: string,
  allFiles: string[]
): Promise<boolean> {
  const potentialTestFiles = allFiles.filter(
    f => (f.includes('.test.') || f.includes('.spec.')) &&
         f.endsWith('.ts') &&
         !f.includes('node_modules')
  );

  for (const testFile of potentialTestFiles) {
    if (await testImportsSourceFile(testFile, sourceFilePath)) {
      return true;
    }
  }

  return false;
}

/**
 * Check for test coverage via forward lookup (test file colocated/mirrored)
 * and reverse lookup (test file imports source file).
 */
async function checkTestCoverage(files: string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  const sections = await loadConstitution().then(extractSections);
  const section = "Test Coverage";
  const sectionLine = sections.get(section) || 0;

  for (const filePath of files) {
    // Only check source files, not test files
    if (filePath.includes(".test.") || filePath.includes(".spec.")) {
      continue;
    }

    // Skip fixture files (they are test artifacts, not source code)
    if (filePath.includes('/fixtures/') || filePath.includes('\\fixtures\\')) {
      continue;
    }

      // Look for corresponding test file in multiple common locations
      const baseName = path.basename(filePath, path.extname(filePath));
      const dirName = path.dirname(filePath);
      const candidatePaths = [
        filePath.replace(/\.ts$/, ".test.ts"),
        filePath.replace(/\.tsx$/, ".test.tsx"),
        path.join(dirName, "__tests__", `${baseName}.test.ts`),
        path.join(dirName, "__tests__", `${baseName}.test.tsx`),
      ];

      // Also check tests/unit mirror path (e.g. apps/desktop/src/panels/x.ts -> apps/desktop/tests/unit/panels/x.test.ts)
      const srcMatch = filePath.match(/^(apps\/\w+)\/src\/(.+)$/);
      if (srcMatch) {
        const testMirror = path.join(srcMatch[1], "tests", "unit", srcMatch[2]);
        candidatePaths.push(testMirror.replace(/\.ts$/, ".test.ts"));
        candidatePaths.push(testMirror.replace(/\.tsx$/, ".test.tsx"));
      }

      // Also check scripts/tests/ mirror path
      const scriptMatch = filePath.match(/^scripts\/(.+)$/);
      if (scriptMatch) {
        candidatePaths.push(
          path.join("scripts", "tests", scriptMatch[1].replace(/\.ts$/, ".test.ts"))
        );
      }

      let hasTest = false;
      for (const candidate of candidatePaths) {
        try {
          await fs.access(candidate);
          hasTest = true;
          break;
        } catch {
          // continue checking
        }
      }

      if (!hasTest) {
        const testPath = filePath.replace(/\.ts$/, ".test.ts");
        findings.push({
          check: "Test Coverage",
          filePath,
          line: 1,
          description: "No corresponding test file found",
          constitutionSection: section,
          constitutionLine: sectionLine,
          remediationHint: `Create ${path.basename(testPath)} with tests for new functionality`,
        });
      }
    }
  }

  return findings;
}

/**
 * Check for unsafe patterns (any type, hardcoded secrets).
 * Only checks TypeScript source files, skipping test files and fixtures.
 */
async function checkUnsafePatterns(files: string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  const sections = await loadConstitution().then(extractSections);

  for (const filePath of files) {
    // Only check .ts/.tsx source files, skip tests and fixtures
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) continue;
    if (filePath.includes('.test.') || filePath.includes('.spec.')) continue;
    if (filePath.includes('__fixtures__') || filePath.includes('__tests__')) continue;
    if (filePath.includes('node_modules')) continue;

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        // Check for 'any' type
        if (/:\s*any\b/.test(line)) {
          const section = "Type Safety";
          findings.push({
            check: "Type Safety",
            filePath,
            line: index + 1,
            description: 'Use of "any" type detected',
            constitutionSection: section,
            constitutionLine: sections.get(section) || 0,
            remediationHint: "Replace with specific type or use `unknown` with type guard",
          });
        }

        // Check for hardcoded secrets
        if (/(?:API_KEY|SECRET|PASSWORD|TOKEN)\s*=\s*["']/.test(line)) {
          const section = "Security";
          findings.push({
            check: "Security",
            filePath,
            line: index + 1,
            description: "Potential hardcoded secret detected",
            constitutionSection: section,
            constitutionLine: sections.get(section) || 0,
            remediationHint: "Move to environment variables or secure config, never commit secrets",
          });
        }
      });
    } catch {
      // Skip files that can't be read
    }
  }

  return findings;
}

/**
 * Run all compliance checks.
 */
async function runComplianceChecks(files: string[]): Promise<CheckResult> {
  const allFindings: Finding[] = [];

  // Run all checks
  allFindings.push(...(await checkFileSizes(files)));
  allFindings.push(...(await checkTestCoverage(files)));
  allFindings.push(...(await checkUnsafePatterns(files)));

  return {
    passed: blockingFindings.length === 0,
    findings: allFindings,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format results as JSON.
 */
function formatJson(result: CheckResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format results as table.
 */
function formatTable(result: CheckResult): string {
  if (result.findings.length === 0) {
    return "All compliance checks passed!";
  }

  let output = "COMPLIANCE VIOLATIONS:\n\n";

  result.findings.forEach((finding, i) => {
    output += `${i + 1}. ${finding.check} (${finding.filePath}:${finding.line || "N/A"})\n`;
    output += `   Description: ${finding.description}\n`;
    output += `   Constitution: ${finding.constitutionSection}`;
    if (finding.constitutionLine) {
      output += ` (line ${finding.constitutionLine})`;
    }
    output += "\n";
    output += `   Remediation: ${finding.remediationHint}\n\n`;
  });

  return output;
}

/**
 * CLI entry point.
 */
if (import.meta.main) {
  const args = process.argv.slice(2);
  const format = args.includes("--json") ? "json" : "table";
  const files = args.filter(arg => !arg.startsWith("--"));

  if (files.length === 0) {
    process.exit(1);
  }

  runComplianceChecks(files)
    .then(result => {
      if (format === "json") {
      } else {
      }
      process.exit(result.passed ? 0 : 1);
    })
    .catch(_err => {
      process.exit(1);
    });
}

export { runComplianceChecks, type CheckResult, type Finding };
