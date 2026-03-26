import type { IProjectRepository, ProjectEntity, ProjectFilter } from "./ports";

export class ProjectDomainService {
  validateProjectName(name: string): { valid: boolean; reason?: string } {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { valid: false, reason: "name-empty" };
    if (trimmed.length > 200) return { valid: false, reason: "name-too-long" };
    return { valid: true };
  }
}

export class ProjectService {
  constructor(
    private repo: IProjectRepository,
    private domain = new ProjectDomainService()
  ) {}

  async create(input: {
    name: string;
    ownerId: string;
    description?: string;
  }): Promise<ProjectEntity> {
    const validation = this.domain.validateProjectName(input.name);
    if (!validation.valid) throw new Error(`invalid-name:${validation.reason}`);

    const project: ProjectEntity = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      description: input.description?.trim(),
      ownerId: input.ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.repo.save(project);
    return project;
  }

  async get(id: string): Promise<ProjectEntity | null> {
    return await this.repo.findById(id);
  }

  async list(filter?: ProjectFilter): Promise<ProjectEntity[]> {
    return await this.repo.findAll(filter);
  }
}
