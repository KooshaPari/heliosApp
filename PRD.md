# heliosApp — Product Requirements Document

**Version:** 2.0
**Status:** Active
**Date:** 2026-03-26
**Derived from:** Codebase analysis of `apps/runtime`, `apps/desktop`, `apps/renderer`, `packages/`

---

## Product Vision

heliosApp is an agent-first desktop IDE for developers who run AI coding agents at scale.
It provides a unified terminal-and-chat workspace where multiple parallel agent sessions
("lanes") run simultaneously, each with its own PTY, lifecycle state machine, policy gate,
and runtime bus connection.

The application spans three tiers:

1. **`@helios/runtime`** (`apps/runtime`) — TypeScript runtime owning the in-process message
   bus, session/lane/workspace state machines, terminal buffers, PTY lifecycle, audit ledger,
   secrets vault, credential redaction, policy engine, and pluggable inference engine registry.
2. **`@helios/desktop`** (`apps/desktop`) — SolidJS desktop shell owning lane panels,
   workspace views, approval workflows, renderer-engine settings, and the runtime HTTP client.
3. **`@helios/renderer`** (`apps/renderer`) — SolidJS chat UI, terminal tabs, sidebar, and
   keyboard shortcuts rendered inside the Tauri window.

The long-term goal is a Cursor/Windsurf-quality native desktop experience backed by a
unified inference layer that spans cloud providers (Anthropic), local runtimes (MLX,
llama.cpp), and server deployments (vLLM), with full security governance (secret redaction,
policy-gated command execution, and tamper-evident audit).

---

## Target Users

- **Agent-workflow engineers** — developers who run many simultaneous AI coding sessions and
  need fine-grained control over lane lifecycle, approval gates, and session recovery.
- **AI-assisted developers** — individual engineers who want a native IDE shell wrapping LLM
  chat with real terminal access, model selection, and tool-call visibility.
- **Platform operators** — teams requiring audit trails, secret redaction, and policy gates
  before deploying agent-generated commands in sensitive environments.

---

## Epic Index

| Epic | Title |
|------|-------|
| E1 | Lane and Session Orchestration |
| E2 | Desktop Shell and Terminal UI |
| E3 | Inference Engine and Provider Routing |
| E4 | Secrets Vault and Credential Redaction |
| E5 | Policy Engine and Approval Workflow |
| E6 | Audit Ledger and Session Recovery |
| E7 | Terminal Sharing |
| E8 | Configuration, Feature Flags, and Settings |
| E9 | Canary Dependency Management |

---

## E1: Lane and Session Orchestration

Core runtime feature enabling multiple parallel agent sessions within a workspace.

### Stories

- **E1.1: Workspace CRUD** — As a developer, I need to create, open, close, and delete
  workspaces so I can group related agent lanes by project.
  _Acceptance criteria:_ `createWorkspace` requires a non-empty name and absolute `rootPath`;
  `closeWorkspace` requires `active` state; `deleteWorkspace` requires zero active sessions;
  bus events emitted for each lifecycle transition (`workspace.created`, `workspace.closed`,
  `workspace.deleted`).
  _Key code:_ `apps/runtime/src/workspace/workspace.ts`, `workspace/types.ts`

- **E1.2: Lane Lifecycle State Machine** — As the runtime, I need lanes to transition
  through a formal state machine (`new → provisioning → ready → running → blocked → shared
  → cleaning → closed`) so invalid transitions are rejected.
  _Acceptance criteria:_ Invalid transitions throw; closed lanes reject terminal spawns with
  `LANE_CLOSED`; lane state published to bus on every transition.
  _Key code:_ `apps/runtime/src/sessions/state_machine.ts`, `lanes/state_machine.ts`

- **E1.3: Session Attach and Detach** — As a lane, I need to attach and detach from a
  Codex session using transport negotiation (cliproxy harness vs native OpenAI fallback).
  _Acceptance criteria:_ Session attach probes `harnessProbe` health; resolved transport
  (`cliproxy_harness` or `native_openai`) returned in session response; harness
  unavailability emits `harness.status.changed` event with `degrade_reason`.
  _Key code:_ `apps/runtime/src/index.ts` (session attach route), `sessions/`

- **E1.4: PAR Lane Groups** — As a developer, I need to run parallel groups of lanes where
  all members execute concurrently within the same workspace.
  _Acceptance criteria:_ PAR registry tracks member lanes; bus routes commands to all
  members in parallel; individual member failures do not stop surviving members.
  _Key code:_ `apps/runtime/src/lanes/par.ts`, `lanes/registry.ts`

- **E1.5: Lane Cleanup** — As the runtime, I need a cleanup route that marks a lane closed
  and prevents further terminal spawns on it.
  _Acceptance criteria:_ `POST /v1/workspaces/:wid/lanes/:lid/cleanup` sets lane to
  `LANE_CLOSED`; subsequent terminal spawn returns 409; bus event emitted.
  _Key code:_ `apps/runtime/src/index.ts` (cleanup route)

---

## E2: Desktop Shell and Terminal UI

Native Tauri desktop application providing the primary developer interface.

### Stories

- **E2.1: Lane Panel Display** — As a developer, I need a panel for each lane showing its
  lifecycle state, last action, and quick-action buttons.
  _Acceptance criteria:_ `lane_panel.ts` renders lane state badge, action buttons, and event
  handler; empty lane list shows empty state; keyboard navigation works between panels.
  _Key code:_ `apps/desktop/src/panels/lane_panel.ts`, `panels/lane_list_item.ts`,
  `panels/status_badge.ts`

- **E2.2: Active Context Store** — As the desktop shell, I need a context store tracking
  the active workspace, lane, session, terminal, and tab so all panels stay in sync.
  _Acceptance criteria:_ `ActiveContextState` covers workspace/lane/session/terminal IDs,
  active tab, runtime state, transport diagnostics, operation loading states, and renderer
  switch status; dispatched actions produce correct state transitions.
  _Key code:_ `apps/desktop/src/context_store.ts`

- **E2.3: Renderer Engine Hot-Swap** — As a developer, I need to switch the terminal
  renderer engine between Ghostty and Rio at runtime without restarting the application.
  _Acceptance criteria:_ `switchRendererWithRollback` switches engine and rolls back on
  failure; `rendererSwitch` state in context store tracks in-flight/succeeded/failed/
  rolled_back states; settings UI exposes the toggle.
  _Key code:_ `apps/desktop/src/settings.ts`, `settings/hotswap_toggle.ts`,
  `settings/renderer_settings.ts`

- **E2.4: Terminal Rendering (xterm.js)** — As a developer, I need a terminal component
  rendering PTY output with ANSI support, URL linking, and auto-fit to window dimensions.
  _Acceptance criteria:_ xterm.js renders all standard ANSI color codes; `addon-fit` resizes
  columns/rows on window resize; `addon-web-links` makes URLs in terminal output clickable.
  _Key code:_ `apps/renderer/` (xterm component), `package.json` (`@xterm/*` deps)

- **E2.5: Conversation History Persistence** — As a developer, I need chat conversation
  history persisted to disk and restored across application restarts.
  _Acceptance criteria:_ `loadPersistedConversations` in `stores/persistence.store.ts`
  restores conversations on `initializeApp()`; writes occur on each exchange completion.
  _Key code:_ `apps/desktop/src/init.ts`, `stores/persistence.store.ts`

- **E2.6: Model Selection UI** — As a developer, I need a model selector component for
  choosing which inference engine and model to use for a lane session.
  _Acceptance criteria:_ `ModelSelector.tsx` lists available models from the inference
  registry; selection stored in session config; displayed in chat panel header.
  _Key code:_ `apps/desktop/src/components/chat/ModelSelector.tsx`

---

## E3: Inference Engine and Provider Routing

Pluggable inference layer supporting cloud and local AI model backends.

### Stories

- **E3.1: InferenceEngine Interface** — As the runtime, I need a uniform adapter interface
  for all inference backends so providers can be added without touching domain logic.
  _Acceptance criteria:_ `InferenceEngine` interface exposes `init`, `infer`, `inferStream`,
  `listModels`, `healthCheck`, `terminate`; adapters implement the interface independently.
  _Key code:_ `apps/runtime/src/integrations/inference/engine.ts`

- **E3.2: Anthropic Cloud Adapter** — As a developer, I need a Claude adapter that routes
  prompts to the Anthropic Messages API with configurable API key and model.
  _Acceptance criteria:_ `AnthropicInferenceEngine` reads key from `HELIOS_ACP_API_KEY` or
  `ANTHROPIC_API_KEY`; default model is `claude-sonnet-4-20250514`; streaming supported;
  `init()` throws if key is absent.
  _Key code:_ `apps/runtime/src/integrations/inference/anthropic-adapter.ts`

- **E3.3: Local MLX Adapter** — As a developer on Apple Silicon, I need an MLX adapter
  that routes prompts to a locally running MLX inference server.
  _Acceptance criteria:_ `MlxInferenceEngine` connects to MLX server endpoint; `healthCheck`
  probes the endpoint; `listModels` returns available local models.
  _Key code:_ `apps/runtime/src/integrations/inference/mlx-adapter.ts`

- **E3.4: llama.cpp Adapter** — As a developer, I need a llama.cpp adapter for
  GGUF-quantized model inference on CPU/GPU without cloud dependency.
  _Acceptance criteria:_ `LlamacppInferenceEngine` manages a llama.cpp server process;
  `init` starts the server; `terminate` stops it cleanly.
  _Key code:_ `apps/runtime/src/integrations/inference/llamacpp-adapter.ts`

- **E3.5: vLLM Server Adapter** — As a platform operator, I need a vLLM adapter for
  high-throughput batch inference on GPU servers.
  _Acceptance criteria:_ `VllmInferenceEngine` connects to a vLLM OpenAI-compatible
  endpoint; streaming supported; `listModels` queries `/v1/models`.
  _Key code:_ `apps/runtime/src/integrations/inference/vllm-adapter.ts`

- **E3.6: MCP Tool Bridge** — As an agent session, I need to call MCP-registered tools via
  the provider adapter layer so agents can use external tools via the Model Context Protocol.
  _Acceptance criteria:_ `McpAdapter.callTool(serverId, toolName, args)` dispatches the call
  and returns the result; unknown server IDs return a typed error.
  _Key code:_ `apps/runtime/src/integrations/mcp/adapter.ts`

- **E3.7: A2A Task Delegation** — As an agent, I need to delegate subtasks to peer agents
  via the Agent-to-Agent (A2A) protocol.
  _Acceptance criteria:_ `A2aAdapter.delegateTask(targetAgentId, payload)` returns a
  `delegationId`; delegation events published to bus.
  _Key code:_ `apps/runtime/src/integrations/a2a/adapter.ts`

---

## E4: Secrets Vault and Credential Redaction

Encrypted credential storage and automatic secret scrubbing from all output.

### Stories

- **E4.1: Encrypted Credential Store** — As an operator, I need provider API keys stored
  encrypted at rest so credentials are never written to disk in plaintext.
  _Acceptance criteria:_ `CredentialStore` encrypts via `EncryptionService`; access requires
  `CredentialAccessContext` with `requestingProviderId` and `workspaceId`; access denied
  events published to bus; `CredentialAlreadyExistsError` prevents duplicate keys.
  _Key code:_ `apps/runtime/src/secrets/credential-store.ts`, `secrets/encryption.ts`

- **E4.2: Secret Redaction Engine** — As an operator, I need all PTY output and audit
  payloads scanned for secrets and replaced with `[REDACTED]` before storage or display.
  _Acceptance criteria:_ `RedactionEngine` runs regex rules from `redaction-rules.ts`;
  `RedactionResult` includes position and length of each match; false positive rates tracked
  per rule; `api_key` fields in audit payloads redacted by `sanitizePayload`.
  _Key code:_ `apps/runtime/src/secrets/redaction-engine.ts`,
  `secrets/redaction-rules.ts`, `index.ts` (`sanitizePayload`)

- **E4.3: Protected Paths Detector** — As the policy engine, I need a module that detects
  when agent commands affect protected file paths (e.g., `.env`, credential files).
  _Acceptance criteria:_ `ProtectedPathsDetector` matches command arguments against
  `protected-paths-config.ts` rules; matches elevate command classification to
  `NeedsApproval` or `Blocked`.
  _Key code:_ `apps/runtime/src/secrets/protected-paths-detector.ts`,
  `secrets/protected-paths-matching.ts`, `secrets/protected-paths-config.ts`

- **E4.4: Secrets Audit Trail** — As an auditor, I need every credential access attempt
  logged with outcome, requester, and timestamp.
  _Acceptance criteria:_ `audit-trail.ts` writes an entry for every access (granted/denied);
  entries queryable by `workspaceId` and `providerId`.
  _Key code:_ `apps/runtime/src/secrets/audit-trail.ts`

---

## E5: Policy Engine and Approval Workflow

Command classification and human-in-the-loop approval gating.

### Stories

- **E5.1: Policy Rule Storage** — As an operator, I need policy rules stored per workspace
  in a file-based store with live reload on rule changes.
  _Acceptance criteria:_ `PolicyStorage` watches rule files; `onRulesChanged` callback fires
  on modification; `getRuleSet` returns the latest parsed `PolicyRuleSet` for a workspace.
  _Key code:_ `apps/runtime/src/policy/storage.ts`

- **E5.2: Policy Evaluation Engine** — As the runtime, I need commands classified as
  `safe`, `needs-approval`, or `blocked` before dispatch.
  _Acceptance criteria:_ `PolicyEngine.evaluate(command, context)` returns a
  `PolicyEvaluationResult` with classification, matched rules, and evaluation latency;
  `canExecuteDirectly` / `needsApproval` / `isBlocked` are derived convenience methods.
  _Key code:_ `apps/runtime/src/policy/engine.ts`, `policy/rules.ts`, `policy/types.ts`

- **E5.3: Approval Queue** — As the runtime, I need blocked/needs-approval commands
  queued for human review with per-command approve/reject lifecycle.
  _Acceptance criteria:_ `approval-queue.ts` enqueues classified commands; approve action
  dispatches the original command; reject action emits a rejection event; queue depth is
  observable from the bus state.
  _Key code:_ `apps/runtime/src/policy/approval-queue.ts`

- **E5.4: Approval UI Panel** — As a developer, I need a panel listing pending approval
  requests with approve and reject-with-reason actions.
  _Acceptance criteria:_ `ApprovalPanel.tsx` lists all queued commands; each item shows
  command text, policy rule that matched, and risk classification; approve/reject updates
  queue via runtime client.
  _Key code:_ `apps/desktop/src/components/approval/ApprovalPanel.tsx`,
  `apps/desktop/src/pages/ApprovalWorkflow.tsx`

---

## E6: Audit Ledger and Session Recovery

Tamper-evident event log and crash-recovery bootstrap.

### Stories

- **E6.1: In-Memory Audit Sink** — As the runtime, I need every bus envelope recorded to
  an `InMemoryAuditSink` with sequence number, outcome, and timestamp.
  _Acceptance criteria:_ `AuditSink.write(event)` appends to ring buffer; `flush()` drains
  pending entries; `getMetrics()` reports total written, high-water mark, and persistence
  failures.
  _Key code:_ `apps/runtime/src/audit/sink.ts`, `audit/ring-buffer.ts`

- **E6.2: Audit Bundle Export** — As an operator, I need to export a filtered audit bundle
  by correlation ID with redacted payloads.
  _Acceptance criteria:_ `exportAuditBundle({ correlation_id })` returns count, records with
  `type`, `topic`, `payload`, and `recorded_at`; API keys in payloads replaced with
  `[REDACTED]`.
  _Key code:_ `apps/runtime/src/index.ts` (`exportAuditBundle`)

- **E6.3: Recovery Metadata Export** — As the runtime, I need to export recovery metadata
  for all active lanes, sessions, and terminals so a crashed process can restore state.
  _Acceptance criteria:_ `exportRecoveryMetadata()` returns serializable metadata with all
  lane/session/terminal entries; safe to call at any time without pausing bus dispatch.
  _Key code:_ `apps/runtime/src/index.ts` (`exportRecoveryMetadata`)

- **E6.4: Bootstrap Recovery Classification** — As the runtime on restart, I need to
  classify recovered metadata into recoverable (reconcile) and unrecoverable (cleanup)
  issues so the process can restart cleanly.
  _Acceptance criteria:_ `classifyBootstrap(metadata)` returns `recovered_session_ids` and
  `issues` array; detached sessions classified as unrecoverable/cleanup; lanes with missing
  sessions classified as recoverable/reconcile; terminals with missing sessions classified
  as unrecoverable/cleanup.
  _Key code:_ `apps/runtime/src/index.ts` (`classifyBootstrap`)

- **E6.5: Session Checkpoint Store** — As the runtime, I need periodic session checkpoints
  written to disk so long-running agent sessions survive application restarts.
  _Acceptance criteria:_ `checkpoint_store.ts` serializes session state to disk on a
  configurable interval; restore loads the latest checkpoint on startup.
  _Key code:_ `apps/runtime/src/sessions/checkpoint_store.ts`

---

## E7: Terminal Sharing

Collaborative terminal access via tmate and upterm backends.

### Stories

- **E7.1: Share Session Entity** — As the runtime, I need a share session entity tracking
  state (`pending → active → expired/revoked/failed`) and share link for a terminal.
  _Acceptance criteria:_ `ShareSession` includes `id`, `terminalId`, `backend`
  (`upterm`|`tmate`), `shareLink`, `ttlMs`, `workerPid`, and `correlationId`; state
  transitions are atomic via state machine.
  _Key code:_ `apps/runtime/src/integrations/sharing/share-session.ts`

- **E7.2: tmate Backend** — As a developer, I need to share a terminal session via tmate
  for read-only or read-write collaborative access.
  _Acceptance criteria:_ `TmateAdapter` spawns a tmate subprocess; share link extracted
  from tmate output; worker PID tracked for cleanup on revoke.
  _Key code:_ `apps/runtime/src/integrations/tmate/adapter.ts`,
  `integrations/tmate/command.ts`

- **E7.3: upterm Backend** — As a developer, I need to share a terminal session via upterm
  as an alternative to tmate.
  _Acceptance criteria:_ `UptermAdapter` spawns an upterm worker; session URL returned as
  share link; cleanup terminates the worker process.
  _Key code:_ `apps/runtime/src/integrations/upterm/adapter.ts`,
  `integrations/upterm/command.ts`

- **E7.4: Policy Gate for Sharing** — As an operator, I need terminal sharing to require
  policy approval before a share link is issued.
  _Acceptance criteria:_ Share action submits to approval queue if sharing policy rule
  matches; approved shares proceed to backend; rejected shares emit a revocation event.
  _Key code:_ `apps/runtime/src/integrations/sharing/share-session.ts` (FR-026-003 comment)

---

## E8: Configuration, Feature Flags, and Settings

Application-wide configuration, startup feature flags, and UI settings.

### Stories

- **E8.1: App Config Module** — As the runtime, I need a typed configuration module loading
  settings from environment and config files at startup.
  _Acceptance criteria:_ Config module in `apps/runtime/src/config/` validates required
  fields; missing required config throws with a descriptive message; defaults applied for
  optional fields.
  _Key code:_ `apps/runtime/src/config/`

- **E8.2: Retention Policy Config** — As an operator, I need configurable retention
  settings for audit ring buffers so long-running processes do not consume unbounded memory.
  _Acceptance criteria:_ `createRetentionPolicyConfig` produces typed config; `maxEvents`
  and `maxAgeMs` bounds enforced by ring buffer on write.
  _Key code:_ `apps/runtime/src/config/retention.ts`, `audit/ring-buffer.ts`

- **E8.3: Desktop Renderer Settings** — As a developer, I need settings to control the
  active renderer engine (Ghostty vs Rio) and hot-swap preference.
  _Acceptance criteria:_ `DesktopSettings` (`rendererEngine`, `hotSwapPreferred`) persisted
  via settings store; default is Ghostty with hot-swap enabled; settings UI in
  `settings/renderer_preferences.ts`.
  _Key code:_ `apps/desktop/src/settings.ts`, `settings/renderer_preferences.ts`

- **E8.4: Diagnostics Module** — As an operator, I need runtime diagnostics exposed for
  health checks and debugging.
  _Acceptance criteria:_ Diagnostics module in `apps/runtime/src/diagnostics/` reports
  transport state, harness probe results, and bus metrics; accessible via HTTP health
  endpoint.
  _Key code:_ `apps/runtime/src/diagnostics/`

---

## E9: Canary Dependency Management

Structured dependency upgrade workflow with automated rollback capability.

### Stories

- **E9.1: Canary Upgrade Script** — As a maintainer, I need a script to upgrade a specific
  dependency to its latest version and log the change for rollback reference.
  _Acceptance criteria:_ `deps-canary.ts` upgrades the target package, writes the previous
  and new versions to `deps-changelog.json` and `deps-registry.json`; dry-run mode
  supported.
  _Key code:_ `scripts/deps-canary.ts`, `deps-changelog.json`, `deps-registry.json`

- **E9.2: Dependency Status Dashboard** — As a maintainer, I need a status script reporting
  current vs latest versions across all workspace packages.
  _Acceptance criteria:_ `deps-status.ts` queries the npm registry for each dependency;
  outputs a table of current, latest, and upgrade-available status.
  _Key code:_ `scripts/deps-status.ts`

- **E9.3: Rollback Script** — As a maintainer, I need a rollback script to revert a
  specific dependency to its previously logged version after a canary regression.
  _Acceptance criteria:_ `deps-rollback.ts` reads `deps-changelog.json` for the target
  package; restores the previous version; re-runs `bun install`.
  _Key code:_ `scripts/deps-rollback.ts`

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Local bus P99 round-trip < 10 ms for < 100 concurrent messages |
| Performance | Terminal buffer backpressure prevents unbounded memory growth |
| Security | Credentials never written to disk in plaintext |
| Security | Secret patterns redacted from all audit payloads before persistence |
| Security | Policy engine evaluates every agent command before dispatch |
| Reliability | Session recovery metadata exportable at any time without pausing the bus |
| Reliability | Bootstrap recovery classifies orphaned entities on restart |
| Testability | All domain logic testable with in-memory bus and stub adapters |
| Compatibility | Bun >= 1.2.20, Node.js >= 20 for ecosystem compat checks |
| Compatibility | macOS, Linux (PTY) as primary platforms; Windows via ConPTY as future work |

---

## Key Dependencies (from `package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `solid-js` | ^1.9.11 | UI renderer |
| `@xterm/xterm` | ^5.5.0 | Terminal widget |
| `@xterm/addon-fit` | ^0.10.0 | Terminal auto-resize |
| `@xterm/addon-web-links` | ^0.11.0 | Clickable URLs in terminal |
| `@biomejs/biome` | 1.9.4 | Linter + formatter |
| `typescript` | 5.8.2 | Type system |
| `vitepress` | 1.6.3 | Documentation site |
| `playwright` | 1.58.2 | E2E tests |
| `esbuild` | ^0.27.3 | Bundler |
| `esbuild-plugin-solid` | ^0.6.0 | SolidJS JSX transform |
