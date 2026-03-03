export type SessionTransport = "cliproxy_harness" | "native_openai";
export type SessionStatus = "detached" | "attaching" | "attached" | "terminated";

export type SessionRecord = {
  sessionId: string;
  laneId: string;
  codexSessionId: string;
  transport: SessionTransport;
  status: SessionStatus;
  lastHeartbeatAt: string;
};

export type EnsureSessionInput = {
  laneId: string;
  transport: SessionTransport;
  codexSessionId?: string;
};

export class SessionRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionRegistryError";
  }
}

export class InMemorySessionRegistry {
  private readonly bySessionId = new Map<string, SessionRecord>();
  private readonly activeLaneSessions = new Map<string, string>();
  private readonly activeCodexSessions = new Map<string, string>();

  ensure(input: EnsureSessionInput): { session: SessionRecord; created: boolean } {
    const nowIso = new Date().toISOString();
    const activeSessionId = this.activeLaneSessions.get(input.laneId);
    if (activeSessionId) {
      const active = this.bySessionId.get(activeSessionId);
      if (active) {
        if (input.codexSessionId && input.codexSessionId !== active.codexSessionId) {
          throw new SessionRegistryError(
            `lane ${input.laneId} already mapped to codex session ${active.codexSessionId}`
          );
        }

        active.status = "attached";
        active.transport = input.transport;
        active.lastHeartbeatAt = nowIso;
        return { session: { ...active }, created: false };
      }
      this.activeLaneSessions.delete(input.laneId);
    }

    const codexSessionId = input.codexSessionId ?? this.generateCodexSessionId();
    const codexCollision = this.activeCodexSessions.get(codexSessionId);
    if (codexCollision) {
      const colliding = this.bySessionId.get(codexCollision);
      if (colliding && colliding.status !== "terminated" && colliding.laneId !== input.laneId) {
        throw new SessionRegistryError(
          `codex session ${codexSessionId} already active on lane ${colliding.laneId}`
        );
      }
    }

    const session: SessionRecord = {
      sessionId: this.generateRuntimeSessionId(),
      laneId: input.laneId,
      codexSessionId,
      transport: input.transport,
      status: "attached",
      lastHeartbeatAt: nowIso,
    };

    this.bySessionId.set(session.sessionId, session);
    this.activeLaneSessions.set(session.laneId, session.sessionId);
    this.activeCodexSessions.set(session.codexSessionId, session.sessionId);
    return { session: { ...session }, created: true };
  }

  get(sessionId: string): SessionRecord | undefined {
    const session = this.bySessionId.get(sessionId);
    return session ? { ...session } : undefined;
  }

  listByLane(laneId: string): SessionRecord[] {
    const sessions: SessionRecord[] = [];
    for (const session of this.bySessionId.values()) {
      if (session.laneId === laneId) {
        sessions.push({ ...session });
      }
    }
    return sessions;
  }

  heartbeat(sessionId: string): SessionRecord {
    const session = this.bySessionId.get(sessionId);
    if (!session) {
      throw new SessionRegistryError(`session ${sessionId} not found`);
    }

    session.lastHeartbeatAt = new Date().toISOString();
    return { ...session };
  }

  terminate(sessionId: string): SessionRecord {
    const session = this.bySessionId.get(sessionId);
    if (!session) {
      throw new SessionRegistryError(`session ${sessionId} not found`);
    }

    session.status = "terminated";
    session.lastHeartbeatAt = new Date().toISOString();
    this.activeLaneSessions.delete(session.laneId);
    this.activeCodexSessions.delete(session.codexSessionId);
    return { ...session };
  }

  private generateRuntimeSessionId(): string {
    return `sess_${crypto.randomUUID()}`;
  }

  private generateCodexSessionId(): string {
    return `codex_${crypto.randomUUID()}`;
  }
}
