# Work Packages: Renderer Adapter Interface

**Inputs**: Design documents from `/kitty-specs/010-renderer-adapter-interface/`
**Prerequisites**: plan.md (required), spec.md (user stories), spec 001 (Control Plane), spec 002 (Local Bus), spec 004 (Configuration), spec 007 (PTY Lifecycle)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/010-renderer-adapter-interface/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Abstract Interface, Renderer Registry, and State Machine (Priority: P0 — prerequisite to WP02)

**Phase**: Phase 1 - Interface Definition
**Goal**: Define the abstract renderer adapter interface (init/start/stop/switch/queryCapabilities), a renderer registry for backend registration, and a state machine governing renderer lifecycle transitions. Implement transactional renderer switching with automatic rollback on failure.
**Independent Test**: Mock backends can register, the state machine validates all transitions, and a switch with rollback preserves the previous renderer on failure.
**Prompt**: `/kitty-specs/010-renderer-adapter-interface/tasks/WP01-abstract-interface-renderer-registry-and-state-machine.md`
**Estimated Prompt Size**: ~450 lines

### Included Subtasks
- [ ] T001 Define abstract renderer adapter interface with lifecycle operations in `apps/runtime/src/renderer/adapter.ts`
- [ ] T002 Implement renderer state machine in `apps/runtime/src/renderer/state_machine.ts`
- [ ] T003 Implement renderer registry (register, lookup, list, enforce single-active) in `apps/runtime/src/renderer/registry.ts`
- [ ] T004 Implement transactional renderer switch with rollback in `apps/runtime/src/renderer/switch.ts`
- [ ] T005 [P] Define capability matrix types and query interface in `apps/runtime/src/renderer/capabilities.ts`
- [ ] T006 [P] Wire renderer lifecycle event publishing to local bus

### Implementation Notes
- Interface must be open for extension: new backends register without modifying core.
- Exactly one renderer active at any time (FR-010-008).
- Switch is a transaction: stop old, start new, rebind streams; rollback on failure.

### Parallel Opportunities
- T005 and T006 can proceed after T001 interface is defined.

### Dependencies
- Depends on spec 002 (Local Bus) and spec 007 (PTY Lifecycle) for stream binding.

### Risks & Mitigations
- Risk: switch transaction timing window leaves system with no active renderer.
- Mitigation: transactional design buffers output during switch; rollback restores previous.

---

## Work Package WP02: Stream Binding, Capability Matrix, and Tests (Priority: P1)

**Phase**: Phase 2 - Integration and Validation
**Goal**: Implement PTY stream binding/unbinding to the active renderer, validate the capability matrix with mock backends, and build comprehensive tests including switch rollback and mock backend registration.
**Independent Test**: PTY streams are bound to the renderer without data loss during switches, mock backends register and report capabilities, and rollback preserves state in 100% of failure tests.
**Prompt**: `/kitty-specs/010-renderer-adapter-interface/tasks/WP02-stream-binding-capability-matrix-and-tests.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T007 Implement PTY stream binding/unbinding to active renderer in `apps/runtime/src/renderer/stream_binding.ts`
- [ ] T008 Implement output buffering during renderer switch to prevent data loss
- [ ] T009 [P] Add Vitest unit tests for state machine, registry, switch/rollback, and capability query in `apps/runtime/tests/unit/renderer/`
- [ ] T010 [P] Add integration tests with mock ghostty and mock rio backends in `apps/runtime/tests/integration/renderer/`
- [ ] T011 [P] Add renderer switch rollback stress test (failure injection)

### Implementation Notes
- Stream binding must handle rebind during switch atomically.
- Output buffering during switch: buffer PTY output while no renderer is active, flush after new renderer starts.
- Mock backends must implement the full adapter interface.

### Parallel Opportunities
- T009, T010, and T011 can all proceed in parallel once WP01 interfaces are stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: output buffering during switch causes memory growth.
- Mitigation: bound the switch buffer (reuse PTY ring buffer caps); switch must complete within 3 seconds.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02.
- **Parallelization**: Within WP01, T005/T006 run in parallel. Within WP02, all test subtasks run in parallel.
- **MVP Scope**: Both WPs are required for MVP renderer adapter support.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Abstract renderer adapter interface | WP01 | P0 | No |
| T002 | Renderer state machine | WP01 | P0 | No |
| T003 | Renderer registry | WP01 | P0 | No |
| T004 | Transactional switch with rollback | WP01 | P0 | No |
| T005 | Capability matrix types and query | WP01 | P0 | Yes |
| T006 | Renderer lifecycle event publishing | WP01 | P0 | Yes |
| T007 | PTY stream binding/unbinding | WP02 | P1 | No |
| T008 | Output buffering during switch | WP02 | P1 | No |
| T009 | Unit tests for interface/registry/switch | WP02 | P1 | Yes |
| T010 | Integration tests with mock backends | WP02 | P1 | Yes |
| T011 | Switch rollback stress test | WP02 | P1 | Yes |
