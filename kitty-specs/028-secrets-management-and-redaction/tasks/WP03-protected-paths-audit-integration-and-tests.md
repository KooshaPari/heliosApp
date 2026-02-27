---
work_package_id: WP03
title: Protected Paths, Audit Integration, and Tests
lane: "for_review"
dependencies:
- WP01
- WP02
base_branch: main
created_at: '2026-02-27T00:00:00+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
phase: Phase 2 - Integration and Hardening
assignee: ''
agent: ''
shell_pid: ''
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP03 - Protected Paths, Audit Integration, and Tests

## Objectives & Success Criteria

- Implement protected path detection that warns operators when terminal commands access sensitive files.
- Deliver a configurable protected path list with operator-added custom patterns.
- Integrate credential access and redaction audit trails with the spec 024 audit subsystem.
- Deliver CI redaction verification tests that block merge on unredacted secrets.
- Deliver comprehensive integration tests covering all success criteria.

Success criteria:
- Terminal command accessing `.env` triggers warning badge (FR-028-007).
- Configurable path list works with custom patterns (FR-028-008).
- Audit export contains zero unredacted secrets (SC-028-001).
- Cross-provider credential access denied in 100% of tests (SC-028-004).
- Redaction audit trail present for every persisted artifact (SC-028-005).
- CI gate fails on unredacted secrets in test scenarios (FR-028-011).

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/028-secrets-management-and-redaction/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/028-secrets-management-and-redaction/spec.md`
- WP01-WP02 outputs:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/encryption.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/credential-store.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/redaction-engine.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/redaction-rules.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/audit-trail.ts`
- Audit subsystem (spec 024):
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/audit/`

Constraints:
- Protected path detection monitors terminal command input, not filesystem events.
- Warning is non-blocking (badge/toast, not prompt).
- CI tests must be deterministic with known patterns.
- Coverage >=85% with FR-028-007, FR-028-008, FR-028-011 traceability.

Implementation command:
- `spec-kitty implement WP03`

## Subtasks & Detailed Guidance

### Subtask T011 - Implement protected path detection and warning emission

- Purpose: Proactively warn operators before credential exposure reaches the redaction boundary.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/protected-paths.ts`.
  2. Implement `ProtectedPathDetector` class:
     - `check(command: string): ProtectedPathMatch[]`:
       - Scan terminal command text for file path references matching protected patterns.
       - Return list of matches with path pattern, matched path, and warning message.
     - `onWarning(callback: (match: ProtectedPathMatch) => void): void`:
       - Register callback for warning delivery.
  3. Define default protected path patterns:
     - `.env` (and `.env.*` variants).
     - `credentials.json`, `credentials.yaml`, `credentials.yml`.
     - `**/secrets/**` (any path containing a `secrets` directory).
     - `~/.ssh/id_*` (SSH private keys).
     - `~/.aws/credentials`, `~/.aws/config`.
     - `~/.config/gcloud/application_default_credentials.json`.
     - `**/service-account*.json` (GCP service account keys).
  4. Implement command scanning:
     - Parse command text for file path arguments.
     - Match against protected patterns using glob matching.
     - Handle common commands: `cat`, `less`, `vim`, `nano`, `code`, `cp`, `mv`, `scp`, `curl -d @file`.
  5. On match, emit `secrets.protected_path.accessed` bus event:
     - Payload: matched pattern, matched path, command (redacted), terminal ID, correlation ID.
  6. UI integration point: bus event consumed by terminal pane to show warning badge/toast.
  7. Implement acknowledgment tracking:
     - Operator can acknowledge warning (badge dismissed).
     - Acknowledgment recorded as audit event.
     - Same path access within 5 minutes does not re-trigger warning (debounce).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/protected-paths.ts`
- Validation:
  - `cat .env` triggers warning.
  - `cat README.md` does not trigger warning.
  - SSH key access triggers warning.
  - Command with multiple file args detects all protected paths.
  - Acknowledgment prevents re-trigger within debounce window.
  - Bus event emitted on detection.
- Parallel: No.

### Subtask T012 - Implement configurable protected path list

- Purpose: Allow operators to customize which paths trigger warnings.
- Steps:
  1. In `protected-paths.ts`, implement `ProtectedPathConfig`:
     - `addPattern(pattern: string, description: string): void` -- add custom protected path pattern.
     - `removePattern(pattern: string): void` -- remove custom pattern.
     - `listPatterns(): ProtectedPathPattern[]` -- list all patterns (default + custom).
     - `importPatterns(path: string): Promise<void>` -- load from JSON config.
     - `exportPatterns(path: string): Promise<void>` -- save to JSON config.
  2. Persist custom patterns:
     - File: `<data-dir>/config/protected-paths.json`.
     - Default patterns loaded first, custom patterns merged.
     - Custom patterns can disable default patterns by referencing their ID.
  3. Define `ProtectedPathPattern` type:
     - `id: string`, `pattern: string` (glob), `description: string`, `enabled: boolean`, `isDefault: boolean`.
  4. Validate pattern syntax on add:
     - Reject empty patterns.
     - Reject overly broad patterns (e.g., `*` or `**/*`).
     - Warn on patterns that match common non-sensitive paths.
  5. Emit bus event on config change: `secrets.protected_paths.config.changed`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/protected-paths.ts`
- Validation:
  - Custom patterns are added and trigger warnings.
  - Patterns persist across restarts.
  - Default patterns can be disabled.
  - Invalid patterns are rejected.
  - Overly broad patterns trigger warning.
- Parallel: No.

### Subtask T013 - Integrate credential access and redaction audit trails with spec 024

- Purpose: Ensure all credential and redaction events flow through the audit subsystem.
- Steps:
  1. Wire credential store audit events to spec 024 audit sink:
     - `secrets.credential.created`, `secrets.credential.rotated`, `secrets.credential.revoked`, `secrets.credential.accessed`, `secrets.credential.access.denied`.
     - Each event passes through the audit sink's persistence pipeline.
  2. Wire redaction audit events to spec 024:
     - `secrets.redaction.applied` events are persisted as audit records.
     - Redaction audit records are queryable via audit API.
  3. Wire protected path events to spec 024:
     - `secrets.protected_path.accessed` events are persisted.
     - Acknowledgment events are persisted.
  4. Ensure all audit events from this spec are themselves redacted before persistence:
     - Credential events must not contain credential values (already enforced in WP01).
     - Redaction events must not contain matched secret values (already enforced in WP02).
     - Protected path events contain command text which must pass through redaction.
  5. Implement audit export integration:
     - When spec 024 export bundle is generated, all secrets-related audit records are included.
     - Export content passes through redaction engine (double-redaction safety).
  6. Verify round-trip: store credential -> access credential -> export audit -> verify export contains access record but not credential value.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/audit-trail.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/audit/` (integration points)
- Validation:
  - All credential lifecycle events appear in audit log.
  - All redaction events appear in audit log.
  - Protected path events appear in audit log.
  - Audit export contains no credential values.
  - Double-redaction on export does not corrupt non-secret content.
- Parallel: No.

### Subtask T014 - Add CI redaction verification tests

- Purpose: Ensure CI pipeline catches unredacted secrets and blocks merge.
- Steps:
  1. Create redaction verification test suite that runs as part of CI:
     - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/__tests__/ci-redaction-verification.test.ts`.
  2. Test scenarios:
     - **Known pattern injection**: Inject known AWS, GitHub, OpenAI keys into audit events. Verify all are redacted in persisted output.
     - **Export bundle verification**: Generate export bundle with injected secrets. Verify bundle contains zero unredacted secrets.
     - **Multi-line secret**: Inject private key block spanning multiple lines. Verify complete redaction.
     - **Partial match**: Inject truncated key at line boundary. Verify redaction handles partial match.
     - **False positive baseline**: Run redaction on 1000 lines of typical code output. Verify false positive rate < 1%.
  3. Implement verification as assertion-based tests:
     - Scan output for known injected patterns using exact string matching.
     - Any match = test failure.
  4. Configure tests to run in CI pipeline:
     - Add test to Vitest config.
     - Mark as required gate (failure blocks merge).
  5. Include test fixtures:
     - `__fixtures__/known-secrets.json`: known positive patterns for each category.
     - `__fixtures__/non-secrets.json`: known negative patterns (common strings that should not be redacted).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/__tests__/ci-redaction-verification.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/__tests__/__fixtures__/known-secrets.json`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/__tests__/__fixtures__/non-secrets.json`
- Validation:
  - All known secret patterns are caught by redaction.
  - False positive rate < 1% on non-secret fixture.
  - Test failure blocks CI merge.
  - FR-028-011 fully covered.
- Parallel: Yes (after T011-T013 are stable).

### Subtask T015 - Add integration tests for protected paths, isolation, audit, and redaction

- Purpose: Verify end-to-end security workflow correctness across all success criteria.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/__tests__/integration.test.ts`.
  2. **Protected path tests** (FR-028-007, FR-028-008):
     - `cat .env` triggers warning.
     - `cat README.md` does not trigger warning.
     - Custom pattern addition triggers on matching commands.
     - Acknowledgment debounces repeated warnings.
  3. **Cross-provider isolation tests** (SC-028-004):
     - Store credential for provider A.
     - Attempt retrieval from provider B context.
     - Verify denial in 100% of attempts.
     - Verify denial audit event emitted.
  4. **Audit completeness tests** (SC-028-005):
     - Run full lifecycle: store credential, access it, redact output, export audit.
     - Verify every action has audit record.
     - Verify redaction audit trail present for every persisted artifact.
  5. **End-to-end redaction test** (SC-028-001):
     - Inject secrets into terminal output.
     - Capture for audit persistence.
     - Verify persisted content has redaction placeholders.
     - Generate export bundle.
     - Verify export contains zero unredacted secrets.
  6. **Credential rotation test** (SC-028-002):
     - Store credential, rotate.
     - Read raw credential file.
     - Verify old value is not recoverable from encrypted file.
  7. **Redaction latency test** (SC-028-003):
     - Measure redaction latency over 100 audit events.
     - Verify p95 < 5ms.
  8. Map all tests to SC-028-001 through SC-028-005.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/__tests__/integration.test.ts`
- Validation:
  - All test scenarios pass.
  - Each SC-028-* has at least one mapped test.
  - Coverage across all secrets files >=85%.
- Parallel: Yes (after T011-T013 are stable).

## Test Strategy

- Protected path tests use mock terminal command input.
- Isolation tests use different provider context objects.
- Audit completeness tests capture events via spy on audit sink.
- Redaction verification uses known secret fixtures.
- Latency tests use `performance.now()` with statistical aggregation.
- All tests run via Bun/Vitest.

## Risks & Mitigations

- Risk: Protected path command parsing misses unusual file argument formats.
- Mitigation: Cover common command patterns (cat, less, vim, cp, scp, curl -d @file); document unsupported patterns.
- Risk: Double-redaction on export corrupts content.
- Mitigation: Redaction is idempotent (already-redacted placeholders do not match secret patterns).

## Review Guidance

- Confirm protected path detection monitors command text, not filesystem.
- Confirm warnings are non-blocking (badge/toast).
- Confirm audit integration routes all secrets events through spec 024.
- Confirm CI redaction tests are configured as merge-blocking gates.
- Confirm integration tests cover all five success criteria.
- Confirm no credential values appear anywhere in audit output.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-27T11:55:09Z – unknown – lane=for_review – Ready for review: per-topic sequencing, AsyncLocalStorage correlation, BACKPRESSURE payload enforcement, 96 tests passing, all benchmarks within SLO
