# Work Packages: Provider Adapter Interface and Lifecycle

**Inputs**: Design documents from `/kitty-specs/025-provider-adapter-interface-and-lifecycle/`
**Prerequisites**: plan.md (required), spec.md (user stories), related specs (002, 005, 023)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/025-provider-adapter-interface-and-lifecycle/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Typed Adapter Interface, Registry, and Lifecycle (Priority: P0 -- prerequisite to all other WPs)

**Phase**: Phase 0 - Foundation
**Goal**: Define the typed `ProviderAdapter` interface with init/health/execute/terminate lifecycle methods, implement the provider registry with configuration validation and credential binding, and deliver per-lane process-level isolation primitives.
**Independent Test**: A mock provider registers, passes health check, executes a task, and terminates cleanly. Registration with invalid config is rejected with normalized error. Process isolation boundary prevents cross-lane resource leakage.
**Prompt**: `/kitty-specs/025-provider-adapter-interface-and-lifecycle/tasks/WP01-typed-adapter-interface-registry-and-lifecycle.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T001 Define `ProviderAdapter` typed interface with init, health, execute, terminate lifecycle methods in `apps/runtime/src/providers/adapter.ts`
- [ ] T002 Implement provider registry with configuration validation, credential binding, and concurrency limits in `apps/runtime/src/providers/registry.ts`
- [ ] T003 Implement normalized error taxonomy mapping all provider error types to common codes in `apps/runtime/src/providers/errors.ts`
- [ ] T004 [P] Implement process-level isolation wrapper for provider execution contexts with lane-scoped failure boundaries
- [ ] T005 [P] Add unit tests for adapter interface contracts, registry lifecycle, and error normalization in `apps/runtime/src/providers/__tests__/`

### Implementation Notes
- Keep adapter interface minimal and protocol-agnostic; ACP/MCP/A2A specifics belong in downstream WPs.
- Credential binding must delegate to spec 028 credential store interface (stub if not yet available).
- Process isolation uses OS-level child processes, not in-process sandboxing.

### Parallel Opportunities
- T004 and T005 can proceed after T001/T002 interface contracts are stable.

### Dependencies
- None (foundation WP).

### Risks & Mitigations
- Risk: adapter interface too generic to support protocol-specific lifecycle needs.
- Mitigation: include protocol-specific extension points (config generics, typed execute payloads).

---

## Work Package WP02: ACP Client Boundary Adapter (Priority: P0)

**Goal**: Implement the ACP protocol client for Claude/agent task execution with run/cancel lifecycle, bus correlation, health monitoring, and policy gate integration point.
**Independent Test**: ACP client initializes against mock ACP endpoint, executes a task with correlation ID, cancels a running task, and health checks report status on the bus.
**Prompt**: `/kitty-specs/025-provider-adapter-interface-and-lifecycle/tasks/WP02-acp-client-boundary-adapter.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [ ] T006 Implement ACP client adapter implementing `ProviderAdapter` interface with run/cancel lifecycle in `apps/runtime/src/providers/acp-client.ts`
- [ ] T007 Wire ACP task execution to local bus with correlation ID propagation and result capture
- [ ] T008 Integrate policy gate pre-execute hook (spec 023) before ACP task dispatch
- [ ] T009 [P] Implement ACP-specific health check with configurable interval and degraded/unavailable state transitions
- [ ] T010 [P] Add integration tests for ACP lifecycle (init, execute, cancel, health, terminate) against mock ACP server in `apps/runtime/src/providers/__tests__/`

### Implementation Notes
- ACP client must propagate correlation IDs from originating bus request through to ACP response.
- Run/cancel lifecycle must handle timeout scenarios with normalized timeout error codes.
- Policy gate is a pre-execute hook; if denied, the execute call returns a policy-denied error without contacting ACP.

### Parallel Opportunities
- T009 and T010 can proceed after T006 client skeleton is stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: ACP SDK instability causes adapter failures.
- Mitigation: wrap ACP SDK calls in try/catch with normalized error mapping; mock ACP server for all tests.

---

## Work Package WP03: MCP Tool Bridge and Sandboxing (Priority: P0)

**Goal**: Implement the MCP tool bridge for tool discovery, schema registration, sandboxed invocation, and result capture with full error normalization and bus correlation.
**Independent Test**: MCP bridge connects to mock MCP server, discovers tools, registers schemas in catalog, invokes a tool in sandboxed context, and captures result with correlation ID. Disconnection produces retryable error.
**Prompt**: `/kitty-specs/025-provider-adapter-interface-and-lifecycle/tasks/WP03-mcp-tool-bridge-and-sandboxing.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [ ] T011 Implement MCP bridge adapter implementing `ProviderAdapter` interface with tool discovery and schema registration in `apps/runtime/src/providers/mcp-bridge.ts`
- [ ] T012 Implement sandboxed tool invocation with execution boundary enforcement and result capture
- [ ] T013 Wire MCP tool results to local bus with correlation ID propagation
- [ ] T014 Handle MCP server disconnection with retryable error normalization and reconnection strategy
- [ ] T015 [P] Add integration tests for MCP tool lifecycle (connect, discover, invoke, disconnect, reconnect) against mock MCP server in `apps/runtime/src/providers/__tests__/`

### Implementation Notes
- Tool schema registration must include input/output schemas for validation by downstream consumers.
- Sandboxed invocation runs in a child process with resource limits; tool crash must not leak to host.
- Reconnection strategy should use exponential backoff with configurable max retries.

### Parallel Opportunities
- T015 can proceed after T011/T012 interfaces are stable.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: MCP server protocol version mismatch.
- Mitigation: version negotiation on connect; reject incompatible servers with clear error.

---

## Work Package WP04: A2A Federation Router, Health Monitoring, and Tests (Priority: P1)

**Goal**: Implement the A2A federation router stub (slice-1) with endpoint registration, delegation routing, failure isolation, failover logic, health monitoring across all provider types, and comprehensive test coverage including chaos tests.
**Independent Test**: A2A stub routes delegation to mock endpoint, failover activates on primary failure, provider crash in lane A produces zero effect on lane B, all provider errors map to normalized taxonomy.
**Prompt**: `/kitty-specs/025-provider-adapter-interface-and-lifecycle/tasks/WP04-a2a-federation-router-health-monitoring-and-tests.md`
**Estimated Prompt Size**: ~450 lines

### Included Subtasks
- [ ] T016 Implement A2A federation router stub with endpoint registration and delegation routing in `apps/runtime/src/providers/a2a-router.ts`
- [ ] T017 Implement cross-provider health monitoring with configurable intervals, degraded/unavailable transitions, and bus status publication in `apps/runtime/src/providers/health.ts`
- [ ] T018 Implement failover routing logic that reroutes traffic from degraded providers to healthy alternatives
- [ ] T019 [P] Add chaos tests for provider crash isolation (SC-025-002): crash in lane A must produce zero effect on lane B
- [ ] T020 [P] Add integration tests for A2A delegation, failover routing, credential rotation without restart (SC-025-005), and normalized error completeness (SC-025-004)

### Implementation Notes
- A2A router is a stub in slice-1; full multi-endpoint failover is deferred to slice-2 but the interface must be designed for it.
- Health monitoring should be a single coordinator consuming health responses from all registered providers.
- Failover routing must be provider-level, not request-level; in-flight requests to crashing providers may fail.
- Credential rotation test must verify take-effect without provider restart or task interruption.

### Parallel Opportunities
- T019 and T020 can proceed after T016/T017/T018 implementations are stable.

### Dependencies
- Depends on WP01, WP02, WP03.

### Risks & Mitigations
- Risk: failover logic introduces routing ambiguity.
- Mitigation: explicit routing table with deterministic provider selection; no implicit fallback.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> (WP02 and WP03 in parallel) -> WP04.
- **Parallelization**: WP02 and WP03 can run concurrently after WP01; within each WP, designated `[P]` tasks can execute in parallel after interface-lock milestones.
- **MVP Scope**: WP01 (foundation) + WP02 (ACP) + WP03 (MCP) deliver core provider functionality; WP04 adds A2A stub, health monitoring, failover, and comprehensive tests.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Define ProviderAdapter typed interface | WP01 | P0 | No |
| T002 | Implement provider registry | WP01 | P0 | No |
| T003 | Implement normalized error taxonomy | WP01 | P0 | No |
| T004 | Process-level isolation wrapper | WP01 | P0 | Yes |
| T005 | Adapter/registry/error unit tests | WP01 | P0 | Yes |
| T006 | ACP client adapter implementation | WP02 | P0 | No |
| T007 | ACP bus correlation wiring | WP02 | P0 | No |
| T008 | ACP policy gate integration | WP02 | P0 | No |
| T009 | ACP health check implementation | WP02 | P0 | Yes |
| T010 | ACP lifecycle integration tests | WP02 | P0 | Yes |
| T011 | MCP bridge adapter implementation | WP03 | P0 | No |
| T012 | Sandboxed tool invocation | WP03 | P0 | No |
| T013 | MCP bus correlation wiring | WP03 | P0 | No |
| T014 | MCP disconnection handling | WP03 | P0 | No |
| T015 | MCP lifecycle integration tests | WP03 | P0 | Yes |
| T016 | A2A federation router stub | WP04 | P1 | No |
| T017 | Cross-provider health monitoring | WP04 | P1 | No |
| T018 | Failover routing logic | WP04 | P1 | No |
| T019 | Provider crash isolation chaos tests | WP04 | P1 | Yes |
| T020 | A2A/failover/rotation integration tests | WP04 | P1 | Yes |
