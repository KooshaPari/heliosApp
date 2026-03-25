import { CreateProjectUseCase } from "../application/use-cases";
/**
 * Composition Root / Dependency Injection Container
 *
 * This module wires up all the dependencies and creates the application.
 * It is the entry point that assembles the hexagonal architecture.
 */
import type { IProjectRepository } from "../domain/ports/output";
import { ProjectDomainService } from "../domain/services";

/**
 * Dependency Container
 *
 * Holds all dependencies and provides factory methods for creating use cases.
 */
export class Container {
  private repositories: Map<string, unknown> = new Map();
  private services: Map<string, unknown> = new Map();
  private useCases: Map<string, unknown> = new Map();

  /**
   * Register a repository implementation
   */
  registerRepository<T>(name: string, instance: T): this {
    this.repositories.set(name, instance);
    return this;
  }

  /**
   * Register a service
   */
  registerService<T>(name: string, instance: T): this {
    this.services.set(name, instance);
    return this;
  }

  /**
   * Get a repository
   */
  getRepository<T>(name: string): T {
    const repo = this.repositories.get(name);
    if (!repo) {
      throw new Error(`Repository not registered: ${name}`);
    }
    return repo as T;
  }

  /**
   * Get a service
   */
  getService<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not registered: ${name}`);
    }
    return service as T;
  }

  /**
   * Get or create a use case
   */
  getUseCase<T>(name: string): T {
    const cached = this.useCases.get(name);
    if (cached) {
      return cached as T;
    }

    const useCase = this.createUseCase(name);
    this.useCases.set(name, useCase);
    return useCase as T;
  }

  private createUseCase(name: string): unknown {
    switch (name) {
      case "CreateProject":
        return new CreateProjectUseCase(
          this.getRepository<IProjectRepository>("ProjectRepository"),
          this.getService<ProjectDomainService>("ProjectDomainService")
        );

      default:
        throw new Error(`Unknown use case: ${name}`);
    }
  }

  /**
   * Create a default container with in-memory implementations
   */
  static createDefault(): Container {
    const container = new Container();

    // Register domain services
    container.registerService("ProjectDomainService", new ProjectDomainService());

    // For real implementations, register concrete repositories here:
    // container.registerRepository("ProjectRepository", new PostgresProjectRepository(pool));

    return container;
  }
}

/**
 * Factory function for quick setup
 */
export function createContainer(): Container {
  return Container.createDefault();
}
