# Work Packages: Colab Agent Terminal Control Plane

**Inputs**: Design documents from `/kitty-specs/001-colab-agent-terminal-control-plane/`
**Prerequisites**: plan.md (required), spec.md (user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Protocol Contracts and Runtime Foundation (Priority: P0)

**Goal**: Establish deterministic control-plane protocol primitives, validators, and audit/event scaffolding.
**Independent Test**: Protocol envelope validation and event ordering tests pass with known-good and bad payloads.
**Prompt**: `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/WP01-protocol-contracts-and-runtime-foundation.md`
**Estimated Prompt Size**: ~320 lines

### Included Subtasks
- [x] T001 Align `specs/protocol/v1/methods.json` and `specs/protocol/v1/topics.json` with slice-1 lane/session/terminal/harness flows
- [x] T002 Implement strict envelope validator + typed protocol helpers in `apps/runtime/src/protocol/types.ts` and `apps/runtime/src/protocol/bus.ts`
- [x] T003 Add deterministic sequence and correlation guardrails in `apps/runtime/src/protocol/bus.ts`
- [x] T004 [P] Add runtime audit event sink scaffold in `apps/runtime/src/index.ts` and new `apps/runtime/src/audit/` module
- [x] T005 [P] Add Vitest unit tests for envelope validation and event ordering in `apps/runtime/tests/unit/protocol/`

### Implementation Notes
- Keep protocol and bus behavior fail-fast; no silent fallback inside core envelope pipeline.
- Correlation ID must be mandatory on lifecycle-critical actions.

### Parallel Opportunities
- T004 and T005 can proceed after T002 baseline type contracts are stable.

### Dependencies
- None.

### Risks & Mitigations
- Risk: schema drift between `specs/protocol/v1/` and runtime types.
- Mitigation: derive runtime literal unions directly from schema/topic assets where practical.

---

## Work Package WP02: Lane and Session Lifecycle with Harness Routing (Priority: P1) 🎯 MVP

**Goal**: Deliver create/attach/cleanup lane lifecycle and session ensure flow for Codex CLI with `cliproxyapi++` primary route and native fallback.
**Independent Test**: Lane/session API calls create usable sessions; harness outage degrades to native path without runtime failure.
**Prompt**: `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/WP02-lane-and-session-lifecycle-with-harness-routing.md`
**Estimated Prompt Size**: ~390 lines

### Included Subtasks
- [x] T006 Implement lane lifecycle state machine (`create/list/attach/cleanup`) in `apps/runtime/src/sessions/state_machine.ts`
- [x] T007 Implement in-memory session registry keyed by `codex_session_id` in `apps/runtime/src/sessions/`
- [ ] T008 Implement `cliproxyapi++` health monitor + route selector in `apps/runtime/src/integrations/exec.ts`
- [ ] T009 Expose lane/session/harness status endpoints per `contracts/control-plane.openapi.yaml` in runtime API surface
- [ ] T010 [P] Add integration tests for harness healthy and degraded scenarios in `apps/runtime/tests/integration/sessions/`

### Implementation Notes
- Primary transport must attempt `cliproxy_harness` first.
- Fallback to `native_openai` must be explicit and auditable.

### Parallel Opportunities
- T010 can be authored in parallel once endpoint signatures are fixed.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: ambiguous transport state during transient harness failures.
- Mitigation: add explicit transport state transition events and debounce health checks.

---

## Work Package WP03: Terminal Registry and Streaming Data Plane (Priority: P1) 🎯 MVP

**Goal**: Deliver terminal spawn/input/output lifecycle with deterministic mapping to workspace/lane/session.
**Independent Test**: Multiple terminals can be created and streamed while preserving per-lane isolation and ordered events.
**Prompt**: `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/WP03-terminal-registry-and-streaming-data-plane.md`
**Estimated Prompt Size**: ~360 lines

### Included Subtasks
- [ ] T011 Implement terminal registry mapping (`terminal_id` ↔ `workspace_id/lane_id/session_id`) in `apps/runtime/src/sessions/`
- [ ] T012 Implement spawn/input/resize command handlers in `apps/runtime/src/integrations/exec.ts`
- [ ] T013 Implement bounded terminal output buffering/backpressure in runtime stream path
- [ ] T014 Emit and persist `terminal.*` lifecycle events through protocol bus and audit sink
- [ ] T015 [P] Add unit and integration tests for terminal lifecycle/state transitions in `apps/runtime/tests/`

### Implementation Notes
- Use hard output bounds to protect low-memory devices.
- Keep terminal hot path separate from heavier control-plane orchestration.

### Parallel Opportunities
- T015 can run in parallel after handler skeletons land.

### Dependencies
- Depends on WP02.

### Risks & Mitigations
- Risk: event floods causing UI lag.
- Mitigation: ring buffers with explicit drop/overflow telemetry.

---

## Work Package WP04: Editorless Control Plane UI and Context Cohesion (Priority: P2)

**Goal**: Deliver unified tab experience (terminal/agent/session/chat/project), diagnostics, and renderer mode switching with rollback.
**Independent Test**: Full editorless workflow can be completed while context remains synchronized across tabs.
**Prompt**: `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/WP04-editorless-control-plane-ui-and-context-cohesion.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [ ] T016 Build shared active-context store in `apps/desktop/src/` for workspace/lane/session/tab state
- [ ] T017 Implement tab surfaces for terminal/agent/session/chat/project bound to shared context
- [ ] T018 Wire UI actions to runtime APIs for lane create, session ensure, and terminal spawn
- [ ] T019 Implement renderer mode transaction + rollback UX in `apps/desktop/src/settings.ts`
- [ ] T020 [P] Add Playwright flows for tab sync, lane switching, and renderer switch safety

### Implementation Notes
- Keep interaction surface terminal-first and editorless per spec.
- Diagnostics should expose harness transport choice and degradation reasons.

### Parallel Opportunities
- T020 can be authored while T018/T019 are integrated.

### Dependencies
- Depends on WP03.

### Risks & Mitigations
- Risk: stale tab context under rapid switching.
- Mitigation: single source of truth store + explicit invalidation on lifecycle events.

---

## Work Package WP05: Recovery, Watchdog, and Audit Fidelity (Priority: P2)

**Goal**: Add crash recovery behavior for slice-1 continuity, orphan detection/remediation, and complete lifecycle audit trails.
**Independent Test**: Controlled restart and orphan drills recover or remediate state with clear user guidance and auditable history.
**Prompt**: `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/WP05-recovery-watchdog-and-audit-fidelity.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T021 Implement restart recovery bootstrap using in-memory rebuild + `codex_session_id` reattach semantics
- [ ] T022 Implement orphan lane/session watchdog and remediation suggestions in runtime services
- [ ] T023 Implement immutable lifecycle audit records with correlation filtering and export hooks
- [ ] T024 Normalize protocol-boundary failure payloads to stable error codes/messages
- [ ] T025 [P] Add recovery/chaos tests and failure-drill scenarios in `apps/runtime/tests/integration/recovery/`

### Implementation Notes
- Maintain deterministic ordering for lifecycle-critical events during recovery.
- Errors must be normalized and safe to display.

### Parallel Opportunities
- T025 can be developed in parallel once recovery/watchdog APIs are stable.

### Dependencies
- Depends on WP03.

### Risks & Mitigations
- Risk: partial recovery leaves inconsistent lane/session state.
- Mitigation: explicit reconciliation states and user-visible remediation paths.

---

## Work Package WP06: Hardening, Performance Gates, and Release Readiness (Priority: P3)

**Goal**: Enforce strict quality gates, run performance/soak checks, and publish implementation/operations guidance for MVP handoff.
**Independent Test**: All quality gates are green; quickstart scenarios execute successfully; performance telemetry is collected for target workflows.
**Prompt**: `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/WP06-hardening-performance-gates-and-release-readiness.md`
**Estimated Prompt Size**: ~340 lines

### Included Subtasks
- [ ] T026 Implement runtime metrics for lane create latency, session restore latency, and terminal backlog depth
- [ ] T027 Add local soak/perf harness for multi-session tab scenarios and publish thresholds
- [ ] T028 Enforce strict lint/type/security/static analysis gates in repo tooling
- [ ] T029 Validate and refine `quickstart.md`, `plan.md`, and ops notes with final scenario commands
- [ ] T030 Produce MVP boundary checklist with explicit deferred items (post-MVP durability expansion)

### Implementation Notes
- Keep strictness at max without ignores/skips.
- Preserve transparent separation between slice-1 and deferred scope.

### Parallel Opportunities
- T029 and T030 can run in parallel with T026/T027 after core features stabilize.

### Dependencies
- Depends on WP04 and WP05.

### Risks & Mitigations
- Risk: perf regressions masked by small local test runs.
- Mitigation: enforce repeated soak profiles and track trend metrics.

---

## Work Package WP07: Protocol Boundary Delegation and Traceability Gates (Priority: P3)

**Goal**: Implement explicit FR-010 protocol boundaries for local/tool/A2A delegation and enforce measurable quality gates for coverage and requirement traceability.
**Independent Test**: Delegation mode selection is deterministic across local/tool/A2A boundaries, and CI fails when coverage drops below 85% or requirement traces are missing.
**Prompt**: `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/WP07-protocol-boundary-delegation-and-traceability-gates.md`
**Estimated Prompt Size**: ~360 lines

### Included Subtasks
- [ ] T031 Define FR-010 boundary contract mapping (`local_execution`, `tool_invocation`, `a2a_delegation`) in `specs/protocol/v1/methods.json`, `specs/protocol/v1/topics.json`, and `kitty-specs/001-colab-agent-terminal-control-plane/spec.md`
- [ ] T032 Implement protocol boundary adapter and dispatch selection in `apps/runtime/src/protocol/boundary_adapter.ts` and integrate with `apps/runtime/src/integrations/exec.ts`
- [ ] T033 [P] Add unit/integration tests for local/tool/A2A delegation routing and boundary error normalization in `apps/runtime/tests/unit/protocol/` and `apps/runtime/tests/integration/protocol/`
- [ ] T034 Implement coverage gate (`>=85% lines`) in `apps/runtime/package.json`, `apps/runtime/vitest.config.ts`, and repo CI workflow configs
- [ ] T035 Implement requirement-traceability gate (`FR/NFR -> test artifact`) using `kitty-specs/001-colab-agent-terminal-control-plane/` trace matrix checks and validation scripts under `apps/runtime/tests/`
- [ ] T036 [P] Add gate validation tests/fixtures proving coverage and traceability gates fail closed when thresholds or mappings are missing

### Implementation Notes
- Boundary adapter must remain explicit: no implicit fallback between local/tool/A2A paths.
- Traceability gate should consume stable requirement IDs and reject orphan tests or orphan requirements.

### Parallel Opportunities
- T033 and T036 can proceed in parallel once T032 and T035 interfaces are stable.

### Dependencies
- Depends on WP06.

### Risks & Mitigations
- Risk: delegation boundary ambiguity causes accidental path switching.
- Mitigation: enforce adapter-level discriminated union and explicit refusal responses on unknown boundary type.

---

## Work Package WP08: Durability Follow-On Placeholder and Retention Compliance (Priority: P3)

**Goal**: Add slice-2 durability follow-on placeholders and enforce retention/export compliance coverage for lifecycle audit data.
**Independent Test**: Slice-2 durability placeholders are tracked with explicit checkpoint contracts, and retention/export tests verify completeness and policy enforcement.
**Prompt**: `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/WP08-durability-follow-on-placeholder-and-retention-compliance.md`
**Estimated Prompt Size**: ~350 lines

### Included Subtasks
- [ ] T037 Define slice-2 durability placeholder contract (persistent lane/session/checkpoint store) in `kitty-specs/001-colab-agent-terminal-control-plane/plan.md` and `kitty-specs/001-colab-agent-terminal-control-plane/data-model.md`
- [ ] T038 Add checkpoint persistence interface stubs and TODO markers for slice-2 handoff in `apps/runtime/src/sessions/` and `apps/runtime/src/audit/`
- [ ] T039 Implement retention policy configuration model and enforcement hooks for audit/session artifacts in `apps/runtime/src/audit/` and `apps/runtime/src/config/`
- [ ] T040 [P] Add retention policy compliance tests for TTL expiry, legal hold exception, and deletion audit proofs in `apps/runtime/tests/integration/recovery/` and `apps/runtime/tests/unit/audit/`
- [ ] T041 [P] Add export completeness tests to verify policy-compliant lifecycle export contains required fields/correlation IDs and redacts restricted data
- [ ] T042 Update `quickstart.md` and ops guidance with slice-2 durability placeholder boundaries, retention policy defaults, and compliance verification commands

### Implementation Notes
- Slice-2 durability artifacts in this work package are placeholders only; avoid hidden persistence enablement in slice-1 runtime paths.
- Retention policy behavior must be auditable and deterministic across replay/export workflows.

### Parallel Opportunities
- T040 and T041 can run in parallel after T039 policy model interfaces are stable.

### Dependencies
- Depends on WP05 and WP07.

### Risks & Mitigations
- Risk: retention enforcement diverges from export behavior.
- Mitigation: lock both behaviors behind shared policy evaluators and completeness assertions.

---

## Work Package WP09: Formal Protocol Surface Completion (Priority: P3)

**Goal**: Ensure complete parity between formal protocol assets (`specs/protocol/v1/`) and feature contracts/runtime task coverage for methods/topics outside the initial slice-1 core path.
**Independent Test**: A parity checker reports zero unmapped formal methods/topics and all deferred entries are explicitly linked to implementable tasks.
**Prompt**: `/kitty-specs/001-colab-agent-terminal-control-plane/tasks/WP09-formal-protocol-surface-completion.md`
**Estimated Prompt Size**: ~330 lines

### Included Subtasks
- [ ] T043 Build a method/topic parity matrix artifact mapping every formal method/topic to contract sections, runtime adapter paths, and WP task IDs
- [ ] T044 Add explicit contract coverage for workspace/project/renderer/agent/approval/share/zmx method families in `kitty-specs/001-colab-agent-terminal-control-plane/contracts/control-plane.openapi.yaml` and protocol docs
- [ ] T045 Add event coverage mapping for `workspace.opened`, `project.ready`, renderer switch events, `agent.run.*`, and approval/share events in feature contract docs and runtime event plans
- [ ] T046 [P] Add automated parity check script/test that fails when formal method/topic entries are unmapped or removed without explicit extension/defer annotation
- [ ] T047 [P] Update `research.md`, `plan.md`, and `quickstart.md` with parity verification commands and extension/defer policy examples

### Implementation Notes
- Treat `specs/protocol/v1/*` as canonical baseline and document Helios-specific extensions (`harness.status.changed`, `lane.attached`) explicitly.
- No silent contract drift is allowed.

### Parallel Opportunities
- T046 and T047 can run in parallel after T043 matrix format is agreed.

### Dependencies
- Depends on WP08.

### Risks & Mitigations
- Risk: parity matrix gets stale as contracts evolve.
- Mitigation: parity check script becomes required gate in CI/local validation.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02 → WP03 → (WP04 and WP05 in parallel) → WP06 → WP07 → WP08 → WP09.
- **Parallelization**: WP04 and WP05 can run concurrently after WP03; within WP07/WP08/WP09, designated `[P]` tasks can execute in parallel after interface-lock milestones.
- **MVP Scope**: WP01 + WP02 + WP03 (core control-plane lifecycle and terminal flow), with WP07/WP08/WP09 extending post-MVP compliance hardening, slice-2 readiness scaffolding, and formal protocol parity completion.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Align protocol methods/topics | WP01 | P0 | No |
| T002 | Implement envelope validator/types | WP01 | P0 | No |
| T003 | Add deterministic sequence guardrails | WP01 | P0 | No |
| T004 | Audit event sink scaffold | WP01 | P0 | Yes |
| T005 | Protocol unit tests | WP01 | P0 | Yes |
| T006 | Lane lifecycle state machine | WP02 | P1 | No |
| T007 | In-memory session registry | WP02 | P1 | No |
| T008 | Harness health monitor + routing | WP02 | P1 | No |
| T009 | Lane/session/harness API endpoints | WP02 | P1 | No |
| T010 | Harness fallback integration tests | WP02 | P1 | Yes |
| T011 | Terminal registry mapping | WP03 | P1 | No |
| T012 | Spawn/input/resize handlers | WP03 | P1 | No |
| T013 | Bounded output buffering | WP03 | P1 | No |
| T014 | Terminal lifecycle event emission | WP03 | P1 | No |
| T015 | Terminal lifecycle tests | WP03 | P1 | Yes |
| T016 | Shared active-context store | WP04 | P2 | No |
| T017 | Unified tab surfaces | WP04 | P2 | No |
| T018 | UI-to-runtime action wiring | WP04 | P2 | No |
| T019 | Renderer switch transaction/rollback | WP04 | P2 | No |
| T020 | Playwright workflow tests | WP04 | P2 | Yes |
| T021 | Restart recovery bootstrap | WP05 | P2 | No |
| T022 | Orphan watchdog/remediation | WP05 | P2 | No |
| T023 | Lifecycle audit fidelity + export | WP05 | P2 | No |
| T024 | Normalize boundary failures | WP05 | P2 | No |
| T025 | Recovery/chaos tests | WP05 | P2 | Yes |
| T026 | Runtime performance metrics | WP06 | P3 | No |
| T027 | Soak/performance harness | WP06 | P3 | No |
| T028 | Strict quality gate enforcement | WP06 | P3 | No |
| T029 | Quickstart and ops validation | WP06 | P3 | Yes |
| T030 | MVP boundary checklist | WP06 | P3 | Yes |
| T031 | Define FR-010 boundary contract mapping | WP07 | P3 | No |
| T032 | Implement protocol boundary adapter dispatch | WP07 | P3 | No |
| T033 | Delegation routing + boundary error tests | WP07 | P3 | Yes |
| T034 | Enforce coverage threshold gate (>=85%) | WP07 | P3 | No |
| T035 | Enforce requirement-traceability gate | WP07 | P3 | No |
| T036 | Gate fail-closed validation fixtures/tests | WP07 | P3 | Yes |
| T037 | Define slice-2 durability placeholder contract | WP08 | P3 | No |
| T038 | Add checkpoint persistence interface stubs | WP08 | P3 | No |
| T039 | Implement retention policy model/enforcement hooks | WP08 | P3 | No |
| T040 | Retention policy compliance tests | WP08 | P3 | Yes |
| T041 | Export completeness compliance tests | WP08 | P3 | Yes |
| T042 | Document durability/retention ops verification | WP08 | P3 | No |
| T043 | Build formal method/topic parity matrix | WP09 | P3 | No |
| T044 | Add formal method-family contract coverage | WP09 | P3 | No |
| T045 | Add formal event-family coverage mapping | WP09 | P3 | No |
| T046 | Automated parity checker gate | WP09 | P3 | Yes |
| T047 | Publish parity verification guidance | WP09 | P3 | Yes |
