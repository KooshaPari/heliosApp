# HeliosApp

HeliosApp is the application surface in the Helios stack.

## Overview

- App source: `apps/`
- Product and architecture docs: `docs/`
- Specs and planning artifacts: `specs/`, `kitty-specs/`

## Repository Structure

- `apps/`: application code and runtime modules
- `docs/`: project documentation and guides
- `specs/`: feature and protocol specifications
- `kitty-specs/`: generated/spec-kitty artifacts

## Development

- Install dependencies per workspace toolchain
- Run project-specific dev commands from `apps/`
- Keep docs discoverable through VitePress category pages under `docs/`

## Documentation

- Unified docs entry: `docs/index.md`
- Super categories: Wiki, Development Guide, Document Index, API, Roadmap
- Regenerate index pages: `docs/scripts/generate-doc-index.sh`

## Contributing

- Create feature work on a worktree branch from `main`
- Keep changes scoped and documented
- Open PRs targeting `main`
