# Feature Specification: Share Session Workflows

**Feature Branch**: `026-share-session-workflows`
**Created**: 2026-02-27
**Updated**: 2026-02-27
**Status**: Draft

## Overview

Terminal sharing workflows via upterm and tmate. Operators can share individual terminal sessions with collaborators or AI agents through policy-gated, time-limited share links. Sharing is per-terminal (not per-workspace), with full audit trail and explicit lifecycle management. No background daemons run per terminal; share workers start on demand.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Share a Terminal Session (Priority: P0)

As an operator, I can share a specific terminal with a collaborator so they can observe or interact with my session in real time.

**Why this priority**: Collaboration is the core value proposition of share sessions.

**Independent Test**: Select a terminal, initiate share via upterm, verify a share link is generated and a remote participant can connect.

**Acceptance Scenarios**:

1. **Given** an active terminal, **When** the operator requests a share via upterm, **Then** the policy gate evaluates approval (deny-by-default) and, if approved, a share link with TTL is returned within 3 seconds.
2. **Given** a share request, **When** the policy gate denies it, **Then** the operator receives a clear denial reason and no share worker is started.
3. **Given** an active share, **When** the operator switches share backend to tmate, **Then** a new share link is generated via tmate and the previous upterm session is terminated.

---

### User Story 2 — TTL and Lifecycle Management (Priority: P0)

As an operator, I can rely on automatic expiration of share sessions so that no session remains shared indefinitely without explicit renewal.

**Why this priority**: Unmanaged share sessions are a security liability.

**Acceptance Scenarios**:

1. **Given** an active share with a 30-minute TTL, **When** 25 minutes elapse, **Then** the operator and connected participants receive a grace period warning.
2. **Given** an active share, **When** the TTL expires without extension, **Then** the share worker terminates, connected participants are disconnected, and an audit event is recorded.
3. **Given** an active share, **When** the operator explicitly extends the TTL, **Then** the new expiry is set and an audit event is recorded.

---

### User Story 3 — Handoff Between Human and AI (Priority: P1)

As an operator, I can hand off a terminal session to an AI agent (or receive one back) with context preserved so that work continues without re-establishing state.

**Why this priority**: Human-AI handoff is central to the agent-assisted workflow model.

**Acceptance Scenarios**:

1. **Given** a human-operated terminal, **When** the operator initiates handoff to an AI agent, **Then** an approval chain is triggered, and upon approval the AI agent receives terminal access with working directory and environment context preserved.
2. **Given** an AI-operated terminal, **When** the AI initiates handoff back to a human, **Then** the human receives a notification and the terminal focus returns to them with scrollback intact.
3. **Given** a handoff in progress, **When** the approval chain is rejected, **Then** no access transfer occurs and both parties are notified.

---

### Edge Cases

- Concurrent share limit per terminal must be enforced; exceeding it returns a clear error.
- Revoking a share while participants are connected must disconnect them within 5 seconds.
- Network partition during an active share must not leave orphan share workers; heartbeat timeout triggers cleanup.
- Share worker crash must not affect the underlying terminal session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-026-001**: The system MUST support per-terminal sharing via upterm and tmate backends, selectable at share time.
- **FR-026-002**: The system MUST enforce a deny-by-default policy gate before any share worker starts, integrating with spec 023 approval gates.
- **FR-026-003**: The system MUST generate share links with a configurable TTL (default and per-request).
- **FR-026-004**: The system MUST auto-terminate share sessions on TTL expiry and issue grace period warnings before expiry.
- **FR-026-005**: The system MUST support TTL extension via explicit operator action.
- **FR-026-006**: The system MUST enforce a configurable concurrent share limit per terminal.
- **FR-026-007**: The system MUST provide revoke controls that disconnect participants within 5 seconds.
- **FR-026-008**: The system MUST support human-to-AI and AI-to-human terminal handoff with context preservation.
- **FR-026-009**: The system MUST start share workers on demand (no background daemon per terminal).
- **FR-026-010**: The system MUST display share status badges in the lane panel for active shares.
- **FR-026-011**: The system MUST record every share action (start, stop, extend, revoke, handoff) as an audit event with correlation IDs via spec 024.

### Non-Functional Requirements

- **NFR-026-001**: Share link generation MUST complete within 3 seconds (p95) after policy approval.
- **NFR-026-002**: Share worker startup MUST NOT increase baseline memory by more than 15 MB per active share.
- **NFR-026-003**: Revoke-to-disconnect latency MUST be < 5 seconds (p95).
- **NFR-026-004**: Share worker crash MUST NOT affect the host terminal PTY or other terminals.

### Dependencies

- **Spec 002** (Local Bus): Share lifecycle events are dispatched and observed via the bus.
- **Spec 009** (Zellij Sessions): Share targets are zellij-managed terminal sessions.
- **Spec 023** (Policy/Approval Gates): Share requests pass through policy evaluation.
- **Spec 024** (Audit Logging): All share actions are recorded in the audit log.

## Key Entities

- **Share Session**: A time-limited, policy-gated sharing instance binding a terminal to a share backend (upterm or tmate).
- **Share Worker**: An on-demand process managing the share backend connection for a single terminal.
- **Share Link**: A generated URI or command granting access to a shared terminal, scoped by TTL and permissions.
- **Handoff**: A directed transfer of terminal control between a human operator and an AI agent (or vice versa).
- **Policy Gate**: Deny-by-default evaluation checkpoint that must approve before share activation.

## Success Criteria *(mandatory)*

- **SC-026-001**: Share link generation succeeds within 3s in 95% of test runs after policy approval.
- **SC-026-002**: TTL expiry auto-terminates 100% of share sessions without manual intervention in lifecycle tests.
- **SC-026-003**: Human-to-AI handoff preserves working directory and environment context in 100% of handoff tests.
- **SC-026-004**: No orphan share workers remain after share revocation or terminal close in 100% of chaos tests.
- **SC-026-005**: Every share action produces a correlated audit event verified by audit log inspection.

## Assumptions

- upterm and tmate binaries are available on the host system or bundled with the app.
- Policy gate infrastructure (spec 023) is operational before share workflows are enabled.
- Share sessions are local-network or SSH-tunneled; cloud relay is out of scope for initial implementation.
- Handoff context preservation covers working directory, environment variables, and scrollback; full process state transfer is deferred to zmx integration.
