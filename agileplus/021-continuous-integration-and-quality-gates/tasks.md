# Work Packages: Continuous Integration and Quality Gates

**Inputs**: Design documents from `/kitty-specs/021-continuous-integration-and-quality-gates/`
**Prerequisites**: plan.md (required), spec.md (user stories), spec 019 (Bun workspace setup)

**Tests**: Include explicit testing work because the constitution requires all gates at maximum strictness with no skips.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/021-continuous-integration-and-quality-gates/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `.github/`, `scripts/`, and `apps/`.

---

## Work Package WP01: Gate Pipeline Definition — Typecheck, Lint, and Test Gates (Priority: P0)

**Phase**: Phase 1 - CI Foundation
**Goal**: Define the GitHub Actions CI workflow and implement the first four gates: TypeScript strict type check, Biome lint/format, Vitest unit tests, and Playwright e2e tests.
**Independent Test**: Push a commit with a deliberate lint violation and verify the pipeline fails at the lint gate with actionable diagnostics.
**Prompt**: `/kitty-specs/021-continuous-integration-and-quality-gates/tasks/WP01-gate-pipeline-definition.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T001 Create `.github/workflows/quality-gates.yml` with pipeline skeleton executing 8 gates in order with fail-fast behavior and structured JSON artifact output
- [ ] T002 Implement Gate 1 (TypeScript strict type check) using `bun run typecheck` from spec 019 with strict mode validation
- [ ] T003 Implement Gate 2 (Biome lint/format) with maximum strictness config in `biome.json`, ESLint as secondary cross-check where needed
- [ ] T004 Implement Gate 3 (Vitest unit tests) running all test suites, failing on any test failure including `.skip`/`.only`/`.todo` markers
- [ ] T005 [P] Implement Gate 4 (Playwright e2e tests) running all Playwright suites against a built desktop artifact in headless mode
- [ ] T006 [P] Create `scripts/gate-report.ts` structured JSON report generator producing per-gate reports with gate name, status, file path, line number, error detail, and remediation hint

### Implementation Notes
- Pipeline must execute gates in defined order: typecheck -> lint -> test -> e2e -> coverage -> security -> static analysis -> bypass detection.
- Each gate must produce a structured JSON report even when passing (empty findings array).
- Biome config must be at maximum strictness; ESLint is secondary only where Biome lacks coverage.

### Parallel Opportunities
- T005 and T006 can proceed after T001 pipeline skeleton is in place.

### Dependencies
- Depends on spec 019 (Bun workspace setup with typecheck/test scripts).

### Risks & Mitigations
- Risk: Playwright requires a display server or virtual framebuffer on CI runners.
- Mitigation: Configure Playwright for headless mode; add Xvfb setup step if needed.

---

## Work Package WP02: Coverage, Security, and Static Analysis Gates (Priority: P0)

**Goal**: Implement the remaining three analysis gates: coverage threshold enforcement (>= 85%), security vulnerability scanning, and static analysis for anti-patterns and complexity.
**Independent Test**: Drop coverage below 85% and verify the coverage gate fails with current percentage and threshold.
**Prompt**: `/kitty-specs/021-continuous-integration-and-quality-gates/tasks/WP02-coverage-security-static-analysis.md`
**Estimated Prompt Size**: ~340 lines

### Included Subtasks
- [ ] T007 Implement Gate 5 (coverage threshold) enforcing >= 85% line coverage per workspace package and aggregate, using Vitest coverage output
- [ ] T008 Implement Gate 6 (security scan) checking dependencies for known vulnerabilities, flagging high/critical as failures with severity and remediation
- [ ] T009 Implement Gate 7 (static analysis) detecting anti-patterns, complexity violations, and dead code across the monorepo
- [ ] T010 [P] Add coverage manifest generation: per-package and aggregate coverage summary compared against threshold, output as structured JSON
- [ ] T011 [P] Add gate integration tests: verify each gate produces correct pass/fail for known fixture inputs (clean code, vulnerability, complexity violation)

### Implementation Notes
- Coverage must be enforced per-package AND aggregate; a single package below threshold fails the gate.
- Security scan should use Bun's built-in audit or equivalent tool.
- Static analysis should detect dead code, excessive complexity, and known anti-patterns.

### Parallel Opportunities
- T010 and T011 can proceed after T007-T009 gate implementations are stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: Security scan produces false positives on prerelease dependencies.
- Mitigation: Allow documented exceptions via deps-registry.json from spec 020; never auto-suppress.

---

## Work Package WP03: Bypass Detection, Local Gate Mirror, and Tests (Priority: P1)

**Goal**: Implement Gate 8 (bypass detection) that scans for suppression directives and the `bun run gates` local command that mirrors the CI pipeline exactly.
**Independent Test**: Add a `// biome-ignore` directive, run `bun run gates` locally, confirm it fails at the bypass detection gate with file and line.
**Prompt**: `/kitty-specs/021-continuous-integration-and-quality-gates/tasks/WP03-bypass-detection-and-local-gates.md`
**Estimated Prompt Size**: ~350 lines

### Included Subtasks
- [ ] T012 Implement Gate 8 (bypass detection) scanning all source files for suppression directives: `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `biome-ignore`, `.skip`, `.only`, `.todo` in test files
- [ ] T013 Create `scripts/gate-bypass-detect.ts` as a standalone scanner with file/line reporting for each detected suppression
- [ ] T014 Implement `scripts/gates.ts` as the `bun run gates` entrypoint executing all 8 gates in the same order and config as CI
- [ ] T015 [P] Add bypass detection tests: verify each suppression directive type is caught, verify clean files pass, verify the scanner handles edge cases (directives in comments, strings, template literals)
- [ ] T016 [P] Add `bun run gates` parity tests: verify local execution produces identical pass/fail results as CI for the same commit
- [ ] T017 Validate pipeline idempotency: run the same commit through the pipeline twice and verify identical results (NFR-003)

### Implementation Notes
- Bypass detection must catch all known suppression patterns; the list must be extensible.
- `bun run gates` must use identical thresholds and config as CI; any divergence is a bug.
- Pipeline must be idempotent per NFR-003.

### Parallel Opportunities
- T015 and T016 can proceed after T012-T014 are functional.

### Dependencies
- Depends on WP02.

### Risks & Mitigations
- Risk: Suppression directives in third-party code or generated files cause false positives.
- Mitigation: Exclude `node_modules/` and configured generated-file paths; document exclusions.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02 → WP03.
- **Parallelization**: Within each WP, `[P]` tasks can run after core implementations are stable.
- **MVP Scope**: All three WPs required for constitution-compliant quality enforcement.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | CI pipeline skeleton | WP01 | P0 | No |
| T002 | Gate 1: TypeScript typecheck | WP01 | P0 | No |
| T003 | Gate 2: Biome lint/format | WP01 | P0 | No |
| T004 | Gate 3: Vitest unit tests | WP01 | P0 | No |
| T005 | Gate 4: Playwright e2e tests | WP01 | P0 | Yes |
| T006 | Structured gate report generator | WP01 | P0 | Yes |
| T007 | Gate 5: Coverage threshold | WP02 | P0 | No |
| T008 | Gate 6: Security scan | WP02 | P0 | No |
| T009 | Gate 7: Static analysis | WP02 | P0 | No |
| T010 | Coverage manifest generation | WP02 | P0 | Yes |
| T011 | Gate integration tests | WP02 | P0 | Yes |
| T012 | Gate 8: Bypass detection | WP03 | P1 | No |
| T013 | Bypass detection scanner script | WP03 | P1 | No |
| T014 | bun run gates local entrypoint | WP03 | P1 | No |
| T015 | Bypass detection tests | WP03 | P1 | Yes |
| T016 | Local/CI parity tests | WP03 | P1 | Yes |
| T017 | Pipeline idempotency validation | WP03 | P1 | No |
