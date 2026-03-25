export interface ProjectEntity {
  id: string;
  name: string;
  description?: string | undefined;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFilter {
  ownerId?: string;
  name?: string;
  limit?: number;
  offset?: number;
}

/** Output port for project repository */
export interface IProjectRepository {
  save(project: ProjectEntity): Promise<void>;
  findById(id: string): Promise<ProjectEntity | null>;
  findAll(filter?: ProjectFilter): Promise<ProjectEntity[]>;
  delete(id: string): Promise<void>;
}
