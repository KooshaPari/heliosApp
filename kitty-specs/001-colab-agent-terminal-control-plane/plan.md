# Implementation Plan: Colab Agent Terminal Control Plane
*Path: [templates/plan-template.md](templates/plan-template.md)*

**Branch**: `001-colab-agent-terminal-control-plane` | **Date**: 2026-02-26 | **Spec**: [kitty-specs/001-colab-agent-terminal-control-plane/spec.md](kitty-specs/001-colab-agent-terminal-control-plane/spec.md)
**Input**: Feature specification from `/kitty-specs/001-colab-agent-terminal-control-plane/spec.md`

## Summary

Deliver a tight first vertical slice for a terminal-first control plane: one canonical runtime path (`codex` CLI + `cliproxyapi++` harness), one end-to-end tabbed UX flow (terminal/agent/session/chat/project), deterministic lifecycle events, and in-memory session continuity keyed by Codex session IDs. If harness initialization fails, degrade to native OpenAI login path while keeping local runtime responsive.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - In-memory continuity using `codex_session_id` reattach semantics.
  - Transient checkpoint snapshots for runtime restart recovery.
  - Explicit protocol boundaries for local control, tool interoperability routing, and A2A delegation entry points.
- **Slice-2 (deferred, must remain explicit in artifacts)**:
  - Durable local persistence for workspace/project metadata.
  - Durable checkpoint persistence and restore across full host restarts.
  - Expanded boundary adapter depth beyond slice-1 canonical path.
  - Full formal localbus runtime implementation completion beyond parity mapping/check gates delivered in slice-1 planning tasks.

## Technical Context

**Language/Version**: TypeScript (TS-native track, Bun runtime), Python 3.14+/PyPy 3.11 for supporting tooling where needed  
**Primary Dependencies**: Bun, runtime protocol bus in `apps/runtime/src/protocol/`, Codex CLI integration, `cliproxyapi++` harness bridge  
**Storage**: In-memory for this vertical slice (Codex session IDs used for continuity); durable persistence deferred to later increment  
**Testing**: Bun test gates, strict lint/type checks, static analysis, security checks, and soak/regression drills  
**Target Platform**: Local device-first desktop runtime (no required cloud dependency)  
**Project Type**: Desktop + local runtime control plane  
**Performance Goals**: Fast lane/session switches and responsive multi-tab control under high local session concurrency  
**Constraints**: Dockerless runtime, low-overhead process orchestration, deterministic event ordering, graceful harness degradation path  
**Scale/Scope**: First slice focused on single canonical provider path with multi-session tab control and diagnostics

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Language/runtime alignment**: PASS. TS + Bun-centered implementation aligns with constitution.
- **Testing posture**: PASS. Plan enforces the WP06 runtime command gates (`lint`, `typecheck`, `static`,
  `test`, `security`, `quality`) and soak validation.
- **Coverage + traceability posture**: Planned for WP07; not enforced by WP06 command gates.
- **Performance/local-first constraints**: PASS. Device-first, low-overhead, dockerless assumptions retained.
- **Architecture discipline**: PASS. Vertical slice keeps explicit extension seams (provider and session boundaries) without overbuilding adapter matrix.
- **Durability scope alignment**: PASS. Spec and plan now explicitly separate slice-1 transient continuity and slice-2 durable persistence/checkpoint requirements.

## Project Structure

### Documentation (this feature)

```
kitty-specs/001-colab-agent-terminal-control-plane/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── control-plane.openapi.yaml
│   └── orchestration-envelope.schema.json
└── tasks.md                # Phase 2 output (/spec-kitty.tasks command)
```

### Source Code (repository root)

```
apps/
├── desktop/
│   └── src/
│       ├── index.ts
│       └── settings.ts
└── runtime/
    └── src/
        ├── index.ts
        ├── integrations/
        │   └── exec.ts
        ├── protocol/
        │   ├── bus.ts
        │   ├── methods.ts
        │   ├── topics.ts
        │   └── types.ts
        └── sessions/
            └── state_machine.ts

specs/
└── protocol/
    └── v1/
        ├── envelope.schema.json
        ├── methods.json
        └── topics.json

kitty-specs/001-colab-agent-terminal-control-plane/
└── (planning artifacts)
```

**Structure Decision**: Keep a two-app split (`apps/desktop` UI shell + `apps/runtime` control plane) with protocol contracts in `specs/protocol/v1` and feature planning artifacts in `kitty-specs/001-colab-agent-terminal-control-plane/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| In-memory continuity for slice-1 instead of full durable replay | Matches confirmed delivery priority for fastest end-to-end value on canonical path | Full durability in slice-1 increases integration surface and delays first validated control-plane loop |

## Quality Gate Enforcement

- Coverage baseline and requirement traceability gates are deferred to WP07 (`T034`/`T035`).
- Fail closed on lint/type/static/security/test gate violations; no ignore/skip pathways.
- Enforce protocol parity checks against `specs/protocol/v1/methods.json` and `specs/protocol/v1/topics.json` with explicit deferred mapping records.

## Formal Protocol Parity

- **Formal source of truth**: `specs/protocol/v1/envelope.schema.json`, `specs/protocol/v1/methods.json`, `specs/protocol/v1/topics.json`.
- **Feature-contract rule**: `kitty-specs/001-colab-agent-terminal-control-plane/contracts/` must either:
  - represent the formal method/topic surface directly, or
  - document phased/deferred entries with explicit task coverage and acceptance criteria.
- **Extension rule**: Helios-specific additions (for example `harness.status.changed`) are allowed only when listed as explicit extensions, never as silent divergence.

## WP06 Validation and Release Readiness Update (2026-02-26)

### Hardening Artifacts

- Runtime instrumentation now emits structured `diagnostics.metric` events for:
  - `lane_create_latency_ms`
  - `session_restore_latency_ms`
  - `terminal_output_backlog_depth`
- Soak scenario baseline is codified in `docs/runtime-performance-baselines.md`.
- Strict local gate command surface is codified in `package.json` scripts:
  - `bun run lint`
  - `bun run typecheck`
  - `bun run static`
  - `bun run test`
  - `bun run security`
  - `bun run quality`

### MVP Boundary Re-Validation

- **Confirmed in MVP (slice-1)**:
  - In-memory performance metrics + diagnostics integration.
  - Multi-session soak/perf threshold validation.
  - Strict fail-closed local runtime quality and security gates.
- **Explicitly deferred post-MVP**:
  - Durable metrics storage, long-horizon trend warehousing, and cross-host soak orchestration.
  - Additional non-canonical boundary adapters beyond current slice-1 hardening scope.
