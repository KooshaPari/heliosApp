---
work_package_id: WP02
title: Feature Flag System and Tests
lane: "doing"
dependencies: [WP01]
base_branch: 004-app-settings-and-feature-flags-WP01
base_commit: ac383a1d731ebcb407add85b7c275e8ab117073c
created_at: '2026-02-27T11:50:49.277334+00:00'
subtasks: [T008, T009, T010, T011, T012]
phase: Phase 2 - Feature Gating
assignee: ''
agent: "wp02-flags-agent"
shell_pid: "38381"
---

# Work Package Prompt: WP02 - Feature Flag System and Tests

## Objectives & Success Criteria

- Implement a feature flag subsystem with typed query API and zero-allocation read path.
- Define the `renderer_engine` flag as the first production flag.
- Wire flag changes through the settings persistence and bus event pipeline.
- Validate flag read latency and correctness through tests and microbenchmarks.

Success criteria:
- Feature flag reads return correct values with < 0.01ms latency (p95).
- `renderer_engine` flag defaults to `ghostty` and accepts `rio`.
- Flag changes persist and emit appropriate bus events.
- Zero-allocation confirmed in microbenchmarks.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/004-app-settings-and-feature-flags/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/004-app-settings-and-feature-flags/spec.md`
- WP01 code:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/types.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/schema.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/settings.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/store.ts`

Constraints:
- Flag read < 0.01ms (p95) — zero allocation on hot path.
- No heap allocation beyond cached primitive on read.
- Keep files under 350 lines.

## Subtasks & Detailed Guidance

### Subtask T008 - Implement feature flag subsystem

- Purpose: provide a typed, high-performance flag query API on top of the settings substrate.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/flags.ts`.
  2. Define `FeatureFlag<T>` interface: `{ key: string; defaultValue: T; description: string }`.
  3. Implement `FlagRegistry` class:
     - Constructor takes `SettingsManager` instance.
     - `register<T>(flag: FeatureFlag<T>): void` — register a flag definition.
     - `get<T>(key: string): T` — read from pre-cached primitive values. No object creation, no Map iterator. Use a frozen object with direct property access for known flags.
     - `getAll(): Record<string, unknown>` — return all flag values (allowed to allocate, not on hot path).
  4. Internal: on initialization and on `settings.changed` events, update cached primitive values.
  5. Cache implementation: use a plain object with known keys as properties. Flag reads become `cache.renderer_engine` — direct property access, zero allocation.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/flags.ts`
- Validation checklist:
  - [ ] `get` returns correct value after initialization.
  - [ ] `get` returns default if flag not set in settings.
  - [ ] `get` after settings change returns new value.
  - [ ] No object allocation on `get` call path.
- Edge cases:
  - Flag queried before initialization — return default value.
  - Unknown flag key — throw with clear message (not undefined).
- Parallel: No.

### Subtask T009 - Define renderer_engine feature flag

- Purpose: establish the first production flag for dual-renderer support.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/schema.ts`, ensure `renderer_engine` setting is defined with type=enum, values=['ghostty', 'rio'], default='ghostty', reloadPolicy='restart'.
  2. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/flags.ts`, register `renderer_engine` as a `FeatureFlag<'ghostty' | 'rio'>`.
  3. Implement typed accessor: `getRendererEngine(): 'ghostty' | 'rio'` as a convenience method on `FlagRegistry`.
  4. Document that changing this flag requires restart (reload policy = restart).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/schema.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/flags.ts`
- Validation checklist:
  - [ ] Default value is 'ghostty'.
  - [ ] Setting to 'rio' persists and returns 'rio' on next read.
  - [ ] Setting to invalid value (e.g., 'webgl') is rejected by schema validation.
  - [ ] Typed accessor returns correct union type.
- Edge cases:
  - Settings file has `renderer_engine: 'ghostty'` explicitly — should be indistinguishable from default.
- Parallel: No.

### Subtask T010 - Wire flag changes to bus events

- Purpose: ensure flag changes propagate through the standard settings event pipeline.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/flags.ts`, subscribe to `settings.changed` bus events (or direct SettingsManager callbacks).
  2. On flag value change, update the internal cache.
  3. Optionally publish `flags.changed` as a more specific event topic (delegates to bus).
  4. For restart-required flags: do NOT update the cache (old value stays active until restart). Set `pendingRestart` flag on the FlagRegistry.
  5. Implement `getPending(key: string): { current: T; pending: T } | null` — returns current and pending values for restart-required flags with uncommitted changes.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/flags.ts`
- Validation checklist:
  - [ ] Hot-reloadable flag changes update cache immediately.
  - [ ] Restart-required flag changes do NOT update cache.
  - [ ] `getPending` returns both current and pending for changed restart flags.
  - [ ] `getPending` returns null for unchanged flags.
- Edge cases:
  - Multiple restart-required changes before restart — each overrides the pending value.
  - Restart-required flag changed back to current value — pending is cleared.
- Parallel: No.

### Subtask T011 - Add Vitest unit tests for feature flags

- Purpose: verify flag correctness, caching, and change propagation.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/config/flags.test.ts`.
  2. Test `get`: returns default on fresh init.
  3. Test `get` after settings change: returns new value.
  4. Test `getRendererEngine`: returns typed value.
  5. Test invalid flag key: throws.
  6. Test restart-required flag: cache not updated until restart.
  7. Test `getPending`: returns current/pending pair after restart-required change.
  8. Test `getPending`: returns null for unchanged flag.
  9. Test concurrent flag reads: no corruption.
  10. Test flag registration: duplicate registration throws.
  11. Add FR traceability: `// FR-008`, `// FR-009`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/config/flags.test.ts`
- Validation checklist:
  - [ ] >= 12 test cases.
  - [ ] FR traceability comments present.
  - [ ] Tests run in < 3 seconds.
- Edge cases:
  - Test flag read before any settings load — returns default.
  - Test with all enum values for renderer_engine.
- Parallel: Yes (after T008/T009 are stable).

### Subtask T012 - Add microbenchmarks for flag reads and settings writes

- Purpose: enforce NFR latency SLOs in CI.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/config/flags-bench.ts`.
  2. Benchmark 1: flag read latency — 100,000 reads, measure p50, p95, p99. Assert p95 < 0.01ms.
  3. Benchmark 2: settings write latency — 1,000 writes with validation and persistence. Assert p95 < 50ms.
  4. Benchmark 3: hot-reload propagation — change setting, measure time until subscriber receives. Assert p95 < 500ms.
  5. Benchmark 4: flag read memory — ensure zero heap allocations per read using Bun's allocation tracking or manual measurement.
  6. Output results as JSON for CI gate consumption.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/bench/config/flags-bench.ts`
- Validation checklist:
  - [ ] All benchmarks produce structured output.
  - [ ] Thresholds are asserted, not just reported.
  - [ ] Warm-up phase before measurement.
- Edge cases:
  - CI slowdown factor — use 2x threshold multiplier.
- Parallel: Yes (after T008 is stable).

## Test Strategy

- Unit tests for correctness; microbenchmarks for performance.
- Flag read path must be proven zero-allocation via benchmark.
- Cover all flag types and reload policies.

## Risks & Mitigations

- Risk: direct property access cache invalidation is fragile.
- Mitigation: cache rebuild on any settings change event; test cache consistency after changes.

## Review Guidance

- Confirm flag read path has no object creation.
- Confirm restart-required flags have proper pending value semantics.
- Confirm typed accessor returns narrowed union type.
- Confirm benchmarks fail on threshold breach.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
- 2026-02-27T11:50:49Z – wp02-flags-agent – shell_pid=38381 – lane=doing – Assigned agent via workflow command
