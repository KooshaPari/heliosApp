export class ProjectEntityBase {
  constructor(public id: string, public name: string, public ownerId: string, public description?: string) {}
}

export type Project = ProjectEntityBase;
