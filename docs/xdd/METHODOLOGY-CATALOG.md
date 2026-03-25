# xDD Methodology Catalog

**Version**: 1.0
**Date**: 2026-03-25
**Status**: Active

This document catalogs the development methodologies we follow in the Phenotype ecosystem, organized by category.

---

## Table of Contents

1. [Core xDD](#core-xdd)
2. [Architecture xDD](#architecture-xdd)
3. [Design xDD](#design-xdd)
4. [Quality xDD](#quality-xdd)
5. [Process xDD](#process-xdd)
6. [Testing xDD](#testing-xdd)
7. [Documentation xDD](#documentation-xdd)
8. [Observability xDD](#observability-xdd)
9. [Security xDD](#security-xdd)
10. [Project Management xDD](#project-management-xdd)

---

## Core xDD

| # | Method | Description | When Applied |
|---|--------|-------------|--------------|
| 1 | **TDD** | Test-Driven Development | All new code |
| 2 | **BDD** | Behavior-Driven Development | User-facing features |
| 3 | **DDD** | Domain-Driven Design | Complex domain logic |
| 4 | **ADD** | Anatomy-Driven Development | UI components |
| 5 | **CDD** | Component-Driven Development | UI component libraries |
| 6 | **SDD** | Specification-Driven Development | Protocol implementations |
| 7 | **LDD** | Learning-Driven Development | Spikes and R&D |
| 8 | **PDD** | Performance-Driven Development | Performance-critical paths |

### TDD (Test-Driven Development)

**Cycle**: Red → Green → Refactor

```typescript
// 1. RED: Write failing test
test("should calculate latency correctly", () => {
  const registry = new MetricsRegistry();
  registry.record("test", 100);
  expect(registry.get("test").p99).toBeCloseTo(100);
});

// 2. GREEN: Write minimal implementation
class MetricsRegistry {
  private metrics = new Map<string, number[]>();
  record(name: string, value: number) {
    if (!this.metrics.has(name)) this.metrics.set(name, []);
    this.metrics.get(name)!.push(value);
  }
  get(name: string) {
    return { p99: this.metrics.get(name)?.[0] ?? 0 };
  }
}

// 3. REFACTOR: Improve while keeping tests green
```

### BDD (Behavior-Driven Development)

Use Gherkin syntax for critical user flows:

```gherkin
Feature: Project Creation
  Scenario: User creates a new project
    Given the user is authenticated
    And the workspace is empty
    When the user creates a project named "My Project"
    Then the project should be created
    And the user should be navigated to the project view
```

---

## Architecture xDD

| # | Method | Description | When Applied |
|---|--------|-------------|--------------|
| 9 | **HDD** | Hexagonal-Driven Development | All new modules |
| 10 | **CQRS** | Command Query Responsibility Segregation | Read/write heavy features |
| 11 | **EDA** | Event-Driven Architecture | Async workflows |
| 12 | **SEDA** | Staged Event-Driven Architecture | Pipeline processing |

### HDD (Hexagonal-Driven Development)

New modules MUST follow hexagonal architecture:

```
domain/
├── entities/           # Domain objects with identity
├── value-objects/      # Immutable, interchangeable values
├── services/           # Domain operations
├── events/             # Domain events
└── ports/              # Interface definitions
    ├── input/          # Use case interfaces
    └── output/         # Repository/external service interfaces

adapters/
├── primary/            # Driving adapters (API, CLI, UI)
└── secondary/         # Driven adapters (DB, HTTP, FileSystem)

application/
└── use-cases/         # Orchestrate domain logic
```

---

## Design xDD

| # | Method | Description |
|---|--------|-------------|
| 13 | **SOLID** | Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion |
| 14 | **DRY** | Don't Repeat Yourself |
| 15 | **KISS** | Keep It Simple, Stupid |
| 16 | **YAGNI** | You Aren't Gonna Need It |
| 17 | **GRASP** | General Responsibility Assignment Software Patterns |

### SOLID Principles Checklist

- [ ] **S**ingle Responsibility: Each class has one reason to change
- [ ] **O**pen/Closed: Open for extension, closed for modification
- [ ] **L**iskov Substitution: Subtypes can replace base types
- [ ] **I**nterface Segregation: Many small interfaces over one large interface
- [ ] **D**ependency Inversion: Depend on abstractions, not concretions

---

## Quality xDD

| # | Method | Description | Gate |
|---|--------|-------------|------|
| 18 | **QFD** | Quality-First Development | CI |
| 19 | **Shift-Left** | Test earlier in pipeline | CI |
| 20 | **Mutation Testing** | Verify test quality | Weekly |
| 21 | **Code Coverage** | Measure test breadth | >80% for domain |

### Quality Gates (CI Required)

```yaml
quality-gates:
  typecheck: required  # tsc --noEmit
  lint: required       # biome check
  unit-tests: required # vitest
  coverage: required   # >80% for domain/
  secret-scan: required # git-secrets
```

---

## Process xDD

| # | Method | Description |
|---|--------|-------------|
| 22 | **Trunk-Based** | Short-lived branches |
| 23 | **Stacking PRs** | Dependent changes as stacked PRs |
| 24 | **GitOps** | Git as single source of truth |
| 25 | **Mob Programming** | Whole team collaboration |

### Stacking PRs Workflow

```
main
├── feat/core-module          # PR #1: Core functionality
│   └── feat/api-integration # PR #2: API layer (depends on #1)
│       └── feat/ui-feature  # PR #3: UI (depends on #2)
```

---

## Testing xDD

| # | Method | Description |
|---|--------|-------------|
| 26 | **Unit Testing** | Test smallest units |
| 27 | **Integration Testing** | Test component interaction |
| 28 | **E2E Testing** | Full user flows |
| 29 | **Contract Testing** | API compatibility |
| 30 | **Golden Master** | Output regression |

### Test Pyramid

```
        ┌─────────┐
        │   E2E   │  ← Few, slow, expensive
        ├─────────┤
        │Integration│ ← Some, medium speed
        ├─────────┤
        │  Unit   │  ← Many, fast, cheap
        └─────────┘
```

---

## Documentation xDD

| # | Method | Description |
|---|--------|-------------|
| 31 | **Docs-as-Code** | Documentation in version control |
| 32 | **ADR** | Architecture Decision Records |
| 33 | **Living Docs** | Auto-generated from code |
| 34 | **Storybook** | Component documentation |

### ADR Lifecycle

1. **Proposed**: Draft created, needs review
2. **Accepted**: Reviewed and approved
3. **Deprecated**: Superseded by another ADR
4. **Rejected**: Alternative chosen instead

---

## Observability xDD

| # | Method | Description |
|---|--------|-------------|
| 35 | **DORA Metrics** | Deployment frequency, Lead time, MTTR, Change failure rate |
| 36 | **SLI/SLO** | Service Level Indicators/Objectives |
| 37 | **Structured Logging** | Consistent log format |

### DORA Metrics Targets

| Metric | Elite | High | Medium | Low |
|--------|-------|------|--------|-----|
| Deployment Frequency | On-demand | Daily-Weekly | Weekly-Monthly | Monthly+ |
| Lead Time | <1 hour | 1 day-1 week | 1-6 months | 6+ months |
| MTTR | <1 hour | <1 day | 1 day-1 week | 1+ week |
| Change Failure Rate | 0-15% | 16-30% | 31-45% | 46%+ |

---

## Security xDD

| # | Method | Description |
|---|--------|-------------|
| 38 | **Shift-Left Security** | Security in early stages |
| 39 | **SAST/DAST** | Static/Dynamic security scanning |
| 40 | **Secrets Management** | Centralized secrets handling |

---

## Project Management xDD

| # | Method | Description |
|---|--------|-------------|
| 41 | **Agile** | Iterative development |
| 42 | **Scrum** | Roles and ceremonies |
| 43 | **Kanban** | Flow-based delivery |
| 44 | **OKR** | Objectives & Key Results |

---

## Quick Reference Card

### When Starting New Work

1. [ ] Create feature branch from main
2. [ ] Write tests first (TDD)
3. [ ] Follow hexagonal structure (HDD)
4. [ ] Apply SOLID principles
5. [ ] Document architectural decisions (ADR)

### Before Merging PR

1. [ ] All tests pass
2. [ ] Typecheck passes (`bun run typecheck`)
3. [ ] Lint passes (`bun run lint`)
4. [ ] Coverage > 80% for domain code
5. [ ] No new security issues
6. [ ] Documentation updated

### Code Review Checklist

- [ ] Domain logic is testable without infrastructure
- [ ] Dependencies point inward (domain → application → adapters)
- [ ] No violations of SOLID principles
- [ ] Tests follow given/when/then pattern
- [ ] Public API has documentation

---

## Related Documents

- [ADR-001: Hexagonal Architecture](./adr/ADR-001-HEXAGONAL-ARCHITECTURE.md)
- [ADR-002: Package Organization](./adr/ADR-002-PACKAGE-ORGANIZATION.md)
- [ADR-003: Testing Strategy](./adr/ADR-003-TESTING-STRATEGY.md)
