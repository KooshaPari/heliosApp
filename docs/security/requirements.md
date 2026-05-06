# Security Requirements

**Status:** Informational

**See also:** [ADR-004: Authentication and Authorization Architecture](../adr/ADR-004.md)

This document tracks heliosApp security requirements. See ADR-004 for the
authoritative decision record covering authN/authZ strategy, session management,
MFA support, B2B SSO, and audit compliance.

## Quick Reference

| Requirement | Status |
|---|---|
| Auth method | See ADR-004 |
| Secrets management | Spec 028 |
| Credential storage | Encrypted; spec 028 interface |
| Audit logging | Spec 024 |
| Policy engine | Spec 023 |
| Secrets scanning | trufflehog (CI), pre-commit hook |

## Reporting Vulnerabilities

See [`SECURITY.md`](../../SECURITY.md) in the repo root for the full responsible
disclosure policy and contact address.

## In This Repo

- Secrets module: `apps/runtime/src/secrets/`
- Policy engine: `apps/runtime/src/policy/`
- Audit sink: `apps/runtime/src/audit/`
- Credential store interface: spec 028

<!-- Expand with threat model, pen-test results, and compliance posture — see ADR-004. -->
