# Product Requirements Document — heliosApp

## E1: Runtime Orchestration

### E1.1: Local Bus Protocol
As the runtime, I want a unified message bus so that workspace, lane, session, and terminal entities can communicate via commands, events, and responses.

**Acceptance Criteria:**
- LocalBusEnvelope protocol with command, event, and response types
- Correlation tracking via `correlation_id`
- Lifecycle ordering enforcement (state machine transitions)

### E1.2: Workspace and Lane Management
As a developer, I want to create workspaces with lanes so that I can organize parallel agent sessions.

**Acceptance Criteria:**
- Workspace CRUD with persistent state
- Lane orchestration (PAR lanes for parallel execution)
- Lane-to-session binding

### E1.3: Session and Terminal Lifecycle
As a developer, I want to attach sessions to lanes and spawn terminals so that agents can execute commands.

**Acceptance Criteria:**
- Session attach/detach with state machine
- PTY lifecycle manager for terminal processes
- Zellij mux adapter for multiplexed sessions

---

## E2: Desktop Application

### E2.1: Tauri Desktop Shell
As a user, I want a native desktop application so that I can interact with the runtime visually.

**Acceptance Criteria:**
- Tauri-based desktop app with TypeScript renderer
- Terminal rendering UI
- Integration with runtime via local bus

---

## E3: Provider and Extension System

### E3.1: Provider Adapter Interface
As a developer, I want pluggable provider adapters so that new AI providers can be added without modifying core runtime.

**Acceptance Criteria:**
- Provider adapter interface with lifecycle hooks
- Provider registry for discovery and management
- Configuration per-provider

---

## E4: Observability and Security

### E4.1: Audit Logging
As an operator, I want audit logging and session replay so that I can review agent actions.

**Acceptance Criteria:**
- Audit log capture for all bus events
- Session replay from audit trail

### E4.2: Secrets Management
As a developer, I want secure secret handling so that credentials are not exposed in sessions.

**Acceptance Criteria:**
- Secrets module with encrypted storage
- Secret injection into terminal environments

---

## E5: Configuration and Build

### E5.1: App Settings and Feature Flags
As a developer, I want configuration and feature flags so that I can control runtime behavior.

**Acceptance Criteria:**
- App settings via config module
- Feature flag evaluation at runtime
- Renderer engine settings control

### E5.2: CI/CD and Quality Gates
As a team, we want automated quality gates so that all changes pass lint, test, and security checks.

**Acceptance Criteria:**
- Biome linting, Vitest testing
- Policy gate, stage gates, required check guards
- VitePress documentation deployment
