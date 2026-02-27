# Work Packages: Secrets Management and Redaction

**Inputs**: Design documents from `/kitty-specs/028-secrets-management-and-redaction/`
**Prerequisites**: plan.md (required), spec.md (user stories), related specs (002, 024, 025)

**Tests**: Include explicit testing work because the feature spec and constitution require strict validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/028-secrets-management-and-redaction/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `apps/`, `specs/`, and `kitty-specs/`.

---

## Work Package WP01: Encrypted Credential Store and Lifecycle (Priority: P0 -- prerequisite to all other WPs)

**Phase**: Phase 0 - Foundation
**Goal**: Implement an encrypted per-provider+workspace credential store with AES-256-GCM, credential lifecycle operations (create, rotate, revoke), cross-provider isolation enforcement, and credential access audit trail.
**Independent Test**: Store a credential, verify encryption on disk, retrieve for use, rotate (old irrecoverable), revoke (removed + audit event). Cross-provider access denied.
**Prompt**: `/kitty-specs/028-secrets-management-and-redaction/tasks/WP01-encrypted-credential-store-and-lifecycle.md`
**Estimated Prompt Size**: ~400 lines

### Included Subtasks
- [x] T001 Implement AES-256-GCM encryption module with OS keychain master key integration in `apps/runtime/src/secrets/encryption.ts`
- [x] T002 Implement per-provider+workspace credential store with scoped access in `apps/runtime/src/secrets/credential-store.ts`
- [x] T003 Implement credential lifecycle operations (create, rotate, revoke) with audit event emission
- [x] T004 [P] Implement cross-provider credential isolation enforcement and access denial
- [x] T005 [P] Add unit tests for encryption, credential store, lifecycle operations, and cross-provider isolation

### Implementation Notes
- Master key derived from OS keychain; no hardcoded keys.
- Rotation overwrites previous value making it irrecoverable.
- Fully offline operation; no remote key vault dependency.

### Parallel Opportunities
- T004 and T005 can proceed after T001-T003 are stable.

### Dependencies
- None (foundation WP).

### Risks & Mitigations
- Risk: OS keychain API differs across platforms.
- Mitigation: Keychain access abstracted behind interface; platform-specific implementations.

---

## Work Package WP02: Redaction Engine and Pattern Matching (Priority: P0)

**Goal**: Implement a synchronous pattern-based redaction engine at the audit sink boundary that detects and strips secrets before persistence or export. Support configurable and operator-tunable redaction rules.
**Independent Test**: Emit known API key pattern in content, pass through redaction engine, verify key is replaced with placeholder. False positive rate is tunable.
**Prompt**: `/kitty-specs/028-secrets-management-and-redaction/tasks/WP02-redaction-engine-and-pattern-matching.md`
**Estimated Prompt Size**: ~380 lines

### Included Subtasks
- [x] T006 Implement redaction engine as synchronous filter on audit sink path in `apps/runtime/src/secrets/redaction-engine.ts`
- [ ] T007 Implement default redaction rules for AWS, GCP, GitHub, OpenAI key patterns in `apps/runtime/src/secrets/redaction-rules.ts`
- [x] T008 Implement configurable and operator-tunable redaction rule management
- [x] T009 Implement redaction audit trail proving redaction was applied to each artifact in `apps/runtime/src/secrets/audit-trail.ts`
- [x] T010 [P] Add unit tests for redaction engine, default patterns, custom rules, and audit trail generation

### Implementation Notes
- Redaction is synchronous; must not add > 5ms latency to audit sink path.
- Binary content passes through without text-pattern scanning.
- Redaction replaces secrets with `[REDACTED:<category>]` placeholder.

### Parallel Opportunities
- T010 can proceed after T006-T009 are stable.

### Dependencies
- Depends on WP01 (credential store provides known patterns).

### Risks & Mitigations
- Risk: Regex-based pattern matching is too slow for high-throughput audit paths.
- Mitigation: Compile patterns once at startup; benchmark against 5ms budget in tests.

---

## Work Package WP03: Protected Paths, Audit Integration, and Tests (Priority: P1)

**Goal**: Implement protected path warnings for sensitive file access, integrate credential access and redaction audit trails with spec 024, deliver CI redaction verification tests, and comprehensive integration tests.
**Independent Test**: Terminal command accessing `.env` triggers warning badge; audit export contains no unredacted secrets; cross-provider credential access denied; redaction audit trail present for all artifacts.
**Prompt**: `/kitty-specs/028-secrets-management-and-redaction/tasks/WP03-protected-paths-audit-integration-and-tests.md`
**Estimated Prompt Size**: ~420 lines

### Included Subtasks
- [x] T011 Implement protected path detection and warning emission for sensitive file access in `apps/runtime/src/secrets/protected-paths.ts`
- [x] T012 Implement configurable protected path list with operator-added custom patterns
- [x] T013 Integrate credential access and redaction audit trails with spec 024 audit subsystem
- [ ] T014 [P] Add CI redaction verification tests that block merge on unredacted secrets (FR-028-011)
- [ ] T015 [P] Add integration tests for protected path warnings, cross-provider isolation, audit completeness, and redaction verification

### Implementation Notes
- Protected path detection monitors terminal command input, not filesystem events.
- Warning is a badge/toast in terminal pane, not a blocking prompt (operator acknowledges).
- CI redaction tests should be deterministic with known secret patterns.

### Parallel Opportunities
- T014 and T015 can proceed after T011-T013 implementations are stable.

### Dependencies
- Depends on WP01 and WP02.

### Risks & Mitigations
- Risk: Protected path detection causes false positives on common commands.
- Mitigation: Default path list is conservative; operator-tunable patterns reduce false positives.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03.
- **Parallelization**: Within each WP, designated `[P]` tasks can execute in parallel after interface-lock milestones.
- **MVP Scope**: WP01 (credential store) + WP02 (redaction engine) deliver core security; WP03 adds protected paths, audit integration, and CI verification.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | AES-256-GCM encryption module | WP01 | P0 | No |
| T002 | Per-provider+workspace credential store | WP01 | P0 | No |
| T003 | Credential lifecycle operations | WP01 | P0 | No |
| T004 | Cross-provider isolation enforcement | WP01 | P0 | Yes |
| T005 | Encryption and credential store unit tests | WP01 | P0 | Yes |
| T006 | Redaction engine synchronous filter | WP02 | P0 | No |
| T007 | Default redaction rules (AWS, GCP, etc.) | WP02 | P0 | No |
| T008 | Configurable redaction rule management | WP02 | P0 | No |
| T009 | Redaction audit trail | WP02 | P0 | No |
| T010 | Redaction engine unit tests | WP02 | P0 | Yes |
| T011 | Protected path detection and warnings | WP03 | P1 | No |
| T012 | Configurable protected path list | WP03 | P1 | No |
| T013 | Audit subsystem integration | WP03 | P1 | No |
| T014 | CI redaction verification tests | WP03 | P1 | Yes |
| T015 | Protected path and audit integration tests | WP03 | P1 | Yes |
