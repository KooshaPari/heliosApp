# Work Packages: Rio Renderer Backend

**Inputs**: Design documents from `/kitty-specs/012-rio-renderer-backend/`
**Prerequisites**: plan.md (required), spec.md (user stories), spec 010 (Renderer Adapter Interface), spec 011 (Ghostty Backend for fallback target)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/012-rio-renderer-backend/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Rio Adapter Implementing 010 Interface with Feature Flag (Priority: P0 — prerequisite to WP02)

**Phase**: Phase 1 - Rio Foundation
**Goal**: Implement the rio renderer adapter conforming to the spec 010 RendererAdapter interface, gated behind a feature flag that is off by default. When disabled, rio has zero runtime cost. Includes process lifecycle, surface binding, capability reporting, and metrics using the same schema as ghostty.
**Independent Test**: Rio registers with the renderer adapter when flag is enabled, is rejected when disabled, and reports accurate capabilities.
**Prompt**: `/kitty-specs/012-rio-renderer-backend/tasks/WP01-rio-adapter-implementing-010-interface-with-feature-flag.md`
**Estimated Prompt Size**: ~480 lines

### Included Subtasks
- [ ] T001 Implement feature flag gate for rio (off by default, zero runtime cost when disabled) in `apps/runtime/src/renderer/rio/index.ts`
- [ ] T002 Implement rio adapter class implementing RendererAdapter interface in `apps/runtime/src/renderer/rio/backend.ts`
- [ ] T003 Implement rio process lifecycle (start/stop/crash detection) in `apps/runtime/src/renderer/rio/process.ts`
- [ ] T004 Implement rio surface binding and PTY stream piping in `apps/runtime/src/renderer/rio/surface.ts`
- [ ] T005 Implement rio capability matrix and frame metrics (same schema as ghostty) in `apps/runtime/src/renderer/rio/capabilities.ts` and `apps/runtime/src/renderer/rio/metrics.ts`
- [ ] T006 [P] Implement input passthrough from rio to PTY write path in `apps/runtime/src/renderer/rio/input.ts`

### Implementation Notes
- Feature flag: check configuration (spec 004) at registration time; skip entirely if disabled.
- Zero runtime cost: no module loading, no process spawn, no memory allocation when flag is off.
- Metrics schema must be identical to ghostty (same event type, same fields).
- Rio adapter must conform to RendererAdapter without modifications.

### Parallel Opportunities
- T006 can proceed after T002 adapter interface is established.

### Dependencies
- Depends on spec 010 (Renderer Adapter Interface) and spec 004 (Configuration/Feature Flags).

### Risks & Mitigations
- Risk: rio embedding API differs significantly from ghostty.
- Mitigation: same process-based management pattern; adapt CLI/IPC details.

---

## Work Package WP02: Crash Fallback to Ghostty and Tests (Priority: P1)

**Phase**: Phase 2 - Fallback and Validation
**Goal**: Implement automatic fallback from rio to ghostty on crash, verify feature flag enforcement, and build comprehensive tests including SLO benchmarks and fallback scenarios.
**Independent Test**: Rio crash triggers automatic fallback to ghostty with session preservation, feature flag disabled means zero rio artifacts, and SLO benchmarks pass when rio is active.
**Prompt**: `/kitty-specs/012-rio-renderer-backend/tasks/WP02-crash-fallback-to-ghostty-and-tests.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [ ] T007 Implement crash fallback: rio crash triggers automatic switch to ghostty with session preservation
- [ ] T008 Implement feature flag toggle handling (disable while rio is active: switch to ghostty first)
- [ ] T009 [P] Add Vitest unit tests for rio adapter, feature flag, and fallback logic in `apps/runtime/tests/unit/renderer/rio/`
- [ ] T010 [P] Add integration tests for rio lifecycle and fallback in `apps/runtime/tests/integration/renderer/rio/`
- [ ] T011 [P] Add feature flag enforcement tests (zero runtime cost when disabled)
- [ ] T012 [P] Add SLO benchmark tests for rio (same targets as ghostty)

### Implementation Notes
- Fallback uses the renderer switch transaction from spec 010 (switch from rio to ghostty).
- Feature flag toggle while rio is active: graceful switch to ghostty, then disable.
- Zero-cost verification: check process table and memory for rio artifacts when flag is off.

### Parallel Opportunities
- T009, T010, T011, and T012 can all proceed in parallel once WP01 is complete.

### Dependencies
- Depends on WP01 and spec 011 (Ghostty Backend as fallback target).

### Risks & Mitigations
- Risk: fallback to ghostty fails (ghostty also unavailable).
- Mitigation: escalate to `errored` state; system cannot render without any backend.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02.
- **Parallelization**: Within WP01, T006 runs in parallel. Within WP02, all test subtasks run in parallel.
- **MVP Scope**: Rio is optional for MVP (feature-flagged off), but both WPs should be ready for opt-in testing.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Feature flag gate (zero runtime cost) | WP01 | P0 | No |
| T002 | Rio adapter implementing RendererAdapter | WP01 | P0 | No |
| T003 | Rio process lifecycle | WP01 | P0 | No |
| T004 | Surface binding and PTY stream piping | WP01 | P0 | No |
| T005 | Capability matrix and frame metrics | WP01 | P0 | No |
| T006 | Input passthrough (rio -> PTY) | WP01 | P0 | Yes |
| T007 | Crash fallback to ghostty | WP02 | P1 | No |
| T008 | Feature flag toggle handling | WP02 | P1 | No |
| T009 | Unit tests for adapter/flag/fallback | WP02 | P1 | Yes |
| T010 | Integration tests for lifecycle/fallback | WP02 | P1 | Yes |
| T011 | Feature flag zero-cost enforcement tests | WP02 | P1 | Yes |
| T012 | SLO benchmark tests | WP02 | P1 | Yes |
