# Feature Specification: Provider Adapter Interface and Lifecycle

**Feature Branch**: `025-provider-adapter-interface-and-lifecycle`
**Created**: 2026-02-27
**Updated**: 2026-02-27
**Status**: Draft

## Overview

Typed adapter interface for AI provider orchestration. Providers (Claude via ACP, MCP tool servers, A2A external agents) register through a common lifecycle (init, health, execute, terminate) and are bound to lanes with process-level isolation. The adapter layer normalizes errors, manages credentials per provider, monitors health with failover routing, and ensures that provider failures isolate to the lane level without crashing the global runtime. This spec owns the adapter boundary -- not the bus (002), not the lane executor (008), not the policy engine (023).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Register and Use a Provider (Priority: P0)

As an operator, I can configure an AI provider (e.g., Claude via ACP) and have it available for agent task execution in my workspace lanes.

**Why this priority**: No agent functionality exists without at least one working provider.

**Acceptance Scenarios**:

1. **Given** a valid provider configuration with credentials, **When** the provider is registered, **Then** it initializes, passes health check, and reports ready status on the bus.
2. **Given** a registered provider, **When** an agent task is dispatched to a lane, **Then** the provider executes the task and returns results correlated to the originating bus request.
3. **Given** a provider that fails initialization, **When** registration is attempted, **Then** the failure is reported with a normalized error code and the provider is marked unavailable.

---

### User Story 2 — MCP Tool Discovery and Invocation (Priority: P0)

As an operator, I can connect MCP tool servers so that agents can discover and invoke tools within sandboxed execution boundaries.

**Why this priority**: MCP tools are the primary mechanism for agent-world interaction.

**Acceptance Scenarios**:

1. **Given** an MCP server is configured, **When** the adapter connects, **Then** available tools are discovered and registered in the tool catalog with their schemas.
2. **Given** a discovered tool, **When** an agent invokes it, **Then** the invocation executes in a sandboxed context and the result is captured with correlation ID.
3. **Given** an MCP server disconnects mid-session, **When** a tool invocation is attempted, **Then** the adapter returns a normalized error and the agent receives a retryable failure.

---

### User Story 3 — A2A Federation (Priority: P1)

As an operator, I can delegate tasks to external agents via A2A protocol so that specialized agents can collaborate without direct coupling.

**Acceptance Scenarios**:

1. **Given** an A2A endpoint is registered, **When** a task is delegated, **Then** the request routes to the external agent and the result syncs back to the local bus with correlation.
2. **Given** an A2A delegation fails, **When** the failure is detected, **Then** it is isolated to the originating lane and a normalized error is returned.
3. **Given** multiple A2A endpoints, **When** the primary is unhealthy, **Then** failover routes to a healthy alternative if configured.

---

### User Story 4 — Provider Health and Failover (Priority: P1)

As an operator, I want unhealthy providers to be detected and traffic rerouted so that agent workflows are not stalled by a single provider outage.

**Acceptance Scenarios**:

1. **Given** a provider health check fails 3 consecutive times, **When** evaluated, **Then** the provider is marked degraded and removed from active routing.
2. **Given** a degraded provider recovers, **When** health checks pass, **Then** the provider is restored to active routing within one health check interval.
3. **Given** all providers for a capability are unhealthy, **When** a task is dispatched, **Then** the system queues the task and alerts the operator rather than failing silently.

---

### Edge Cases

- Provider process crash must not leak memory or file descriptors in the host process.
- Credential rotation must take effect without provider restart.
- Concurrent execute calls to the same provider must be bounded by configurable concurrency limits.
- Lane termination must trigger provider terminate lifecycle for that lane's bindings.
- Provider timeout must produce a normalized timeout error, not an unhandled promise rejection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-025-001**: The system MUST define a typed adapter interface with init, health, execute, and terminate lifecycle methods.
- **FR-025-002**: The system MUST support provider registration with configuration validation and credential binding.
- **FR-025-003**: The system MUST integrate ACP for Claude/agent task execution with run and cancel lifecycle and local bus correlation.
- **FR-025-004**: The system MUST integrate MCP for tool discovery, schema registration, sandboxed invocation, and result capture.
- **FR-025-005**: The system MUST integrate A2A for external agent delegation with failure isolation and local bus sync.
- **FR-025-006**: The system MUST maintain per-provider credential stores isolated from other providers.
- **FR-025-007**: The system MUST enforce process-level isolation for provider execution contexts.
- **FR-025-008**: The system MUST bind providers to lanes so that provider failures isolate to the affected lane.
- **FR-025-009**: The system MUST perform periodic health checks on all registered providers and publish status to the bus.
- **FR-025-010**: The system MUST implement failover routing when a provider is marked degraded.
- **FR-025-011**: The system MUST normalize error codes across all provider types (ACP, MCP, A2A) into a common error taxonomy.
- **FR-025-012**: The system MUST enforce policy gates (spec 023) before executing agent-initiated provider actions.

### Non-Functional Requirements

- **NFR-025-001**: Provider init MUST complete within 5 seconds (p95) or be marked as failed.
- **NFR-025-002**: Health check interval MUST be configurable with a default of 30 seconds.
- **NFR-025-003**: Provider execute call overhead (adapter layer, excluding provider processing) MUST be < 10ms (p95).
- **NFR-025-004**: Provider crash MUST NOT leak resources (memory, file descriptors, child processes) in the host runtime.
- **NFR-025-005**: The system MUST support at least 10 concurrent providers per workspace without degradation.

### Dependencies

- **Spec 002** (Local Bus): Provider lifecycle events and task correlation published on the bus.
- **Spec 005** (IDs/Correlation): Correlation IDs link provider executions to originating requests.
- **Spec 023** (Policy Engine): Policy gates evaluated before agent-initiated provider actions.

## Key Entities

- **ProviderAdapter**: Typed interface implementing init, health, execute, terminate for a specific provider protocol (ACP, MCP, A2A).
- **ProviderRegistration**: Configuration record binding a provider adapter to a workspace with credentials, health policy, and concurrency limits.
- **ACPClient**: ACP protocol client managing run/cancel lifecycle for Claude and compatible agents.
- **MCPBridge**: MCP protocol client handling tool discovery, schema caching, sandboxed invocation, and result capture.
- **A2ARouter**: A2A protocol client managing external agent delegation, failure isolation, and failover.
- **ProviderHealthStatus**: Current health state (healthy, degraded, unavailable) with last-check timestamp and failure count.
- **NormalizedError**: Common error envelope with code, message, provider source, retryable flag, and correlation ID.

## Success Criteria *(mandatory)*

- **SC-025-001**: At least one ACP provider and one MCP tool server register, pass health checks, and execute tasks end-to-end in integration tests.
- **SC-025-002**: Provider crash in lane A produces zero observable effect on lane B in 100% of chaos test injections.
- **SC-025-003**: Failover routes traffic to healthy provider within one health check interval in 95% of failover test runs.
- **SC-025-004**: All provider errors across ACP, MCP, and A2A map to the normalized error taxonomy with zero unmapped error codes.
- **SC-025-005**: Credential rotation takes effect without provider restart or task interruption in 100% of rotation test runs.

## Assumptions

- ACP, MCP, and A2A protocol specifications are stable enough for initial adapter implementation.
- Process-level isolation uses OS-level process boundaries (child processes), not in-process sandboxing.
- Failover is provider-level, not request-level; in-flight requests to a crashing provider may fail.
- Credential storage delegates to the OS keychain or a secure local store; this spec does not define the secret storage implementation.
- Post-MVP: provider marketplace, dynamic provider loading, multi-tenant credential vaults.
