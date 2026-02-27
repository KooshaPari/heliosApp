# Implementation Plan: TS7 and Bun Runtime Setup

**Branch**: `019-ts7-and-bun-runtime-setup` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/019-ts7-and-bun-runtime-setup/spec.md`

## Summary

Establish the foundational monorepo build infrastructure: Bun workspace configuration with `apps/desktop` and `apps/runtime` packages, TypeScript 7 strict-mode configs, dev server with hot-reload, production build scripts, and standalone typecheck gate. This is the dependency-zero foundation that every other spec builds on.

## Scope Contract (Slice Boundaries)

- **Slice-1 (current implementation scope)**:
  - Root `package.json` with Bun workspace declarations for `apps/desktop` and `apps/runtime`.
  - `tsconfig.base.json` with TS7 strict mode, no implicit any, strict null checks.
  - Per-workspace `tsconfig.json` extending the shared base.
  - `bunfig.toml` with workspace resolution and minimum Bun version enforcement.
  - `bun dev` script with hot-reload across workspaces.
  - `bun run typecheck` as a standalone strict-mode gate.
  - `bun run build` producing a launchable ElectroBun desktop artifact.
  - Path alias resolution for both build and runtime.
- **Slice-2 (deferred)**:
  - Additional workspace packages (`packages/shared`, `packages/protocol`).
  - Advanced build optimizations (tree-shaking tuning, bundle analysis).
  - Cross-platform build targets beyond the local dev machine.

## Technical Context

**Language/Version**: TypeScript 7 (strict mode), Bun >= 1.2
**Primary Dependencies**: Bun, ElectroBun (desktop shell packaging), TypeScript 7
**Storage**: N/A (build tooling only)
**Testing**: Vitest for unit tests, Playwright for e2e, strict lint/type checks
**Target Platform**: Local device-first desktop runtime (macOS primary)
**Project Type**: Monorepo build infrastructure
**Performance Goals**: `bun install` < 30s, dev server cold start < 5s, typecheck < 15s
**Constraints**: No globally installed tools other than Bun; deterministic builds

## Constitution Check

- **Language/runtime alignment**: PASS. TS7 + Bun matches constitution requirements.
- **Testing posture**: PASS. Vitest + Playwright enforced; typecheck is a discrete gate.
- **Coverage posture**: PASS. Infrastructure enables per-package coverage enforcement.
- **Performance/local-first**: PASS. Bun-native, no cloud dependencies.
- **Architecture discipline**: PASS. Clean two-app split with shared base config.

## Project Structure

### Documentation (this feature)

```
kitty-specs/019-ts7-and-bun-runtime-setup/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```
package.json              # Bun workspace root
bunfig.toml               # Bun configuration
tsconfig.base.json        # Shared strict TS7 config
apps/
├── desktop/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
└── runtime/
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── index.ts
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| ElectroBun prerelease dependency | Required for desktop shell packaging per constitution | No stable Bun-native desktop framework exists yet |

## Quality Gate Enforcement

- Enforce `bun run typecheck` as a standalone zero-error gate before any build step.
- Enforce strict mode flags: `noImplicitAny`, `strictNullChecks`, `strict` in `tsconfig.base.json`.
- Fail closed on any workspace resolution error or circular dependency.
- Validate path alias resolution in both build and runtime contexts.
- No `@ts-ignore` or `@ts-expect-error` directives permitted.
