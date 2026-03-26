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

// Application layer exports
export { CreateProjectUseCase, ValidationError } from "./application";
// Config exports
export { Container, createContainer } from "./config";
// Domain layer exports
export { Entity } from "./domain/entities";
export { BaseDomainEvent, DomainEvent } from "./domain/events";

// Port exports
export type {
  CreateProjectInput,
  CreateProjectOutput,
  ICreateProjectInputPort,
} from "./domain/ports/input";
export type {
  IProjectRepository,
  ProjectEntity,
  ProjectFilter,
} from "./domain/ports/output";
export { ProjectDomainService, type ValidationResult } from "./domain/services";
export { ValueObject } from "./domain/value-objects";
