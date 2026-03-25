/**
 * @phenotype/template-hexagonal
 *
 * Hexagonal architecture template for Phenotype packages.
 *
 * This package provides the foundational building blocks for implementing
 * hexagonal (ports & adapters) architecture in TypeScript.
 *
 * @example
 * ```typescript
 * import { Entity, ValueObject, BaseDomainEvent } from "@phenotype/template-hexagonal";
 *
 * // Create a domain entity
 * class User extends Entity<UserId> {
 *   constructor(
 *     private readonly _id: UserId,
 *     private name: string
 *   ) {
 *     super(_id);
 *   }
 *
 *   protected isEqual(other: User): boolean {
 *     return this._id.equals(other._id);
 *   }
 *
 *   rename(newName: string): void {
 *     this.name = newName;
 *   }
 * }
 * ```
 */

// Domain layer exports
export { Entity } from "./domain/entities";
export { ValueObject } from "./domain/value-objects";
export { DomainEvent, BaseDomainEvent } from "./domain/events";
export { ProjectDomainService, type ValidationResult } from "./domain/services";

// Port exports
export {
  type ICreateProjectInputPort,
  type CreateProjectInput,
  type CreateProjectOutput,
} from "./domain/ports/input";
export {
  type IProjectRepository,
  type ProjectFilter,
  type ProjectEntity,
} from "./domain/ports/output";

// Application layer exports
export { CreateProjectUseCase, ValidationError } from "./application";

// Config exports
export { Container, createContainer } from "./config";
