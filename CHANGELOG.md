# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-29

### Added

- Aligned CI Bun usage with the `packageManager` field in `package.json`, and documented local development troubleshooting in [Troubleshooting local development](docs/guides/troubleshooting-local-dev.md).
- Created `KILL_SWITCH.md` documenting emergency shutdown procedures for PTY/secrets/bus.
- Added `anchore/sbom-action` to CI for Syft-based SBOM generation.
- Exported `ActiveContext` type from `tab_surface.ts` for module compatibility.
- Added `turbo.json` for task orchestration and caching.
- Added `Quick Start` section to `README.md`.
- Added `lint-staged` hook to `.pre-commit-config.yaml`.

### Fixed

- Fixed syntax error in `ModelSelector.tsx` (unclosed button tag).
- Fixed syntax error in `lane_event_handler.ts` (unclosed loop).
- Installed missing type definitions (@types/node, bun-types, @playwright/test) and `vitest`.
- Deduplicated `dependencies` and pinned `engines` in `package.json`.
