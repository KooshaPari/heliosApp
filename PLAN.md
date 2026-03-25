# Implementation Plan — heliosApp

## Phase 1: Core Protocol and Infrastructure (Done)

| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| P1.1 | LocalBus envelope protocol (command/event/response) | — | Done |
| P1.2 | ID standards and cross-repo coordination | — | Done |
| P1.3 | Bun monorepo with workspace structure | — | Done |

## Phase 2: Runtime Core (Done)

| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| P2.1 | Workspace state management | P1.1 | Done |
| P2.2 | PAR lane orchestrator | P2.1 | Done |
| P2.3 | Session lifecycle and binding | P2.2 | Done |
| P2.4 | PTY lifecycle manager | P2.3 | Done |
| P2.5 | Zellij mux session adapter | P2.4 | Done |

## Phase 3: Desktop and Renderer (In Progress)

| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| P3.1 | Tauri desktop shell | P1.3 | In Progress |
| P3.2 | Terminal renderer UI | P3.1 | In Progress |
| P3.3 | Runtime-desktop integration via bus | P3.1, P1.1 | In Progress |

## Phase 4: Extensions and Providers (Planned)

| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| P4.1 | Provider adapter interface | P2.1 | Planned |
| P4.2 | Provider registry | P4.1 | Planned |
| P4.3 | Share session workflows | P2.3 | Planned |

## Phase 5: Observability and Security (Planned)

| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| P5.1 | Audit logging and session replay | P1.1 | Planned |
| P5.2 | Secrets management module | P2.1 | Planned |
| P5.3 | Diagnostics and recovery | P2.1 | Planned |

## Phase 6: CI/CD and Quality (Done)

| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| P6.1 | GitHub Actions CI workflows | — | Done |
| P6.2 | Policy gate and stage gates | P6.1 | Done |
| P6.3 | VitePress documentation | — | Done |
