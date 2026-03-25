# Implementation Plan: Share Session Workflows

**Branch**: `026-share-session-workflows` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/026-share-session-workflows/spec.md`

## Summary

Deliver per-terminal session sharing via upterm and tmate backends with policy-gated activation, TTL lifecycle management, human-AI handoff workflows, and on-demand share workers. No background daemons run per terminal; workers start only when a share is approved and terminate on TTL expiry, revocation, or terminal close.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - upterm and tmate adapter implementations with backend selection at share time.
  - Policy gate integration (spec 023) with deny-by-default enforcement.
  - TTL management: configurable default, per-request override, grace period warnings, auto-terminate.
  - Share revocation with sub-5-second participant disconnect.
  - On-demand share worker lifecycle (start, heartbeat, terminate).
  - Audit event emission for all share actions (spec 024).
  - Share status badges in lane panel.
- **Slice-2 (deferred, must remain explicit in artifacts)**:
  - Human-to-AI and AI-to-human handoff with full context preservation (stub interface in slice-1, full implementation deferred until zmx integration matures).
  - Cloud relay for remote share sessions beyond local network / SSH tunnel.
  - Multi-participant concurrent share beyond configurable limit tuning.

## Technical Context

**Language/Version**: TypeScript (TS-native track, Bun runtime)
**Primary Dependencies**: Bun, upterm binary, tmate binary, `apps/runtime/src/protocol/` bus
**Storage**: Share session state is in-memory with bus event persistence via spec 024 audit log
**Testing**: Vitest for unit tests, Playwright for UI badge verification, integration tests with mock upterm/tmate
**Target Platform**: Local device-first desktop runtime
**Project Type**: Runtime integration subsystem -- sharing boundary
**Performance Goals**: Share link generation < 3s (p95); revoke-to-disconnect < 5s (p95); worker memory < 15 MB
**Constraints**: No background daemons; on-demand workers only; local-network or SSH-tunneled sharing

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun.
- **Testing posture**: PASS. Vitest + Playwright + integration tests with mock share backends.
- **Coverage + traceability**: PASS. >=85% coverage; FR-026-* mapped to test cases.
- **Performance/local-first**: PASS. No cloud relay dependency; on-demand workers minimize resource usage.
- **Architecture discipline**: PASS. Share workflows do not own terminal sessions (009), policy (023), or audit (024).

## Project Structure

### Documentation (this feature)

```
kitty-specs/026-share-session-workflows/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/runtime/src/integrations/sharing/
├── share-session.ts     # Share session entity and lifecycle state
├── share-worker.ts      # On-demand worker process management
├── upterm-adapter.ts    # upterm backend adapter
├── tmate-adapter.ts     # tmate backend adapter
├── ttl-manager.ts       # TTL tracking, grace warnings, auto-terminate
├── handoff.ts           # Human-AI handoff stub (slice-1) / full impl (slice-2)
└── __tests__/
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Two share backends (upterm + tmate) | Spec requires backend selection at share time for operator flexibility | Single backend would lock operators into one tool's availability and limitations |
| On-demand worker lifecycle with heartbeat | NFR-026-004 requires worker crash isolation from host terminal | In-process sharing would risk terminal PTY corruption on worker failure |

## Quality Gate Enforcement

- Enforce line coverage baseline of >=85% with stricter expectations on TTL and revocation paths.
- Enforce FR-to-test traceability: every FR-026-* must have at least one dedicated test.
- Chaos tests: share worker crash must not affect host terminal PTY (SC-026-004).
- Audit completeness: every share action produces a correlated audit event (SC-026-005).
- Fail closed on lint/type/static/security/test gate violations; no ignore/skip pathways.
