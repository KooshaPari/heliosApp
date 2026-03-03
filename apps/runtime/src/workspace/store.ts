// T003 — In-memory workspace store

import type { Workspace, WorkspaceStore } from './types.js';

export class InMemoryWorkspaceStore implements WorkspaceStore {
  private readonly data = new Map<string, Workspace>();

  async getAll(): Promise<Workspace[]> {
    return [...this.data.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  async getById(id: string): Promise<Workspace | undefined> {
    return this.data.get(id);
  }

  async getByName(name: string): Promise<Workspace | undefined> {
    const lower = name.toLowerCase();
    for (const ws of this.data.values()) {
      if (ws.name.toLowerCase() === lower) {
        return ws;
      }
    }
    return undefined;
  }

  async save(workspace: Workspace): Promise<void> {
    this.data.set(workspace.id, workspace);
  }

  async remove(id: string): Promise<void> {
    this.data.delete(id);
  }

  async flush(): Promise<void> {
    // No-op for in-memory backend
  }
}

export function createInMemoryStore(): WorkspaceStore {
  return new InMemoryWorkspaceStore();
}
