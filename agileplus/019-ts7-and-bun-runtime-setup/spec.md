# Feature Specification: TS7 and Bun Runtime Setup

**Feature Branch**: `019-ts7-and-bun-runtime-setup`
**Created**: 2026-02-27
**Status**: Draft
**Dependencies**: None

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build and Run the Desktop App from Source (Priority: P1)

As a developer cloning heliosApp for the first time, I can install dependencies and run a dev build with a single command so that I am productive within minutes.

**Why this priority**: Without a working build pipeline, no other feature can be developed, tested, or shipped.

**Independent Test**: Clone a fresh copy, run the documented bootstrap command, and verify the dev server starts and the desktop shell opens.

**Acceptance Scenarios**:

1. **Given** a clean checkout of heliosApp, **When** the developer runs `bun install && bun dev`, **Then** all workspace dependencies resolve and the ElectroBun desktop shell launches with a functional terminal surface.
2. **Given** a monorepo with `apps/desktop` and `apps/runtime` workspaces, **When** a developer edits a TypeScript file in `apps/runtime`, **Then** the dev server hot-reloads the change without a full restart.
3. **Given** TypeScript 7 strict mode is enabled, **When** the developer introduces a type error, **Then** the build fails immediately with a clear diagnostic pointing to the offending file and line.

---

### User Story 2 - Run Type Checking as a Standalone Gate (Priority: P1)

As a CI pipeline or a developer, I can run type checking independently of the build so that type errors are caught early without waiting for a full compilation cycle.

**Why this priority**: Type safety is a constitution requirement and must be verifiable as a discrete step.

**Independent Test**: Introduce a deliberate type error, run the type-check command, confirm it fails; fix the error, run again, confirm it passes.

**Acceptance Scenarios**:

1. **Given** a correctly typed codebase, **When** `bun run typecheck` is executed, **Then** the command exits 0 with no diagnostics.
2. **Given** a type error in any workspace package, **When** `bun run typecheck` is executed, **Then** the command exits non-zero and prints the file path, line number, and error message.

---

### Edge Cases

- What happens when a workspace package has an incompatible TypeScript version constraint? The build system must detect the conflict at install time and fail with an actionable message.
- How does the system handle circular workspace dependencies? The monorepo config must reject circular references during resolution.
- What happens when Bun is not installed or is below the minimum required version? The bootstrap script must detect this and print upgrade instructions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST use Bun workspaces with at least two packages: `apps/desktop` (ElectroBun shell) and `apps/runtime` (core runtime logic).
- **FR-002**: The root `package.json` MUST declare workspace paths, the minimum Bun version, and the TypeScript 7 dependency.
- **FR-003**: The build system MUST produce a runnable ElectroBun desktop application from `apps/desktop`.
- **FR-004**: A `bun dev` script MUST start a development server with hot-reload support for all workspace packages.
- **FR-005**: A `bun run typecheck` script MUST execute TypeScript strict-mode type checking across all workspace packages and exit non-zero on any error.
- **FR-006**: A `bun run build` script MUST produce a production-optimized bundle for the desktop shell.
- **FR-007**: Each workspace package MUST have its own `tsconfig.json` extending a shared root `tsconfig.base.json` with strict mode, no implicit any, and strict null checks enabled.
- **FR-008**: Path aliases defined in `tsconfig` MUST resolve correctly for both the build toolchain and the runtime.

### Non-Functional Requirements

- **NFR-001**: Clean install (`bun install`) MUST complete in under 30 seconds on a 100 Mbps connection with warm registry cache.
- **NFR-002**: Dev server cold start MUST reach interactive state in under 5 seconds on a 4-core, 8 GB RAM machine.
- **NFR-003**: Type-check pass on the full monorepo MUST complete in under 15 seconds on the reference hardware.
- **NFR-004**: The build configuration MUST NOT depend on globally installed tools other than Bun itself.

### Key Entities

- **Workspace Package**: A discrete unit within the monorepo with its own `package.json` and `tsconfig.json`, linked via Bun workspace resolution.
- **Root Config**: The top-level `package.json`, `tsconfig.base.json`, and `bunfig.toml` that govern shared settings for all workspace packages.
- **Build Artifact**: The compiled, bundled output of `apps/desktop` suitable for local execution via ElectroBun.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A fresh clone + `bun install && bun dev` results in a running desktop shell within 60 seconds total elapsed time.
- **SC-002**: `bun run typecheck` catches 100% of deliberately introduced type errors in a validation suite.
- **SC-003**: `bun run build` produces a launchable desktop artifact with zero TypeScript errors and zero build warnings.
- **SC-004**: All workspace packages resolve cross-references without manual path hacks or pre-build steps.

## Assumptions

- Bun >= 1.2 is the minimum supported runtime version.
- TypeScript 7 is available as a stable or late-RC release and supports the required strict-mode flags.
- ElectroBun provides a Bun-compatible build entry point for desktop shell packaging.
- The monorepo will grow to include additional workspace packages (e.g., `packages/shared`, `packages/protocol`) in later specs.
