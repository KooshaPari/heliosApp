# Work Packages: Helios MVP Agent IDE

**Feature**: 030-helios-mvp-agent-ide
**Created**: 2026-03-01
**Total Subtasks**: 36
**Total Work Packages**: 9

## Phase 1 — Foundation

### WP01: SolidJS Foundation and Shared Types
**Priority**: P0 (Setup)
**Estimated prompt size**: ~350 lines
**Dependencies**: None
**Implementation command**: `spec-kitty implement WP01`

**Goal**: Replace the raw HTML/JS renderer with a SolidJS project structure and define shared types for all entities.

**Subtasks**:
- [x] T001: Create SolidJS project structure for helios renderer [P]
- [x] T002: Create shared types for Conversation, Message, InferenceProvider entities [P]
- [x] T003: Create conversation persistence layer (GoldfishDB schema) [P]
- [x] T004: Create InferenceEngine strategy interface and provider registry [P]

**Implementation sketch**: Set up SolidJS entry point, component directory structure, CSS/Tailwind integration. Define TypeScript interfaces for all key entities. Extend GoldfishDB persistence with conversation/message tables. Create abstract InferenceEngine interface.

**Parallel opportunities**: All 4 subtasks are independent and can be worked on simultaneously within the WP.

**Risks**: ElectroBun webview compatibility with SolidJS bundling needs verification.

---

### WP02: App Shell Layout
**Priority**: P0 (Setup)
**Estimated prompt size**: ~300 lines
**Dependencies**: WP01
**Implementation command**: `spec-kitty implement WP02 --base WP01`

**Goal**: Build the main application shell with resizable panels, sidebar, and status bar.

**Subtasks**:
- [x] T015: Build AppShell layout (sidebar, center, bottom panels, resizable)
- [x] T016: Build Sidebar component (conversation list, new chat button)
- [x] T017: Build StatusBar component (connection status, model indicator)
- [x] T018: Add keyboard shortcuts (Ctrl+N new chat, Ctrl+` toggle terminal, Ctrl+1-5 tabs)

**Implementation sketch**: Create AppShell as root SolidJS component with CSS Grid/Flexbox layout. Sidebar is collapsible left panel. StatusBar is fixed bottom strip. Wire keyboard event handlers.

**Parallel opportunities**: T015-T017 are independent components. T018 depends on the shell being wired.

**Risks**: Resizable panel behavior in ElectroBun webview.

---

## Phase 2 — Chat Core (User Story 1)

### WP03: Chat Panel and Message Rendering
**Priority**: P1
**Estimated prompt size**: ~400 lines
**Dependencies**: WP02
**Implementation command**: `spec-kitty implement WP03 --base WP02`

**Goal**: Build the chat panel with streaming message display and tool call rendering.

**Subtasks**:
- [ ] T005: Build ChatPanel SolidJS component (message list with streaming)
- [ ] T006: Build ChatInput component (text area, send button, model selector dropdown)
- [ ] T008: Build tool call display components (file edit, terminal command inline blocks)

**Implementation sketch**: ChatPanel renders a scrollable message list. Each message has role-based styling (user vs agent). Streaming text appends token-by-token via SolidJS signals. Tool calls render as collapsible blocks with type icons. ChatInput is a textarea with send button and model dropdown.

**Parallel opportunities**: T005, T006, T008 are independent components.

**Risks**: Streaming performance with rapid signal updates.

---

### WP04: Agent Chat Loop Wiring
**Priority**: P1
**Estimated prompt size**: ~400 lines
**Dependencies**: WP03
**Implementation command**: `spec-kitty implement WP04 --base WP03`

**Goal**: Wire the chat UI to the ACP client for end-to-end agent conversations.

**Subtasks**:
- [ ] T007: Wire agent chat to ACP client with streaming response display
- [ ] T009: Implement conversation context/history management (multi-turn)
- [ ] T010: Add agent action interrupt/cancel UI

**Implementation sketch**: On send, create a Message, call a2a-dispatch agent.run via RPC, stream response tokens into the message. Maintain conversation history array in SolidJS store. Pass full history as context on each turn. Add cancel button that calls agent.cancel RPC.

**Parallel opportunities**: T009 and T010 are independent of each other but both depend on T007.

**Risks**: ACP streaming format must be parsed correctly. Cancel must abort in-flight requests cleanly.

---

## Phase 3 — Terminal Core (User Story 2)

### WP05: Terminal Panel and Multi-Terminal
**Priority**: P1
**Estimated prompt size**: ~350 lines
**Dependencies**: WP02
**Implementation command**: `spec-kitty implement WP05 --base WP02`

**Goal**: Build terminal UI with xterm.js and support multiple concurrent terminals.

**Subtasks**:
- [x] T011: Build TerminalPanel SolidJS component wrapping xterm.js
- [x] T012: Build terminal tab bar for multiple terminals
- [x] T013: Wire terminal I/O to existing terminal-bridge PTY
- [x] T014: Enable agent-driven terminal command execution (agent → bridge → PTY)

**Implementation sketch**: Wrap existing xterm.js setup in a SolidJS component. Terminal tab bar manages terminal instances. Wire stdin/stdout via RPC to terminal-bridge. Add RPC handler for agent to request command execution in a named terminal.

**Parallel opportunities**: T011-T012 are UI-only. T013-T014 are wiring tasks. Can parallelize within pairs.

**Risks**: xterm.js lifecycle must be managed carefully with SolidJS (attach/detach on mount/unmount). Existing terminal-bridge already works — don't break it.

---

## Phase 4 — Persistence (User Story 3)

### WP06: Conversation Persistence and Session Restore
**Priority**: P2
**Estimated prompt size**: ~300 lines
**Dependencies**: WP04
**Implementation command**: `spec-kitty implement WP06 --base WP04`

**Goal**: Persist conversations to GoldfishDB and restore them on app restart.

**Subtasks**:
- [ ] T019: Implement conversation save/load with GoldfishDB
- [ ] T020: Implement session restore on app restart
- [ ] T021: Wire sidebar conversation list to persisted data

**Implementation sketch**: On each message send/receive, upsert conversation and append message to GoldfishDB. On app start, load all conversations and populate sidebar. Clicking a conversation loads its messages into the chat panel. New conversation creates a fresh entry.

**Parallel opportunities**: T019 is the persistence layer, T020-T021 consume it.

**Risks**: Data migration if schema changes. Large conversations may slow load times — consider lazy loading messages.

---

## Phase 5 — Inference Engine (User Story 4)

### WP07: Hardware Detection and MLX Adapter
**Priority**: P2
**Estimated prompt size**: ~400 lines
**Dependencies**: WP01
**Implementation command**: `spec-kitty implement WP07 --base WP01`

**Goal**: Detect hardware capabilities and implement MLX inference for Apple Silicon.

**Subtasks**:
- [ ] T022: Create hardware detection module (Apple Silicon, NVIDIA GPU, CPU-only)
- [ ] T023: Create MLX inference adapter
- [ ] T025: Refactor existing llama.cpp/ACP into the strategy interface

**Implementation sketch**: Hardware detection uses platform checks (process.arch, CUDA detection via nvidia-smi). MLX adapter spawns mlx_lm.server or uses mlx-lm Python bindings via subprocess. Refactor existing AcpClient to implement the InferenceEngine interface. llama.cpp adapter wraps the existing llama-cli binary.

**Parallel opportunities**: T022, T023, T025 are independent — different files.

**Risks**: MLX requires Python environment. NVIDIA detection may fail in WSL2 without proper drivers. llama.cpp refactor must not break existing ACP functionality.

---

### WP08: vLLM Adapter and Model Selector UI
**Priority**: P2
**Estimated prompt size**: ~350 lines
**Dependencies**: WP07
**Implementation command**: `spec-kitty implement WP08 --base WP07`

**Goal**: Add vLLM inference support and build the model selector UI.

**Subtasks**:
- [ ] T024: Create vLLM inference adapter
- [ ] T026: Build model selector UI with provider grouping
- [ ] T027: Wire inference engine to chat loop with hot-swap support

**Implementation sketch**: vLLM adapter connects to a vLLM server endpoint (OpenAI-compatible API). Model selector dropdown groups models by provider (Local/Cloud). Hot-swap updates the active engine reference without losing conversation state.

**Parallel opportunities**: T024 (backend) and T026 (UI) are independent. T027 wires them together.

**Risks**: vLLM endpoint must be user-configurable. Model list must refresh when providers change.

---

## Phase 6 — De-stub and Polish

### WP09: Muxer De-stub and Session Sharing
**Priority**: P3
**Estimated prompt size**: ~300 lines
**Dependencies**: WP05
**Implementation command**: `spec-kitty implement WP09 --base WP05`

**Goal**: Wire muxer dispatch to real adapters and add session sharing UI.

**Subtasks**:
- [ ] T028: Wire muxer-dispatch.spawn() to real Zellij/adapter calls
- [ ] T029: Wire muxer attach/detach/kill to real adapter lifecycle
- [ ] T030: Add session sharing UI (upterm/tmate link generation)

**Implementation sketch**: In muxer-dispatch.ts, replace in-memory session creation with calls to the real Zellij/Tmate/UPterm adapters that already exist. On spawn, call the appropriate adapter.create(). On kill, call adapter.destroy(). Session sharing UI shows a "Share" button that triggers upterm/tmate start and displays the resulting link.

**Parallel opportunities**: T028-T029 are tightly coupled. T030 is independent UI work.

**Risks**: Real adapter calls may fail if CLI tools aren't installed — need graceful degradation.

---

### WP10: File Context, First-Run, and Quality
**Priority**: P3
**Estimated prompt size**: ~400 lines
**Dependencies**: WP04, WP05
**Implementation command**: `spec-kitty implement WP10 --base WP05`

**Goal**: Build file context panel, first-run setup flow, and pass quality gates.

**Subtasks**:
- [ ] T031: Build FileContext panel showing agent-accessed files
- [ ] T032: Build DiffView component for proposed changes
- [ ] T033: Wire accept/reject actions to file write operations
- [ ] T034: First-run setup flow (API key configuration, hardware detection)
- [ ] T035: Error handling and connection recovery UI
- [ ] T036: Quality gate pass (lint, typecheck, tests)

**Implementation sketch**: FileContext is a right sidebar panel listing files the agent has read/written. DiffView shows unified diffs with green/red highlighting. Accept triggers file write via RPC, reject sends feedback to agent. First-run wizard checks for API key in env, prompts if missing. Error UI shows toast notifications with retry buttons. Quality pass runs `task quality:ci`.

**Parallel opportunities**: T031-T033 (file context), T034-T035 (setup/error), T036 (quality) are independent streams.

**Risks**: DiffView complexity — may need a library. First-run must not block repeat users. Quality gate may surface new issues.

---

## Dependency Graph

```
WP01 (Foundation) ──┬──→ WP02 (App Shell) ──→ WP03 (Chat Panel) ──→ WP04 (Chat Loop) ──→ WP06 (Persistence)
                    │                      └──→ WP05 (Terminal) ──→ WP09 (Muxer De-stub)
                    │                                            └──→ WP10 (File Context + Polish)
                    └──→ WP07 (HW Detection + MLX) ──→ WP08 (vLLM + Model Selector)
```

## Parallelization Summary

After WP01 completes:
- **Parallel track A**: WP02 → WP03 → WP04 → WP06 (Chat path)
- **Parallel track B**: WP07 → WP08 (Inference path)
- **Parallel track C**: WP02 → WP05 → WP09 (Terminal + Muxer path)
- WP10 joins after WP04 + WP05

## MVP Scope

**Minimum viable product = WP01 + WP02 + WP03 + WP04 + WP05**

This delivers:
- SolidJS-based product UI (not debug dashboard)
- Working agent chat with streaming responses
- Integrated terminal with PTY
- App shell with sidebar and status bar

Everything after WP05 is enhancement (persistence, local inference, muxer, file review).
