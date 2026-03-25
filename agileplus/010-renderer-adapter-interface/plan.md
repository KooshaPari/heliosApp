# Implementation Plan: Renderer Adapter Interface

**Branch**: `010-renderer-adapter-interface` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Deliver the abstract renderer adapter interface at `apps/runtime/src/renderer/` that defines lifecycle operations (init, start, stop, switch, queryCapabilities), a renderer registry, and a state machine governing renderer transitions. This interface is the contract that specs 011 (ghostty) and 012 (rio) implement. Renderer switches are transactional with automatic rollback on failure. Exactly one renderer is active at any time.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Renderer adapter interface with init/start/stop/switch/queryCapabilities.
  - Renderer state machine: `uninitialized` -> `initializing` -> `running` -> `switching` -> `stopping` -> `stopped` -> `errored`.
  - Renderer registry for backend registration with identity, version, and capability metadata.
  - Transactional renderer switch with rollback on failure.
  - PTY stream binding/unbinding to active renderer without data loss.
  - Lifecycle event publishing to local bus.
  - Structured capability matrix per renderer.
- **Slice-2 (deferred)**:
  - Multi-renderer split-view (different renderers for different panes).
  - Renderer hot-reload without session interruption.
  - Renderer performance auto-tuning.

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Local bus (spec 002), PTY lifecycle (spec 007), configuration (spec 004)
**Storage**: In-memory renderer registry
**Testing**: Vitest with mock renderer backends, Playwright for switch E2E
**Target Platform**: macOS/Linux desktop with ElectroBun shell
**Performance Goals**: Switch p95 < 3s, < 16.7ms added render latency (one frame at 60 FPS), capability query p95 < 50ms
**Constraints**: Exactly one active renderer, open/closed for extension (new backends without core changes)

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun.
- **Testing posture**: PASS. Vitest + mock backends + Playwright.
- **Coverage + traceability**: PASS. >= 85% baseline.
- **Performance/local-first**: PASS. Sub-frame render path overhead.
- **Architecture discipline**: PASS. Interface/registry pattern supports N backends without modification.
- **Recovery guarantees**: PASS. Transactional switch with rollback; crash detection and fallback.

## Project Structure

### Documentation

```
kitty-specs/010-renderer-adapter-interface/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code

```
apps/runtime/src/renderer/
├── index.ts              # Public API and re-exports
├── adapter.ts            # Abstract renderer adapter interface
├── state_machine.ts      # Renderer state machine
├── registry.ts           # Renderer registry (register, lookup, list)
├── switch.ts             # Transactional renderer switch logic with rollback
├── capabilities.ts       # Capability matrix types and query
└── stream_binding.ts     # PTY stream bind/unbind to active renderer
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Transactional switch with rollback | Failed switches must not leave the system without a working renderer | Simple stop-then-start risks a window with no active renderer and potential data loss |
| Capability matrix per renderer | Different renderers have different feature profiles | Assuming uniform capabilities would cause silent failures on unsupported features |

## Quality Gate Enforcement

- Enforce line coverage >= 85% with stricter expectations on switch/rollback and stream binding paths.
- Enforce FR/NFR to test traceability for all 8 FRs and 4 NFRs.
- Fail closed on lint/type/static/security/test violations.
- Validate lifecycle event schema against bus contract (spec 002).
- Verify both mock ghostty and mock rio backends register without interface modifications.
- Test: renderer switch rollback preserves previous renderer in 100% of failure scenarios.
