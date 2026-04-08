# AgilePlus Methodology Specification

## Overview

AgilePlus is the lightweight agile methodology implemented in the heliosApp ecosystem. It emphasizes feature-centric work organization, structured tracking through convoys and beads, and systematic quality enforcement through pre-submission gates.

**Version:** 1.0  
**Status:** Active  
**Rig ID:** `35903ad7-65d2-489a-bf30-ff95018fd80f`  
**Town ID:** `78a8d430-a206-4a25-96c0-5cd9f5caf984`

---

## Core Principles

### 1. Feature-Centric Work Organization

All development work is organized around **features** — discrete, deliverable units of functionality that map to product requirements. Features are decomposed into **work packages** (beads) that represent implementation tasks.

### 2. Convoy-Based Work Batching

Related work items are batched into **convoys** for coordinated parallel execution. Convoys enable multiple agents to work simultaneously on different aspects of the same feature while maintaining traceability.

| Property | Description |
|---|---|
| **Convoy ID** | Unique identifier (e.g., `6d75756c-5831-406f-9d7c-bcd49be2a22a`) |
| **Feature Branch** | Git branch pattern: `convoy/<name>/<convoy-id>/head` |
| **Beads** | Contains one or more work items |

### 3. Structured Tracking Over Ad Hoc Communication

AgilePlus enforces structured tracking over informal communication:
- All feature work must be tracked via beads in the Gastown system
- Status updates occur through the bead state machine
- Historical decisions are preserved in git history and governance logs

### 4. Quality Gates Before Submission

Every work submission passes through quality gates before being merged:
- Type checking (`bun run typecheck`)
- Linting (`bun run lint`)
- Unit tests (`bun run test`)
- E2E tests (`bun run test:e2e`)
- Coverage validation (85% threshold)
- Security scanning
- Bypass detection

---

## Work Package Workflow

### Bead States

Work packages (beads) in AgilePlus follow a defined state machine:

| State | Description |
|---|---|
| `open` | Initial state, work not yet started |
| `in_progress` | Actively being worked on |
| `in_review` | Submitted for review |
| `blocked` | Work paused due to dependency or issue |
| `done` | Completed and merged |
| `cancelled` | Work cancelled |

### Lifecycle

```
open → in_progress → in_review → closed
  ↓         ↓            ↓
blocked   blocked    (rework)
```

1. **Feature Creation** — A feature is created and decomposed into beads
2. **Convoy Formation** — Related beads are batched into a convoy
3. **Agent Assignment** — Beads are assigned to polecat agents via `gt_sling`
4. **Execution** — Agent works on the feature branch
5. **Quality Gates** — Agent runs `task quality` to validate
6. **Submission** — Agent calls `gt_done` to push and transition to `in_review`
7. **Review** — Refinery reviews and either merges or requests changes
8. **Rework** (if requested) — Agent receives feedback, fixes issues
9. **Closure** — Bead marked as `done`

---

## Integration with heliosApp Architecture

### Spec-to-Implementation Mapping

Each technical specification in `docs/plans/` corresponds to implementation work tracked via beads:

| Spec Document | Purpose | Tracking |
|---|---|---|
| `AGILEPLUS_SPEC.md` | Methodology specification | This document |
| `KILO_GASTOWN_SPEC.md` | Agent orchestration | Bead lifecycle |
| `PLAN.md` | 8-phase implementation plan | Phase-based |
| `FUNCTIONAL_REQUIREMENTS.md` | Technical requirements | FR codes |

### Branch Naming Convention

Feature branches follow the convoy pattern, linking git work to bead tracking:

```
convoy/<project>-kilo-specs-<repo>/<convoy-id>/gt/<agent-name>/<bead-id>
```

Example:
```
convoy/agileplus-kilo-specs-heliosapp/6d75756c/gt/polecat-33/c5141b38
```

### Commit Hygiene

Commits maintain traceability:
- Descriptive commit messages reference bead context
- Frequent commits on feature branches
- Push after every commit (ephemeral container)

---

## heliosApp-Specific Implementation

### Build and Test Commands

| Command | Purpose |
|---|---|
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | Code linting |
| `bun run test` | Unit tests |
| `bun run test:e2e` | End-to-end tests |
| `bun run test:coverage` | Coverage report |
| `bun run gates` | Full quality gate suite |
| `task quality` | Quick quality validation |

### Quality Gate Pipeline

The 8-stage gate pipeline (`.github/workflows/quality-gates.yml`):

1. Type check
2. Lint
3. Unit tests
4. E2E tests
5. Coverage (85% threshold)
6. Security scan
7. Static analysis
8. Bypass detection

### Monorepo Structure

heliosApp uses a Bun monorepo with structured apps and packages:

```
heliosApp/
├── apps/
│   ├── runtime/           # Core runtime engine
│   ├── desktop/           # Desktop shell
│   ├── renderer/          # SolidJS web renderer
│   └── colab-renderer/    # Collaborative renderer
├── packages/              # Shared packages
├── docs/                   # VitePress documentation
├── specs/                  # Protocol specifications
├── scripts/               # Build and governance scripts
└── tools/                  # Gate testing fixtures
```

---

## CLI Reference

### Gastown Delegation Commands

| Command | Purpose |
|---|---|
| `gt_prime` | Get context: agent identity, hooked bead, mail |
| `gt_sling <bead_id>` | Delegate single bead to agent |
| `gt_sling_batch <convoy_id>` | Delegate all beads in convoy |
| `gt_done --branch <name>` | Complete work, push, transition to `in_review` |
| `gt_bead_status <bead_id>` | Check bead status |
| `gt_checkpoint --data <json>` | Save crash-recovery state |
| `gt_list_convoys` | List all convoys in rig |
| `gt_mail_send` | Send message to another agent |
| `gt_escalate` | Report issue requiring human intervention |

### Local Development Commands

```bash
# Quick quality checks
task quality:quick    # or: just quality-quick

# Strict quality checks
task quality:strict   # or: just quality-strict

# Full preflight (deps + typecheck + lint + test)
task preflight        # or: just preflight
```

---

## Relationship with Kilo Gastown

AgilePlus and Kilo Gastown work together:

| Layer | System | Tracks |
|---|---|---|
| **Orchestration** | Kilo Gastown | Agent work, parallelization, delegation |
| **Execution** | Git branches, commits | Code changes |
| **Methodology** | AgilePlus | Features, quality gates, workflow |

Kilo Gastown provides the agent orchestration infrastructure (convoys, beads, polecats), while AgilePlus defines the methodology and quality standards applied to all work.

---

## Related Documentation

| Document | Purpose |
|---|---|
| `KILO_GASTOWN_SPEC.md` | Agent orchestration system |
| `AGILEPLUS_KILO_SPEC.md` | Combined methodology overview |
| `PLAN.md` | 8-phase implementation plan |
| `FUNCTIONAL_REQUIREMENTS.md` | Feature requirements |
| `AGENTS.md` | Agent behavior rules |

---

## Summary

AgilePlus provides heliosApp with:

- **Feature-centric organization** — All work decomposed into trackable beads
- **Convoy parallelization** — Multiple agents work simultaneously on related tasks
- **Quality gates** — Pre-submission validation ensures code quality
- **Traceability** — Branch naming links to convoy ID to bead
- **Methodology consistency** — Enforced through conventions across the monorepo
