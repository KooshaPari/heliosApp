# Implementation Plan: Provider Adapter Interface and Lifecycle

**Branch**: `025-provider-adapter-interface-and-lifecycle` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/025-provider-adapter-interface-and-lifecycle/spec.md`

## Summary

Deliver a typed adapter interface for AI provider orchestration (ACP, MCP, A2A) with common lifecycle methods (init, health, execute, terminate), per-provider credential binding, process-level isolation scoped to lanes, health monitoring with failover routing, and a normalized error taxonomy. The adapter layer is the boundary between the runtime bus and external provider protocols.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Typed `ProviderAdapter` interface with init/health/execute/terminate lifecycle.
  - ACP client for Claude with run/cancel lifecycle and bus correlation.
  - MCP bridge for tool discovery, schema registration, and sandboxed invocation.
  - Per-provider health monitoring with configurable intervals and degraded/unavailable states.
  - Normalized error taxonomy mapping ACP, MCP, and A2A errors to common codes.
  - Process-level isolation binding providers to lanes.
  - Policy gate integration point (spec 023) as a pre-execute hook.
- **Slice-2 (deferred, must remain explicit in artifacts)**:
  - A2A federation router with multi-endpoint failover (stub interface delivered in slice-1).
  - Dynamic provider loading and marketplace discovery.
  - Multi-tenant credential vaults beyond OS keychain delegation.
  - Advanced concurrency management (adaptive rate limiting, backpressure).

## Technical Context

**Language/Version**: TypeScript (TS-native track, Bun runtime)
**Primary Dependencies**: Bun, `apps/runtime/src/protocol/` bus, ACP SDK, MCP SDK
**Storage**: Credential binding delegates to OS keychain / spec 028; adapter state is in-memory
**Testing**: Vitest + Playwright, chaos injection for provider crash isolation, integration tests against mock providers
**Target Platform**: Local device-first desktop runtime (no required cloud dependency)
**Project Type**: Runtime subsystem -- provider boundary layer
**Performance Goals**: Adapter overhead < 10ms (p95); init < 5s (p95); 10+ concurrent providers
**Constraints**: Dockerless, process-level isolation via child processes, lane-scoped failure boundaries

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun implementation.
- **Testing posture**: PASS. Vitest + chaos injection + integration tests against mock providers.
- **Coverage + traceability**: PASS. >=85% coverage; FR-025-* mapped to test cases.
- **Performance/local-first**: PASS. Device-first, no cloud dependency for provider lifecycle.
- **Architecture discipline**: PASS. Adapter boundary is explicit; does not own bus (002) or lane executor (008).

## Project Structure

### Documentation (this feature)

```
kitty-specs/025-provider-adapter-interface-and-lifecycle/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/runtime/src/providers/
├── adapter.ts          # ProviderAdapter interface and base class
├── registry.ts         # Provider registration and lifecycle management
├── health.ts           # Health monitor with configurable intervals and failover
├── errors.ts           # Normalized error taxonomy
├── acp-client.ts       # ACP protocol client for Claude
├── mcp-bridge.ts       # MCP tool discovery and sandboxed invocation
├── a2a-router.ts       # A2A federation stub (slice-1) / full router (slice-2)
└── __tests__/
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Three protocol clients (ACP, MCP, A2A) behind one interface | Spec mandates unified lifecycle for heterogeneous providers | Separate untyped integrations would duplicate health/error/lifecycle logic |
| Process-level isolation per provider | NFR-025-004 requires crash containment without host resource leaks | In-process sandboxing cannot guarantee FD/memory isolation on crash |

## Quality Gate Enforcement

- Enforce line coverage baseline of >=85% with stricter expectations on lifecycle-critical paths (init, terminate, health).
- Enforce FR-to-test traceability: every FR-025-* must have at least one dedicated test.
- Chaos tests: provider crash in lane A must produce zero observable effect on lane B (SC-025-002).
- Normalized error coverage: zero unmapped error codes across ACP, MCP, and A2A (SC-025-004).
- Fail closed on lint/type/static/security/test gate violations; no ignore/skip pathways.
