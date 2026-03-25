# Spec: 

## Meta

- **ID**: 
- **Title**: 
- **Created**: 2026-03-25
- **State**: in_progress

## Overview

- **Date**: 2026-02-26
- **Researchers**: codex
- **Open Questions**: None blocking Phase 1

## Decisions & Rationale

| Decision | Rationale | Evidence | Status |
|----------|-----------|----------|--------|
| Use a tight vertical slice first (not full adapter matrix) | Fastest path to prove value and validate control-plane UX with lower integration risk | User alignment during planning interrogation; `docs/sessions/20260226-helios-market-research/12_FORK_STRATEGY.md` | final |
| Canonical provider path is Codex CLI + `cliproxyapi++` harness | Explicit user requirement for first-class flow and harness validation | User planning input; `docs/sessions/20260226-helios-market-research/13_CROSS_REPO_ROLLOUT_MAP.md` | final |
| Degrade to native OpenAI login when harness unavailable | Keeps runtime usable under integration failure while preserving operability | User planning input; NFR graceful degradation in `kitty-specs/001-colab-agent-terminal-control-plane/spec.md` | final |
| Use in-memory session state for slice-1 continuity via Codex session IDs | Reduces initial complexity while preserving a continuity mechanism for early adoption | User planning input; state/event model in `docs/sessions/20260226-helios-market-research/07_PROTOCOL_AND_EVENTS.md` | final |
| Maintain deterministic bus envelope and lifecycle events as hard architectural invariant | Core control-plane reliability depends on correlation and ordered state transitions | `specs/protocol/v1/envelope.schema.json`; `docs/sessions/20260226-helios-market-research/07_PROTOCOL_AND_EVENTS.md` | final |
| Keep Bun + TS-native toolchain with strict test gates | Matches constitution and existing repo direction (`apps/runtime`, `apps/desktop`) | `docs/reference/constitution.md`; repository layout under `apps/` | final |
| Maintain formal protocol parity between `specs/protocol/v1` and feature contracts | Prevents drift from initial architecture intent while allowing explicit phased defer/extension handling | `specs/protocol/v1/methods.json`, `specs/protocol/v1/topics.json`, `contracts/orchestration-envelope.schema.json` | final |

## Requirements

- See tasks/ directory for work packages
- See research.md for background and analysis

## Future Work

- Implement features per tasks/
- Verify against acceptance criteria
