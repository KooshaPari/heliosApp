# Feature Specification: Colab Agent Terminal Control Plane

**Feature Branch**: `001-colab-agent-terminal-control-plane`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "all of the above, initial prompt; Planning Co(Lab) fork focused on effectively being a hyper optimal Antigravity + Warp Terminal + Codex App + our personal needed features that will be added AFTER the mvp. core focus is tight IDE experience just without the editor and really good agent\\session\\chat\\project mgmt tabs etc"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Multi-Lane Terminal Work Reliably (Priority: P1)

As an operator managing parallel project work, I can create, attach, and recover multiple work lanes with persistent terminal sessions so work continues through restarts and failures.

**Why this priority**: Reliable lane and terminal continuity is the core value proposition and baseline for daily use.

**Independent Test**: Can be fully tested by creating multiple lanes and sessions, forcing restarts, and verifying the same work context is recoverable without manual reconstruction.

**Acceptance Scenarios**:

1. **Given** a user with an active workspace, **When** they create a new lane and start a terminal session, **Then** the lane and session are available for reattach later.
2. **Given** a terminal session with active commands, **When** the runtime restarts, **Then** the session state is restored and mapped to the same lane and workspace.
3. **Given** orphaned lane/session artifacts, **When** watchdog checks run, **Then** the user receives actionable remediation guidance and optional safe cleanup.

---

### User Story 2 - Use a Tight Editorless IDE Surface (Priority: P2)

As an agent-centric developer, I can manage terminal, agent, session, chat, and project context from a low-friction interface without needing an in-app code editor.

**Why this priority**: This defines the product interaction model and enables fast execution with minimal interface overhead.

**Independent Test**: Can be tested by completing a full lane lifecycle (create, run, switch context, recover) using only the control-plane interface and terminal surfaces.

**Acceptance Scenarios**:

1. **Given** an active workspace, **When** the user opens terminal, agent, session, chat, and project tabs, **Then** each tab reflects the same underlying lane context.
2. **Given** two available rendering modes, **When** the user changes rendering mode in settings, **Then** the runtime switches or safely restarts while preserving active session context.

---

### User Story 3 - Orchestrate Agent Work Across Protocol Boundaries (Priority: P3)

As an advanced user, I can run local and external agent operations through consistent orchestration boundaries with traceable request/response behavior.

**Why this priority**: Protocol interoperability enables extensibility and long-term platform utility beyond local terminal control.

**Independent Test**: Can be tested by issuing an orchestration request, confirming correlation continuity, and validating completion/error events across protocol boundaries.

**Acceptance Scenarios**:

1. **Given** a valid orchestration request, **When** it is routed through protocol boundaries, **Then** request correlation is preserved from submission to completion.
2. **Given** an external protocol failure, **When** the failure is returned, **Then** the local runtime remains responsive and surfaces normalized error feedback.

---

### Edge Cases

- What happens when a rendering-mode switch cannot be completed in-place? The system must fall back to a safe restart path and preserve session continuity.
- How does the system handle partial recovery after a crash? The system must restore all recoverable lanes/sessions and clearly flag unrecoverable artifacts for user action.
- What happens when lane/session metadata and runtime state diverge? The system must detect drift, prevent unsafe actions, and prompt reconciliation.
- How does the system handle concurrent actions on the same lane/session from multiple tabs? The system must serialize conflicting actions and provide deterministic outcomes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001a**: For slice-1, the system MUST let users initialize/open workspaces and restore active workspace context after runtime restart via `codex_session_id` reattach flow.
- **FR-001b**: For slice-2, the system MUST persist workspace/project metadata durably on local storage across full host restarts.
- **FR-002**: The system MUST provide lane lifecycle actions (create, list, attach, cleanup) with explicit lifecycle status.
- **FR-003**: The system MUST provide session lifecycle actions (ensure/open/terminate) linked to lane identity.
- **FR-004**: The system MUST maintain a terminal registry that maps each terminal to workspace, lane, and session.
- **FR-005a**: For slice-1, the system MUST support transient checkpoint snapshots sufficient for active terminal/session continuity during runtime restarts.
- **FR-005b**: For slice-2, the system MUST support durable checkpoint persistence and restore for terminal/session continuity.
- **FR-006**: The system MUST execute crash-restart recovery orchestration that restores recoverable lane/session state from available checkpoints and reconciliation rules.
- **FR-007**: The system MUST expose two rendering modes selectable by user settings.
- **FR-008**: The system MUST perform rendering-mode switch as a transaction with automatic rollback on failure.
- **FR-009**: The system MUST provide an internal command/response/event bus with envelope validation and correlation IDs.
- **FR-010**: The system MUST expose protocol boundaries for local control, tool interoperability, and agent-to-agent delegation.
- **FR-011**: The system MUST provide unified tabs for terminal, agent, session, chat, and project management views bound to active context.
- **FR-012**: The system MUST detect orphaned lane/session artifacts and surface actionable remediation paths.
- **FR-013**: The system MUST preserve deterministic event ordering for lifecycle-critical state transitions.
- **FR-014**: The system MUST provide auditable operation records for lane/session/agent lifecycle actions.
- **FR-015**: The system MUST clearly separate MVP scope from deferred post-MVP capabilities in product behavior and planning artifacts.
- **FR-016**: The system MUST keep core workflows fully usable without requiring an embedded code editor.
- **FR-017**: The system MUST maintain parity with formal localbus protocol assets in `specs/protocol/v1/` for method/topic coverage, with any intentional extensions explicitly documented.
- **FR-018**: The system MUST expose lifecycle surfaces for renderer switch/capabilities, agent run/cancel, approval resolution, share-session controls (`upterm`/`tmate`), and checkpoint/restore semantics in phased implementation artifacts.

#### FR-010 Boundary Contract Mapping

| Boundary | Canonical Commands | Canonical Events | Runtime Adapter |
|----------|--------------------|------------------|-----------------|
| local control | `boundary.local.dispatch`, `lane.create`, `session.attach`, `terminal.spawn` | `boundary.local.dispatched`, lifecycle topics | `local_bus` |
| tool interoperability | `boundary.tool.dispatch`, `approval.request.resolve`, `share.upterm.start`, `zmx.checkpoint` | `boundary.tool.dispatched`, `boundary.dispatch.failed` | `tool_bridge` |
| agent-to-agent delegation | `boundary.a2a.dispatch`, `agent.run`, `agent.cancel` | `boundary.a2a.delegated`, `boundary.dispatch.failed` | `a2a_bridge` |

### Non-Functional Requirements

- **NFR-001**: Primary terminal interactions (input echo, context-switch feedback) MUST satisfy `p50 <= 60ms` and `p95 <= 150ms` under baseline load profile.
- **NFR-002**: Recovery operations for recoverable sessions MUST satisfy `p95 <= 5s` under baseline restart profile.
- **NFR-003**: In multi-lane workflows (`>=8` active lanes), users MUST identify active workspace/lane/session correctly in `>=95%` of validation tasks and complete lane-context switch actions in `<=5s p95`.
- **NFR-004**: On external boundary failures (tool/A2A/harness), local runtime control MUST remain available, degraded routing MUST engage within `<=2s p95`, and failure scope MUST be isolated to affected lane/session without process-wide crash.
- **NFR-005a**: Lifecycle event and audit records MUST be retained for at least 30 days by default (configurable) with enough fidelity to reconstruct key operator actions for incident review.
- **NFR-005b**: Audit export bundles MUST include complete correlated timeline fields for selected workspace/lane/session scopes with required redactions applied.

### Key Entities *(include if feature involves data)*

- **Workspace**: Top-level operating boundary containing projects, lanes, and shared runtime settings.
- **Project Context**: Metadata that binds repository or task context to workspace views and active lanes.
- **Lane**: Isolated execution track for a unit of work, including lifecycle state and associated sessions.
- **Session**: Multiplexed terminal context attached to a lane with persistence and recovery semantics.
- **Terminal Instance**: Concrete interactive terminal endpoint mapped to workspace/lane/session identifiers.
- **Renderer Mode**: User-selectable rendering pathway with capability state and switch transaction metadata.
- **Orchestration Envelope**: Structured command/response/event unit containing correlation and outcome fields.
- **Protocol Boundary**: Named integration surface for local control, tool invocation, and agent federation actions.
- **Lifecycle Audit Event**: Immutable record of significant lane/session/agent operations for traceability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of lane create/attach operations complete successfully on first attempt in normal conditions.
- **SC-002**: At least 95% of recoverable sessions are restored after controlled restart tests without manual operator repair.
- **SC-003**: Users can switch active lane context and continue work in under 5 seconds for common workflows.
- **SC-004**: In validation runs, users complete a full editorless workflow (open workspace → run terminal work → recover state) with at least 90% first-attempt completion.
- **SC-005**: In protocol-boundary failure drills, 100% of injected external failures are surfaced with normalized errors while local runtime control remains operational.
- **SC-006**: Protocol parity validation shows 100% coverage of formal `methods.json` and `topics.json` entries in feature contracts or explicitly documented deferred mappings.

## Assumptions

- Existing planning docs under `docs/sessions/20260226-helios-market-research/` are the authoritative source for MVP candidate scope.
- Collaboration overlays and personal feature packs are explicitly deferred to post-MVP.
- Slice-1 scope uses in-memory continuity and `codex_session_id` reattach; slice-2 adds durable local persistence and durable checkpoint restore.
- Target branch remains `main` for planning artifacts unless changed later by user direction.
