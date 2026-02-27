// T002 & T004 — Workspace entity functions and service

import type {
  CreateWorkspaceInput,
  Workspace,
  WorkspaceStore,
} from './types.js';

// Stub ID generator — uses spec 005 format ws_{ulid}
function generateWorkspaceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `ws_${timestamp}${random}`;
}

function normalizeRootPath(rootPath: string): string {
  return rootPath.endsWith('/') && rootPath.length > 1
    ? rootPath.slice(0, -1)
    : rootPath;
}

// ── Entity functions (immutable state transitions) ──────────────────

export function createWorkspace(input: CreateWorkspaceInput): Workspace {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error('Workspace name must not be empty');
  }
  if (!input.rootPath.startsWith('/')) {
    throw new Error('Workspace rootPath must be absolute');
  }
  const now = Date.now();
  return {
    id: generateWorkspaceId(),
    name,
    rootPath: normalizeRootPath(input.rootPath),
    state: 'active',
    createdAt: now,
    updatedAt: now,
    projects: [],
  };
}

export function openWorkspace(ws: Workspace): Workspace {
  if (ws.state !== 'closed') {
    throw new Error(
      `Cannot open workspace in '${ws.state}' state; must be 'closed'`,
    );
  }
  return { ...ws, state: 'active', updatedAt: Date.now() };
}

export function closeWorkspace(ws: Workspace): Workspace {
  if (ws.state !== 'active') {
    throw new Error(
      `Cannot close workspace in '${ws.state}' state; must be 'active'`,
    );
  }
  return { ...ws, state: 'closed', updatedAt: Date.now() };
}

export function deleteWorkspace(
  ws: Workspace,
  activeSessionCount: number,
): Workspace {
  if (activeSessionCount > 0) {
    throw new Error(
      'Cannot delete workspace with active sessions; close sessions first',
    );
  }
  if (ws.state === 'deleted') {
    throw new Error('Workspace is already deleted');
  }
  return { ...ws, state: 'deleted', updatedAt: Date.now() };
}

// ── Service layer (CRUD + uniqueness + persistence) ─────────────────

export class WorkspaceService {
  private readonly store: WorkspaceStore;
  private readonly sessionCountQuery: (
    workspaceId: string,
  ) => Promise<number>;

  constructor(
    store: WorkspaceStore,
    sessionCountQuery?: (workspaceId: string) => Promise<number>,
  ) {
    this.store = store;
    this.sessionCountQuery = sessionCountQuery ?? (() => Promise.resolve(0));
  }

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const existing = await this.store.getByName(input.name.trim());
    if (existing !== undefined) {
      throw new Error(
        `Workspace with name '${input.name.trim()}' already exists`,
      );
    }
    const ws = createWorkspace(input);
    await this.store.save(ws);
    return ws;
  }

  async open(id: string): Promise<Workspace> {
    const ws = await this.requireById(id);
    const opened = openWorkspace(ws);
    await this.store.save(opened);
    return opened;
  }

  async close(id: string): Promise<Workspace> {
    const ws = await this.requireById(id);
    const closed = closeWorkspace(ws);
    await this.store.save(closed);
    return closed;
  }

  async delete(id: string): Promise<void> {
    const ws = await this.requireById(id);
    const count = await this.sessionCountQuery(id);
    const deleted = deleteWorkspace(ws, count);
    // Mark deleted in store then remove
    await this.store.save(deleted);
    await this.store.remove(id);
  }

  async list(): Promise<Workspace[]> {
    return this.store.getAll();
  }

  async get(id: string): Promise<Workspace | undefined> {
    return this.store.getById(id);
  }

  private async requireById(id: string): Promise<Workspace> {
    const ws = await this.store.getById(id);
    if (ws === undefined) {
      throw new Error(`Workspace '${id}' not found`);
    }
    return ws;
  }
}
