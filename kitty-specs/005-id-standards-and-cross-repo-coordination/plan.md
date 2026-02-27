# Implementation Plan: ID Standards and Cross-Repo Coordination

**Branch**: `005-id-standards-and-cross-repo-coordination` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)

## Summary

Implement the shared ID generation and validation library using ULID-based `{prefix}_{ulid}` format. Zero runtime dependencies, cross-repo compatible (heliosApp, thegent, trace, heliosHarness). This is a leaf dependency with no upstream spec requirements -- every other spec depends on it.

## Scope Contract

- **In scope (this slice)**:
  - ID format: `{prefix}_{ulid}` with defined prefix registry (`ws`, `ln`, `ss`, `tm`, `rn`, `cor`).
  - ULID generation with monotonic ordering within same process/millisecond.
  - `generateId(entityType)` and `validateId(raw)` and `parseId(raw)` public API.
  - Zero-dependency library publishable as a Bun/TS package.
  - Collision resistance: zero expected collisions at 1M IDs/s/process.
  - URL-safe, filename-safe, JSON-safe output (alphanumeric + underscore only).
- **Deferred**:
  - Custom clock management (delegated to ULID library internals).
  - Prefix registry versioning or deprecation workflow.
  - Cross-repo integration test harness (repos must import and run their own validation).

## Technical Context

**Language/Version**: TypeScript, Bun runtime
**Primary Dependencies**: None at runtime (zero-dependency constraint). ULID generation is self-contained.
**Storage**: None (pure generation/validation library)
**Testing**: Vitest for unit tests, concurrency collision tests, microbenchmarks
**Target Platform**: Cross-platform library (macOS, Linux)
**Constraints**: Zero runtime deps, < 0.01ms generation, < 0.005ms validation, no heap allocation beyond output string
**Performance Goals**: NFR-001 through NFR-004 per spec

## Constitution Check

- **Language/runtime alignment**: PASS. TS + Bun.
- **Testing posture**: PASS. Vitest with collision and benchmark suites.
- **Coverage + traceability**: PASS. >=85% baseline; pure library targets >=95%.
- **Performance/local-first**: PASS. Zero network, zero I/O.
- **Dockerless**: PASS.
- **Device-first**: PASS. Runs entirely in-process.

## Project Structure

### Source Code

```
packages/ids/
├── src/
│   ├── index.ts        # Public API: generateId, validateId, parseId
│   ├── ulid.ts         # ULID generation (self-contained, monotonic)
│   ├── prefixes.ts     # Prefix registry: entity type -> prefix mapping
│   ├── validate.ts     # Format validation, prefix check, ULID integrity
│   └── parse.ts        # Extract entity type and timestamp from raw ID
├── package.json        # Zero dependencies, exports for cross-repo consumption
└── tsconfig.json
```

### Planning Artifacts

```
kitty-specs/005-id-standards-and-cross-repo-coordination/
├── spec.md
├── plan.md
└── tasks.md
```

**Structure Decision**: Placed in `packages/ids/` as a shared library rather than under `apps/runtime/` because this package is consumed by multiple repos (heliosApp, thegent, trace, heliosHarness). The `packages/` directory signals cross-repo intent.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Self-contained ULID implementation | Zero-dependency constraint prohibits importing a ULID library | External ULID dep violates NFR-004 and complicates cross-repo packaging |
| Monotonic increment within same millisecond | Spec requires monotonic ordering for IDs generated in the same ms | Random ULID suffix allows ordering inversions within the same millisecond |

## Quality Gate Enforcement

- Line coverage >= 95% (pure library, no I/O excuses).
- FR-to-test traceability: every FR-00x maps to at least one named test.
- Fail closed on lint, type-check, and test gate violations.
- Collision test gate: 10M IDs across 8 threads, zero collisions required.
- Microbenchmark gate: generation < 0.01ms, validation < 0.005ms.
- Format test gate: 100% of generated IDs pass regex `^[a-z]{2,3}_[0-9A-HJKMNP-TV-Z]{26}$`.
