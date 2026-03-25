# Feature Specification: Secrets Management and Log Redaction

**Feature Branch**: `028-secrets-management-and-redaction`
**Created**: 2026-02-27
**Updated**: 2026-02-27
**Status**: Draft

## Overview

Secrets management and redaction pipeline for heliosApp. Credentials are stored securely per provider, encrypted at rest, and scoped to prevent cross-provider leakage. A redaction engine intercepts all output destined for persistence (audit logs, terminal captures, export bundles) and strips detected secrets before storage. The constitution mandates credential isolation and redaction; this spec defines the WHAT and WHY for that mandate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Credential Storage and Lifecycle (Priority: P0)

As an operator, I can store provider credentials securely so that my API keys and tokens are encrypted at rest and never exposed in logs.

**Why this priority**: Credential leakage is the highest-severity security failure mode.

**Independent Test**: Store a credential, verify it is encrypted on disk, retrieve it for use, rotate it, verify the old value is irrecoverable.

**Acceptance Scenarios**:

1. **Given** a new provider credential, **When** the operator stores it, **Then** it is encrypted at rest and scoped to the provider+workspace combination.
2. **Given** a stored credential, **When** the operator rotates it, **Then** the previous value is overwritten and irrecoverable from the credential store.
3. **Given** a stored credential, **When** the operator revokes it, **Then** it is removed from the store and an audit event is recorded.

---

### User Story 2 — Automatic Redaction in Logs and Exports (Priority: P0)

As an operator, I can trust that secrets are never persisted in audit logs, terminal output captures, or export bundles, even if they appear in terminal output.

**Why this priority**: A single unredacted secret in logs can compromise an entire provider account.

**Independent Test**: Emit a known API key pattern in terminal output, trigger an audit log export, verify the key is redacted in the exported content.

**Acceptance Scenarios**:

1. **Given** terminal output containing an API key matching a known pattern, **When** the output is captured for audit persistence, **Then** the key is replaced with a redaction placeholder before storage.
2. **Given** an export bundle generation, **When** the bundle includes terminal captures and audit events, **Then** all content passes through the redaction engine before being written to the bundle.
3. **Given** a false-positive redaction, **When** the operator reviews the redaction log, **Then** they can see what was redacted and tune the pattern to reduce false positives.

---

### User Story 3 — Protected Path Warnings (Priority: P1)

As an operator, I receive a warning when terminal commands interact with files in sensitive paths so that I am aware of potential credential exposure.

**Why this priority**: Proactive warnings prevent accidental credential exposure before it reaches the redaction boundary.

**Acceptance Scenarios**:

1. **Given** a terminal command that reads `.env` or `credentials.json`, **When** the command is detected, **Then** a warning badge appears in the terminal pane indicating sensitive file access.
2. **Given** a configurable protected path list, **When** the operator adds a custom path pattern, **Then** subsequent access to matching paths triggers the warning.
3. **Given** a warning is displayed, **When** the operator acknowledges it, **Then** the command proceeds normally and the acknowledgment is recorded in the audit log.

---

### Edge Cases

- Redaction must handle partial secret matches (truncated keys in wrapped terminal lines) without leaving fragments.
- Concurrent credential rotation and credential read must not return stale or partially-written values.
- Redaction engine must not introduce more than 5ms latency on the audit sink path.
- Binary content in terminal output must pass through redaction without corruption.
- Credentials must remain accessible during network-offline operation (no dependency on remote key vault).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-028-001**: The system MUST provide a secure per-provider credential store with encryption at rest.
- **FR-028-002**: The system MUST scope credentials to provider+workspace and prevent cross-provider credential access.
- **FR-028-003**: The system MUST support credential lifecycle operations: create, rotate, and revoke, each producing an audit event.
- **FR-028-004**: The system MUST implement a pattern-based redaction engine that detects API keys, tokens, passwords, and connection strings.
- **FR-028-005**: The system MUST apply redaction at the audit sink boundary, before any content is persisted or exported.
- **FR-028-006**: The system MUST support configurable redaction rules with operator-tunable patterns.
- **FR-028-007**: The system MUST warn operators when terminal commands access sensitive file paths (`.env`, `credentials.json`, `**/secrets/**`).
- **FR-028-008**: The system MUST support a configurable protected path list.
- **FR-028-009**: The system MUST maintain a credential access audit trail recording every read, write, and delete of credentials.
- **FR-028-010**: The system MUST maintain a redaction audit trail proving that redaction was applied to each persisted artifact.
- **FR-028-011**: The system MUST provide redaction verification tests as part of the CI/CD pipeline.

### Non-Functional Requirements

- **NFR-028-001**: Redaction engine MUST NOT add more than 5ms latency (p95) to the audit sink write path.
- **NFR-028-002**: Credential store encryption MUST use AES-256-GCM or equivalent AEAD cipher.
- **NFR-028-003**: Credential store MUST operate fully offline (no remote key vault dependency).
- **NFR-028-004**: Redaction false-positive rate MUST be tunable to below 1% for standard development workflows after initial configuration.

### Dependencies

- **Spec 002** (Local Bus): Credential access events and redaction notifications are dispatched via the bus.
- **Spec 024** (Audit Logging): Redacted audit events are persisted through the audit subsystem.
- **Spec 025** (Provider Isolation): Credential scoping aligns with provider isolation boundaries.

## Key Entities

- **Credential Store**: An encrypted, per-provider storage backend for API keys, tokens, and other secrets.
- **Redaction Engine**: A pipeline component that pattern-matches secrets in content and replaces them with redaction placeholders before persistence.
- **Redaction Rule**: A configurable pattern (regex or structured matcher) defining what constitutes a secret for redaction purposes.
- **Protected Path**: A file path pattern that triggers operator warnings when accessed from a terminal.
- **Redaction Audit Record**: Proof that a specific artifact was processed by the redaction engine, including what was redacted (by category, not by value).

## Success Criteria *(mandatory)*

- **SC-028-001**: Zero secrets appear in persisted audit logs or export bundles across 100% of redaction test scenarios.
- **SC-028-002**: Credential rotation produces irrecoverable previous values in 100% of lifecycle tests.
- **SC-028-003**: Redaction engine adds < 5ms latency to audit sink writes in 95% of measurements.
- **SC-028-004**: Cross-provider credential access attempts are denied in 100% of isolation tests.
- **SC-028-005**: Redaction audit trail is present for every persisted artifact in 100% of compliance verification runs.

## Assumptions

- Credential encryption keys are derived from a local master key managed by the OS keychain or a user-provided passphrase; key management UX is a separate concern.
- Redaction patterns ship with sensible defaults (AWS, GCP, GitHub, OpenAI key formats) and are extensible by operators.
- Redaction operates on text content; binary blobs are passed through without text-pattern scanning.
- The redaction engine is a synchronous filter on the audit sink path, not an async post-processor.
