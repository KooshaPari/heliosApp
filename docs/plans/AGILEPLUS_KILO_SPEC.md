# AgilePlus + Kilo Specs: heliosApp

## Convoy Overview

**Convoy ID:** `6d75756c-5831-406f-9d7c-bcd49be2a22a`  
**Branch:** `convoy/agileplus-kilo-specs-heliosapp/6d75756c/head`  
**Status:** Active  
**Created:** 2026-03-31

---

## Purpose

This convoy establishes the combined AgilePlus and Kilo Gastown methodology documentation for the heliosApp project. It provides:

1. **AgilePlus** - Project management methodology for tracking features and work packages
2. **Kilo Gastown** - Agent orchestration and delegation system for multi-agent coordination

---

## Methodology Stack

### AgilePlus (Project Tracking)

AgilePlus tracks all feature development through work packages with defined states:

| State | Description |
|-------|-------------|
| `open` | Initial state, work not yet started |
| `in_progress` | Actively being worked on |
| `in_review` | Submitted for review |
| `blocked` | Work paused due to dependency |
| `done` | Completed and merged |
| `cancelled` | Work cancelled |

**Reference:** [`docs/plans/AGILEPLUS_SPEC.md`](./AGILEPLUS_SPEC.md)

### Kilo Gastown (Agent Orchestration)

Kilo Gastown coordinates autonomous agents (polecats) through a bead-based system:

| Bead State | Description |
|------------|-------------|
| `open` | Work item created, not yet assigned |
| `in_progress` | Agent is actively working |
| `in_review` | Work submitted for review |
| `closed` | Work completed and merged |

**Reference:** [`docs/plans/KILO_GASTOWN_SPEC.md`](./KILO_GASTOWN_SPEC.md)

---

## Convoy Structure

### Branch Naming Convention

```
convoy/<project>-kilo-specs-<repo>/<convoy-id>/head
```

### Agent Branches

| Agent | Bead ID | Purpose |
|-------|---------|---------|
| polecat-21 | c5141b38 | AgilePlus methodology spec |
| polecat-48 | b4803254 | Kilo Gastown methodology spec |

### Delegation Tools

- **`gt_sling <bead_id>`** - Delegate single bead to agent
- **`gt_sling_batch <convoy_id>`** - Delegate all beads in convoy
- **`gt_list_convoys`** - List all convoys in rig
- **`gt_done --branch <name>`** - Complete work and transition to review

---

## Quality Gates

Before submitting work, agents must run:

```bash
task quality
```

This validates:
- Code correctness
- Linting and type checking
- Test passing

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [`AGILEPLUS_SPEC.md`](./AGILEPLUS_SPEC.md) | AgilePlus tracking methodology |
| [`KILO_GASTOWN_SPEC.md`](./KILO_GASTOWN_SPEC.md) | Kilo Gastown orchestration |
| [`PLAN.md`](../PLAN.md) | 8-phase implementation plan |
| [`PRD.md`](../PRD.md) | Product Requirements Document |
| [`AGENTS.md`](../AGENTS.md) | Agent behavior rules |

---

## Summary

This convoy establishes the combined methodology documentation:

- **AgilePlus** provides centralized work tracking with CLI-driven workflow
- **Kilo Gastown** enables parallel execution through convoys and autonomous agents
- **Integration** links branch naming to convoy IDs to AgilePlus features
