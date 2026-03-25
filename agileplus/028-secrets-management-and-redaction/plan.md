# Implementation Plan: Secrets Management and Redaction

**Branch**: `028-secrets-management-and-redaction` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/028-secrets-management-and-redaction/spec.md`

## Summary

Deliver encrypted per-provider credential stores, a pattern-based redaction engine at the audit sink boundary, protected path warnings for terminal commands, and full audit trails for credential access and redaction events. Credentials are scoped to provider+workspace, encrypted with AES-256-GCM, and operate fully offline. The redaction engine is a synchronous filter ensuring zero secrets reach persistent storage.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Encrypted credential store per provider+workspace with AES-256-GCM, backed by OS keychain for master key.
  - Credential lifecycle: create, rotate (overwrite-irrecoverable), revoke, each with audit event.
  - Cross-provider credential isolation enforcement.
  - Pattern-based redaction engine with default patterns (AWS, GCP, GitHub, OpenAI key formats).
  - Redaction applied synchronously at audit sink boundary before persistence or export.
  - Configurable redaction rules with operator-tunable patterns.
  - Protected path warnings for sensitive file access (.env, credentials.json, **/secrets/**).
  - Credential access and redaction audit trails.
- **Slice-2 (deferred, must remain explicit in artifacts)**:
  - Remote key vault integration for enterprise deployments.
  - Binary content scanning beyond text-pattern matching.
  - Redaction ML model for detecting non-pattern-based secrets.
  - Key management UX (master key rotation, passphrase recovery).

## Technical Context

**Language/Version**: TypeScript (TS-native track, Bun runtime)
**Primary Dependencies**: Bun, Node crypto (AES-256-GCM), OS keychain API, `apps/runtime/src/protocol/` bus
**Storage**: Encrypted credential files on local filesystem; master key in OS keychain
**Testing**: Vitest for unit tests, redaction verification tests in CI, integration tests with known secret patterns
**Target Platform**: Local device-first desktop runtime (fully offline capable)
**Project Type**: Runtime security subsystem -- secrets and redaction boundary
**Performance Goals**: Redaction overhead < 5ms (p95) on audit sink path; credential ops < 50ms
**Constraints**: Fully offline, no remote key vault, AES-256-GCM minimum, synchronous redaction filter

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun with Node crypto for encryption.
- **Testing posture**: PASS. Vitest + CI redaction verification + integration tests with known patterns.
- **Coverage + traceability**: PASS. >=85% coverage; FR-028-* mapped to test cases.
- **Performance/local-first**: PASS. Fully offline credential store; no remote dependencies.
- **Architecture discipline**: PASS. Credential store scoping aligns with provider isolation (025); redaction sits at audit boundary (024).

## Project Structure

### Documentation (this feature)

```
kitty-specs/028-secrets-management-and-redaction/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
apps/runtime/src/secrets/
├── credential-store.ts    # Encrypted per-provider+workspace credential storage
├── encryption.ts          # AES-256-GCM encrypt/decrypt with keychain master key
├── redaction-engine.ts    # Pattern-based synchronous redaction filter
├── redaction-rules.ts     # Default and configurable redaction patterns
├── protected-paths.ts     # Sensitive path detection and warning emission
├── audit-trail.ts         # Credential access and redaction audit record generation
└── __tests__/
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Synchronous redaction filter on audit sink | NFR-028-001 requires < 5ms overhead and zero secrets in persistent storage | Async post-processor could allow unredacted secrets to reach disk before redaction completes |
| Per-provider+workspace credential scoping | FR-028-002 mandates cross-provider isolation | Global credential store would make cross-provider leakage a single-bug risk |

## Quality Gate Enforcement

- Enforce line coverage baseline of >=85% with stricter expectations on encryption, redaction, and credential isolation paths.
- Enforce FR-to-test traceability: every FR-028-* must have at least one dedicated test.
- Redaction verification: zero secrets in persisted audit logs across all test scenarios (SC-028-001).
- Isolation test: cross-provider credential access denied in 100% of attempts (SC-028-004).
- Redaction audit trail present for every persisted artifact (SC-028-005).
- CI gate: redaction verification tests run on every commit; failure blocks merge.
- Fail closed on lint/type/static/security/test gate violations; no ignore/skip pathways.
