# HeliosApp

<<<<<<< HEAD
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
=======
## Future Review: Claudia Awesome-List Mentions

Captured on 2026-02-26 for follow-up validation and prioritization.

- `awesome-claude` - `claudia` - 13.9k⭐ - Powerful GUI app and toolkit for Claude Code (Claude Code Ecosystem / Frameworks & Platforms)
- `awesome` - `getAsterisk/claudia` - A powerful GUI app and Toolkit for Claude Code - Create custom agents, manage interactive Claude Code sessions, run secure background agents, and more. (TypeScript)
- `awesome` - `getAsterisk/claudia` - A powerful GUI app and Toolkit for Claude Code - Create custom agents, manage interactive Claude Code sessions, run secure background agents, and more. (TypeScript)
- `StarryDivineSky` - `getAsterisk/claudia`
- `awesome-claude-code` - **`claudia`** - Create custom agents, manage interactive Claude Code sessions, run secure background agents, and more. (GUIs & Web UIs)
- `Awesome-LLMOps` - Claudia - Create custom agents, manage interactive Claude Code sessions, run secure background agents, and more. ![Stars](https://img.shields.io/github/stars/getAsterisk/claudia.svg?style=flat&color=green) ![Contributors](https://img.shields.io/github/contributors/getAsterisk/claudia?color=green) ![LastCommit](https://img.shields.io/github/last-commit/getAsterisk/claudia?color=green) (Orchestration / Agent)
- `awesome-LLM-resources` - Claudia
- `definitive-opensource` - Claudia - Create custom agents, manage interactive Claude Code sessions, run secure background agents, and more. | `Cross` | **20.6k** | (Table of Contents / Agent)
- `awesome-claude-code` - claudia

## Notes

- These entries are intentionally preserved as provided (including possible duplicates) for future source verification.
- `awesome.ecosyste.ms` projects index: https://awesome.ecosyste.ms/projects

## Engineering Baseline

- Install dependencies: `bun install --frozen-lockfile`
- Run quick quality checks: `task quality:quick` or `just quality-quick`
- Run strict quality checks: `task quality:strict` or `just quality-strict`
- Build docs: `bun run docs:build`

CI/CD and docs deploy definitions are in:

- `.github/workflows/ci.yml`
- `.github/workflows/stage-gates.yml`
- `.github/workflows/policy-gate.yml`
- `.github/workflows/required-check-names-guard.yml`
- `.github/workflows/vitepress-pages.yml`
>>>>>>> origin/main
