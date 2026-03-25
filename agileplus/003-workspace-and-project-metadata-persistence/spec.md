# Feature Specification: Workspace and Project Metadata Persistence

**Feature Branch**: `003-workspace-and-project-metadata-persistence`
**Created**: 2026-02-27
**Status**: Draft

## Overview

Workspace CRUD and project bootstrap for heliosApp. Scope: create, open, close, and delete workspaces; bind projects to workspaces; manage root paths; persist metadata. MVP uses in-memory storage with JSON snapshots; durability phase migrates to SQLite. This spec owns the data model and lifecycle — not the UI surfaces (001) or the bus messages (002).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Workspace Lifecycle (Priority: P0)

As an operator, I can create, open, close, and delete workspaces so that I can organize my work into isolated contexts.

**Why this priority**: Workspaces are the top-level organizational boundary; nothing else functions without them.

**Independent Test**: Exercise full CRUD lifecycle through the API, verify state transitions, confirm deletion removes all associated metadata.

**Acceptance Scenarios**:

1. **Given** no workspaces exist, **When** the user creates a workspace with a name and root path, **Then** the workspace is persisted and appears in the workspace list.
2. **Given** an open workspace, **When** the user closes it, **Then** the workspace state is saved and it is removed from active workspace set.
3. **Given** a workspace with no active sessions, **When** the user deletes it, **Then** all associated metadata is removed and the workspace no longer appears in any listing.
4. **Given** a workspace with active sessions, **When** the user attempts deletion, **Then** the system blocks deletion and surfaces a "close sessions first" error.

---

### User Story 2 — Project Binding and Bootstrap (Priority: P1)

As an operator, I can bind a project (git repo or directory) to a workspace and bootstrap it (init or clone) so that workspace context reflects real project structure.

**Why this priority**: Project binding connects the abstract workspace to concrete filesystem context.

**Acceptance Scenarios**:

1. **Given** an existing workspace, **When** the user binds a local directory as a project, **Then** the project root path is recorded and validated.
2. **Given** an existing workspace, **When** the user binds a git clone URL, **Then** the system clones the repo into workspace-managed storage and records the binding.
3. **Given** a bound project whose root path no longer exists, **When** the workspace is opened, **Then** the system flags the project as `stale` and surfaces remediation options.

---

### User Story 3 — Metadata Persistence Across Restarts (Priority: P1)

As an operator, I can restart heliosApp and find all my workspaces and project bindings intact.

**Why this priority**: Without persistence, every restart destroys organizational context.

**Acceptance Scenarios**:

1. **Given** workspaces with bound projects, **When** the app restarts, **Then** all workspace and project metadata is restored from persisted storage.
2. **Given** a corrupted metadata file, **When** the app starts, **Then** the system detects corruption, logs the error, and offers recovery from last known good snapshot.

---

### Edge Cases

- Workspace names must be unique within the installation; duplicate creation returns a clear error.
- Root paths must be absolute and point to accessible directories; relative paths are rejected.
- Concurrent workspace operations (e.g., two windows deleting the same workspace) must be serialized.
- Metadata migration from in-memory/JSON to SQLite must be non-destructive and reversible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support workspace CRUD: create (name, root_path), open, close, delete.
- **FR-002**: The system MUST enforce unique workspace names within an installation.
- **FR-003**: The system MUST support project binding: attach a local directory or git clone URL to a workspace.
- **FR-004**: The system MUST validate project root paths on workspace open and flag unreachable paths as `stale`.
- **FR-005**: The system MUST persist workspace and project metadata to local storage (JSON for MVP, SQLite for durability phase).
- **FR-006**: The system MUST restore all workspace and project metadata on app restart.
- **FR-007**: The system MUST detect metadata corruption and offer recovery from last known good snapshot.
- **FR-008**: The system MUST block workspace deletion when active sessions exist, surfacing an actionable error.
- **FR-009**: The system MUST emit bus events (via spec 002) for workspace lifecycle transitions: `workspace.created`, `workspace.opened`, `workspace.closed`, `workspace.deleted`.
- **FR-010**: The system MUST assign each workspace a unique `workspace_id` per spec 005 ID standards.

### Non-Functional Requirements

- **NFR-001**: Workspace create/open/close operations MUST complete in < 100ms (p95).
- **NFR-002**: Metadata persistence (flush to disk) MUST complete in < 200ms (p95) for up to 50 workspaces.
- **NFR-003**: Metadata restore on startup MUST complete in < 500ms (p95) for up to 50 workspaces with 10 projects each.
- **NFR-004**: Metadata storage footprint MUST be < 1 MB for 50 workspaces with 10 projects each.

### Dependencies

- **Spec 002** (Local Bus): Workspace lifecycle events published through the bus.
- **Spec 005** (ID Standards): Workspace and project IDs follow the unified ID schema.

## Key Entities

- **Workspace**: Top-level organizational boundary with unique name, root path, lifecycle state (active/closed/deleted), and metadata.
- **Project Binding**: Association between a workspace and a project root (local path or git URL) with status (active/stale).
- **Metadata Store**: Persistence layer abstracting JSON (MVP) and SQLite (durability phase) backends.
- **Workspace Snapshot**: Point-in-time serialization of workspace and project metadata for corruption recovery.

## Success Criteria *(mandatory)*

- **SC-001**: Full CRUD lifecycle (create, open, close, delete) passes integration tests with 100% state consistency.
- **SC-002**: App restart restores 100% of persisted workspaces and project bindings in < 500ms.
- **SC-003**: Corruption injection tests recover from last known good snapshot in 100% of cases.
- **SC-004**: Concurrent workspace operation tests produce zero data races or inconsistent states.
- **SC-005**: Stale project detection correctly flags 100% of unreachable root paths on workspace open.

## Assumptions

- MVP persistence is JSON files in a well-known app data directory; SQLite migration follows in a subsequent slice.
- Workspaces are local-only; sync/sharing is post-MVP.
- Project bootstrap (git clone) delegates to system git; no embedded git implementation.
- Workspace metadata does not include terminal session state (that belongs to spec 008-009).
