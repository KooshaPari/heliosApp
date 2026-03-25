---
work_package_id: WP02
title: Cross-Repo Compatibility, Parsing, and Tests
lane: "for_review"
dependencies: [WP01]
base_branch: 005-id-standards-and-cross-repo-coordination-WP01
base_commit: 150dc34892e75ea57aecb4214dbbd95fbce3e4b3
created_at: '2026-02-27T11:50:53.018943+00:00'
subtasks: [T007, T008, T009, T010]
phase: Phase 2 - Integration
assignee: ''
agent: "wp02-ids-agent"
shell_pid: "38565"
---

# Work Package Prompt: WP02 - Cross-Repo Compatibility, Parsing, and Tests

## Objectives & Success Criteria

- Configure the IDs package for cross-repo consumption by thegent, trace, and heliosHarness.
- Prove collision resistance at scale (10M IDs across concurrent contexts).
- Enforce generation and validation latency SLOs via microbenchmarks.
- Validate format compliance for 100% of generated IDs.

Success criteria:
- Package imports and type-checks correctly in a minimal external Bun project.
- Zero collisions in 10M concurrent generation test.
- Generation < 0.01ms (p95); validation < 0.005ms (p95).
- 100% format compliance across all generated IDs.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/005-id-standards-and-cross-repo-coordination/plan.md`
- WP01 code: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/`

Constraints:
- Zero runtime dependencies.
- Package must be consumable without bundler (direct TS import or pre-compiled JS).
- tsconfig: strict mode, declaration files.

## Subtasks & Detailed Guidance

### Subtask T007 - Configure package.json for cross-repo consumption

- Purpose: make the IDs package importable by other repos in the ecosystem.
- Steps:
  1. Create or update `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/package.json`.
  2. Set `name`: `@helios/ids` (or `@phenotype/ids` per org convention).
  3. Set `version`: `0.1.0`.
  4. Set `type`: `module`.
  5. Set `exports`: `{ ".": { "import": "./src/index.ts", "types": "./src/index.ts" } }`.
  6. Set `dependencies`: `{}` (zero deps).
  7. Set `devDependencies`: `{ "vitest": "..." }` (test runner only).
  8. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tsconfig.json`.
  9. Enable strict mode, declaration, target ES2022.
  10. Verify: `bun run tsc --noEmit` passes with zero errors.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/package.json`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tsconfig.json`
- Validation checklist:
  - [ ] `dependencies` is empty.
  - [ ] Type declarations are emitted or source-importable.
  - [ ] `bun run tsc --noEmit` passes.
  - [ ] Package name follows org convention.
- Edge cases:
  - Other repos using different TS versions — target ES2022 for broad compatibility.
  - Bun workspace linking — verify `bun link` works from packages/ids.
- Parallel: No.

### Subtask T008 - Add 10M collision resistance test

- Purpose: prove uniqueness guarantees at scale under concurrent generation.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/collision.test.ts`.
  2. Generate 10,000,000 IDs using 8 concurrent Promise.all contexts (1.25M each).
  3. Collect all IDs in a Set.
  4. Assert Set size === 10,000,000 (zero collisions).
  5. Verify all IDs pass `validateId`.
  6. Set test timeout to 60 seconds (this is a heavy test).
  7. Add `// FR-004` traceability.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/collision.test.ts`
- Validation checklist:
  - [ ] Zero collisions across 10M IDs.
  - [ ] All IDs pass validation.
  - [ ] Test completes within 60 seconds.
- Edge cases:
  - Memory pressure — 10M strings at ~35 bytes each is ~350 MB. If too much, reduce to 1M with 8 contexts.
  - Bun's event loop behavior — ensure concurrent contexts actually interleave.
- Parallel: Yes (after WP01 is complete).

### Subtask T009 - Add microbenchmarks

- Purpose: enforce generation and validation latency SLOs.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/bench/id-bench.ts`.
  2. Benchmark 1: `generateId('workspace')` — 100,000 iterations. Measure p50, p95, p99. Assert p95 < 0.01ms.
  3. Benchmark 2: `validateId(validId)` — 100,000 iterations. Assert p95 < 0.005ms.
  4. Benchmark 3: `parseId(validId)` — 100,000 iterations. Measure latency.
  5. Benchmark 4: sustained throughput — generate 1M IDs, measure total time. Assert > 1M IDs/second.
  6. Output structured JSON results.
  7. Warm-up: skip first 1,000 iterations.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/bench/id-bench.ts`
- Validation checklist:
  - [ ] All benchmarks produce structured output.
  - [ ] p95 thresholds are asserted.
  - [ ] Warm-up phase included.
- Edge cases:
  - CI machine slowdown — use 2x threshold factor.
- Parallel: Yes (after WP01 is complete).

### Subtask T010 - Add format compliance regex test

- Purpose: prove 100% of generated IDs conform to the format specification.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/format.test.ts`.
  2. Define format regex: `^[a-z]{2,3}_[0-9A-HJKMNP-TV-Z]{26}$`.
  3. Generate 10,000 IDs for each entity type.
  4. Assert every ID matches the regex.
  5. Assert every ID is URL-safe: no characters requiring percent-encoding.
  6. Assert every ID is filename-safe: no `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`.
  7. Assert every ID is JSON-safe: `JSON.parse(JSON.stringify(id)) === id`.
  8. Add `// FR-008` traceability.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/format.test.ts`
- Validation checklist:
  - [ ] 60,000 IDs (10k x 6 types) all pass format regex.
  - [ ] URL-safe, filename-safe, JSON-safe confirmed.
  - [ ] Test covers all entity types.
- Edge cases:
  - Crockford base32 excludes I, L, O, U — verify none appear in output.
- Parallel: Yes (after WP01 is complete).

## Test Strategy

- Collision test is a heavy stress test — run separately from unit tests.
- Microbenchmarks enforce SLOs with assertions.
- Format compliance is exhaustive across all entity types.
- All tests are deterministic and reproducible.

## Risks & Mitigations

- Risk: 10M collision test requires too much memory.
- Mitigation: use incremental Set with periodic size checks; reduce to 1M if memory constrained.

## Review Guidance

- Confirm package.json has zero runtime dependencies.
- Confirm collision test uses truly concurrent contexts.
- Confirm benchmarks fail on SLO breach.
- Confirm format regex matches spec exactly (Crockford base32 character set).

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
- 2026-02-27T11:50:53Z – wp02-ids-agent – shell_pid=38565 – lane=doing – Assigned agent via workflow command
- 2026-02-27T12:31:35Z – wp02-ids-agent – shell_pid=38565 – lane=for_review – Completed
