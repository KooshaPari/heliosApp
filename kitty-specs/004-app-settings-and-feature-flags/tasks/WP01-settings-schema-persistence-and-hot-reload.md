---
work_package_id: WP01
title: Settings Schema, Persistence, and Hot-Reload
lane: "doing"
dependencies: []
base_branch: main
base_commit: f95ec2c9561fb25c9f97b087363c68474f24f89f
created_at: '2026-02-27T11:28:40.281844+00:00'
subtasks: [T001, T002, T003, T004, T005, T006, T007]
phase: Phase 1 - Foundation
assignee: ''
agent: "wp01-settings-agent"
shell_pid: "28634"
---

# Work Package Prompt: WP01 - Settings Schema, Persistence, and Hot-Reload

## Objectives & Success Criteria

- Define typed settings schema with defaults, types, validation rules, and reload policies.
- Implement JSON persistence with in-memory cache.
- Implement settings read/write API with validation and change detection.
- Implement hot-reload propagation via bus events for hot-reloadable settings.
- Preserve unknown keys for forward compatibility.

Success criteria:
- Fresh install returns correct defaults for 100% of settings.
- Invalid values are rejected with schema validation errors.
- Hot-reload propagation reaches subscribers within 500ms.
- Settings survive app restart with 100% fidelity.
- Unknown keys round-trip through save/load without loss.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/004-app-settings-and-feature-flags/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/004-app-settings-and-feature-flags/spec.md`
- Target directory: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/`

Constraints:
- Settings write < 50ms (p95).
- Hot-reload propagation < 500ms (p95).
- Settings file < 100 KB for 200 settings.
- Keep files under 350 lines.

## Subtasks & Detailed Guidance

### Subtask T001 - Define settings types and reload policy

- Purpose: establish the type foundation for the settings subsystem.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/types.ts`.
  2. Define `ReloadPolicy`: `'hot' | 'restart'`.
  3. Define `SettingType`: `'string' | 'number' | 'boolean' | 'enum'`.
  4. Define `SettingDefinition` interface: `{ key: string; type: SettingType; default: unknown; description: string; reloadPolicy: ReloadPolicy; validation?: (value: unknown) => boolean; enumValues?: string[] }`.
  5. Define `SettingsSchema`: `Record<string, SettingDefinition>`.
  6. Define `SettingChangeEvent`: `{ key: string; oldValue: unknown; newValue: unknown; reloadPolicy: ReloadPolicy }`.
  7. Define `SettingsStore` interface: `{ load(): Promise<Record<string, unknown>>; save(values: Record<string, unknown>): Promise<void>; watch(callback: () => void): () => void }`.
  8. Export all types.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/types.ts`
- Validation checklist:
  - [ ] All types compile under `strict: true`.
  - [ ] `SettingDefinition` captures all metadata needed for validation and hot-reload.
  - [ ] `SettingsStore` is an interface (backend-agnostic).
- Edge cases:
  - Enum settings need both `enumValues` array and `type: 'enum'` — validate this at schema registration time.
- Parallel: No.

### Subtask T002 - Implement settings schema with defaults

- Purpose: define all initial settings with their metadata and default values.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/schema.ts`.
  2. Define the initial schema as a `SettingsSchema` constant.
  3. Include at minimum:
     - `renderer_engine`: type=enum, values=['ghostty', 'rio'], default='ghostty', reloadPolicy='restart'.
     - `theme`: type=enum, values=['dark', 'light', 'system'], default='system', reloadPolicy='hot'.
     - `terminal.scrollback_lines`: type=number, default=10000, reloadPolicy='hot', validation: value >= 1000 && value <= 100000.
     - `telemetry.enabled`: type=boolean, default=false, reloadPolicy='restart'.
  4. Implement `getDefault(key: string): unknown` — returns the default for a schema key.
  5. Implement `getAllDefaults(): Record<string, unknown>` — returns all defaults.
  6. Implement `validateValue(key: string, value: unknown): { valid: boolean; reason?: string }`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/schema.ts`
- Validation checklist:
  - [ ] All initial settings have defaults.
  - [ ] `validateValue` rejects wrong types.
  - [ ] `validateValue` rejects out-of-range enum values.
  - [ ] `validateValue` rejects numbers outside range.
  - [ ] Unknown keys return a validation pass (unknown key preservation).
- Edge cases:
  - Validate `null` and `undefined` values — both rejected for defined settings.
  - Key not in schema — `getDefault` returns `undefined`, `validateValue` returns valid (unknown key).
- Parallel: No.

### Subtask T003 - Implement JSON persistence store

- Purpose: persist settings to JSON file with in-memory cache and external edit detection.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/store.ts`.
  2. Implement `JsonSettingsStore` class implementing `SettingsStore`.
  3. Constructor takes `filePath: string`.
  4. `load()`: read JSON file, parse, return as `Record<string, unknown>`. Missing file returns empty object.
  5. `save(values)`: merge with any existing unknown keys, serialize to JSON, atomic write (temp → fsync → rename).
  6. `watch(callback)`: use `Bun.file` or `fs.watch` on the settings file. Debounce with 200ms delay. Call callback on external changes. Return unsubscribe function.
  7. Internal: track last write timestamp to distinguish own writes from external edits.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/store.ts`
- Validation checklist:
  - [ ] Missing file handled gracefully (returns empty).
  - [ ] Atomic write prevents corruption.
  - [ ] File watch detects external edits.
  - [ ] Own writes do not trigger watch callback.
- Edge cases:
  - File deleted while running — next save re-creates it.
  - Invalid JSON in file — load returns empty with logged warning.
  - Concurrent writes from multiple windows — last write wins, conflict logged.
- Parallel: No.

### Subtask T004 - Implement settings read/write API

- Purpose: provide the primary settings interface with validation and change detection.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/settings.ts`.
  2. Implement `SettingsManager` class.
  3. Constructor takes `SettingsSchema`, `SettingsStore`, and optional bus publish function.
  4. `init(): Promise<void>` — load from store, merge with defaults (defaults fill missing keys), cache in memory.
  5. `get(key: string): unknown` — return from in-memory cache. If key not in cache, return default. Zero allocation.
  6. `set(key: string, value: unknown): Promise<SettingChangeEvent>` — validate against schema, update cache, persist, return change event.
  7. `getAll(): Record<string, unknown>` — return full settings snapshot.
  8. `reset(key: string): Promise<SettingChangeEvent>` — reset to default.
  9. Wire file watch: on external edit, reload from store, detect changes, emit events.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/settings.ts`
- Validation checklist:
  - [ ] `get` returns default for unset key.
  - [ ] `set` rejects invalid values with validation error.
  - [ ] `set` persists and returns change event.
  - [ ] `reset` restores default and persists.
  - [ ] External file edit triggers reload and change detection.
- Edge cases:
  - Setting same value again — should still persist but change event shows oldValue === newValue.
  - Setting a key not in schema — store it (unknown key preservation), but don't validate.
- Parallel: No.

### Subtask T005 - Implement hot-reload propagation

- Purpose: notify subscribers of setting changes in real time.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/settings.ts`, after a successful `set()`:
     - If the setting's reload policy is `'hot'`, publish `settings.changed` event on the bus with `SettingChangeEvent` payload.
     - If the setting's reload policy is `'restart'`, set a `restartRequired` flag and do NOT publish hot-reload event.
  2. Implement `onSettingChanged(callback: (event: SettingChangeEvent) => void): () => void` for direct subscription (in addition to bus events).
  3. Implement `isRestartRequired(): boolean` — returns true if any restart-required setting has changed since last startup.
  4. Implement `getChangedRestartSettings(): string[]` — returns list of changed restart-required setting keys.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/settings.ts`
- Validation checklist:
  - [ ] Hot-reloadable setting change publishes bus event.
  - [ ] Restart-required setting change sets flag but does not publish.
  - [ ] Direct subscriber receives change event.
  - [ ] `isRestartRequired()` returns true after restart-required change.
- Edge cases:
  - Bus not available — log and skip event emission.
  - Multiple rapid changes — each emits its own event (no batching for MVP).
- Parallel: No.

### Subtask T006 - Implement unknown key preservation

- Purpose: ensure settings files from newer versions are not corrupted by older runtimes.
- Steps:
  1. In `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/store.ts`, on `load()`:
     - Parse all keys from JSON.
     - Separate into known keys (in schema) and unknown keys.
     - Store unknown keys in a separate internal map.
  2. On `save()`:
     - Merge known settings with preserved unknown keys.
     - Serialize the merged object.
  3. Unknown keys are never validated, never appear in `get()`, and never trigger change events.
  4. Add `getUnknownKeys(): string[]` for diagnostics.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/config/store.ts`
- Validation checklist:
  - [ ] Unknown keys survive save/load round-trip.
  - [ ] Unknown keys do not appear in `getAll()`.
  - [ ] Unknown keys do not trigger validation.
  - [ ] `getUnknownKeys()` lists all preserved unknown keys.
- Edge cases:
  - Key that was previously unknown becomes known in a schema update — it transitions to validated.
  - Deeply nested unknown key structure — preserve the entire subtree.
- Parallel: Yes (after T003/T004 are stable).

### Subtask T007 - Add Vitest unit tests

- Purpose: lock settings behavior and guard against regressions.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/config/schema.test.ts`.
  2. Test `getDefault`: returns correct defaults for all defined settings.
  3. Test `validateValue`: valid and invalid values for each type (string, number, boolean, enum).
  4. Test unknown key validation: returns valid.
  5. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/config/settings.test.ts`.
  6. Test full lifecycle: init with defaults, set value, get value, restart, verify persistence.
  7. Test invalid value rejection.
  8. Test hot-reload: change hot setting, verify bus event emitted.
  9. Test restart-required: change restart setting, verify flag set, no bus event.
  10. Test unknown key preservation: add unknown key, save, load, verify present.
  11. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/config/store.test.ts`.
  12. Test JSON round-trip, missing file, corrupted file, external edit detection.
  13. Add FR traceability: `// FR-001`, `// FR-002`, `// FR-003`, `// FR-005`, `// FR-010`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/config/schema.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/config/settings.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/tests/unit/config/store.test.ts`
- Validation checklist:
  - [ ] >= 25 test cases across all files.
  - [ ] FR traceability comments present.
  - [ ] Tests use temp directories for file operations.
- Edge cases:
  - Test with null, undefined, NaN, Infinity values.
  - Test concurrent set operations.
- Parallel: Yes (after T004/T005 are stable).

## Test Strategy

- Unit tests via Vitest for schema validation, settings API, and store.
- Use temp directories for file-based tests.
- Mock bus for event emission tests.
- Cover all setting types and reload policies.

## Risks & Mitigations

- Risk: file watch fires during own writes.
- Mitigation: track write timestamp; ignore watch events within debounce window of own write.

## Review Guidance

- Confirm all settings have defaults.
- Confirm validation covers all types.
- Confirm hot-reload and restart-required paths are distinct.
- Confirm unknown keys survive round-trip.
- Confirm no `any` types in public API.

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
- 2026-02-27T11:28:40Z – wp01-settings-agent – shell_pid=28634 – lane=doing – Assigned agent via workflow command
