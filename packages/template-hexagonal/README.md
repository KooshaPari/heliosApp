# @phenotype/template-hexagonal

Hexagonal architecture template for Phenotype packages.

## Overview

This package provides the foundational building blocks for implementing hexagonal (ports & adapters) architecture in TypeScript. It establishes the core domain primitives, port interfaces, and application layer patterns used across the Phenotype ecosystem.

## Architecture

The template follows **Hexagonal Architecture** (also known as Ports & Adapters):

```
┌─────────────────────────────────────────────────────────────┐
│                      DRIVING ADAPTERS                        │
│   (Primary: API, CLI, UI - call input ports)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                        │
│              (Use Cases: orchestrate domain)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        DOMAIN CORE                          │
│  (Entities, Value Objects, Domain Services, Domain Events)   │
│  (NO external dependencies - pure TypeScript)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       OUTPUT PORTS                          │
│         (Repository interfaces - define contracts)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DRIVEN ADAPTERS                          │
│  (Secondary: DB, External APIs - implement output ports)    │
└─────────────────────────────────────────────────────────────┘
```

## Key Principles

1. **Domain is Pure**: No imports from frameworks, adapters, or external systems
2. **Dependencies Point Inward**: Outer layers depend on inner layers, never reverse
3. **Ports are Interfaces**: Adapters implement interfaces, not concrete classes
4. **Dependency Injection**: Composition root wires everything together

## Usage

### Install

```bash
bun add @phenotype/template-hexagonal
```

### Create a Domain Entity

```typescript
import { Entity } from "@phenotype/template-hexagonal";

interface UserId {
  value: string;
}

class User extends Entity<UserId> {
  constructor(
    private readonly _id: UserId,
    private _name: string,
    private _email: string
  ) {
    super(_id);
  }

  protected isEqual(other: User): boolean {
    return this._id.value === other._id.value;
  }

  // Domain methods
  rename(newName: string): void {
    this._name = newName;
  }

  get name(): string {
    return this._name;
  }
}
```

### Define Output Ports (Repository Interfaces)

```typescript
import type { Entity } from "@phenotype/template-hexagonal";

export interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findAll(): Promise<User[]>;
  delete(id: UserId): Promise<void>;
}
```

### Create Use Cases (Application Layer)

```typescript
import type { IUserRepository } from "../domain/ports/output";
import { ValidationError } from "@phenotype/template-hexagonal";

export interface ICreateUserInputPort {
  execute(input: CreateUserInput): Promise<User>;
}

export interface CreateUserInput {
  name: string;
  email: string;
}

export class CreateUserUseCase implements ICreateUserInputPort {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: CreateUserInput): Promise<User> {
    if (!input.email.includes("@")) {
      throw new ValidationError("Invalid email address");
    }

    const user = new User(
      { value: crypto.randomUUID() },
      input.name,
      input.email
    );

    await this.userRepository.save(user);
    return user;
  }
}
```

### Wire It Up (Composition Root)

```typescript
import { Container } from "@phenotype/template-hexagonal";
import { InMemoryUserRepository } from "./adapters/secondary/InMemoryUserRepository";
import { CreateUserUseCase } from "./application/CreateUserUseCase";

const container = new Container();

// Register adapters
container.registerRepository("UserRepository", new InMemoryUserRepository());

// Create use cases with dependencies
const createUser = container.getUseCase<CreateUserUseCase>("CreateUser");

// Use the use case
const user = await createUser.execute({
  name: "John Doe",
  email: "john@example.com",
});
```

## Package Structure

```
packages/template-hexagonal/
├── src/
│   ├── domain/
│   │   ├── entities/          # Entity base class
│   │   ├── value-objects/     # ValueObject base class
│   │   ├── services/          # Domain services
│   │   ├── events/           # Domain events
│   │   └── ports/
│   │       ├── input/        # Input port interfaces (use cases)
│   │       └── output/        # Output port interfaces (repositories)
│   ├── application/
│   │   └── use-cases/        # Application services
│   ├── adapters/
│   │   ├── primary/          # Driving adapters (API, CLI)
│   │   └── secondary/        # Driven adapters (DB, external)
│   └── config/
│       └── container.ts      # DI container
└── README.md
```

## Testing

Domain logic can be tested without any mocking:

```typescript
import { describe, it, expect } from "bun:test";
import { User } from "./domain/User";

describe("User Entity", () => {
  it("should rename user", () => {
    const user = new User({ value: "1" }, "John", "john@example.com");
    user.rename("Jane");
    expect(user.name).toBe("Jane");
  });

  it("should be equal to user with same id", () => {
    const user1 = new User({ value: "1" }, "John", "john@example.com");
    const user2 = new User({ value: "1" }, "Jane", "jane@example.com");
    expect(user1.equals(user2)).toBe(true);
  });
});
```

## Related

- [ADR-001: Hexagonal Architecture](docs/architecture/adr/ADR-001-HEXAGONAL-ARCHITECTURE.md)
- [xDD Methodology Catalog](docs/xdd/METHODOLOGY-CATALOG.md)
