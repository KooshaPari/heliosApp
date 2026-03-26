# Architecture Decision Records — heliosApp

This document records key architectural decisions made during the development of heliosApp. Each ADR captures the context, rationale, and consequences of significant design choices visible in the codebase.

---

## ADR-001 | Local Bus Envelope Protocol | Adopted

**Status:** Adopted

**Context:**
heliosApp requires a communication protocol for coordinating commands, events, and responses across workspace, lane, session, and terminal entities. Communication occurs both within the runtime and between the desktop client and runtime.

**Decision:**
Implement a unified **LocalBusEnvelope** protocol with three envelope types:
- **Command envelopes**: Method-based requests (e.g., `lane.create`, `session.attach`, `terminal.spawn`)
- **Event envelopes**: Topic-based pub/sub events (e.g., `session.attached`, `terminal.output`)
- **Response envelopes**: Responses to commands (success or error)

All envelopes carry metadata: `id`, `correlation_id`, `type`, `ts`, and context IDs (`workspace_id`, `lane_id`, `session_id`, `terminal_id`).

**Consequences:**
- **Unified interface**: Commands and events use the same envelope structure, simplifying routing and serialization.
- **Correlation tracking**: `correlation_id` links commands to their events and responses, enabling distributed tracing.
- **Loose coupling**: Producers don't depend on consumers; pub/sub topology allows new subscribers without modifying producers.
- **Lifecycle ordering enforcement**: The protocol enforces state machine transitions (e.g., `session.attach.started` must precede `session.attached`).
- **Complexity**: The envelope spec requires careful validation; invalid ordering is detected and rejected.

**Code locations:** `/apps/runtime/src/protocol/bus.ts`, `/apps/runtime/src/protocol/types.ts`

---

## ADR-002 | Monorepo with Bun Workspaces | Adopted

**Status:** Adopted

**Context:**
heliosApp comprises multiple loosely coupled packages: runtime (core orchestration), desktop (client UI and platform integration), and renderer (terminal rendering UI). Code sharing between these packages is expected to grow.

**Decision:**
Use a **Bun monorepo** with npm workspaces (`"workspaces"` in root `package.json`):
- `apps/runtime`: Core runtime orchestration, bus, protocol, state machines.
- `apps/desktop`: Tauri-based desktop application shell.
- Unified `package.json` root with shared `devDependencies`, `biome.json`, and `tsconfig.base.json`.
- Single `bun.lock` for reproducible installs.

**Consequences:**
- **Single version of dependencies**: All packages use the same versions of TypeScript, Vitest, Biome, etc., ensuring consistency.
- **Shared tooling**: One linting and formatting config simplifies governance.
- **Shared build context**: Bun's native workspace support means no separate build orchestration needed.
- **Cross-workspace imports**: Packages can import from each other via `@helios/*` aliases.
- **Trade-off**: Monorepos make it harder to release packages independently; used for integration, not distribution.

**Code locations:** `/package.json`, `/apps/runtime/package.json`, `/apps/desktop/package.json`, `/Taskfile.yml`

---

## ADR-003 | Renderer Adapter Interface with Pluggable Backends | Adopted

**Status:** Adopted

**Context:**
heliosApp must support multiple terminal rendering engines (Ghostty, Rio, and potentially others). The rendering layer is performance-critical and must be swappable without downtime.

**Decision:**
Define a **RendererAdapter** interface that all backends must implement:
```typescript
interface RendererAdapter {
  init(config): Promise<void>;
  start(surface): Promise<void>;
  stop(): Promise<void>;
  bindStream(ptyId, stream): void;
  handleInput(ptyId, data): void;
  resize(ptyId, cols, rows): void;
  queryCapabilities(): RendererCapabilities;
  getState(): RendererState;
  onCrash(handler): void;
}
```

Concrete backends (ghostty, rio) implement this interface. A **RendererRegistry** manages instantiation and hot-swapping.

**Consequences:**
- **Backend abstraction**: New renderers can be added without modifying core runtime code.
- **Hot-swap support**: Renderers can be switched at runtime via `renderer.switch` command with transactional safety.
- **Capability negotiation**: Each backend declares what it supports (e.g., GPU acceleration, max dimensions).
- **Stream binding model**: PTY streams are bound to renderer implementations, not global streams.
- **Testing**: Mocks and stubs can implement the interface for unit testing.

**Code locations:** `/apps/runtime/src/renderer/adapter.ts`, `/apps/runtime/src/renderer/registry.ts`, `/apps/runtime/src/renderer/ghostty/backend.ts`, `/apps/runtime/src/renderer/rio/backend.ts`

---

## ADR-004 | Lane Orchestration with Par Task Binding | Adopted

**Status:** Adopted

**Context:**
heliosApp manages concurrent workstreams ("lanes"), each capable of hosting multiple terminals and potentially running background tasks (par tasks). Lanes must be durable, resumable, and observable.

**Decision:**
Implement **lanes** as first-class orchestration units:
- Each lane has a **state machine** (idle → active → stale → terminated).
- Lanes are registered in a **LaneRegistry** with persistent metadata.
- Par tasks (background processes) can be bound to lanes via **ParBinding**.
- Lanes transition through well-defined states with events published to the bus for each transition.
- A **watchdog** monitors for stale or orphaned lanes and triggers recovery.

**Consequences:**
- **Observable concurrency**: Each lane is a trackable entity with clear lifecycle.
- **Durability**: Lane state can be checkpointed and restored after crashes.
- **Background task model**: Par tasks are lightweight processes tied to lanes, enabling scripting and automation.
- **Governance**: Lane state transitions are logged and auditable via the event bus.
- **Complexity**: State machine enforces constraints; invalid transitions are rejected.

**Code locations:** `/apps/runtime/src/lanes/`, `/apps/runtime/src/lanes/state_machine.ts`, `/apps/runtime/src/lanes/par.ts`, `/apps/runtime/src/lanes/registry.ts`

---

## ADR-005 | PTY Lifecycle State Machine with Idle Monitoring | Adopted

**Status:** Adopted

**Context:**
PTY processes must be managed with lifecycle awareness, resource cleanup, and detection of stalled processes. The runtime must know when a PTY is actively being used vs. idle.

**Decision:**
Implement a **PTY state machine** with states: uninitialized → idle → spawning → active → stopping → stopped → errored.
- PTYs are spawned via `Bun.spawn()` and registered in a **PtyRegistry**.
- An **IdleMonitor** tracks time since last I/O; idle PTYs can be throttled or reaped.
- **PtyRecord** captures: process ID, dimensions, lifecycle timestamps, and session/lane bindings.
- State transitions are published as events for observability.

**Consequences:**
- **Resource awareness**: Idle processes don't consume unnecessary CPU or memory.
- **Debuggability**: Timestamp and state history allow post-mortem analysis.
- **Graceful cleanup**: Known idle/zombie processes can be terminated cleanly.
- **Integration point**: Desktop client can throttle rendering for idle terminals.
- **Overhead**: Idle monitoring requires background polling; tuned via configurable intervals.

**Code locations:** `/apps/runtime/src/pty/`, `/apps/runtime/src/pty/state_machine.ts`, `/apps/runtime/src/pty/spawn.ts`, `/apps/runtime/src/pty/idle_monitor.ts`, `/apps/runtime/src/pty/registry.ts`

---

## ADR-006 | Transactional Renderer Switching with Rollback | Adopted

**Status:** Adopted

**Context:**
Switching between rendering backends (Ghostty ↔ Rio) must be atomic and recoverable. If a switch fails mid-flight, the system must revert to the previous engine without losing terminal state or data.

**Decision:**
Implement **renderer switching as a transaction**:
1. Query both engines' capabilities.
2. Prepare the target engine (pre-allocate resources).
3. Rebind all PTY streams to the new engine.
4. Publish transition events.
5. On failure, **rollback**: rebind streams back to the previous engine and emit error event.

State is managed in a **SwitchTransaction** object that encapsulates the operation.

**Consequences:**
- **Atomicity**: Either the switch completes or it's fully reverted; no partial states.
- **Observability**: Client sees clear success or failure; no ambiguity.
- **Reliability**: Terminal sessions remain alive if switching fails.
- **Complexity**: Transaction logic is intricate and must handle all edge cases (crashed processes, missing streams, etc.).
- **Performance**: Switching may be slow due to rebinding and sync operations.

**Code locations:** `/apps/runtime/src/renderer/switch_transaction.ts`, `/apps/runtime/src/renderer/switch.ts`, `/apps/runtime/src/renderer/rollback.ts`

---

## ADR-007 | Checkpoint-Based Session Recovery and Orphan Reconciliation | Adopted

**Status:** Adopted

**Context:**
heliosApp must survive crashes. Sessions, lanes, and terminals must be recoverable from persistent state. Orphaned resources must be detected and cleaned up.

**Decision:**
Implement a **multi-layer recovery system**:
1. **Checkpoint format**: Capture session metadata, scrollback buffers, working directories, and shell state.
2. **Checkpoint scheduler**: Periodically write checkpoints to disk with atomic file operations (temp file → fsync → rename).
3. **Restoration on startup**: Load latest valid checkpoint and reattach to surviving PTYs.
4. **Orphan reconciler**: Scan for processes without corresponding session records; clean up or reconcile.
5. **Safe mode**: If recovery fails, start in safe mode with reduced functionality.

**Consequences:**
- **Durability**: Sessions survive host crashes or abnormal termination.
- **Partial recovery**: Some sessions may be lost if checkpoints are stale or corrupt.
- **Disk space**: Scrollback buffers are capped to prevent unbounded growth.
- **Complexity**: Recovery logic must handle corrupted checkpoints, clock skew, stale references, and concurrent orphans.
- **Trade-off**: Frequent checkpoints improve recovery coverage but increase I/O overhead.

**Code locations:** `/apps/runtime/src/recovery/`, `/apps/runtime/src/recovery/checkpoint.ts`, `/apps/runtime/src/recovery/restoration.ts`, `/apps/runtime/src/recovery/orphan-reconciler.ts`, `/apps/runtime/src/recovery/watchdog.ts`

---

## ADR-008 | Workspace and Project Binding Model | Adopted

**Status:** Adopted

**Context:**
heliosApp must support multi-project workflows. Users can work with multiple project repositories within a single workspace, and projects must be persistent across sessions.

**Decision:**
Define a **workspace/project binding model**:
- **Workspace**: Top-level container with metadata (name, root path, creation timestamp).
- **ProjectBinding**: Link from workspace to a project (git repository) with status tracking.
- **WorkspaceStore interface**: Backend-agnostic persistence (can be memory, file-based, or database).
- Workspaces are queryable by ID or name; projects are indexed within workspaces.

**Consequences:**
- **Multi-project support**: Users can organize work across repositories.
- **Durability**: Workspace metadata survives crashes.
- **Flexibility**: Store implementation can vary (in-memory for testing, file-based for production).
- **Loose coupling**: Runtime doesn't depend on specific storage backend.
- **Minimal overhead**: Binding metadata is lightweight; main content is in PTY/lane state.

**Code locations:** `/apps/runtime/src/workspace/types.ts`, `/apps/runtime/src/workspace/workspace.ts`, `/apps/runtime/src/workspace/store.ts`, `/apps/runtime/src/workspace/project.ts`

---

## ADR-009 | Inference Engine Abstraction with Multi-Backend Support | Adopted

**Status:** Adopted

**Context:**
heliosApp integrates AI inference for code intelligence, completions, and agent functionality. Inference must support multiple backends: local (MLX, llama.cpp) and cloud (OpenAI, Anthropic).

**Decision:**
Define an **InferenceEngine interface** with multiple implementations:
```typescript
interface InferenceEngine {
  init(): Promise<void>;
  infer(request): Promise<InferenceResponse>;
  inferStream(request): AsyncIterable<string>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<"healthy" | "degraded" | "unavailable">;
  terminate(): Promise<void>;
}
```

Implementations: `MLXAdapter`, `LlamaCppAdapter`, `AnthropicAdapter`, `VllmAdapter`.

A **hardware detection module** determines available compute (GPU, RAM, CPU cores) to select appropriate engines.

**Consequences:**
- **Backend agility**: Switch between local and cloud inference without code changes.
- **Offline-first design**: Local inference (MLX, llama.cpp) works without internet.
- **Graceful degradation**: If preferred backend unavailable, fall back to cloud or disable features.
- **Hardware awareness**: Automatically select engines based on system capabilities.
- **Dependency complexity**: Multiple inference libraries have heavy dependencies (PyTorch, CUDA, etc.).

**Code locations:** `/apps/runtime/src/integrations/inference/`, `/apps/runtime/src/integrations/inference/engine.ts`, `/apps/runtime/src/integrations/inference/mlx-adapter.ts`, `/apps/runtime/src/integrations/inference/llamacpp-adapter.ts`, `/apps/runtime/src/integrations/inference/hardware.ts`

---

## ADR-010 | MCP (Model Context Protocol) Adapter Interface | Adopted

**Status:** Adopted

**Context:**
heliosApp must integrate with external AI services and tools via a standard protocol. Model Context Protocol (MCP) provides a standardized interface for tool calling and context passing.

**Decision:**
Implement a minimal **McpAdapter interface**:
```typescript
interface McpAdapter {
  callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;
}
```

The adapter acts as a gateway between heliosApp's inference engines and MCP-compliant tools/servers. Tool invocations are routed through the adapter, which handles transport, serialization, and error handling.

**Consequences:**
- **Interoperability**: heliosApp can invoke tools from any MCP-compliant server.
- **Minimal coupling**: Runtime doesn't implement MCP; adapter is a thin bridge.
- **Future extensibility**: MCP protocol updates are absorbed by the adapter.
- **No MCP validation**: This adapter does not validate MCP spec compliance (that's done by servers).
- **Transport agnostic**: Adapter can use stdio, HTTP, or other transports.

**Code locations:** `/apps/runtime/src/integrations/mcp/adapter.ts`

---

## ADR-011 | Quality Gates with Biome Linter and Vitest | Adopted

**Status:** Adopted

**Context:**
heliosApp is a complex distributed system requiring strict code quality, type safety, and test coverage. Multiple developers may contribute; CI/CD must enforce standards.

**Decision:**
Implement a **quality gate pipeline**:
- **Linting & formatting**: Biome (all rules enabled: suspicious, correctness, style, complexity, security).
- **Type checking**: TypeScript with strict mode (`tsc --noEmit`).
- **Unit testing**: Vitest for test execution and coverage reporting.
- **Test pyramid**: Target 70% unit, 20% integration, 10% E2E.
- **Taskfile orchestration**: Tasks for `quality:quick`, `quality:strict`, and CI lane.

All checks are runnable locally and enforced in CI.

**Consequences:**
- **Consistency**: Same standards apply to all contributors.
- **Fast feedback**: Inner-loop checks (`quality:quick`) run in seconds.
- **Strict safety**: No disabled linting rules; suppressions require justification.
- **Test confidence**: Coverage metrics track which code is tested.
- **CI clarity**: Clear pass/fail signals for PRs.

**Code locations:** `/biome.json`, `/Taskfile.yml`, `/package.json` (scripts), `/apps/runtime/package.json`, `/apps/desktop/package.json`

---

## ADR-012 | Desktop Client with Tauri Framework | Adopted

**Status:** Adopted

**Context:**
heliosApp requires a native desktop application with access to platform APIs (file system, OS windows, system tray, etc.). A web-based UI is insufficient for performance and OS integration.

**Decision:**
Use **Tauri** for the desktop shell:
- Tauri provides a lightweight Rust bridge between JavaScript/TypeScript UI and native system APIs.
- The desktop app (`apps/desktop`) communicates with the runtime (`apps/runtime`) via IPC.
- UI framework is flexible; currently using Solid.js for the renderer app.

**Consequences:**
- **Native integration**: Access to file system, OS windows, keyboard shortcuts, system tray.
- **Performance**: Rust backend for hot-path operations; JS/TS for UI.
- **Cross-platform**: Single codebase compiles to macOS, Linux, Windows.
- **Lightweight**: Tauri bundles are smaller than Electron.
- **Learning curve**: Developers must understand Rust-JS interop and Tauri APIs.
- **Vendor lock-in**: Migrating away from Tauri would require significant rework.

**Code locations:** `/apps/desktop/src/`, `/apps/renderer/src/` (Solid.js UI)

---

## ADR-013 | Monorepo Build with Bun, TypeScript, and esbuild | Adopted

**Status:** Adopted

**Context:**
heliosApp must build quickly, support hot reload during development, and produce optimized bundles for production. Build configuration must be simple and maintainable.

**Decision:**
Use **Bun as runtime and build orchestrator**:
- `bun run` executes scripts defined in `package.json`.
- `bun install` manages dependencies with `bun.lock`.
- `bun build` compiles TypeScript/JavaScript to bundled output.
- esbuild plugin (`esbuild-plugin-solid`) for Solid.js JSX support.
- `bun test` runs Vitest tests.

No external build tool (Webpack, Vite, Turbopack) is needed for the current scope.

**Consequences:**
- **All-in-one runtime**: Bun replaces Node.js + npm + separate build tools.
- **Speed**: Bun is faster than Node.js for most operations.
- **TypeScript natively**: No tsc wrapper needed for execution.
- **Simplified toolchain**: Fewer dependencies, fewer config files.
- **Single runtime**: Development and build use the same Bun version.
- **Limited ecosystem**: Fewer Bun plugins than Node.js; some NPM tools may not work.

**Code locations:** `/package.json`, `/bunfig.toml`, `Taskfile.yml`, `/apps/runtime/package.json`, `/apps/desktop/package.json`

---

## ADR-014 | Protocol-First Development with Envelope Validation | Adopted

**Status:** Adopted

**Context:**
heliosApp is a distributed system with a runtime and multiple clients (desktop, CLI, tools). The protocol between components must be unambiguous and machine-verifiable.

**Decision:**
**Define protocols before implementation**:
- Core protocol: `/specs/protocol/v1/envelope.schema.json` (JSON Schema).
- Topics (events): `/specs/protocol/v1/topics.json` (enumeration).
- Methods (commands): `/specs/protocol/v1/methods.json` (command catalog).
- Validation: Envelope validation is performed at the boundary (`LocalBus.publish`, `LocalBus.request`) before processing.

Protocol version is embedded in envelope structure; breaking changes increment the version.

**Consequences:**
- **Contract clarity**: Clients and runtime agree on what messages are valid.
- **Interoperability**: Protocol allows external tooling (e.g., CLI clients, test harnesses) to work with heliosApp.
- **Testability**: Protocol can be tested in isolation from implementation.
- **Evolution path**: Version numbers allow gradual protocol migration.
- **Validation overhead**: All envelopes must be validated; invalid messages are rejected with clear errors.

**Code locations:** `/specs/protocol/v1/`, `/apps/runtime/src/protocol/bus.ts` (validation), `/kitty-specs/002-local-bus-v1-protocol-and-envelope/meta.json`

---

## ADR-015 | Streaming Terminal Output with Backpressure Handling | Adopted

**Status:** Adopted

**Context:**
PTY output (terminal text) arrives continuously and may exceed consumer processing speed. The system must buffer intelligently, report backlog metrics, and not drop data.

**Decision:**
Use **ReadableStream<Uint8Array>** for PTY output streams:
- Streams are bound to renderer implementations via `bindStream(ptyId, stream)`.
- **Backlog metrics** are tracked (depth, buffered bytes) and published via `terminal.output` events.
- Renderers consume streams at their own pace; backpressure (slow rendering) is observed via depth metrics.
- No data is dropped; if a renderer falls behind, output is buffered in memory (with size limits).

**Consequences:**
- **Resource fairness**: Slow renderers don't affect fast ones; each has its own buffer.
- **Observability**: Client can monitor backlog depth and adjust rendering or throttle input.
- **Memory safety**: Buffers are capped to prevent unbounded growth; overflow triggers events.
- **Async-friendly**: Streams integrate naturally with async/await patterns.
- **Complexity**: Managing multiple concurrent streams requires careful bookkeeping.

**Code locations:** `/apps/runtime/src/renderer/stream_binding.ts`, `/apps/runtime/src/protocol/bus.ts` (backlog_depth metrics), `/apps/runtime/src/pty/io.ts`

---

## ADR-016 | Provider Adapter Pattern for Extensibility | Adopted

**Status:** Adopted

**Context:**
heliosApp must support multiple provider types (inference engines, MCP servers, external tools, etc.). Adding a new provider should not require changes to core runtime.

**Decision:**
Define a **provider adapter interface**:
```typescript
interface ProviderAdapter {
  init(): Promise<void>;
  invoke(method: string, args: unknown): Promise<unknown>;
  healthCheck(): Promise<"healthy" | "degraded" | "unavailable">;
  terminate(): Promise<void>;
}
```

Each provider type (inference, MCP, tool) implements this interface. A **ProviderRegistry** manages the lifecycle and routing.

**Consequences:**
- **Plugin architecture**: New providers can be added without modifying runtime.
- **Uniform interface**: All providers expose the same methods (init, invoke, health, terminate).
- **Decoupling**: Core runtime doesn't know about specific providers.
- **Registration overhead**: Registry must track all providers and their availability.
- **Testing**: Providers can be stubbed or mocked for testing.

**Code locations:** `/apps/runtime/src/providers/adapter.ts`, `/apps/runtime/src/providers/` (registry, lifecycle management)

---

## ADR-017 | Credential and Secrets Redaction in Event Bus | Adopted

**Status:** Adopted

**Context:**
heliosApp processes environment variables, API keys, credentials, and other sensitive data. These must never be logged or transmitted in plaintext via the event bus.

**Decision:**
Implement **secrets redaction at the boundary**:
- Define a set of sensitive patterns (API keys, passwords, tokens).
- When events are published via the bus, sensitive fields are scanned and redacted.
- Redaction is applied before storing events in logs or sending to clients.
- Configuration allows adding custom patterns for application-specific secrets.

**Consequences:**
- **Security**: Sensitive data doesn't leak via logs, telemetry, or wire protocols.
- **Operational visibility**: Non-sensitive information still flows through for debugging.
- **Performance**: Redaction adds overhead; applied selectively to high-risk events.
- **Completeness**: False negatives (undetected secrets) are a risk; patterns must be comprehensive.
- **User education**: Users must not store credentials in terminal commands visible to the system.

**Code locations:** `/apps/runtime/src/secrets/`, `/apps/runtime/src/protocol/boundary_adapter.ts` (redaction layer)

---

## ADR-018 | Event Audit Log with Sequence Numbers | Adopted

**Status:** Adopted

**Context:**
heliosApp must provide an audit trail of all significant events for debugging, compliance, and forensics. Event order matters; sequence must be preserved.

**Decision:**
Implement an **audit log**:
- All events are stored with a monotonic sequence number (per-topic).
- Events include: ID, type, topic, timestamp, correlation_id, context IDs, payload, and sequence.
- The audit log is queryable by topic, correlation_id, or time range.
- Audit records include outcome (accepted/rejected) and validation errors.

**Consequences:**
- **Debuggability**: Post-mortem analysis can reconstruct system state.
- **Compliance**: Audit trail satisfies regulatory requirements.
- **Performance**: Writing audit logs is blocking; async writing or batching mitigates latency.
- **Storage**: Audit logs can grow large; retention policies must be enforced.
- **Privacy**: Audit log contains sensitive data; must be protected and redacted.

**Code locations:** `/apps/runtime/src/audit/`, `/apps/runtime/src/audit/bus-subscriber.ts`, `/apps/runtime/src/protocol/bus.ts` (audit recording)

---

## ADR-019 | Zellij Session Multiplexer Integration | Adopted

**Status:** Adopted

**Context:**
heliosApp must manage multiple concurrent terminal sessions. Zellij is a modern session multiplexer (like tmux/screen) that provides windowing and layout management.

**Decision:**
Integrate with **Zellij**:
- Each lane can host a Zellij session for managing multiple panes/tabs.
- Zellij session lifecycle is tied to lane lifecycle.
- Terminal bindings map PTY output to Zellij panes.
- Zellij layout and configuration is managed via heliosApp API.

**Consequences:**
- **Window management**: Users get native windowing within a lane.
- **Persistence**: Zellij sessions can be serialized and restored.
- **Complexity**: Adding a dependency on Zellij and learning its APIs.
- **Performance**: Zellij adds overhead; suitable for multi-pane workloads, less so for single terminals.
- **Alternative**: Could use tmux instead (more stable, wider adoption); Zellij chosen for better Rust ecosystem fit.

**Code locations:** `/apps/runtime/src/integrations/zellij/`, `/kitty-specs/009-zellij-mux-session-adapter/meta.json`

---

## ADR-020 | Continuous Integration with GitHub Actions and Quality Gates | Adopted

**Status:** Adopted

**Context:**
heliosApp is a multi-component system with strict quality requirements. CI must enforce: build, lint, type checking, unit tests, security scanning, and documentation build.

**Decision:**
Use **GitHub Actions** with quality gates:
- **lint-test.yml**: Biome linting, TypeScript checking, Vitest unit tests on every PR.
- **security.yml**: Dependency vulnerability scanning, secret detection, SAST analysis.
- **build.yml**: Full monorepo build and artifact generation.
- **docs.yml**: VitePress documentation build validation.
- Blocking checks: All tests and lints must pass before merge.
- Non-blocking checks: Security and docs warnings are reported but don't block.

**Consequences:**
- **Automation**: No manual testing; CI catches regressions and linting issues.
- **Transparency**: All checks are visible to reviewers; clear pass/fail signals.
- **Speed**: GitHub Actions is fast for Node.js/TypeScript workloads.
- **Cost**: Free for open-source; paid for private repos.
- **Complexity**: Workflow YAML can be verbose; multiple workflows required for full coverage.

**Code locations:** `/.github/workflows/`, `/.oxlintrc.json`, `/biome.json`, `/Taskfile.yml`

---

## Summary Table

| ID | Title | Status | Key Insight |
|-------|-------|--------|--------------|
| ADR-001 | Local Bus Envelope Protocol | Adopted | Unified protocol for commands, events, responses with correlation tracking. |
| ADR-002 | Bun Monorepo with Workspaces | Adopted | Single version of deps, shared tooling, fast builds. |
| ADR-003 | Pluggable Renderer Backends | Adopted | Adapter pattern for Ghostty/Rio with hot-swap support. |
| ADR-004 | Lane Orchestration with Par Tasks | Adopted | First-class lanes with state machine and durability. |
| ADR-005 | PTY Lifecycle State Machine | Adopted | Observable PTY lifecycle with idle monitoring. |
| ADR-006 | Transactional Renderer Switching | Adopted | Atomic switching with rollback on failure. |
| ADR-007 | Checkpoint-Based Recovery | Adopted | Crash-safe sessions via periodic checkpoints + orphan reconciliation. |
| ADR-008 | Workspace/Project Binding Model | Adopted | Multi-project support with persistent metadata. |
| ADR-009 | Inference Engine Abstraction | Adopted | Multi-backend (MLX, llama.cpp, OpenAI) with hardware detection. |
| ADR-010 | MCP Adapter Interface | Adopted | Lightweight bridge to MCP-compliant tools/servers. |
| ADR-011 | Quality Gates (Biome + Vitest) | Adopted | Strict linting, type checking, test coverage enforced in CI. |
| ADR-012 | Desktop with Tauri | Adopted | Native desktop app with Rust-JS bridge for OS integration. |
| ADR-013 | Build with Bun/esbuild | Adopted | All-in-one runtime, fast build, simplified toolchain. |
| ADR-014 | Protocol-First Development | Adopted | Schemas define envelopes, topics, methods; validation at boundaries. |
| ADR-015 | Streaming Output with Backpressure | Adopted | ReadableStream for PTY output with backlog metrics. |
| ADR-016 | Provider Adapter Pattern | Adopted | Extensible adapters for inference, MCP, tools. |
| ADR-017 | Secrets Redaction in Events | Adopted | Sensitive data scrubbed from event bus and logs. |
| ADR-018 | Event Audit Log with Sequences | Adopted | Queryable audit trail with monotonic sequences per topic. |
| ADR-019 | Zellij Integration | Adopted | Session multiplexer for multi-pane workloads. |
| ADR-020 | GitHub Actions CI & Gates | Adopted | Automated lint, test, security, docs checks with blocking gates. |

---

## Cross-References

- **Protocol Specifications**: See `/specs/protocol/v1/` for envelope schemas, topics, and methods.
- **Kitty Specs**: See `/kitty-specs/` for detailed requirements and traceability matrices.
- **Code Entity Map**: See `docs/reference/CODE_ENTITY_MAP.md` for mapping decisions to implementation.
- **Functional Requirements**: See `FUNCTIONAL_REQUIREMENTS.md` for features that depend on these decisions.
