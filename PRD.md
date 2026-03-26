# heliosApp — Product Requirements Document

## Product Vision

heliosApp is an agent-first desktop IDE designed for developers who run AI coding agents
at scale. It provides a unified terminal-and-chat workspace where multiple parallel agent
sessions (lanes) can run simultaneously, each with its own PTY, lifecycle state machine,
and runtime bus connection. The long-term goal is a Cursor/Windsurf-quality native desktop
experience backed by a unified inference layer that spans cloud providers (Anthropic, etc.),
local runtimes (MLX, llama.cpp), and server deployments (vLLM).

The application is split across three tiers: a TypeScript runtime (`apps/runtime`) that
owns the message bus, session state machines, terminal buffers, and audit ledger; a
SolidJS renderer (`apps/renderer`) that owns the chat UI, terminal tabs, sidebar, and
keyboard shortcuts; and a desktop shell (`apps/desktop`) that owns lane/workspace panels,
renderer-engine switching, approval workflows, and settings components.

---

## Target Users

- **Agent-workflow engineers** — developers who run many simultaneous AI coding sessions and
  need fine-grained control over lane lifecycle, approval gates, and session recovery.
- **AI-assisted developers** — individual engineers who want a native IDE shell that wraps
  LLM chat with real terminal access, model selection, and tool-call visibility.
- **Platform operators** — teams who need audit trails, secret redaction, and policy gates
  before deploying agent-generated commands.

---

## Epics

### E1: Runtime Message Bus and Protocol

Core inter-process communication layer used by all higher-level features.

#### Stories

- **E1.1: Local Bus Protocol** — As the runtime, I need a typed `LocalBusEnvelope` with
  `command`, `event`, and `response` discriminated variants so all subsystems communicate
  over a single in-process channel.
  _Acceptance criteria:_ Envelope carries `id`, `type`, `ts`, `correlation_id`, `method`,
  optional `workspace_id/lane_id/session_id/terminal_id`, `payload`, `status`, and `error`;
  unit tests cover all three variants.

- **E1.2: InMemoryLocalBus** — As a developer, I need a concrete `InMemoryLocalBus`
  implementation that handles `dispatch`, `subscribe`, `getEvents`, `getState`, and
  `getAuditRecords` so tests and the runtime client can operate without a real IPC layer.
  _Acceptance criteria:_ Dispatch returns a valid response envelope; subscribers fire on
  matching topics; state is queryable; tests pass with Vitest.

- **E1.3: Boundary Dispatcher** — As the desktop tier, I need a `BoundaryDispatcher`
  adapter wrapping the bus so renderer calls cross the desktop/runtime boundary through a
  single typed function.
  _Acceptance criteria:_ Dispatcher forwards envelopes to the bus and returns serialised
  responses; error responses propagate `status: "error"`.

- **E1.4: Method and Topic Registry** — As a protocol consumer, I need a typed `METHODS`
  constant and `ProtocolTopic` enum so callers never hard-code string method names.
  _Acceptance criteria:_ All bus methods used in `runtime_client.ts` are present in the
  registry; TypeScript compilation fails if an unknown method is referenced.

---

### E2: Session and Lane Lifecycle

State-machine-driven lifecycle governing workspaces, lanes, sessions, and terminals.

#### Stories

- **E2.1: Lane State Machine** — As the runtime, I need formal `LaneState` transitions
  (`new → provisioning → ready → running → blocked/shared/failed → cleaning → closed`) with
  transition guards so invalid state jumps are rejected with a `LaneLifecycleError`.
  _Acceptance criteria:_ All 9 states implemented; illegal transitions throw; tests cover
  happy path and guard violations.

- **E2.2: Session State Machine** — As the runtime, I need `SessionState` transitions
  (`detached → attaching → attached → restoring → terminated`) tied to lane lifecycle so a
  lane in `closed` state cannot hold an `attached` session.
  _Acceptance criteria:_ Session state is gated on parent lane state; tests cover attach,
  detach, and restore transitions.

- **E2.3: Terminal Lifecycle** — As the runtime, I need `TerminalState` transitions
  (`idle → spawning → active → throttled/errored → stopped`) with a ring-buffer for
  stdout bytes, configurable drop policy, and `resizeTerminal` support.
  _Acceptance criteria:_ `spawnTerminal`, `inputTerminal`, `resizeTerminal`, and
  `stopTerminal` commands route through the bus; buffer tracks `total_bytes`,
  `dropped_bytes`, and `next_seq`; PTY resize is forwarded.

- **E2.4: Workspace and Project Metadata Persistence** — As a developer, I need workspace
  and lane records to persist across process restarts so I can resume sessions without
  manual re-creation.
  _Acceptance criteria:_ Workspace CRUD emits bus events; records are serialisable; a
  cold-start load pass restores in-memory state from persisted records.

- **E2.5: Orphan Detection and Remediation** — As the runtime, I need an orphan-detection
  pass that compares persisted lanes/sessions/terminals against live state so stale entries
  are classified as `recoverable` (reconcile) or `unrecoverable` (cleanup).
  _Acceptance criteria:_ `getOrphanReport` returns an issue list; `bootstrapRecovery`
  applies the remediation plan; tests cover both classifications.

---

### E3: Desktop Lane/Workspace Panel

Imperative HTML component layer in `apps/desktop` for workspace management.

#### Stories

- **E3.1: Lane Panel (Left Rail)** — As a user, I need a scrollable left-rail panel showing
  all lanes in the active workspace with status badges (state labels), orphan indicators,
  and session count so I can see the health of all concurrent work at a glance.
  _Acceptance criteria:_ `LanePanel` renders lane list; active lane is highlighted;
  `isOrphaned` lanes show a distinct indicator; `onLaneSelect/Create/Delete` callbacks fire.

- **E3.2: Keyboard Navigation** — As a keyboard-first user, I need `ArrowUp/Down`,
  `Home/End`, `Enter`, and `Delete/Backspace` to navigate and act on lane items without
  reaching for the mouse.
  _Acceptance criteria:_ `KeyboardNav` handles all six key bindings; wrap mode is
  configurable; delete triggers `onDelete` which may return a confirmation promise.

- **E3.3: Confirmation Dialog** — As a user performing a destructive lane action, I need a
  modal confirmation dialog that traps focus and restores it on close so I cannot
  accidentally dismiss it.
  _Acceptance criteria:_ Dialog opens with `open()`, closes with `close()`; `isDangerous`
  flag renders a red confirm button; focus is restored to the element that triggered it.

- **E3.4: Lane Actions** — As a user, I need inline lane action controls (rename, share,
  duplicate, delete) surfaced in the lane list item so common workflows require minimal
  clicks.
  _Acceptance criteria:_ `LaneActions` component emits typed callbacks for each action;
  delete action opens the confirmation dialog.

- **E3.5: Lane List Status Display** — As a user, I need a status bar below the lane list
  showing total lane count, running count, and blocked count so I have aggregate health
  visibility.
  _Acceptance criteria:_ Counts update reactively when the lane list prop changes.

---

### E4: Renderer Shell (SolidJS)

Reactive SolidJS front-end in `apps/renderer` providing the primary user interface.

#### Stories

- **E4.1: App Shell Layout** — As a user, I need a three-panel layout (sidebar, main chat
  area, draggable terminal panel) where each panel can be shown or hidden independently.
  _Acceptance criteria:_ `AppShell` renders sidebar, main content, and terminal; terminal
  height is drag-resizable down to a `TERMINAL_MIN_HEIGHT` of 80 px; sidebar and terminal
  toggling is wired to `app.store`.

- **E4.2: Sidebar and Conversation List** — As a user, I need a sidebar showing past
  conversations with relative timestamps so I can switch between prior sessions.
  _Acceptance criteria:_ `Sidebar` renders `ConversationItem` list; relative times show
  seconds/minutes/hours ago; clicking an item calls `setActiveConversation`.

- **E4.3: Chat Panel and Message Bubbles** — As a user, I need a scrolling chat thread
  that auto-scrolls to the latest message and distinguishes user messages, assistant
  messages, tool calls, and tool results with distinct visual treatments.
  _Acceptance criteria:_ `ChatPanel` auto-scrolls on `messages.length` change;
  `MessageBubble` renders four roles; streaming messages show a distinct state.

- **E4.4: Tool Call and Tool Result Blocks** — As a user, I need collapsible blocks for
  tool calls (showing tool name, status icon, and JSON input) and tool results (showing
  output or error with colour-coded border) so I can inspect agent tool usage without
  clutter.
  _Acceptance criteria:_ `ToolCallBlock` expands/collapses input JSON; status icons for
  pending/streaming/complete/error; `ToolResultBlock` shows error border in red and
  success in green.

- **E4.5: Terminal Tabs and Panel** — As a user, I need a tabbed terminal area at the
  bottom of the shell where each tab corresponds to an independent PTY session and I can
  create or close terminals.
  _Acceptance criteria:_ `TerminalTabs` renders one tab per terminal; active tab is
  highlighted; `createTerminal` adds a tab; `closeTerminal` removes it and advances focus;
  `TerminalPanel` is visible only for the active terminal.

- **E4.6: Status Bar** — As a user, I need a persistent status bar showing the WebSocket/
  bus connection state (connected/reconnecting/disconnected) with a colour-coded indicator
  so I know if the IDE is live.
  _Acceptance criteria:_ `StatusBar` reads `connectionStatus` from `app.store`; colours
  are green/yellow/red respectively.

---

### E5: Chat and Inference Engine

AI conversation management and model routing within the renderer and runtime.

#### Stories

- **E5.1: Conversation Store** — As a user, I need a reactive conversation store that
  manages multiple conversations with `id`, `title`, `modelId`, `createdAt`, `updatedAt`,
  and a `messages` array so conversations are preserved across route changes.
  _Acceptance criteria:_ `createConversation` generates a timestamped id; `sendMessage`
  appends user message and initiates streaming; `setActiveConversation` switches context.

- **E5.2: Chat Input Component** — As a user, I need a text input that sends on Enter and
  disables itself during streaming so I cannot submit a second message before the first
  response completes.
  _Acceptance criteria:_ `ChatInput` disables send when `isStreaming` is true; Enter key
  triggers `onSend`; Cancel button calls `onCancel` if provided.

- **E5.3: Model Selector** — As a user, I need a grouped model picker showing cloud
  (Anthropic Claude family), local (MLX), and server (vLLM) providers so I can switch
  inference backends without leaving the IDE.
  _Acceptance criteria:_ `ModelSelector` renders three provider groups; unavailable models
  are visually disabled; selection calls `onSelect` with the model id.

- **E5.4: Streaming Message Rendering** — As a user, I need assistant responses to stream
  token-by-token into the message bubble so I see progress immediately rather than waiting
  for a complete response.
  _Acceptance criteria:_ Messages with `metadata.status === "streaming"` render with a
  distinct streaming indicator; once complete the indicator is removed.

---

### E6: Renderer Engine and Hot-Swap

Terminal rendering back-end selection and transactional switching.

#### Stories

- **E6.1: Renderer Adapter Interface** — As the runtime, I need a `RendererAdapter`
  interface with `initialize`, `render`, `resize`, and `dispose` methods so Ghostty and
  Rio backends are interchangeable.
  _Acceptance criteria:_ Interface is typed; both Ghostty and Rio adapters implement it;
  TypeScript fails to compile an incomplete adapter.

- **E6.2: Ghostty and Rio Back-ends** — As a user, I need both Ghostty and Rio terminal
  emulators available as selectable back-ends so I can choose based on GPU support and
  font-rendering preferences.
  _Acceptance criteria:_ Both back-end modules export a conforming adapter; capability
  query returns `availableEngines` list; each is tested with a smoke integration test.

- **E6.3: Renderer Switch Transaction** — As a user, I need renderer switching to be
  transactional with automatic rollback so a failed switch leaves the terminal in a
  working state on the previous engine rather than a broken state.
  _Acceptance criteria:_ `switchRendererWithRollback` attempts switch; on failure attempts
  rollback; if rollback also fails, queries live engine and returns observed state;
  `context_store` is updated via `renderer.switch.*` action sequence.

- **E6.4: Renderer Settings Panel** — As a user, I need a settings panel listing available
  renderer engines with their availability status and an activate button so I can change
  the active engine from the UI.
  _Acceptance criteria:_ `RendererSettings` renders one row per renderer; unavailable
  engines are greyed out; selecting an available engine calls `onRendererSelect`.

- **E6.5: Hot-Swap Toggle** — As a user, I need a toggle in renderer settings to enable or
  disable hot-swap (live engine switching without session restart) so I can opt into the
  riskier but faster switching mode.
  _Acceptance criteria:_ `HotswapToggle` renders a labelled checkbox; state propagates to
  `DesktopSettings.hotSwapPreferred`; capability query returns `hotSwapSupported`.

---

### E7: Approval Workflow and Command Policy

Human-in-the-loop gates for agent-generated commands.

#### Stories

- **E7.1: Approval Types and Status Machine** — As an operator, I need typed
  `ApprovalRequest` and `ApprovalStatus` (pending/approved/rejected/expired) entities so
  approvals are unambiguous and traceable.
  _Acceptance criteria:_ `ApprovalRequest` carries `command`, `agentId`,
  `requesterName`, `expiresAt`, and optional resolution fields; all four statuses are
  represented.

- **E7.2: Approval Panel UI** — As a user, I need a panel listing pending approval
  requests with command text, agent id, and creation time so I can review and act on
  pending gates.
  _Acceptance criteria:_ `ApprovalPanel` renders all requests; selecting one shows a
  detail view with approve button and reject-with-reason form; empty state is handled.

- **E7.3: Approval Workflow Page** — As a user, I need a dedicated full-page approval
  workflow view reachable from the lane panel so I can manage approvals without losing
  context on the main IDE layout.
  _Acceptance criteria:_ `ApprovalWorkflow` page mounts `ApprovalPanel`; navigation back
  to main view is available.

- **E7.4: Command Policy Engine** — As an operator, I need a policy engine that evaluates
  commands against a rule set before dispatching them so high-risk commands (e.g. `rm -rf`,
  `git push --force`) are blocked or require explicit approval.
  _Acceptance criteria:_ Policy rules are configurable; matched commands emit an approval
  request event; unmatched commands pass through immediately.

---

### E8: Audit Ledger and Session Replay

Tamper-evident event log and replay capability for governance and debugging.

#### Stories

- **E8.1: Audit Sink** — As the runtime, I need every bus event persisted to an `AuditSink`
  with `id`, `timestamp`, `topic`, `payload`, and `correlationId` so nothing is lost after
  a crash.
  _Acceptance criteria:_ `AuditSink` subscribes to all bus topics; records are queryable
  via `getAuditRecords`; export produces an `AuditExportBundle` with `exportedAt` and
  `redacted` flag.

- **E8.2: Secret Redaction** — As an operator, I need any payload key containing `api_key`
  (case-insensitive) to be replaced with `[REDACTED]` before writing to the audit log so
  credentials do not appear in plain-text audit bundles.
  _Acceptance criteria:_ `sanitizePayload` redacts matching keys; other keys are
  unmodified; test covers both matching and non-matching keys.

- **E8.3: Audit Ledger HTTP API** — As a tooling integrator, I need HTTP endpoints for
  searching, paginating, and filtering audit records so external dashboards can query the
  event history without direct bus access.
  _Acceptance criteria:_ `AuditLedgerAPI` exposes paginated `GET /audit/records`; supports
  filter by `correlationId` and `topic`; rate-limited to 100 requests per minute.

- **E8.4: Session Replay from Audit Trail** — As an operator, I need to reconstruct a
  session's terminal output by replaying ordered audit records for a given correlation id
  so I can review exactly what an agent did in a past session.
  _Acceptance criteria:_ `exportAuditBundle` accepts a `correlation_id` filter and returns
  ordered records; replaying them restores observable terminal state.

---

### E9: Crash Recovery and Restoration

Resilient state recovery across application restarts and unexpected process terminations.

#### Stories

- **E9.1: Recovery Metadata Export** — As the runtime, I need to export a snapshot of all
  active lanes, sessions, and terminals at shutdown so the next startup has a recovery
  manifest.
  _Acceptance criteria:_ `exportRecoveryMetadata` returns typed arrays for lanes, sessions,
  and terminals; snapshot is serialisable to JSON.

- **E9.2: Bootstrap Classification** — As the runtime on startup, I need to classify each
  entity in the recovery manifest as recoverable or unrecoverable and emit a
  `BootstrapResult` so the UI can report what was restored versus what was lost.
  _Acceptance criteria:_ `classifyBootstrap` marks `detached` sessions as unrecoverable
  (cleanup); lanes with a missing session as recoverable (reconcile); tests cover both paths.

- **E9.3: Orphan Reconciliation** — As the runtime, I need to attempt reconciliation of
  recoverable orphans (re-attaching sessions to lanes) on boot before the UI is shown so
  users resume work rather than a blank workspace.
  _Acceptance criteria:_ `bootstrapRecovery` triggers reconcile for recoverable items;
  cleanup for unrecoverable ones; `getBootstrapResult` returns the final summary.

---

### E10: Secrets Management

Credential storage, injection, and redaction throughout the application stack.

#### Stories

- **E10.1: Encrypted Secret Storage** — As a developer, I need secrets stored with
  encryption at rest so API keys are not visible in config files or process memory dumps.
  _Acceptance criteria:_ Secrets module encrypts values before writing to disk; decrypt
  only on read; no plaintext intermediary.

- **E10.2: Secret Injection into Terminal Environments** — As a developer, I need secrets
  injected into the PTY environment at spawn time so agents can access credentials without
  the user having to set environment variables manually.
  _Acceptance criteria:_ `spawnTerminal` accepts a secrets map; values are set as env vars;
  values do not appear in the audit log (redacted at sink level).

- **E10.3: Runtime Payload Redaction** — As an operator, I need all runtime payloads
  containing secret-pattern keys to be redacted before any cross-boundary transmission so
  credentials cannot leak via the bus or HTTP API.
  _Acceptance criteria:_ `sanitizePayload` runs on every command and event payload; the
  `fetch` handler in `RuntimeHandle` applies redaction before responding.

---

### E11: App Settings and Feature Flags

Configuration surface for end-users and operators.

#### Stories

- **E11.1: Desktop Settings Model** — As a user, I need a `DesktopSettings` object with
  `rendererEngine` and `hotSwapPreferred` fields that persists across sessions so my
  preferences are not reset on restart.
  _Acceptance criteria:_ Settings load from storage on init; mutations persist
  synchronously; defaults are `ghostty` and `true`.

- **E11.2: Renderer Engine Settings Control** — As a user, I need the renderer settings
  panel to reflect the live engine reported by the runtime (not just the stored preference)
  so I see the actual active back-end even after a failed switch.
  _Acceptance criteria:_ `RendererSettings` reads from `RendererCapabilities.activeEngine`;
  discrepancy between stored preference and live engine is surfaced to the user.

- **E11.3: Switch Confirmation UI** — As a user, I need a confirmation step before a
  renderer switch so I am warned that switching may cause a brief terminal disruption.
  _Acceptance criteria:_ `SwitchConfirmation` component renders warning text and requires
  explicit confirmation; cancellation aborts without touching the runtime.

- **E11.4: Active Context Tab Navigation** — As a user, I need tabs within the desktop
  shell switching between `terminal`, `agent`, `session`, `chat`, and `project` views so I
  can navigate contexts without opening separate windows.
  _Acceptance criteria:_ `context_store` tracks `activeTab`; `tab.set` action updates it;
  each tab value maps to a distinct panel.

---

### E12: Quality Gates, Observability, and Developer Experience

Infrastructure ensuring code quality, performance baselines, and governance.

#### Stories

- **E12.1: Gate Pipeline** — As a maintainer, I need gate scripts for lint, typecheck,
  coverage, static analysis, security, and end-to-end tests that each write a structured
  JSON report to `.gate-reports/` so gate status is machine-readable.
  _Acceptance criteria:_ Six gate scripts exist and produce reports; `gate-aggregate.ts`
  collects them; CI reads the aggregate to pass/fail the build.

- **E12.2: Gate Bypass Detection** — As a maintainer, I need a `gate-bypass-detect.ts`
  script that flags any PR that modifies gate scripts or disables checks so governance
  bypasses are surfaced before merge.
  _Acceptance criteria:_ Script detects gate-file modifications; outputs a finding to the
  aggregate report; test coverage in `scripts/tests/gate-bypass-detect.test.ts`.

- **E12.3: Dependency Canary and Changelog** — As a maintainer, I need a `deps-canary.ts`
  script that monitors declared dependencies against the latest registry versions and writes
  a `deps-changelog.json` so stale or vulnerable dependencies are caught early.
  _Acceptance criteria:_ Canary runs on schedule; changelog entries include version delta
  and flag security advisories; rollback script restores the previous lockfile.

- **E12.4: Performance Baseline and Instrumentation** — As a maintainer, I need a
  `phenotype-metrics` package with a ring-buffer aggregator and metrics registry so bus
  latency, terminal throughput, and message counts can be baselined and regression-detected.
  _Acceptance criteria:_ Ring buffer stores N samples; aggregator computes mean/p50/p99;
  metrics registry names counters and gauges; tests cover all three modules.

- **E12.5: VitePress Documentation Site** — As a contributor, I need a built documentation
  site at `docs/.vitepress` with architecture, API reference, and governance pages so new
  team members can onboard without reading source code.
  _Acceptance criteria:_ `pnpm docs:build` succeeds; `docs-dist/index.html` is viewable
  in a browser; ADR pages are included.

---

## Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Bus dispatch round-trip under 10 ms p99 for in-process envelopes (baseline via `phenotype-metrics`). |
| NFR-02 | Reliability | Session recovery on restart must complete within 5 seconds for up to 20 persisted sessions. |
| NFR-03 | Security | No API key or secret value appears in audit logs, HTTP responses, or bus event payloads. |
| NFR-04 | Accessibility | All interactive elements (lane list, chat input, approval panel) are keyboard-navigable with ARIA roles. |
| NFR-05 | Testability | Unit test coverage must remain at or above 80 %; gate-coverage script enforces this. |
| NFR-06 | Maintainability | Cyclomatic complexity per function must not exceed 10; cognitive complexity must not exceed 15. |
| NFR-07 | Build | `bun run build` must complete without errors on the latest stable Bun release; TypeScript strict mode enabled. |
| NFR-08 | Observability | All lane, session, and terminal state transitions emit structured bus events consumable by the audit ledger. |
| NFR-09 | Portability | Desktop shell targets macOS (primary) and Linux via Tauri; renderer-only mode works in any modern Chromium. |
| NFR-10 | Backwards Compatibility | `LocalBusEnvelope` schema version is pinned to `v1`; additions are additive; no field removals without a schema version bump. |

---

## Out of Scope

- **Mobile clients** — iOS/Android shells are not planned for the current roadmap.
- **Collaborative multi-user sessions** — Real-time co-editing or shared cursors between
  two human users are outside this product; session-share is an agent-to-operator read-only
  flow only.
- **Built-in code editor** — heliosApp is a terminal-and-chat host, not a Monaco/CodeMirror
  editor replacement. File editing is delegated to agents running in the PTY.
- **Cloud-hosted backend** — All runtime components run locally on the user's machine;
  no SaaS runtime tier is planned.
- **Windows support** — Tauri on Windows is not a current target; the primary concern is
  macOS ARM and x86_64 Linux.
- **Plugin marketplace** — A user-facing extension registry is deferred; the adapter
  interfaces (renderer, provider) enable plugins but no discovery or install UX is in scope.
