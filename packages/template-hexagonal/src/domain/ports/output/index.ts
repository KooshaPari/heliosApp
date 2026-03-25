/**
 * Output Ports (Repository Interfaces)
 *
 * Output ports define the contracts for infrastructure access.
 * They are implemented by driven adapters (repositories, external services).
 */

/**
 * Example: Project Repository Port
 */
export interface IProjectRepository {
  save(project: ProjectEntity): Promise<void>;
  findById(id: string): Promise<ProjectEntity | null>;
  findAll(filter?: ProjectFilter): Promise<ProjectEntity[]>;
  delete(id: string): Promise<void>;
}

export interface ProjectFilter {
  ownerId?: string;
  name?: string;
  limit?: number;
  offset?: number;
}

/**
 * Example: Project Entity (domain object for repository)
 */
export interface ProjectEntity {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}
