# Functional Requirements — heliosApp

**Version:** 2.0
**Status:** Active
**Date:** 2026-03-26
**Traces to:** PRD.md epics E1–E9

---

## Categories

| Code | Domain |
|------|--------|
| LANE | Lane, session, and workspace orchestration |
| UI | Desktop shell and terminal UI |
| INF | Inference engine and provider routing |
| SEC | Secrets vault and credential redaction |
| POL | Policy engine and approval workflow |
| AUD | Audit ledger and session recovery |
| SHARE | Terminal sharing |
| CONF | Configuration, feature flags, and settings |
| QUAL | Quality gates and toolchain |

---

## LANE — Lane and Session Orchestration

### FR-LANE-001: Workspace Entity Lifecycle

**Priority**: SHALL
**Description**: The runtime SHALL enforce a formal workspace lifecycle with valid state transitions only.
**Acceptance Criteria**:
- [ ] `createWorkspace` rejects empty names and non-absolute `rootPath` values
- [ ] `openWorkspace` requires state `closed`; throws otherwise
- [ ] `closeWorkspace` requires state `active`; throws otherwise
- [ ] `deleteWorkspace` requires zero active sessions; throws otherwise
- [ ] Bus events emitted: `workspace.created`, `workspace.opened`, `workspace.closed`, `workspace.deleted`
**Traces to**: E1.1
**Key Code**: `apps/runtime/src/workspace/workspace.ts`, `workspace/types.ts`
**Status**: Implemented

---

### FR-LANE-002: Lane State Machine Enforcement

**Priority**: SHALL
**Description**: Lane lifecycle SHALL be enforced by an explicit state machine rejecting invalid transitions.
**Acceptance Criteria**:
- [ ] Valid states: `new`, `provisioning`, `ready`, `running`, `blocked`, `shared`, `failed`, `cleaning`, `closed`
- [ ] Invalid transitions throw a typed error at the state machine boundary
- [ ] Closed lanes return `LANE_CLOSED` error on terminal spawn attempts
- [ ] State change published to bus on every valid transition
**Traces to**: E1.2
**Key Code**: `apps/runtime/src/sessions/state_machine.ts`, `lanes/state_machine.ts`
**Status**: Implemented

---

### FR-LANE-003: Lane Create API

**Priority**: SHALL
**Description**: `POST /v1/workspaces/:wid/lanes` SHALL create a lane and associate it with the workspace.
**Acceptance Criteria**:
- [ ] Returns `{ lane_id }` with HTTP 201 on success
- [ ] `lane_id` derived from `display_name`, `project_context_id`, or timestamp
- [ ] Workspace association persisted in `laneWorkspace` map for cross-workspace validation
**Traces to**: E1.2
**Key Code**: `apps/runtime/src/index.ts` (lane create route)
**Status**: Implemented

---

### FR-LANE-004: Session Attach with Transport Negotiation

**Priority**: SHALL
**Description**: Session attach SHALL negotiate transport between cliproxy harness and native OpenAI fallback based on harness health probe.
**Acceptance Criteria**:
- [ ] `harnessProbe.check()` result determines `transport` field in response
- [ ] Harness unavailable: `transport = "native_openai"`, `degrade_reason` set
- [ ] `harness.status.changed` event published when harness is unavailable
- [ ] `invalid_preferred_transport` error returned for unrecognized transport values
- [ ] Session status `attached` returned on success
**Traces to**: E1.3
**Key Code**: `apps/runtime/src/index.ts` (session attach route)
**Status**: Implemented

---

### FR-LANE-005: PAR Lane Group Registry

**Priority**: SHALL
**Description**: The runtime SHALL support PAR lane groups for parallel multi-lane execution within a workspace.
**Acceptance Criteria**:
- [ ] PAR registry tracks member lanes per group
- [ ] Commands routed to all PAR members in parallel via bus
- [ ] Individual member failure does not terminate surviving members
- [ ] PAR group state derived from aggregate of member states
**Traces to**: E1.4
**Key Code**: `apps/runtime/src/lanes/par.ts`, `lanes/registry.ts`, `lanes/par-types.ts`
**Status**: Partial

---

### FR-LANE-006: Lane Cleanup API

**Priority**: SHALL
**Description**: `POST /v1/workspaces/:wid/lanes/:lid/cleanup` SHALL close a lane and prevent further resource allocation on it.
**Acceptance Criteria**:
- [ ] Lane added to `closedLanes` set after cleanup
- [ ] Subsequent terminal spawn returns HTTP 409 with `lane_closed` error
- [ ] Response: `{ ok: true }` on success
**Traces to**: E1.5
**Key Code**: `apps/runtime/src/index.ts` (cleanup route)
**Status**: Implemented

---

### FR-LANE-007: Terminal Spawn API

**Priority**: SHALL
**Description**: `POST /v1/workspaces/:wid/lanes/:lid/terminals` SHALL spawn a PTY-backed terminal associated with the lane and session.
**Acceptance Criteria**:
- [ ] Terminal entry created with `active` state
- [ ] Terminal buffer initialized with zero bytes
- [ ] Cross-workspace terminal spawn returns HTTP 409
- [ ] Returns `{ terminal_id, lane_id, session_id, state }` with HTTP 201
**Traces to**: E1.2
**Key Code**: `apps/runtime/src/index.ts` (terminal spawn route)
**Status**: Implemented

---

### FR-LANE-008: Terminal Input and Output Buffering

**Priority**: SHALL
**Description**: Terminal input SHALL be buffered with sequence numbers, and buffer overflow SHALL throttle the terminal and emit a state-changed event.
**Acceptance Criteria**:
- [ ] Each input appended to buffer with monotonically increasing `output_seq`
- [ ] Buffer cap configurable via `terminalBufferCapBytes`; defaults to unlimited
- [ ] Overflow sets terminal state to `throttled` and emits `terminal.state.changed`
- [ ] `getTerminalBuffer` returns entries, `total_bytes`, and `dropped_bytes`
**Traces to**: E1.2
**Key Code**: `apps/runtime/src/index.ts` (`appendOutputEvent`), `sessions/terminal_buffer.ts`
**Status**: Implemented

---

### FR-LANE-009: Terminal Resize

**Priority**: SHALL
**Description**: Terminal dimensions SHALL be resizable at runtime, resetting throttled state to active.
**Acceptance Criteria**:
- [ ] Resize sets terminal state to `active`
- [ ] `terminal.state.changed` event published with `cols` and `rows`
- [ ] Unknown terminal ID returns `TERMINAL_NOT_FOUND` error
**Traces to**: E1.2
**Key Code**: `apps/runtime/src/index.ts` (`resizeTerminal`)
**Status**: Implemented

---

### FR-LANE-010: Harness Status Endpoint

**Priority**: SHALL
**Description**: `GET /v1/harness/cliproxy/status` SHALL return the current health of the cliproxy harness.
**Acceptance Criteria**:
- [ ] Returns `{ status: "healthy" | "unavailable", degrade_reason }` with HTTP 200
- [ ] `degrade_reason` null when healthy; reason string when unavailable
**Traces to**: E1.3
**Key Code**: `apps/runtime/src/index.ts` (harness status route)
**Status**: Implemented

---

## UI — Desktop Shell and Terminal UI

### FR-UI-001: Lane Panel Rendering

**Priority**: SHALL
**Description**: The desktop shell SHALL render a panel per lane showing state badge, action buttons, and event handler bindings.
**Acceptance Criteria**:
- [ ] `lane_panel.ts` renders `status_badge` reflecting lane lifecycle state
- [ ] Action buttons bound via `lane_actions.ts`
- [ ] `lane_event_handler.ts` processes lane events and updates panel
- [ ] Keyboard navigation across lanes via `keyboard_nav.ts`
- [ ] Empty state rendered when no lanes exist
**Traces to**: E2.1
**Key Code**: `apps/desktop/src/panels/`
**Status**: Implemented

---

### FR-UI-002: Active Context Store Dispatch

**Priority**: SHALL
**Description**: The desktop context store SHALL track workspace/lane/session/terminal state and support typed action dispatch.
**Acceptance Criteria**:
- [ ] `ActiveContextState` includes: workspaceId, laneId, sessionId, terminalId, activeTab,
  runtimeState, transport diagnostics, operation loading states (lane/session/terminal/
  renderer), and renderer switch status
- [ ] `dispatch` produces correct state for all defined action types
- [ ] Trace log appended on each dispatched action
**Traces to**: E2.2
**Key Code**: `apps/desktop/src/context_store.ts`
**Status**: Implemented

---

### FR-UI-003: Renderer Engine Hot-Swap

**Priority**: SHALL
**Description**: The desktop SHALL support switching the terminal renderer engine (Ghostty/Rio) with automatic rollback on failure.
**Acceptance Criteria**:
- [ ] `switchRendererWithRollback` dispatches `renderer.switch.started`, then
  `renderer.switch.succeeded` or `renderer.switch.failed`
- [ ] Failure triggers rollback to previous engine; `renderer.switch.rolled_back` dispatched
- [ ] Context store `rendererSwitch` reflects in-flight/succeeded/failed/rolled_back states
- [ ] Settings UI exposes engine selection and hot-swap toggle
**Traces to**: E2.3
**Key Code**: `apps/desktop/src/settings.ts`, `settings/hotswap_toggle.ts`
**Status**: Implemented

---

### FR-UI-004: Conversation Persistence on Startup

**Priority**: SHALL
**Description**: Persisted conversation history SHALL be loaded during application initialization.
**Acceptance Criteria**:
- [ ] `initializeApp()` calls `loadPersistedConversations()`
- [ ] Loaded conversations available before first user interaction
**Traces to**: E2.5
**Key Code**: `apps/desktop/src/init.ts`, `stores/persistence.store.ts`
**Status**: Implemented

---

### FR-UI-005: Model Selector Component

**Priority**: SHALL
**Description**: The chat panel SHALL include a model selector allowing the user to choose the active inference engine and model.
**Acceptance Criteria**:
- [ ] `ModelSelector.tsx` lists models from runtime inference registry
- [ ] Selection change updates active session configuration
- [ ] Currently selected model displayed in component
**Traces to**: E2.6
**Key Code**: `apps/desktop/src/components/chat/ModelSelector.tsx`
**Status**: Implemented

---

### FR-UI-006: Approval Panel

**Priority**: SHALL
**Description**: The approval panel SHALL list pending policy-gated commands with approve/reject actions.
**Acceptance Criteria**:
- [ ] `ApprovalPanel.tsx` displays all queued commands with risk classification
- [ ] Approve dispatches the command via runtime client
- [ ] Reject accepts a reason string and emits rejection event
- [ ] `ApprovalWorkflow.tsx` page wraps the panel for full-screen access
**Traces to**: E5.4
**Key Code**: `apps/desktop/src/components/approval/ApprovalPanel.tsx`,
  `apps/desktop/src/pages/ApprovalWorkflow.tsx`
**Status**: Implemented

---

### FR-UI-007: Tab Navigation

**Priority**: SHALL
**Description**: The desktop shell SHALL support tab-based navigation between terminal, agent, session, chat, and project views.
**Acceptance Criteria**:
- [ ] `ActiveTab` type covers: `terminal`, `agent`, `session`, `chat`, `project`
- [ ] Active tab reflected in context store and URL/routing state
- [ ] Tab switch does not reset lane or session selection
**Traces to**: E2.2
**Key Code**: `apps/desktop/src/context_store.ts` (`ActiveTab`), `tabs/`
**Status**: Implemented

---

## INF — Inference Engine and Provider Routing

### FR-INF-001: InferenceEngine Interface Compliance

**Priority**: SHALL
**Description**: All inference adapters SHALL implement the `InferenceEngine` interface without modification.
**Acceptance Criteria**:
- [ ] Interface exports: `id`, `name`, `type` (`local`|`cloud`|`server`), `init()`,
  `infer()`, `inferStream()`, `listModels()`, `healthCheck()`, `terminate()`
- [ ] `healthCheck()` returns `"healthy" | "degraded" | "unavailable"`
- [ ] `inferStream()` returns `AsyncIterable<string>`
**Traces to**: E3.1
**Key Code**: `apps/runtime/src/integrations/inference/engine.ts`
**Status**: Implemented

---

### FR-INF-002: Anthropic Adapter API Key Resolution

**Priority**: SHALL
**Description**: The Anthropic adapter SHALL resolve the API key from `HELIOS_ACP_API_KEY` or `ANTHROPIC_API_KEY` and throw on missing key.
**Acceptance Criteria**:
- [ ] `init()` throws if no API key present with descriptive message
- [ ] Default model `claude-sonnet-4-20250514` used when no model specified
- [ ] Streaming via `inferStream()` supported
- [ ] Request sent to `https://api.anthropic.com/v1/messages` with `anthropic-version: 2023-06-01`
**Traces to**: E3.2
**Key Code**: `apps/runtime/src/integrations/inference/anthropic-adapter.ts`
**Status**: Implemented

---

### FR-INF-003: Local Model Adapters

**Priority**: SHOULD
**Description**: The runtime SHOULD support local model inference via MLX (Apple Silicon), llama.cpp (CPU/GPU), and vLLM (server).
**Acceptance Criteria**:
- [ ] `MlxInferenceEngine`, `LlamacppInferenceEngine`, `VllmInferenceEngine` each implement
  `InferenceEngine`
- [ ] `type` field set to `"local"` for MLX/llama.cpp, `"server"` for vLLM
- [ ] `healthCheck()` probes the backend process/endpoint
- [ ] `terminate()` stops managed processes cleanly
**Traces to**: E3.3, E3.4, E3.5
**Key Code**: `apps/runtime/src/integrations/inference/{mlx,llamacpp,vllm}-adapter.ts`
**Status**: Partial

---

### FR-INF-004: Inference Registry

**Priority**: SHALL
**Description**: The runtime SHALL maintain a registry of available inference engines for discovery and routing.
**Acceptance Criteria**:
- [ ] Registry supports register, lookup by ID, and list-all operations
- [ ] Health status per engine updated by background monitor
- [ ] Routing prefers healthy engines; degraded engines used only as fallback
**Traces to**: E3.1
**Key Code**: `apps/runtime/src/integrations/inference/registry.ts`
**Status**: Partial

---

### FR-INF-005: MCP Tool Call

**Priority**: SHALL
**Description**: The runtime SHALL support tool calls via the Model Context Protocol adapter.
**Acceptance Criteria**:
- [ ] `McpAdapter.callTool(serverId, toolName, args)` dispatches the call
- [ ] Unknown server returns typed error
- [ ] Tool results returned as-is to calling agent
**Traces to**: E3.6
**Key Code**: `apps/runtime/src/integrations/mcp/adapter.ts`
**Status**: Implemented

---

### FR-INF-006: A2A Task Delegation

**Priority**: SHALL
**Description**: The runtime SHALL support agent-to-agent task delegation via the A2A protocol.
**Acceptance Criteria**:
- [ ] `A2aAdapter.delegateTask(targetAgentId, payload)` returns `{ delegationId }`
- [ ] Delegation event published to local bus
**Traces to**: E3.7
**Key Code**: `apps/runtime/src/integrations/a2a/adapter.ts`
**Status**: Implemented

---

## SEC — Secrets Vault and Credential Redaction

### FR-SEC-001: Encrypted Credential Storage

**Priority**: SHALL
**Description**: The credential store SHALL encrypt all stored API keys and secrets before writing to disk.
**Acceptance Criteria**:
- [ ] `CredentialStore` uses `EncryptionService` for all reads and writes
- [ ] Access requires `CredentialAccessContext` with `requestingProviderId` and `workspaceId`
- [ ] `CredentialAccessDeniedError` thrown on unauthorized access
- [ ] `CredentialAlreadyExistsError` thrown on duplicate credential name
- [ ] Bus event published for every access (granted or denied)
**Traces to**: E4.1
**Key Code**: `apps/runtime/src/secrets/credential-store.ts`, `secrets/encryption.ts`
**Status**: Implemented

---

### FR-SEC-002: Secret Redaction in Audit Payloads

**Priority**: SHALL
**Description**: All bus event payloads written to the audit log SHALL have API key fields replaced with `[REDACTED]`.
**Acceptance Criteria**:
- [ ] `sanitizePayload` replaces any key containing `api_key` (case-insensitive) with `[REDACTED]`
- [ ] Non-matching keys pass through unmodified
- [ ] Applied before writing to `InMemoryAuditSink` and before `exportAuditBundle` returns
**Traces to**: E4.2
**Key Code**: `apps/runtime/src/index.ts` (`sanitizePayload`)
**Status**: Implemented

---

### FR-SEC-003: Redaction Engine Rules

**Priority**: SHALL
**Description**: The redaction engine SHALL apply a configurable set of regex rules to scan PTY output and text artifacts for secret patterns.
**Acceptance Criteria**:
- [ ] `RedactionEngine` runs rules from `redaction-rules.ts` in sequence
- [ ] `RedactionResult` includes `redacted` string, `matches` with position/length/category,
  and `latencyMs`
- [ ] Per-rule `falsePositiveRate` tracked in `RedactionStats`
- [ ] Individual rules can be disabled without removing them
**Traces to**: E4.2
**Key Code**: `apps/runtime/src/secrets/redaction-engine.ts`, `secrets/redaction-rules.ts`
**Status**: Implemented

---

### FR-SEC-004: Protected Paths Detection

**Priority**: SHALL
**Description**: Commands affecting protected file paths (`.env`, credential files, key stores) SHALL be flagged for elevated policy classification.
**Acceptance Criteria**:
- [ ] `ProtectedPathsDetector` matches command arguments against configured path patterns
- [ ] Matches cause classification to be elevated to `NeedsApproval` or `Blocked`
- [ ] Protected path config loaded from `protected-paths-config.ts`
**Traces to**: E4.3
**Key Code**: `apps/runtime/src/secrets/protected-paths-detector.ts`,
  `secrets/protected-paths-config.ts`, `secrets/protected-paths-matching.ts`
**Status**: Implemented

---

### FR-SEC-005: Secrets Audit Trail

**Priority**: SHALL
**Description**: Every credential access attempt SHALL be logged with outcome, requester identity, and timestamp.
**Acceptance Criteria**:
- [ ] `audit-trail.ts` writes entry for every access with `outcome` (`granted`|`denied`),
  `requestingProviderId`, `workspaceId`, and ISO timestamp
- [ ] Entries queryable by `workspaceId` and `providerId`
**Traces to**: E4.4
**Key Code**: `apps/runtime/src/secrets/audit-trail.ts`
**Status**: Implemented

---

## POL — Policy Engine and Approval Workflow

### FR-POL-001: Policy Rule Data Model

**Priority**: SHALL
**Description**: Policy rules SHALL have a typed data model with unique IDs, pattern type, classification, scope, and priority.
**Acceptance Criteria**:
- [ ] `PolicyRule` fields: `id`, `pattern`, `patternType` (`glob`|`regex`), `classification`
  (`safe`|`needs-approval`|`blocked`), `scope` (workspace ID), `priority`, `description`,
  `targets?`, `createdAt`, `updatedAt`
- [ ] `PolicyRuleInput` omits computed timestamp fields
**Traces to**: E5.1
**Key Code**: `apps/runtime/src/policy/types.ts`
**Status**: Implemented

---

### FR-POL-002: Policy Rule Storage with Live Reload

**Priority**: SHALL
**Description**: Policy rules SHALL be stored per workspace and reload automatically when the rule file changes on disk.
**Acceptance Criteria**:
- [ ] `PolicyStorage` watches workspace rule files via filesystem watcher
- [ ] `onRulesChanged(workspaceId, rules)` callback fires on modification
- [ ] `getRuleSet(workspaceId)` returns latest parsed `PolicyRuleSet`
- [ ] Rule cache invalidated on file change
**Traces to**: E5.1
**Key Code**: `apps/runtime/src/policy/storage.ts`
**Status**: Implemented

---

### FR-POL-003: Policy Evaluation Result

**Priority**: SHALL
**Description**: Command evaluation SHALL return a typed result with classification, matched rules, evaluation latency, and deny-by-default flag.
**Acceptance Criteria**:
- [ ] `PolicyEvaluationResult` includes `classification`, `matchedRules`, `evaluationMs`,
  `deniedByDefault`
- [ ] `CommandContext` includes `workspaceId`, `agentId`, `affectedPaths?`, `isDirect`
- [ ] `canExecuteDirectly`, `needsApproval`, `isBlocked` derived from result
**Traces to**: E5.2
**Key Code**: `apps/runtime/src/policy/engine.ts`, `policy/types.ts`
**Status**: Implemented

---

### FR-POL-004: Approval Queue Lifecycle

**Priority**: SHALL
**Description**: Commands classified as `needs-approval` SHALL be queued for human review with approve and reject actions.
**Acceptance Criteria**:
- [ ] Approval queue enqueues command with ID, classification, and context
- [ ] Approve action dispatches the original command envelope to the bus
- [ ] Reject action accepts a `reason` string and emits a rejection event
- [ ] Queue depth observable from runtime state
**Traces to**: E5.3
**Key Code**: `apps/runtime/src/policy/approval-queue.ts`
**Status**: Implemented

---

## AUD — Audit Ledger and Session Recovery

### FR-AUD-001: Audit Sink Write and Flush

**Priority**: SHALL
**Description**: The audit sink SHALL write every bus envelope with outcome, sequence, and reason, and support explicit flush.
**Acceptance Criteria**:
- [ ] `AuditSink.write(event)` appends to ring buffer with `sequence`, `outcome`
  (`accepted`|`rejected`), and `reason`
- [ ] `flush()` drains pending entries to storage
- [ ] `getBufferedCount()` returns current buffer depth
- [ ] `getMetrics()` returns `totalEventsWritten`, `bufferHighWaterMark`,
  `persistenceFailures`, `retryCount`
**Traces to**: E6.1
**Key Code**: `apps/runtime/src/audit/sink.ts`, `audit/ring-buffer.ts`
**Status**: Implemented

---

### FR-AUD-002: Audit Bundle Export with Redaction

**Priority**: SHALL
**Description**: Audit bundles exported by correlation ID SHALL have sensitive payloads redacted before returning to callers.
**Acceptance Criteria**:
- [ ] `exportAuditBundle({ correlation_id })` filters events by correlation ID
- [ ] `api_key` fields in payloads replaced with `[REDACTED]` via `sanitizePayload`
- [ ] Bundle includes `count` and `records` with `type`, `topic`, `payload`, `recorded_at`
**Traces to**: E6.2
**Key Code**: `apps/runtime/src/index.ts` (`exportAuditBundle`)
**Status**: Implemented

---

### FR-AUD-003: Recovery Metadata Export

**Priority**: SHALL
**Description**: The runtime SHALL export serializable recovery metadata covering all active lanes, sessions, and terminals without pausing bus dispatch.
**Acceptance Criteria**:
- [ ] `exportRecoveryMetadata()` returns `{ lanes, sessions, terminals }` in serializable form
- [ ] Safe to call concurrently with active bus dispatch
- [ ] Session status included per entry
**Traces to**: E6.3
**Key Code**: `apps/runtime/src/index.ts` (`exportRecoveryMetadata`)
**Status**: Implemented

---

### FR-AUD-004: Bootstrap Recovery Classification

**Priority**: SHALL
**Description**: On restart with recovery metadata, the runtime SHALL classify entities into recoverable and unrecoverable issues.
**Acceptance Criteria**:
- [ ] Detached sessions: `unrecoverable`, `cleanup` remediation
- [ ] Lanes with missing sessions: `recoverable`, `reconcile` remediation
- [ ] Terminals with missing sessions: `unrecoverable`, `cleanup` remediation
- [ ] `getBootstrapResult()` returns result after `bootstrapRecovery(metadata)` call
- [ ] `getOrphanReport()` returns issues list for external inspection
**Traces to**: E6.4
**Key Code**: `apps/runtime/src/index.ts` (`classifyBootstrap`, `bootstrapRecovery`)
**Status**: Implemented

---

### FR-AUD-005: Retention Policy Enforcement

**Priority**: SHALL
**Description**: Audit ring buffers SHALL enforce configurable retention limits on event count and age.
**Acceptance Criteria**:
- [ ] `createRetentionPolicyConfig` produces typed config with `maxEvents` and `maxAgeMs`
- [ ] Ring buffer enforces limits on every write
- [ ] Overflowed entries counted in `eventsOverflowed` metric
**Traces to**: E8.2
**Key Code**: `apps/runtime/src/config/retention.ts`, `audit/ring-buffer.ts`
**Status**: Implemented

---

## SHARE — Terminal Sharing

### FR-SHARE-001: Share Session State Machine

**Priority**: SHALL
**Description**: Terminal share sessions SHALL follow a formal state machine with states `pending`, `active`, `expired`, `revoked`, and `failed`.
**Acceptance Criteria**:
- [ ] `ShareSession` entity includes `id`, `terminalId`, `backend`, `shareLink`, `state`,
  `ttlMs`, `workerPid`, `correlationId`, `createdAt`, `expiresAt`
- [ ] State transitions are atomic; invalid transitions throw
- [ ] TTL expiry triggers transition to `expired`
**Traces to**: E7.1
**Key Code**: `apps/runtime/src/integrations/sharing/share-session.ts`
**Status**: Implemented

---

### FR-SHARE-002: tmate and upterm Backend Adapters

**Priority**: SHALL
**Description**: The sharing module SHALL support both tmate and upterm as interchangeable backends.
**Acceptance Criteria**:
- [ ] `TmateAdapter` and `UptermAdapter` both satisfy a common backend interface
- [ ] Both spawn an external process; worker PID tracked for cleanup
- [ ] Share link extracted from process output
- [ ] `revoke()` terminates the worker process
**Traces to**: E7.2, E7.3
**Key Code**: `apps/runtime/src/integrations/tmate/adapter.ts`,
  `integrations/upterm/adapter.ts`
**Status**: Implemented

---

### FR-SHARE-003: Policy Gate for Sharing

**Priority**: SHALL
**Description**: Terminal sharing SHALL require policy approval before a share link is issued.
**Acceptance Criteria**:
- [ ] Share action evaluated against `PolicyEngine` before spawning backend worker
- [ ] `NeedsApproval` classification queues the share request in approval queue
- [ ] Rejected share emits revocation event without spawning worker
**Traces to**: E7.4
**Key Code**: `apps/runtime/src/integrations/sharing/share-session.ts` (FR-026-003)
**Status**: Partial

---

## CONF — Configuration and Settings

### FR-CONF-001: Runtime Config Validation

**Priority**: SHALL
**Description**: The config module SHALL validate required fields at startup and throw descriptive errors for missing values.
**Acceptance Criteria**:
- [ ] Required fields throw on missing value with field name in message
- [ ] Optional fields apply defaults without error
- [ ] Config accessible to all runtime subsystems without circular imports
**Traces to**: E8.1
**Key Code**: `apps/runtime/src/config/`
**Status**: Partial

---

### FR-CONF-002: Desktop Renderer Preferences

**Priority**: SHALL
**Description**: Renderer engine preference (Ghostty vs Rio) and hot-swap setting SHALL be persisted and restored.
**Acceptance Criteria**:
- [ ] `DesktopSettings.rendererEngine` defaults to `"ghostty"`
- [ ] `DesktopSettings.hotSwapPreferred` defaults to `true`
- [ ] Settings persisted to disk; loaded on application start
- [ ] Settings UI renders in `settings/renderer_preferences.ts`
**Traces to**: E8.3
**Key Code**: `apps/desktop/src/settings.ts`, `settings/renderer_preferences.ts`
**Status**: Implemented

---

## QUAL — Quality Gates and Toolchain

### FR-QUAL-001: Biome Lint Gate

**Priority**: SHALL
**Description**: All TypeScript sources SHALL pass `biome check` with zero errors before merge to main.
**Acceptance Criteria**:
- [ ] `bun run lint` (`biome check apps playwright.config.ts tsconfig.json package.json`) exits 0
- [ ] No inline suppression comments without documented justification
- [ ] Lint runs in CI on every pull request
**Traces to**: E9 / quality
**Key Code**: `biome.json`, `package.json` (`lint` script)
**Status**: Partial

---

### FR-QUAL-002: Unit and Integration Test Coverage

**Priority**: SHALL
**Description**: The test suite SHALL maintain >= 80% line coverage across all non-UI modules.
**Acceptance Criteria**:
- [ ] `bun test --coverage` covers `apps/runtime/tests/unit` and `apps/desktop/tests/unit`
- [ ] Integration tests in `apps/runtime/tests/integration` run via Vitest
- [ ] Coverage report artifact published on every CI run
- [ ] Regression below threshold blocks merge
**Traces to**: E9 / quality
**Key Code**: `package.json` (`test:coverage` script)
**Status**: Partial

---

### FR-QUAL-003: Local Bus Latency

**Priority**: SHALL
**Description**: Local bus command-to-response round-trips SHALL complete under 10 ms P99 for fewer than 100 concurrent messages.
**Acceptance Criteria**:
- [ ] P99 < 10 ms measured by integration test harness
- [ ] No message loss confirmed by correlation ID tracking
- [ ] Performance regression test blocks merge if threshold exceeded
**Traces to**: E1.1
**Key Code**: `apps/runtime/tests/integration/`
**Status**: Planned

---

### FR-QUAL-004: E2E Playwright Test Suite

**Priority**: SHOULD
**Description**: End-to-end tests SHALL cover primary user workflows via Playwright.
**Acceptance Criteria**:
- [ ] `bun run test:e2e` runs Playwright suite against the compiled desktop
- [ ] Workflows covered: lane create, session attach, terminal spawn, approval flow
- [ ] Results published as test artifacts
**Traces to**: E9 / quality
**Key Code**: `playwright.config.ts`, `test-results/`
**Status**: Planned

---

### FR-QUAL-005: VitePress Docs Build

**Priority**: SHOULD
**Description**: The documentation site SHALL build successfully via VitePress without broken links.
**Acceptance Criteria**:
- [ ] `bun run docs:build` exits 0 on main branch
- [ ] `docs:index` script generates navigation index before build
- [ ] No broken internal links detected during build
**Traces to**: E9 / quality
**Key Code**: `docs/scripts/generate-doc-index.sh`, `package.json` (`docs:build` script)
**Status**: Partial
