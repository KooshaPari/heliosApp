/**
 * Input Ports (Use Case Interfaces)
 *
 * Input ports define the API for the application layer.
 * They are implemented by application services and called by driving adapters.
 */

/**
 * Example: Create Project Use Case
 */
export interface ICreateProjectInputPort {
  execute(input: CreateProjectInput): Promise<CreateProjectOutput>;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  ownerId: string;
}

export interface CreateProjectOutput {
  projectId: string;
  name: string;
  createdAt: Date;
}
