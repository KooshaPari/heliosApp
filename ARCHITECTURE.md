# Architecture

## Overview

TypeScript/JS monorepo for Helioscope runtime and desktop applications. Turborepo-style workspace with shared packages and application entry points.

## Components

### Packages (`packages/`)
- `runtime-core` — Core runtime abstractions shared across targets
- `runtime` — Target-specific runtime implementations
- `colab-renderer` — Collaborative rendering layer
- `desktop` — Desktop-specific code (Electron or Tauri)

### Apps (`apps/`)
- Desktop application entry point consuming `packages/`

### Infrastructure
- `tsconfig.base.json` — Shared TypeScript config
- `dist/` — Build output

## Data Flow

Shared packages (`runtime-core`) are consumed by target-specific packages (`runtime`, `desktop`) which are bundled into apps for deployment.

## Key Files

- `packages/` — shared library packages
- `apps/` — application entry points
- `tsconfig.base.json` — shared TS config
