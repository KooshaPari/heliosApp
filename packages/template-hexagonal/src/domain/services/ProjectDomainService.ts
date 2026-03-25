/**
 * Domain Services
 *
 * Domain services encapsulate domain logic that doesn't naturally fit
 * within a single entity or value object.
 *
 * Key Rules:
 * - Domain services should be stateless
 * - They operate on domain objects
 * - They should have no dependencies on infrastructure
 * - They are part of the domain layer
 */
import { ProjectEntity } from "../ports/output/index";

/**
 * Example domain service for project operations
 */
export class ProjectDomainService {
  /**
   * Validates project name according to domain rules
   */
  validateProjectName(name: string): ValidationResult {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: "Project name cannot be empty" };
    }
    if (name.length > 255) {
      return { valid: false, error: "Project name cannot exceed 255 characters" };
    }
    if (!/^[a-zA-Z0-9-_ ]+$/.test(name)) {
      return {
        valid: false,
        error: "Project name can only contain letters, numbers, spaces, hyphens, and underscores",
      };
    }
    return { valid: true };
  }

  /**
   * Checks if a user can access a project
   */
  canAccessProject(project: ProjectEntity, userId: string): boolean {
    return project.ownerId === userId;
  }

  /**
   * Generates a project slug from name
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
