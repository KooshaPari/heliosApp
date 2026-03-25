# Feature Specification: Prerelease Dependency Registry

**Feature Branch**: `020-prerelease-dependency-registry`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: 019-ts7-and-bun-runtime-setup

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Track Cutting-Edge Dependencies Safely (Priority: P1)

As a developer working with prerelease versions of ElectroBun, ghostty, zellij, and other key dependencies, I can see the current pinned version, the latest available prerelease, and whether an upgrade is safe so that the project stays current without surprise breakage.

**Why this priority**: heliosApp depends on beta/RC software for core functionality. Uncontrolled upgrades cause cascading failures; stale pins cause missed fixes.

**Independent Test**: Pin a dependency to a known beta version, publish a newer RC to the registry, run the tracking command, and confirm it reports the available upgrade with its channel and risk assessment.

**Acceptance Scenarios**:

1. **Given** a lockfile with pinned prerelease versions, **When** a developer runs `bun run deps:status`, **Then** the output lists each tracked dependency with its current pin, latest available version, channel (alpha/beta/RC/stable), and days since last update.
2. **Given** a new RC is available for a tracked dependency, **When** the canary process runs, **Then** the system creates a test branch, upgrades the dependency, and runs the full quality gate suite before reporting pass/fail.

---

### User Story 2 - Roll Back a Breaking Prerelease Automatically (Priority: P1)

As a developer who upgraded a dependency that broke the build or tests, I can trigger an automatic rollback to the last known-good pin so that development is not blocked.

**Why this priority**: Prerelease breakage is expected and frequent. Manual rollback wastes time and risks incomplete reversions.

**Independent Test**: Upgrade a dependency to a version that deliberately fails tests, trigger rollback, and verify the lockfile and dependency tree return to the prior known-good state.

**Acceptance Scenarios**:

1. **Given** a dependency upgrade that causes test failures, **When** the rollback command is executed, **Then** the lockfile reverts to the last known-good pin for that dependency and all tests pass.
2. **Given** a rollback has occurred, **When** the developer checks the dependency log, **Then** there is a timestamped record of the failed upgrade attempt, the failure reason, and the rollback target version.

---

### User Story 3 - Upgrade Dependencies Through a Canary Process (Priority: P2)

As a CI pipeline, I can run scheduled canary upgrades that test prerelease bumps in isolation so that safe upgrades are merged automatically and risky ones are flagged for review.

**Why this priority**: Automation reduces toil and ensures the project does not fall behind on critical upstream fixes.

**Independent Test**: Configure a canary schedule, let it detect an available upgrade, observe it create a branch and run gates, and confirm it either auto-merges on pass or opens a review issue on fail.

**Acceptance Scenarios**:

1. **Given** a passing canary upgrade, **When** all quality gates succeed, **Then** the upgrade is auto-merged to the target branch with a changelog entry.
2. **Given** a failing canary upgrade, **When** any quality gate fails, **Then** the system opens an issue with failure details and does not merge.

---

### Edge Cases

- What happens when two tracked dependencies release conflicting prereleases simultaneously? The system must test each upgrade independently and together, reporting per-dependency and combined results.
- How does the system handle a dependency that removes its prerelease channel entirely? The system must detect the channel disappearance, alert the developer, and retain the last known pin.
- What happens when the registry is unreachable during a canary run? The canary must skip the check, log the connectivity failure, and retry on the next scheduled cycle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST maintain a registry manifest listing each tracked prerelease dependency with its name, current pin, channel (alpha/beta/RC/stable), upstream source, and known-good version history.
- **FR-002**: A `bun run deps:status` command MUST report the current state of all tracked dependencies including available upgrades.
- **FR-003**: The system MUST provide deterministic lockfile pins per workspace package so that each package can be upgraded and rolled back independently.
- **FR-004**: A `bun run deps:rollback <package>` command MUST revert a named dependency to its last known-good pin and regenerate the lockfile.
- **FR-005**: The rollback operation MUST be atomic: either the full reversion succeeds or no lockfile changes are persisted.
- **FR-006**: The canary process MUST create an isolated branch, apply the upgrade, run all quality gates from spec 021, and report results.
- **FR-007**: The canary process MUST auto-merge passing upgrades and open an issue for failing upgrades.
- **FR-008**: Every upgrade attempt (success or failure) MUST be recorded in a structured dependency changelog with timestamp, versions, gate results, and actor.

### Non-Functional Requirements

- **NFR-001**: Rollback to a known-good pin MUST complete in under 60 seconds including lockfile regeneration.
- **NFR-002**: The dependency status command MUST complete in under 10 seconds with warm cache.
- **NFR-003**: The canary process MUST NOT block or delay unrelated CI pipelines.
- **NFR-004**: The registry manifest MUST be version-controlled alongside the codebase so that dependency state is auditable through git history.

### Key Entities

- **Registry Manifest**: A version-controlled file listing all tracked prerelease dependencies, their pins, channels, and known-good history.
- **Dependency Pin**: A deterministic version lock for a single dependency in a single workspace package.
- **Known-Good Version**: The most recent pin for a dependency where all quality gates passed.
- **Canary Run**: An automated upgrade-and-test cycle for a single dependency or batch of dependencies.
- **Dependency Changelog**: A structured log of all upgrade attempts with outcomes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tracked prerelease dependencies have a documented current pin, channel, and known-good version in the registry manifest.
- **SC-002**: Rollback restores a passing test suite within 60 seconds for any single dependency regression.
- **SC-003**: Canary process detects available upgrades within 24 hours of publication to the upstream registry.
- **SC-004**: Zero unreviewed prerelease upgrades reach the main branch -- every upgrade is either canary-validated or manually approved.

## Assumptions

- Upstream registries (npm, GitHub releases) provide programmatic access to prerelease version metadata.
- The quality gates from spec 021 are available and functional before the canary process can be fully operational.
- Bun lockfile format supports per-workspace deterministic pinning.
- The canary schedule cadence is configurable (default: daily).
