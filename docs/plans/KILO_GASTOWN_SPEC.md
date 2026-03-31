# Kilo Gastown Methodology Specification

## Overview

Kilo Gastown is the distributed agent coordination methodology and tooling system used to track, coordinate, and govern all work across the heliosApp rig ecosystem. It provides structured work decomposition, parallel execution tracking, and systematic merge governance through convoys and beads.

**Version:** 1.0  
**Status:** Active  
**Rig ID:** `35903ad7-65d2-489a-bf30-ff95018fd80f`  
**Town ID:** `78a8d430-a206-4a25-96c0-5cd9f5caf984`

---

## Core Principles

### 1. Work Decomposition into Beads and Convoys

All development work is organized around two primary constructs:
- **Beads** — Discrete, deliverable units of work assigned to a single agent (via `gt_sling`)
- **Convoys** — Collections of related beads batched for parallel execution (via `gt_sling_batch`)

### 2. Structured Tracking vs. Ad Hoc Communication

Kilo Gastown enforces structured tracking over informal communication:
- All work must be tracked as beads in the Gastown system
- Status updates occur through the CLI, not informal channels
- Historical decisions are preserved in git history and worklogs

### 3. Methodology Enforcement Through Conventions

The methodology is enforced through consistent conventions:
- Every feature branch follows the convoy pattern linking git work to Gastown beads
- All commits follow structured patterns linked to bead IDs
- Work history is preserved across repository migrations

### 4. Separation of Concerns

Kilo Gastown maintains strict separation between:
- **Planning layer** — Bead definitions, convoy groupings, priorities
- **Execution layer** — Git branches, commits, pull requests
- **Audit layer** — Worklogs, history, merge reviews

---

## Kilo Gastown in heliosApp

### Rig Configuration

The heliosApp project is configured to use Kilo Gastown for all agent coordination:

| Configuration | Value |
|---|---|
| **Rig ID** | `35903ad7-65d2-489a-bf30-ff95018fd80f` |
| **Town ID** | `78a8d430-a206-4a25-96c0-5cd9f5caf984` |
| **Orchestration** | Gastown orchestration system |
| **CLI Entry Points** | `gt_sling`, `gt_sling_batch`, `gt_list_convoys`, `gt_done` |

### Bead Types

Beads in Kilo Gastown can be one of several types:

| Type | Description |
|---|---|
| `issue` | Single discrete task assigned to one agent |
| `merge_request` | Review request for a bead that has been completed |
| `convoy` | Container for batched work (tracks overall progress) |

### Convoy Tracking

Convoys group related beads for coordinated execution:

```
gt_list_convoys
```

This command shows all active convoys, their bead counts, and overall progress.

---

## Work Package Workflow

### Bead Lifecycle

Beads in Kilo Gastown follow a defined state machine:

| State | Description |
|---|---|
| `open` | Initial state, work not yet started |
| `in_progress` | Actively being worked on by assigned agent |
| `in_review` | Work completed, submitted for review |
| `closed` | Merged and completed |

### Lifecycle Flow

1. **Bead Creation** — A bead is created in Gastown with title, body, and type
2. **Agent Hook** — An agent is dispatched via `gt_sling` (single bead) or `gt_sling_batch` (multiple beads)
3. **Execution** — Agent works on the feature branch within the convoy
4. **Status Updates** — Bead state transitions via `gt_done` when complete
5. **Review** — Merge request bead is created for review
6. **Closure** — Bead marked as `closed` after successful merge

### Merge Modes

Kilo Gastown supports two merge modes:

| Mode | Description |
|---|---|
| **review-then-land** | Agent pushes branch, calls `gt_done`, refinery reviews and merges |
| **review-and-merge** | Agent pushes branch, creates PR, refinery merges after review |

The mode is determined by convoy configuration and bead type.

---

## Integration with heliosApp Architecture

### Convoy Naming Convention

Feature branches follow the convoy pattern, linking git work to Gastown convoys:

```
convoy/agileplus-kilo-specs-heliosapp/<convoy-id>/head
```

This allows traceability from branch → convoy → bead.

### Bead ID Pattern

Each bead has a unique ID used for tracking:

```
<type>-<uuid>
```

Example: `issue-1bbc1d5a-a831-4feb-a71a-a264ce67eaff`

### Commit Hygiene

Commits maintain a link to work items:
- Descriptive commit messages reference bead/convoy context
- Frequent commits on feature branches
- Push after every commit (ephemeral container)

---

## Kilo CLI Reference

### Delegation Commands

```bash
# Delegate a single bead to an agent
gt_sling <bead_id>

# Delegate multiple beads as a batch
gt_sling_batch <bead_id_1> <bead_id_2> ...

# List all convoys with progress
gt_list_convoys

# Check convoy status
gt_convoy_status <convoy_id>
```

### Bead Commands

```bash
# Get current bead status
gt_bead_status <bead_id>

# Close a bead when work is complete
gt_bead_close <bead_id>

# Get full context (hooked bead, mail, open beads)
gt_prime
```

### Status States

| State | Meaning |
|---|---|
| `open` | Not started, available for dispatch |
| `in_progress` | Agent is actively working |
| `in_review` | Submitted for review |
| `closed` | Completed and merged |

---

## Available Tools in heliosApp

### Agent Tools

| Tool | Purpose |
|---|---|
| `gt_prime` | Get full role context: identity, hooked bead, mail, open beads |
| `gt_done` | Signal work complete, push branch, transition to in_review |
| `gt_sling` | Delegate single bead to an agent |
| `gt_sling_batch` | Delegate multiple beads as a batch |
| `gt_list_convoys` | List all convoys with progress tracking |
| `gt_convoy_status` | Check status of specific convoy |
| `gt_bead_status` | Read current status of a bead |
| `gt_bead_close` | Close a completed bead |
| `gt_mail_send` | Send message to another agent |
| `gt_mail_check` | Check for pending mail |
| `gt_escalate` | Escalate issue to supervisor |
| `gt_checkpoint` | Write crash-recovery data |
| `gt_status` | Emit plain-language status update |
| `gt_mol_current` | Get current molecule step |
| `gt_mol_advance` | Complete molecule step and advance |

### Quality Gates

Before calling `gt_done`, agents must run quality gates:

```bash
task quality        # Run full quality checks
```

---

## heliosApp Build Commands

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format

# Run unit tests
bun run test

# Run integration tests
bun run test:integration

# Run E2E tests
bun run test:e2e

# Run quality gates
bun run gates
```

---

## Related Documentation

| Document | Purpose |
|---|---|
| `AGILEPLUS_SPEC.md` | AgilePlus project management methodology |
| `PLAN.md` | 8-phase implementation plan |
| `PRD.md` | Product Requirements Document |
| `docs/plans/*` | Technical specifications and plans |
| `README.md` | Project architecture and setup |

---

## Kilo Gastown vs AgilePlus

Kilo Gastown and AgilePlus are complementary methodologies:

| Aspect | Kilo Gastown | AgilePlus |
|---|---|---|
| **Focus** | Agent coordination and delegation | Project management and tracking |
| **Primary Units** | Beads, convoys | Features, work packages |
| **CLI Tools** | gt_sling, gt_sling_batch | agileplus CLI |
| **State Tracking** | Real-time agent status | Long-term feature tracking |
| **Use Case** | Distributed agent work | Human project management |

Both methodologies are used in heliosApp:
- **AgilePlus** tracks high-level feature development
- **Kilo Gastown** coordinates the agent work that implements those features

---

## Migration History

The heliosApp Kilo Gastown methodology was established to support distributed agent coordination. All agent work is now tracked through the Gastown system, with beads linked to convoys for traceability.

---

## Summary

Kilo Gastown provides heliosApp with:

- **Distributed agent coordination** — Beads enable single-task delegation to specific agents
- **Parallel execution** — Convoys batch related work for parallel agent execution
- **Real-time tracking** — gt_list_convoys provides convoy-level progress visibility
- **Merge governance** — Two merge modes ensure code quality through review
- **Traceability** — Branch names, commit messages, and bead IDs link all work to Gastown
- **Crash recovery** — gt_checkpoint enables agents to resume interrupted work
