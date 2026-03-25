# Implementation Plan: Prerelease Dependency Registry

**Branch**: `020-prerelease-dependency-registry` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/020-prerelease-dependency-registry/spec.md`

## Summary

Build root-level tooling to track, upgrade, and roll back prerelease dependencies (ElectroBun, ghostty, zellij) safely. A version-controlled registry manifest records pins and known-good history. Automated canary runs test upgrades against the full quality gate suite before merging. Atomic rollback restores the last known-good state when upgrades break.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Registry manifest file (`deps-registry.json`) listing tracked prerelease deps with pin, channel, and known-good history.
  - `bun run deps:status` command reporting current state and available upgrades.
  - `bun run deps:rollback <package>` with atomic lockfile reversion.
  - Structured dependency changelog recording all upgrade attempts.
  - Canary process: branch creation, upgrade, gate execution, auto-merge or issue creation.
- **Slice-2 (deferred)**:
  - Multi-dependency combined upgrade testing (simultaneous conflict detection).
  - Dashboard UI for dependency health visualization.
  - Notification integrations (Slack, email) for canary results.

## Technical Context

**Language/Version**: TypeScript (Bun scripts), shell automation
**Primary Dependencies**: Bun lockfile APIs, npm/GitHub registry APIs, spec 021 quality gates
**Storage**: Version-controlled JSON manifest + changelog in repository
**Testing**: Vitest for rollback/status logic, integration tests for canary workflow
**Target Platform**: Local dev + CI runner
**Performance Goals**: Status < 10s (warm cache), rollback < 60s including lockfile regen
**Constraints**: Must not block unrelated CI pipelines; manifest must be git-auditable

## Constitution Check

- **Language/runtime alignment**: PASS. Bun-native scripting.
- **Testing posture**: PASS. Canary runs execute the full gate suite from spec 021.
- **Dependency discipline**: PASS. Explicit tracking eliminates unreviewed prerelease drift.
- **Auditability**: PASS. Git-versioned manifest and structured changelog.
- **Rollback safety**: PASS. Atomic reversion prevents partial lockfile states.

## Project Structure

### Documentation (this feature)

```
kitty-specs/020-prerelease-dependency-registry/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
deps-registry.json         # Tracked prerelease manifest
deps-changelog.json        # Structured upgrade log
scripts/
├── deps-status.ts         # bun run deps:status
├── deps-rollback.ts       # bun run deps:rollback
└── deps-canary.ts         # Canary upgrade automation
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Custom registry manifest instead of relying on lockfile alone | Lockfile does not track channel metadata, known-good history, or rollback targets | Need richer metadata than lockfile provides for safe prerelease management |

## Quality Gate Enforcement

- Canary upgrades must pass the full 8-gate pipeline from spec 021 before auto-merge.
- Rollback must restore a passing gate suite; rollback itself is validated by running gates post-revert.
- Zero unreviewed prerelease upgrades may reach main.
- Registry manifest changes must be committed atomically with lockfile changes.
- Dependency changelog must have an entry for every upgrade attempt (pass or fail).
