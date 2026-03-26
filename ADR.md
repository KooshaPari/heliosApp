# heliosApp — Architecture Decision Records

**Version:** 2.0
**Date:** 2026-03-26
**Derived from:** Codebase analysis of `apps/runtime`, `apps/desktop`, `apps/renderer`, `packages/`

---

## ADR-001: Bun as Runtime, Package Manager, and Test Runner

**Date**: 2026-03-26
**Status**: Accepted
**Context**: heliosApp requires a TypeScript-native runtime for the `@helios/runtime` package
and `@helios/desktop` shell. Node.js adds significant startup latency and requires a separate
package manager. The project explicitly targets bleeding-edge dependencies via custom canary
scripts (`scripts/deps-canary.ts`, `deps-rollback.ts`, `deps-status.ts`). A unified
runtime-and-package-manager reduces toolchain surface area.
**Decision**: Use Bun (≥1.2.20) as the sole runtime, package manager, and test runner across
the entire workspace. `bun test` runs unit tests in `apps/runtime/tests/unit`,
`apps/desktop/tests/unit`, and `scripts/tests/`. `bun build` produces bundles. `bunfig.toml`
configures Bun-specific settings. Node.js ≥20 declared only for ecosystem compatibility checks.
**Consequences**: Fast cold-start; native TypeScript without a transpile step; `bun test` replaces
Vitest for unit-tier tests; some Node.js-specific APIs may behave differently under Bun;
contributors must install Bun, not Node.js.
**Alternatives Considered**: Node.js + pnpm (rejected: slower startup, additional toolchain
layer); Deno (rejected: smaller ecosystem, npm compatibility gaps); tsx + Vitest for all
tiers (Vitest retained for integration tests where module mocking is richer; Bun test for
unit tier).

---

## ADR-002: Bun Workspaces Monorepo with Turborepo Task Runner

**Date**: 2026-03-26
**Status**: Accepted
**Context**: heliosApp has two apps (`apps/runtime`, `apps/desktop`) plus an `apps/renderer`
and shared packages (`packages/errors`, `packages/ids`, `packages/logger`, `packages/types`,
`packages/phenotype-metrics`, `packages/phenotype-project`, `packages/template-hexagonal`).
Build order matters: desktop depends on runtime; runtime types used by desktop and renderer.
**Decision**: Bun workspaces declare all `apps/` and `packages/` members. Turborepo
(`turbo.json`) defines task pipelines with explicit `dependsOn` including `^build` (upstream
packages). Incremental caching is content-hash-based, skipping unchanged packages.
**Consequences**: Deterministic build ordering via DAG; incremental builds skip unchanged
packages; cross-package imports use `workspace:*`; Turborepo remote cache not configured
(local only), so CI cold builds are not accelerated.
**Alternatives Considered**: Nx (rejected: heavier config, Angular/React-oriented); manually
ordered scripts (rejected: fragile, unparallelized); separate repos (rejected: cross-app
dependency management becomes manual).

---

## ADR-003: Three-Tier Application Architecture

**Date**: 2026-03-26
**Status**: Accepted
**Context**: heliosApp has distinct concerns across runtime logic (bus, state machines, PTY,
secrets, policy, audit), desktop shell (lane panels, settings, approval UI), and the
terminal/chat renderer. Mixing these into a single package would create circular dependencies
and make the runtime untestable without a UI.
**Decision**: Split into three tiers:
1. `apps/runtime` (`@helios/runtime`) — pure TypeScript, no UI dependency, testable with
   in-memory bus and stub adapters. Owns: protocol bus, workspace/lane/session state machines,
   terminal buffers, PTY lifecycle, audit sink, secrets vault, policy engine, inference
   registry, sharing adapters.
2. `apps/desktop` (`@helios/desktop`) — SolidJS desktop shell. Depends on `@helios/runtime`
   types. Owns: lane panels, context store, renderer settings, approval UI, runtime HTTP client.
3. `apps/renderer` — SolidJS UI components for chat and terminal rendering. Owns: xterm.js
   terminal widget, model selector, chat panel.
**Consequences**: Runtime is fully headless and independently testable; desktop and renderer
can be swapped without touching runtime logic; three package boundaries require explicit API
surface definition.
**Alternatives Considered**: Monolithic single-package (rejected: untestable without UI);
two-tier runtime+UI (considered; renderer split further to isolate high-frequency terminal
rendering from lane management UI).

---

## ADR-004: Hexagonal Architecture for Runtime Domain Logic

**Date**: 2026-03-26
**Status**: Accepted
**Context**: The runtime must support pluggable PTY backends, swappable inference adapters,
and configurable bus implementations. Binding business logic to concrete implementations
would make testing difficult and replacement costly.
**Decision**: Apply hexagonal (ports and adapters) architecture to the runtime. Port interfaces
defined in `protocol/bus.ts` (bus), `providers/adapter.ts` (provider), `pty/` (PTY adapter),
`integrations/inference/engine.ts` (inference). Concrete adapters implement the port. Domain
logic in `sessions/`, `workspace/`, `lanes/` depends only on ports. `packages/template-hexagonal`
codifies the canonical structure for new domain packages.
**Consequences**: Domain logic testable with in-memory stubs; new providers added by
implementing the adapter interface; `template-hexagonal` serves as a cookiecutter; adds
indirection requiring contributors to understand the port/adapter split.
**Alternatives Considered**: MVC (rejected: does not model event-driven multi-adapter
runtime well); flat modules (rejected: no boundary enforcement); DI framework (avoided to
keep architecture explicit and framework-independent).

---

## ADR-005: InMemoryLocalBus with Typed Envelope Protocol

**Date**: 2026-03-26
**Status**: Accepted
**Context**: Workspace, lane, session, and terminal entities must communicate via commands,
events, and responses without direct method calls that would create circular dependencies.
The protocol must enforce lifecycle ordering and support correlation tracking for
request/response pairs.
**Decision**: `LocalBus` port defined in `protocol/bus.ts` with `InMemoryLocalBus` as the
in-process implementation. All messages wrapped in `LocalBusEnvelope` with `correlation_id`,
type (`command`|`event`|`response`), topic, workspace_id, lane_id, session_id,
terminal_id, and payload. `protocol/validator.ts` enforces lifecycle rules before dispatch.
`protocol/topics.ts` and `protocol/methods.ts` define typed topic/method namespaces.
**Consequences**: Entities fully decoupled; correlation ID enables async request/response
matching; in-memory implementation is synchronous and testable without I/O; scaling to
multi-process requires replacing `InMemoryLocalBus` with a NATS or WebSocket adapter without
changing domain code; validator rules must stay in sync with entity state machines.
**Alternatives Considered**: Direct method calls (rejected: circular deps); EventEmitter
(rejected: untyped, no lifecycle enforcement); Redux-style store (rejected: overkill for
message-passing runtime); NATS from day one (rejected: server dependency for local dev).

---

## ADR-006: SolidJS for Desktop and Renderer UI

**Date**: 2026-03-26
**Status**: Accepted
**Context**: Both `apps/desktop` and `apps/renderer` require a reactive UI renderer inside
the Tauri shell. The renderer must handle high-frequency terminal output events (xterm.js)
and session state transitions without jank. Virtual DOM diffing adds overhead on every
terminal output tick.
**Decision**: Use SolidJS (≥1.9.11) for both the desktop shell and renderer. SolidJS
fine-grained reactivity updates only the affected DOM nodes without virtual DOM diffing.
xterm.js (`@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`) provides the
terminal widget. esbuild + `esbuild-plugin-solid` compiles SolidJS JSX. SolidJS signals
drive the context store in `apps/desktop/src/context_store.ts`.
**Consequences**: Terminal scroll performance measurably better than VDOM alternatives;
smaller bundle; smaller ecosystem and fewer off-the-shelf component libraries vs React;
contributors must understand SolidJS signals vs React hooks.
**Alternatives Considered**: React (rejected: VDOM overhead for terminal rendering, heavier
bundle); Vue (rejected: similar VDOM trade-offs); Svelte (considered; SolidJS chosen for
better TypeScript integration at decision time); vanilla DOM (rejected: not maintainable
for complex multi-panel layout).

---

## ADR-007: Biome as Unified Linter and Formatter

**Date**: 2026-03-26
**Status**: Accepted
**Context**: The project needs consistent code style and lint enforcement across all
TypeScript packages. ESLint + Prettier involves two tools, two configs, and integration
overhead.
**Decision**: Use Biome (1.9.4) as the sole linter and formatter. A single `biome.json`
at workspace root configures both (`lineWidth: 100`, `indentStyle: space`, `indentWidth: 2`,
`recommended` ruleset with selective overrides). `bun run lint` → `biome check`,
`bun run format` → `biome format --write`. oxlint also in devDependencies for supplementary
checks.
**Consequences**: Single tool, single config, faster lint (Rust-based); no Prettier/ESLint
conflicts; Biome's rule set smaller than ESLint plugin ecosystem; switching requires
migrating both lint and format configs.
**Alternatives Considered**: ESLint + Prettier (rejected: two-tool overhead, slower); dprint
(rejected: formatter only); oxlint as primary (retained as supplementary; Biome is primary).

---

## ADR-008: Three-Tier Test Strategy (Bun / Vitest / Playwright)

**Date**: 2026-03-26
**Status**: Accepted
**Context**: Three testing tiers have different requirements: unit tests need speed, integration
tests need rich module mocking, E2E tests need real browser automation against the Tauri
desktop.
**Decision**:
- **Unit**: `bun test` — `apps/runtime/tests/unit`, `apps/desktop/tests/unit`, `scripts/tests/`
- **Integration**: Vitest (2.1.9) — `apps/runtime/tests/integration`; richer mocking
- **E2E**: Playwright (1.58.2) — `playwright.config.ts`; browser automation against Tauri
- **DOM env**: `happy-dom` (20.8.7) for unit tests needing browser-like context
**Consequences**: Unit tests fast (Bun native); integration tests get Vitest module interception;
E2E tests exercise the full rendering pipeline; three runners add cognitive overhead; coverage
must be merged from multiple sources for unified report.
**Alternatives Considered**: Vitest for all (unit tier slower); Jest (slower, transpiler config
needed); Cypress for E2E (Playwright has better Tauri integration).

---

## ADR-009: Provider Adapter Registry with Health Monitoring

**Date**: 2026-03-26
**Status**: Accepted
**Context**: heliosApp must route agent sessions to multiple AI provider backends (Anthropic,
MLX, llama.cpp, vLLM, MCP, A2A). New providers should be addable without modifying the core
runtime. Provider health must be monitored to avoid routing sessions to degraded backends.
**Decision**: `InferenceEngine` interface in `integrations/inference/engine.ts` is the port.
`InferenceRegistry` in `integrations/inference/registry.ts` manages discovery and lookup.
A `HealthMonitor` in `integrations/inference/hardware.ts` polls registered engines and marks
healthy/degraded. Separate provider namespaces: `integrations/inference/` (cloud and local
LLM), `integrations/mcp/` (tool bridge), `integrations/a2a/` (agent delegation),
`integrations/acp_client/` (ACP).
**Consequences**: New providers added by implementing `InferenceEngine` and registering in
registry; health monitor routes away from degraded providers; multi-protocol from day one;
registry must handle concurrent registration safely.
**Alternatives Considered**: Hard-coded switch/case (rejected: not extensible); WASM plugin
isolation (deferred to future); direct SDK imports (rejected: tight coupling).

---

## ADR-010: PTY Lifecycle Manager with Zellij Mux Adapter

**Date**: 2026-03-26
**Status**: Accepted
**Context**: Agent sessions require real PTY processes. The runtime must spawn, monitor, and
clean up PTY processes across concurrent sessions. A terminal multiplexer provides developers
a unified view of all running sessions.
**Decision**: PTY lifecycle manager in `apps/runtime/src/pty/` owns process creation, I/O
piping (`io.ts`), buffer management (`buffers.ts`), idle monitoring (`idle_monitor.ts`), and
signal handling (`signals.ts`). Zellij mux adapter (`integrations/zellij/`) provides
terminal multiplexing. tmate and upterm adapters (`integrations/tmate/`, `integrations/upterm/`)
provide session sharing. xterm.js handles terminal rendering on the UI side.
**Consequences**: PTY processes isolated per session; Zellij provides keyboard-driven
navigation; Zellij is an external dependency that must be installed; PTY adapter is the
most platform-specific component (Unix PTY differs from Windows ConPTY).
**Alternatives Considered**: node-pty (rejected: Node.js dependency conflicts with Bun);
tmux adapter (considered; Zellij chosen for Rust-native design); direct `Bun.spawn` without
PTY (rejected: agents require interactive terminal).

---

## ADR-011: Policy Engine with File-Based Rule Store

**Date**: 2026-03-26
**Status**: Accepted
**Context**: Operators need to configure which commands are safe, need approval, or are blocked
per workspace. Rules must reload without restarting the process. The policy must apply to
both agent-initiated commands and direct developer commands.
**Decision**: `PolicyEngine` in `apps/runtime/src/policy/engine.ts` evaluates commands via
`PolicyStorage` which watches per-workspace rule files. Rules use glob or regex patterns with
priority ordering. `PolicyClassification`: `safe`, `needs-approval`, `blocked`. Blocked/
needs-approval commands routed to `approval-queue.ts`. Commands affecting protected paths
detected by `secrets/protected-paths-detector.ts` and escalated.
**Consequences**: Per-workspace policy customization; live reload on rule file changes;
central approval queue decouples blocking from evaluation; protected-paths detector
integrates secrets security with policy enforcement.
**Alternatives Considered**: In-memory only rules (rejected: not persistent, ops unfriendly);
OPA/Rego policy language (deferred as future enhancement); no policy layer (rejected: unsafe
for agent-generated commands).

---

## ADR-012: Secrets Vault with EncryptionService and Redaction Engine

**Date**: 2026-03-26
**Status**: Accepted
**Context**: AI provider API keys must never appear in audit logs, terminal output, or disk
in plaintext. The runtime handles credentials across multiple workspaces and providers.
**Decision**: `CredentialStore` in `apps/runtime/src/secrets/credential-store.ts` encrypts
all secrets via `EncryptionService` (`secrets/encryption.ts`). Access requires a typed
`CredentialAccessContext`. `RedactionEngine` (`secrets/redaction-engine.ts`) scans PTY
output with configurable regex rules from `redaction-rules.ts`. `sanitizePayload` in
`index.ts` redacts `api_key` fields from all audit payloads. `ProtectedPathsDetector`
escalates policy classification for commands touching credential files.
**Consequences**: Defense-in-depth: encryption at rest + redaction in transit + policy
escalation for protected paths; false positive rate tracked per redaction rule; audit trail
captures every access attempt.
**Alternatives Considered**: OS keychain only (not portable to all platforms); no redaction
(rejected: credentials appear in audit logs); plaintext env file storage (rejected: unsafe).

---

## ADR-013: InMemoryAuditSink with Ring Buffer and Recovery Bootstrap

**Date**: 2026-03-26
**Status**: Accepted
**Context**: All bus events must be captured for audit and to support crash recovery. The
audit sink must not block the main bus dispatch path. Processes may crash and must be able
to recover session state from persisted metadata.
**Decision**: `InMemoryAuditSink` (`apps/runtime/src/audit/sink.ts`) uses an `AuditRingBuffer`
with configurable retention (`config/retention.ts`). `exportRecoveryMetadata()` serializes
active lanes, sessions, and terminals to a JSON-safe structure. `classifyBootstrap(metadata)`
on restart classifies entities as recoverable (reconcile) or unrecoverable (cleanup). Session
checkpoints written to disk by `sessions/checkpoint_store.ts`. `exportAuditBundle` returns
filtered records with redacted payloads.
**Consequences**: No synchronous I/O on the audit hot path; session recovery deterministic
from bootstrap classification; in-memory sink loses data on crash (persistent sink is the
production target); ring buffer prevents unbounded memory growth.
**Alternatives Considered**: File-based audit from day one (deferred: sync I/O on hot path);
OpenTelemetry only (rejected: not designed for session replay); event sourcing via NATS
(deferred: local bus is intentionally in-process).

---

## ADR-014: Canary Dependency Management with Changelog and Rollback

**Date**: 2026-03-26
**Status**: Accepted
**Context**: The project explicitly targets bleeding-edge dependencies. Bulk updates risk
accumulating breaking changes. GitHub Actions billing is broken on this account, making
automated PR-based update bots (Renovate, Dependabot) impractical.
**Decision**: Three custom scripts implement structured canary workflow:
- `scripts/deps-canary.ts` — upgrades one dependency, logs old/new version to
  `deps-changelog.json` and `deps-registry.json`
- `scripts/deps-status.ts` — reports current vs latest across all workspace packages
- `scripts/deps-rollback.ts` — reverts a specific dependency to its logged previous version
`bun run deps:canary`, `deps:status`, `deps:rollback` are the entry points.
**Consequences**: Individual dependency updates are trackable and reversible; canary upgrade
testable on feature branch before merge; `deps-changelog.json` grows over time and must be
periodically pruned; custom scripts must be maintained.
**Alternatives Considered**: Renovate (rejected: GitHub Actions billing broken); Dependabot
(same reason); `bun update` without logging (rejected: no rollback).

---

## ADR-015: VitePress Documentation Site with Auto-Generated Navigation Index

**Date**: 2026-03-26
**Status**: Accepted
**Context**: The project needs browsable, statically deployable documentation covering
architecture, APIs, and onboarding. Documentation must be openable via `file://` without
a web server.
**Decision**: VitePress (1.6.3) at `docs/`. Shell script
`docs/scripts/generate-doc-index.sh` auto-generates navigation from the docs directory
tree before each build. `bun run docs:build` → static site in `docs/.vitepress/dist/`.
GitHub Pages deployment via `.github/workflows/vitepress-pages.yml`.
**Consequences**: Offline-browsable docs; auto-index keeps navigation in sync without
manual sidebar config; VitePress Vue-based renderer supports interactive docs components;
contributors must run `docs:build` to see final output; index script must work on macOS
and Linux.
**Alternatives Considered**: Docusaurus (rejected: React-based, heavier, slower builds);
GitBook (rejected: SaaS, not locally browsable); MkDocs (considered; VitePress chosen
for TypeScript ecosystem integration).
