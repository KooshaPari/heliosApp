# Work Packages: Prerelease Dependency Registry

**Inputs**: Design documents from `/kitty-specs/020-prerelease-dependency-registry/`
**Prerequisites**: plan.md (required), spec.md (user stories), spec 019 (Bun workspace setup)

**Tests**: Include explicit testing work because prerelease dependency management requires strict rollback and canary validation.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each work package references a matching prompt file in `/kitty-specs/020-prerelease-dependency-registry/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).
- Subtasks call out concrete paths in `scripts/`, `apps/`, and `kitty-specs/`.

---

## Work Package WP01: Registry Manifest and Status Command (Priority: P0)

**Phase**: Phase 1 - Dependency Tracking
**Goal**: Create a version-controlled registry manifest listing all tracked prerelease dependencies and a `bun run deps:status` command that reports current pins, available upgrades, channels, and staleness.
**Independent Test**: Pin a dependency to a known beta, verify `deps:status` reports the pin, channel, days since update, and any available upgrade.
**Prompt**: `/kitty-specs/020-prerelease-dependency-registry/tasks/WP01-registry-manifest-and-status-command.md`
**Estimated Prompt Size**: ~310 lines

### Included Subtasks
- [ ] T001 Create `deps-registry.json` manifest schema with fields: name, current pin, channel (alpha/beta/RC/stable), upstream source URL, known-good version history array, and last-updated timestamp
- [ ] T002 Populate initial manifest entries for tracked prerelease dependencies (ElectroBun, ghostty, zellij) with current pins and channels
- [ ] T003 Implement `scripts/deps-status.ts` command that reads the manifest, queries upstream registries for latest versions, and reports tabular output with current pin, latest available, channel, and days since last update
- [ ] T004 Create `deps-changelog.json` structured log schema and append utility for recording all upgrade attempts with timestamp, versions, gate results, and actor
- [ ] T005 [P] Add Vitest unit tests for manifest parsing, status reporting, and changelog append logic

### Implementation Notes
- The manifest must be version-controlled alongside the codebase (FR-004 / NFR-004).
- Status command must complete in under 10 seconds with warm cache (NFR-002).
- Manifest changes must be committed atomically with lockfile changes.

### Parallel Opportunities
- T005 can proceed after T003 and T004 interfaces are stable.

### Dependencies
- Depends on spec 019 (Bun workspace setup).

### Risks & Mitigations
- Risk: Upstream registry APIs are rate-limited or unavailable.
- Mitigation: Cache registry responses locally; degrade gracefully with last-known data.

---

## Work Package WP02: Rollback Automation, Canary Upgrade Process, and Tests (Priority: P0)

**Goal**: Deliver atomic rollback to last known-good pin, canary upgrade automation that tests prerelease bumps against the full gate suite, and comprehensive tests for both workflows.
**Independent Test**: Upgrade a dependency to a breaking version, trigger rollback, verify lockfile returns to known-good state and all tests pass.
**Prompt**: `/kitty-specs/020-prerelease-dependency-registry/tasks/WP02-rollback-and-canary-process.md`
**Estimated Prompt Size**: ~350 lines

### Included Subtasks
- [ ] T006 Implement `scripts/deps-rollback.ts` with atomic lockfile reversion to last known-good pin for a named dependency, including lockfile regeneration
- [ ] T007 Implement `scripts/deps-canary.ts` canary process: create isolated branch, apply upgrade, run full quality gate suite (spec 021), auto-merge on pass or open issue on fail
- [ ] T008 Wire canary results into `deps-changelog.json` with pass/fail status, gate details, and branch references
- [ ] T009 [P] Add integration tests for rollback: simulate breaking upgrade, execute rollback, verify lockfile state and passing gates
- [ ] T010 [P] Add integration tests for canary: simulate available upgrade, run canary, verify branch creation, gate execution, and merge/issue outcome
- [ ] T011 Validate NFR compliance: rollback < 60s including lockfile regen, status < 10s warm cache, canary does not block unrelated CI

### Implementation Notes
- Rollback must be atomic: full reversion succeeds or no lockfile changes are persisted (FR-005).
- Canary must not block or delay unrelated CI pipelines (NFR-003).
- Per-workspace deterministic pinning must be maintained (FR-003).

### Parallel Opportunities
- T009 and T010 can proceed after T006 and T007 are functional.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: Lockfile regeneration changes unrelated dependency versions.
- Mitigation: Use Bun's deterministic resolution; diff lockfile before/after to confirm only the target dependency changed.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → WP02.
- **Parallelization**: Within WP01, T005 can run after T003/T004; within WP02, T009/T010 can run after T006/T007.
- **MVP Scope**: Both WPs required for safe prerelease dependency management.

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Registry manifest schema | WP01 | P0 | No |
| T002 | Initial manifest population | WP01 | P0 | No |
| T003 | deps:status command | WP01 | P0 | No |
| T004 | Changelog schema and append utility | WP01 | P0 | No |
| T005 | Manifest/status/changelog unit tests | WP01 | P0 | Yes |
| T006 | Atomic rollback command | WP02 | P0 | No |
| T007 | Canary upgrade process | WP02 | P0 | No |
| T008 | Canary changelog integration | WP02 | P0 | No |
| T009 | Rollback integration tests | WP02 | P0 | Yes |
| T010 | Canary integration tests | WP02 | P0 | Yes |
| T011 | NFR performance validation | WP02 | P0 | No |
