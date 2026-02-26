# Data Model (Discovery Draft)

## Entities

### Entity: Workspace
- **Description**: Local operating boundary that groups projects, lanes, and active runtime settings.
- **Attributes**:
  - `workspace_id` (string)
  - `name` (string)
  - `root_paths` (string[])
  - `active_renderer_mode` (enum: `mode_a`, `mode_b`)
  - `created_at` (datetime)
  - `updated_at` (datetime)
- **Identifiers**: `workspace_id`
- **Lifecycle Notes**: Created once, updated as settings/context change.

### Entity: Lane
- **Description**: Isolated execution track for a scoped unit of work.
- **Attributes**:
  - `lane_id` (string)
  - `workspace_id` (string)
  - `project_context_id` (string)
  - `status` (enum: `new`, `provisioning`, `ready`, `running`, `blocked`, `error`, `closed`)
  - `provider_profile` (string)
  - `created_at` (datetime)
  - `updated_at` (datetime)
- **Identifiers**: `lane_id`
- **Lifecycle Notes**: Created/attached/cleaned up through lane lifecycle actions.

### Entity: Session
- **Description**: Active Codex runtime context linked to a lane.
- **Attributes**:
  - `session_id` (string)
  - `lane_id` (string)
  - `codex_session_id` (string)
  - `transport` (enum: `cliproxy_harness`, `native_openai`)
  - `status` (enum: `detached`, `attaching`, `attached`, `terminated`)
  - `last_heartbeat_at` (datetime)
- **Identifiers**: `session_id`, `codex_session_id`
- **Lifecycle Notes**: In-memory state for slice-1; continuity from Codex session IDs.

### Entity: TerminalInstance
- **Description**: Interactive PTY terminal mapped to workspace/lane/session context.
- **Attributes**:
  - `terminal_id` (string)
  - `workspace_id` (string)
  - `lane_id` (string)
  - `session_id` (string)
  - `title` (string)
  - `state` (enum: `idle`, `spawning`, `active`, `throttled`, `closed`)
  - `last_output_seq` (integer)
- **Identifiers**: `terminal_id`
- **Lifecycle Notes**: Spawned and tracked in registry; terminated on lane/session close.

### Entity: HarnessStatus
- **Description**: Health and routing status for `cliproxyapi++` harness.
- **Attributes**:
  - `harness_id` (string)
  - `status` (enum: `healthy`, `degraded`, `unavailable`)
  - `last_check_at` (datetime)
  - `degrade_reason` (string|null)
  - `fallback_transport` (enum: `native_openai`)
- **Identifiers**: `harness_id`
- **Lifecycle Notes**: Continuously evaluated; drives route selection and diagnostics.

### Entity: OrchestrationEnvelope
- **Description**: Normalized command/response/event contract with correlation metadata.
- **Attributes**:
  - `envelope_id` (string)
  - `correlation_id` (string)
  - `topic` (string)
  - `method` (string|null)
  - `workspace_id` (string)
  - `lane_id` (string|null)
  - `session_id` (string|null)
  - `payload` (object)
  - `timestamp` (datetime)
- **Identifiers**: `envelope_id`, `correlation_id`
- **Lifecycle Notes**: Immutable log/event object; ordered for lifecycle-critical transitions.

### Entity: LifecycleAuditEvent
- **Description**: Auditable operation record for lane/session/agent actions.
- **Attributes**:
  - `audit_event_id` (string)
  - `correlation_id` (string)
  - `event_type` (string)
  - `actor` (string)
  - `result` (enum: `success`, `failure`)
  - `details` (object)
  - `recorded_at` (datetime)
- **Identifiers**: `audit_event_id`
- **Lifecycle Notes**: Append-only event stream.

## Relationships

| Source | Relation | Target | Cardinality | Notes |
|--------|----------|--------|-------------|-------|
| Workspace | contains | Lane | 1:N | Lanes belong to a single workspace |
| Lane | has | Session | 1:N | Lane may host multiple sessions over time |
| Session | owns | TerminalInstance | 1:N | Terminals map to active session context |
| Session | routes_via | HarnessStatus | N:1 | Sessions use harness when healthy else fallback |
| OrchestrationEnvelope | references | Workspace/Lane/Session | N:1 | Envelope includes context IDs for traceability |
| LifecycleAuditEvent | references | OrchestrationEnvelope | N:1 | Audit events correlate back to envelopes |

## Validation & Governance

- **Data quality requirements**:
  - IDs must be stable and unique in active runtime scope.
  - Session, lane, and terminal transitions must follow valid state machine edges.
  - Correlation IDs required for all lifecycle-critical commands/events.
- **Compliance considerations**:
  - No secrets or credential payloads in audit event fields.
  - Failure details should be diagnostic but sanitized.
- **Source of truth**:
  - Runtime state in memory (slice-1).
  - Protocol schema in `specs/protocol/v1/`.
  - Planning artifacts in `kitty-specs/001-colab-agent-terminal-control-plane/`.
