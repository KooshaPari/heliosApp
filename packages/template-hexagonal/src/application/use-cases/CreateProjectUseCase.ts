/**
 * Use Cases (Application Services)
 *
 * Use cases orchestrate domain logic and coordinate between input ports
 * (called by driving adapters) and output ports (called to access infrastructure).
 */
import {
  type ICreateProjectInputPort,
  type CreateProjectInput,
  type CreateProjectOutput,
} from "../../domain/ports/input";
import {
  type IProjectRepository,
  type ProjectEntity,
} from "../../domain/ports/output";
import { ProjectDomainService } from "../../domain/services";

/**
 * Create Project Use Case
 *
 * Orchestrates the creation of a new project:
 * 1. Validates input using domain service
 * 2. Creates project entity
 * 3. Persists via repository
 * 4. Returns result
 */
export class CreateProjectUseCase implements ICreateProjectInputPort {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly domainService: ProjectDomainService = new ProjectDomainService()
  ) {}

  async execute(input: CreateProjectInput): Promise<CreateProjectOutput> {
    // 1. Validate input using domain service
    const validation = this.domainService.validateProjectName(input.name);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    // 2. Create project entity
    const project: ProjectEntity = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      description: input.description?.trim(),
      ownerId: input.ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 3. Persist via repository
    await this.projectRepository.save(project);

    // 4. Return result
    return {
      projectId: project.id,
      name: project.name,
      createdAt: project.createdAt,
    };
  }
}

/**
 * Validation Error - thrown when domain validation fails
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
