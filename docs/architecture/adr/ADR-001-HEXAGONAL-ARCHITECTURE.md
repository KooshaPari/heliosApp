# ADR-001: Adopt Hexagonal (Ports & Adapters) Architecture

**Status**: Proposed
**Date**: 2026-03-25
**Supersedes**: N/A
**Superseded by**: N/A

## Context

The heliosApp codebase is currently monolithic, with domain logic tightly coupled to infrastructure concerns (database access, CLI handlers, API controllers). This coupling makes it difficult to:
- Test domain logic in isolation
- Swap implementations (e.g., PostgreSQL for SQLite)
- Reuse domain logic across applications
- Evolve the system incrementally

We need to restructure the codebase to separate concerns and enable better testability and maintainability.

## Decision

We will adopt **Hexagonal Architecture** (also known as Ports & Adapters) with the following structure:

```
src/
├── domain/                    # Pure domain logic (no external dependencies)
│   ├── entities/              # Domain entities
│   ├── value-objects/         # Immutable value types
│   ├── services/              # Domain services
│   ├── events/                # Domain events
│   └── repositories/          # Repository interfaces (ports)
│
├── application/               # Use cases / application services
│   ├── ports/                 # Input and output port interfaces
│   ├── use-cases/             # Orchestrate domain logic
│   └── dto/                   # Data transfer objects
│
├── adapters/                  # Infrastructure implementations
│   ├── primary/               # Driving adapters (UI, API, CLI)
│   └── secondary/             # Driven adapters (DB, External APIs)
│
└── config/                    # Dependency injection / composition root
```

### Key Principles

1. **Domain Core is Pure**: No imports from frameworks, adapters, or external systems
2. **Dependencies Point Inward**: Outer layers depend on inner layers, never the reverse
3. **Ports are Interfaces**: Adapters implement interfaces, not concrete classes
4. **Dependency Injection**: Composition root wires everything together

## Consequences

### Positive
- Domain logic can be tested without mocking infrastructure
- Easy to add new adapters (e.g., REST API, GraphQL, gRPC)
- Clear boundaries enable parallel development
- Reusable domain packages can be extracted

### Negative
- Initial overhead of creating interfaces and adapters
- More files and indirection
- Requires discipline to maintain boundaries

### Neutral
- Learning curve for team members unfamiliar with hexagonal architecture
- May need to refactor existing code incrementally

## Alternatives Considered

### Option 1: Keep Monolithic Structure
**Pros**: No refactoring effort, familiar pattern

**Cons**: Technical debt accumulates, testing is difficult, coupling increases over time

**Why not chosen**: The current state already shows signs of coupling that makes testing and reuse difficult.

### Option 2: Full Clean Architecture
**Pros**: Strict separation, maximum testability

**Cons**: Heavyweight for a project of our size, may be overkill

**Why not chosen**: Hexagonal provides similar benefits with less ceremony.

## Implementation Plan

1. **Phase 1**: Create hexagonal template package (`phenotype-hexagonal`)
2. **Phase 2**: Extract first domain module (e.g., `MetricsRegistry` → `phenotype-metrics`)
3. **Phase 3**: Refactor existing code to use hexagonal structure
4. **Phase 4**: Establish CI quality gates for architecture compliance

## References

- [Alistair Cockburn - Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Ports and Adapters Pattern](https://www.hillside.net/plop/plop2001/Papers/Cockburn.pdf)
- [ADR-002: Package Organization Strategy](./adr/ADR-002-PACKAGE-ORGANIZATION.md)
