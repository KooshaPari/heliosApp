# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Aligned CI Bun usage with the `packageManager` field in `package.json`, and documented local development troubleshooting in [Troubleshooting local development](docs/guides/troubleshooting-local-dev.md).
- Created `KILL_SWITCH.md` documenting emergency shutdown procedures for PTY/secrets/bus.
- Added `anchore/sbom-action` to CI for Syft-based SBOM generation.
- Exported `ActiveContext` type from `tab_surface.ts` for module compatibility.
- Added `@helios/logger`, `@helios/errors`, and `@helios/types` shared packages.

### Fixed

- Fixed syntax error in `ModelSelector.tsx` (unclosed button tag).
- Fixed syntax error in `lane_event_handler.ts` (unclosed loop).
- Installed missing type definitions (@types/node, bun-types, @playwright/test) and `vitest`.
- Resolved merge conflicts in `package.json` and `CLAUDE.md`.
- Normalized `BindingState` enum casing to `snake_case`.
- Stabilized runtime audit retention and lane lifecycle events.
