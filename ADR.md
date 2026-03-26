# heliosApp — Architecture Decision Records

## ADR-001: Bun as Runtime, Package Manager, and Test Runner
**Date**: 2026-03-25
**Status**: Accepted
**Context**: heliosApp requires a TypeScript-native runtime for the `@helios/runtime` package and `@helios/desktop` shell. Node.js adds significant startup latency and requires a separate package manager (npm/yarn/pnpm). The project targets bleeding-edge dependency management with canary rollout scripts (`deps-canary.ts`, `deps-rollback.ts`). A unified runtime-and-package-manager reduces toolchain surface area.
**Decision**: Use Bun (≥1.2.20) as the sole runtime, package manager, and test runner across the entire workspace. Package scripts use `bun run`, tests use `bun test`, and builds use `bun build`. The `bunfig.toml` configures Bun-specific options. Node.js ≥20 is declared as an engine requirement only for ecosystem compatibility checks.
**Consequences**: Fast cold-start times for CLI and runtime processes; native TypeScript execution without a transpile step in dev; `bun test` replaces Vitest for unit tests in `apps/`; Bun's Jest-compatible test runner requires no separate test framework config; some Node.js-specific APIs may behave differently under Bun; contributors must install Bun instead of Node.js for local development.
**Alternatives Considered**: Node.js + pnpm (rejected: slower startup, additional toolchain layer); Deno (rejected: smaller ecosystem, incompatible with some npm packages used at decision time); tsx + Vitest (considered for test runs; Vitest is retained for integration-level E2E but `bun test` handles unit tests).

---

## ADR-002: Bun Workspaces Monorepo with Turborepo Task Runner
**Date**: 2026-03-25
**Status**: Accepted
**Context**: heliosApp has two distinct applications (`apps/runtime`, `apps/desktop`) and multiple shared packages (`packages/errors`, `packages/ids`, `packages/logger`, `packages/types`, `packages/template-hexagonal`, etc.). Build order matters: `@helios/desktop` depends on `@helios/runtime`, which must be built first. A flat directory structure with manual build ordering is error-prone.
**Decision**: Use Bun workspaces to declare all `apps/` and `packages/` as workspace members. Use Turborepo (`turbo.json`) to define task pipelines with explicit `dependsOn` relationships: `test` depends on `build`, `build` depends on `^build` (upstream workspace packages). `turbo` handles incremental caching via content hashing, skipping unchanged packages on re-runs.
**Consequences**: Deterministic build ordering enforced by the DAG in `turbo.json`; incremental builds skip unchanged packages; cross-package imports use `workspace:*` semver ranges; developers run `bun run <task>` at the root and Turborepo fans out correctly; Turborepo's remote cache is not configured (local cache only), so CI cold builds are not accelerated.
**Alternatives Considered**: Nx (rejected: heavier config, better suited to Angular/React ecosystems); manually ordered build scripts (rejected: fragile, not parallelized); separate repos per app (rejected: cross-app dependency management becomes manual git submodule work).

---

## ADR-003: Hexagonal Architecture with Template Package
**Date**: 2026-03-25
**Status**: Accepted
**Context**: heliosApp's runtime must support pluggable provider adapters, swappable PTY backends, and configurable bus implementations. Binding business logic directly to concrete implementations (e.g., a specific PTY library or a specific AI provider SDK) would make testing difficult and replacement costly. A reference architecture is needed that all new packages should follow.
**Decision**: Apply hexagonal (ports and adapters) architecture across the runtime. A `packages/template-hexagonal` package codifies the canonical structure for new domain packages (port interfaces, adapter implementations, domain logic, test harnesses). Runtime core (`apps/runtime/src/`) is organized into domain-aligned directories: `protocol/` (bus port), `providers/` (provider adapter), `pty/` (PTY adapter), `registry/` (plugin registry), `sessions/` (session domain), `workspace/` (workspace domain), `lanes/` (lane domain).
**Consequences**: Domain logic in `sessions/`, `workspace/`, and `lanes/` can be tested with in-memory bus and stub adapters; new providers can be added by implementing the adapter interface in `providers/adapter.ts` without touching domain logic; `template-hexagonal` serves as a cookiecutter for new packages; adds indirection that requires contributors to understand the port/adapter split before making changes.
**Alternatives Considered**: MVC layering (rejected: controller-service-repository does not model the event-driven, multi-adapter nature of the runtime well); flat modules (rejected: no boundary enforcement, adapters would inevitably import domain internals); dependency injection framework (considered; avoided to keep the architecture explicit and framework-independent).

---

## ADR-004: Local Message Bus (InMemoryLocalBus) with Typed Envelope Protocol
**Date**: 2026-03-25
**Status**: Accepted
**Context**: Workspace, lane, session, and terminal entities need to communicate via commands, events, and responses without direct method calls that would create circular dependencies. The communication protocol must enforce lifecycle ordering (state machine transitions) and support correlation tracking for request/response patterns.
**Decision**: Define a `LocalBus` port (`apps/runtime/src/protocol/bus.ts`) with an `InMemoryLocalBus` in-process implementation. All messages are wrapped in a `LocalBusEnvelope` (`protocol/envelope.ts`) with a `correlation_id`, message type (`command` | `event` | `response`), topic, and payload. `protocol/validator.ts` enforces lifecycle ordering rules (`validator-rules.ts`) before dispatch. `protocol/topics.ts` and `protocol/methods.ts` define the typed topic/method namespace.
**Consequences**: Entities are fully decoupled — a workspace publishes a command to the bus without knowing which handler processes it; `correlation_id` enables async request/response matching; the in-memory implementation is synchronous and testable without I/O; scaling to multi-process communication requires replacing `InMemoryLocalBus` with a NATS or WebSocket adapter without changing any domain code; the validator rules are a central place for lifecycle correctness, but they must be kept in sync with entity state machines.
**Alternatives Considered**: Direct method calls between entities (rejected: circular deps, tight coupling); EventEmitter (rejected: untyped, no correlation, no lifecycle enforcement); Redux-style store (considered; rejected as overkill for a message-passing runtime not a UI state problem); NATS from day one (rejected: adds a server dependency for local development; in-memory bus with a NATS adapter in the future is the plan).

---

## ADR-005: SolidJS for the Desktop Renderer
**Date**: 2026-03-25
**Status**: Accepted
**Context**: The `@helios/desktop` application requires a reactive UI renderer for the Tauri desktop shell. The renderer must display terminal output (xterm.js), manage panel layouts, show settings pages, and reflect real-time session state. Virtual DOM frameworks (React, Vue) add reconciliation overhead that matters for high-frequency terminal updates.
**Decision**: Use SolidJS (≥1.9) as the UI renderer. SolidJS uses fine-grained reactivity without a virtual DOM — updates are surgical and do not re-render component subtrees. The desktop app's `apps/renderer/` directory contains SolidJS components. xterm.js (`@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`) provides the terminal widget. esbuild + `esbuild-plugin-solid` compiles SolidJS JSX.
**Consequences**: Fine-grained reactivity makes terminal scroll performance noticeably smoother than VDOM alternatives; SolidJS's signal model is simpler to reason about for event-driven session state; smaller bundle size than React; smaller ecosystem and fewer off-the-shelf component libraries compared to React; contributors must understand SolidJS signals vs React hooks.
**Alternatives Considered**: React (rejected: VDOM reconciliation overhead for terminal rendering; heavier bundle); Vue (rejected: similar VDOM trade-offs; team preference for SolidJS signals model); Svelte (considered; similar fine-grained model, but SolidJS has better TypeScript integration at decision time); vanilla DOM manipulation (rejected: not maintainable for a complex multi-panel layout).

---

## ADR-006: Biome as the Unified Linter and Formatter
**Date**: 2026-03-25
**Status**: Accepted
**Context**: The project requires consistent code style and lint enforcement across all TypeScript packages. ESLint + Prettier is the traditional stack but involves two tools, two configs, and integration overhead. A faster, unified alternative exists.
**Decision**: Use Biome (1.9.4) as the sole linter and formatter. A single `biome.json` at the workspace root configures both lint rules and format settings (lineWidth: 100, indentStyle: space, indentWidth: 2). The `recommended` ruleset is enabled with selective overrides (e.g., `noExplicitAny: off`). `bun run lint` runs `biome check`, `bun run format` runs `biome format --write`. oxlint is also listed as a dev dependency for supplementary checks.
**Consequences**: Single tool, single config, faster lint runs (Biome is written in Rust); no Prettier/ESLint integration conflicts; Biome's opinionated defaults reduce bikeshedding; Biome's rule set is smaller than ESLint's plugin ecosystem — some specialized rules (accessibility, import ordering plugins) are not available; switching away from Biome in the future requires migrating both lint and format configs.
**Alternatives Considered**: ESLint + Prettier (rejected: two-tool overhead, slower, integration complexity); dprint (rejected: formatter only, still needs a linter); oxlint alone (considered as the primary linter; retained as a supplementary tool but Biome is the primary enforcer); swc-based lint tools (not mature enough at decision time).

---

## ADR-007: Playwright for E2E Testing, Vitest for Integration, Bun Test for Unit
**Date**: 2026-03-25
**Status**: Accepted
**Context**: The project needs three testing tiers: fast unit tests for domain logic, integration tests for bus and adapter interactions, and full E2E tests for the desktop UI. A single test runner cannot optimally serve all three tiers.
**Decision**: Use `bun test` for unit tests (`apps/runtime/tests/unit`, `apps/desktop/tests/unit`, `scripts/tests/`). Use Vitest (2.1.9) for integration tests (`apps/runtime/tests/integration`) where its module-mocking capabilities are richer. Use Playwright (1.58.2) for E2E tests via `playwright.config.ts`. `happy-dom` is the DOM environment for unit tests that need a browser-like context.
**Consequences**: Unit tests are fast (Bun's native runner, no framework overhead); integration tests get Vitest's rich mocking and module interception; E2E tests exercise the full Tauri/SolidJS rendering pipeline via Playwright's browser automation; three test runners add cognitive overhead; coverage is collected separately by each runner and must be merged for a unified report.
**Alternatives Considered**: Vitest for all tiers (considered; rejected because `bun test` is faster for pure unit tests and Playwright is the only viable choice for Tauri E2E); Jest (rejected: slower than Bun test, requires transpiler config); Cypress for E2E (rejected: Playwright has better Tauri integration and is actively maintained for desktop contexts).

---

## ADR-008: Provider Adapter Pattern with Registry for AI Provider Pluggability
**Date**: 2026-03-25
**Status**: Accepted
**Context**: heliosApp must route agent sessions to different AI providers (MCP-compatible providers, A2A protocol providers, ACP clients). New providers should be addable without modifying the core runtime. Provider health must be monitored to avoid routing sessions to degraded backends.
**Decision**: Define a provider adapter interface (`apps/runtime/src/providers/adapter.ts`) that all provider implementations must satisfy. A `ProviderRegistry` (`providers/registry.ts`) manages provider discovery, registration, and lookup. Separate files implement MCP bridge support (`mcp-bridge.ts`, `mcp-bridge-support.ts`), ACP client (`acp-client.ts`), and A2A router (`a2a-router.ts`). A `HealthMonitor` (`health-monitor.ts`) polls registered providers and marks them healthy or degraded.
**Consequences**: New providers are added by implementing the adapter interface and registering in the registry — no core changes required; the health monitor enables the runtime to avoid routing to degraded providers; the A2A and ACP protocols make the runtime multi-protocol from day one; the registry must handle concurrent provider registration safely; provider config is per-provider and not centralized.
**Alternatives Considered**: Hard-coded provider switch/case (rejected: not extensible, requires recompile for new providers); plugin system via WASM (considered for future isolation; deferred); direct SDK imports per provider (rejected: tight coupling, hard to test without live providers).

---

## ADR-009: PTY Lifecycle Manager with Zellij Mux Adapter
**Date**: 2026-03-25
**Status**: Accepted
**Context**: Agent sessions require real PTY processes to execute commands. The runtime must spawn, monitor, and clean up PTY processes across multiple concurrent sessions. A terminal multiplexer is needed to give developers a unified view of all running sessions.
**Decision**: Implement a PTY lifecycle manager in `apps/runtime/src/pty/` that owns PTY process creation, I/O piping, and teardown. A Zellij mux adapter provides terminal multiplexing for developer-facing session management. xterm.js in the desktop renderer handles terminal rendering on the UI side. PTY state (`active`, `inactive`, `throttled`) is tracked per terminal entry and published to the local bus.
**Consequences**: PTY processes are isolated per session — a crashed agent does not affect sibling sessions; Zellij provides keyboard-driven session navigation for developers; throttled state allows the runtime to apply backpressure on high-output processes; Zellij is an external process dependency that must be installed; the PTY adapter is the most platform-specific component (Unix PTY APIs differ from Windows ConPTY).
**Alternatives Considered**: node-pty (rejected: Node.js dependency conflicts with Bun runtime); tmux adapter (considered; Zellij chosen for its Rust-native design and Rust-friendly config API); direct `Bun.spawn` without PTY (rejected: agents require an interactive terminal, not just a subprocess); xterm.js headless only without a mux (rejected: developers need a live multiplexed view during agent runs).

---

## ADR-010: Canary Dependency Management with Automated Rollback
**Date**: 2026-03-25
**Status**: Accepted
**Context**: The project explicitly targets bleeding-edge dependencies. Updating all dependencies at once risks breaking changes going undetected until they accumulate. A structured canary process reduces the blast radius of any single dependency update.
**Decision**: Implement a canary dependency workflow via three scripts: `deps-canary.ts` (upgrades a dependency to its latest/canary version and logs the change), `deps-status.ts` (reports current vs latest versions across all workspace packages), and `deps-rollback.ts` (reverts a specific dependency to its previously logged version). Logs are persisted to `deps-changelog.json` and a registry in `deps-registry.json`.
**Consequences**: Dependency updates are individually trackable and reversible; canary upgrades can be tested on a feature branch before merging; `deps-status.ts` gives a live dashboard of upgrade opportunities; the workflow is custom-built (not a third-party tool), so it must be maintained; `deps-changelog.json` grows over time and must be periodically pruned.
**Alternatives Considered**: Renovate Bot (considered; rejected because GitHub Actions billing is broken on this account, making automated PR-based updates impractical); Dependabot (same rejection reason); manual version bumps (rejected: error-prone, no rollback capability); `bun update` without logging (rejected: no rollback, no change history).

---

## ADR-011: VitePress for Documentation with Auto-Generated Index
**Date**: 2026-03-25
**Status**: Accepted
**Context**: The project needs browsable, statically deployable documentation that covers architecture, APIs, and onboarding. Documentation must be generated from source-adjacent markdown files and must not require a live server to browse.
**Decision**: Use VitePress (1.6.3) for the documentation site. Source docs live in `docs/`. A shell script `docs/scripts/generate-doc-index.sh` auto-generates the navigation index from the docs directory tree before each build. `bun run docs:build` produces a static site in `docs/.vitepress/dist/`. The site can be opened via `file://` in a browser without a web server. VitePress dev server runs via `bun run docs:dev`.
**Consequences**: Documentation is browsable offline via `file://`; the auto-index script keeps navigation in sync with the actual docs directory without manual sidebar config; VitePress's Vue-based renderer supports MDX-like components for interactive docs; contributors must run `bun run docs:build` to see the final rendered output (markdown preview in editors may differ); the index generation script is a shell dependency that must work on macOS and Linux.
**Alternatives Considered**: Docusaurus (rejected: React-based, heavier, slower builds); GitBook (rejected: SaaS, not locally browsable); plain markdown with no site (rejected: no search, no navigation); MkDocs (considered; VitePress chosen for its better TypeScript ecosystem integration and Vue component support).

---

## ADR-012: Audit Sink and Session Replay Architecture
**Date**: 2026-03-25
**Status**: Accepted
**Context**: All bus events must be captured for audit purposes and to support session replay. Debugging agent failures requires reproducing the exact sequence of events that led to a failure state. The audit sink must not block the main bus dispatch path.
**Decision**: Implement an `InMemoryAuditSink` (`apps/runtime/src/audit/sink.ts`) that subscribes to all bus topics and appends every envelope to an in-memory log. The sink is exported from `@helios/runtime`'s public API. Session replay reads the audit log in order and re-dispatches envelopes through a replay bus. The `InMemoryAuditSink` is suitable for development and testing; a persistent audit sink (writing to disk or a database) is the planned production variant.
**Consequences**: All bus events are captured without synchronous I/O on the hot path; session replay enables deterministic debugging of agent failures; the in-memory sink loses data on process restart (acceptable for development; unacceptable for production without persistence); replay requires a separate bus instance to avoid contaminating the live event stream; the audit log grows unbounded in long-running processes and requires periodic snapshotting or rotation.
**Alternatives Considered**: File-based audit log from day one (considered; deferred to avoid synchronous I/O blocking the bus in development); database-backed audit (planned as the production implementation; in-memory sink is an explicit intermediate step); OpenTelemetry event export only (rejected: OTel traces are not designed for session replay, only for observability aggregation); event sourcing via the NATS JetStream pattern (considered; the local bus is intentionally in-process only; NATS integration is a future adapter, not a day-one requirement).
