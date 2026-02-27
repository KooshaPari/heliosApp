# Implementation Plan: Zellij Mux Session Adapter

**Branch**: `009-zellij-mux-session-adapter` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Deliver a zellij multiplexer adapter at `apps/runtime/src/integrations/zellij/` that manages mux sessions bound to lanes. Provides session ensure/open/terminate via the zellij CLI, pane and tab topology management, mux event relay to the local bus, and session reattach after runtime restarts using zellij's native persistence.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Session create, reattach, and terminate via zellij CLI.
  - Session-to-lane binding registry.
  - Pane create, close, resize with PTY lifecycle integration (spec 007).
  - Tab create, close, switch within sessions.
  - Mux event publishing to local bus (session, pane, tab lifecycle events).
  - Session reattach after runtime restart.
  - Orphaned session reconciliation on startup.
- **Slice-2 (deferred)**:
  - Custom zellij layout templates.
  - Pane content snapshotting for checkpoint/restore beyond zellij native persistence.
  - Cross-session pane sharing or mirroring.

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: Zellij CLI, local bus (spec 002), PTY lifecycle (spec 007), lane orchestrator (spec 008)
**Storage**: In-memory session registry; zellij handles session persistence on disk
**Testing**: Vitest for unit tests, integration tests requiring zellij binary
**Target Platform**: macOS/Linux with zellij installed
**Performance Goals**: Session create p95 < 2s, pane add/remove p95 < 500ms, reattach p95 < 3s, < 2ms added data-path latency
**Constraints**: Zellij must be pre-installed; minimum pane dimension enforcement; one session per lane

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun with zellij CLI shelling.
- **Testing posture**: PASS. Vitest + zellij integration tests.
- **Coverage + traceability**: PASS. >= 85% baseline.
- **Performance/local-first**: PASS. All operations local, zellij native persistence.
- **Architecture discipline**: PASS. Adapter pattern isolates zellij specifics from upstream consumers.
- **Recovery guarantees**: PASS. Reattach leverages zellij native session persistence.

## Project Structure

### Documentation

```
kitty-specs/009-zellij-mux-session-adapter/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code

```
apps/runtime/src/integrations/zellij/
├── index.ts              # Public adapter API
├── session.ts            # Session create/reattach/terminate
├── panes.ts              # Pane lifecycle (create, close, resize)
├── tabs.ts               # Tab lifecycle (create, close, switch)
├── registry.ts           # Session-to-lane binding registry
├── cli.ts                # Zellij CLI wrapper
└── events.ts             # Mux event relay to local bus
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Zellij CLI shelling instead of library binding | Zellij has no stable Rust FFI for TypeScript consumers | Direct library binding would require unstable FFI and maintenance burden |
| Minimum pane dimension enforcement | Prevents unusable pane sizes that crash zellij or confuse users | Letting zellij handle it silently leads to inconsistent error behavior |

## Quality Gate Enforcement

- Enforce line coverage >= 85% with stricter expectations on session reattach and reconciliation paths.
- Enforce FR/NFR to test traceability for all 8 FRs and 4 NFRs.
- Fail closed on lint/type/static/security/test violations.
- Validate mux event schema against bus contract (spec 002).
- Integration test: full session create-pane-tab-terminate cycle with real zellij.
- Verify zero orphaned zellij sessions after reconciliation in all test scenarios.
