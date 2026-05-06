# API Design Standards

**Status:** Informational

**See also:** [ADR-003: API Design Standards and Versioning Strategy](../adr/ADR-003.md)

This document tracks heliosApp API design standards. See ADR-003 for the
authoritative decision record covering REST conventions, OpenAPI 3.0 alignment,
versioning policy, error response format (RFC 7807), and GraphQL availability.

## Quick Reference

| Topic | Standard |
|---|---|
| URL style | kebab-case |
| JSON field style | camelCase |
| Versioning | URL-based (/v1/, /v2/) |
| Deprecation | 12-month notice |
| Error format | RFC 7807 Problem Details |

## In This Repo

- Runtime HTTP handler: `apps/runtime/src/http/`
- API client: `packages/runtime-core/src/api/`

<!-- Expand with full API conventions — see ADR-003. -->
