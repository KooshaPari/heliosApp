# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-03-25

### Fixed

- Unified stabilization for runtime audit sink and desktop component imports.
- Resolved vitest matcher type errors in `mcp-bridge` test suite.
- Fixed SLO check logic and percentile calculation in runtime diagnostics.
- Stabilized keyboard shortcuts and session sharing integration tests.
- Cleaned up Oxlint configuration and resolved merge conflicts.

## [0.1.1] - 2026-03-25

### Added

- Aligned CI Bun usage with the `packageManager` field in `package.json`, and documented local development troubleshooting in [Troubleshooting local development](docs/guides/troubleshooting-local-dev.md).
- Created `KILL_SWITCH.md` documenting emergency shutdown procedures for PTY/secrets/bus.
- Added `anchore/sbom-action` to CI for Syft-based SBOM generation.
- Exported `ActiveContext` type from `tab_surface.ts` for module compatibility.
- Added `turbo.json` for task orchestration and caching.
- Added `Quick Start` section to `README.md`.
- Added `lint-staged` hook to `.pre-commit-config.yaml`.
- Added `@helios/logger`, `@helios/errors`, and `@helios/types` shared packages.

### Fixed

- Fixed syntax error in `ModelSelector.tsx` (unclosed button tag).
- Fixed syntax error in `lane_event_handler.ts` (unclosed loop).
- Installed missing type definitions (@types/node, bun-types, @playwright/test) and `vitest`.
- Deduplicated `dependencies` and pinned `engines` in `package.json`.
- Resolved merge conflicts in `package.json` and `CLAUDE.md`.
- Normalized `BindingState` enum casing to `snake_case`.
- Stabilized runtime audit retention and lane lifecycle events.
