export type SessionTransport = "cliproxy_harness" | "native_openai";
export type SessionStatus = "detached" | "attaching" | "attached" | "terminated";

export type SessionRecord = {
  session_id: string;
  lane_id: string;
  codex_session_id: string;
  transport: SessionTransport;
  status: SessionStatus;
  last_heartbeat_at: string;
};

export type EnsureSessionInput = {
  lane_id: string;
  transport: SessionTransport;
  codex_session_id?: string;
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
    const activeSessionId = this.activeLaneSessions.get(input.lane_id);
    if (activeSessionId) {
      const active = this.bySessionId.get(activeSessionId);
      if (!active) {
        this.activeLaneSessions.delete(input.lane_id);
      } else {
        if (input.codex_session_id && input.codex_session_id !== active.codex_session_id) {
          throw new SessionRegistryError(
            `lane ${input.lane_id} already mapped to codex session ${active.codex_session_id}`
          );
        }

        active.status = "attached";
        active.transport = input.transport;
        active.last_heartbeat_at = nowIso;
        return { session: { ...active }, created: false };
      }
    }

    const codexSessionId = input.codex_session_id ?? this.generateCodexSessionId();
    const codexCollision = this.activeCodexSessions.get(codexSessionId);
    if (codexCollision) {
      const colliding = this.bySessionId.get(codexCollision);
      if (colliding && colliding.status !== "terminated" && colliding.lane_id !== input.lane_id) {
        throw new SessionRegistryError(
          `codex session ${codexSessionId} already active on lane ${colliding.lane_id}`
        );
      }
    }

    const session: SessionRecord = {
      session_id: this.generateRuntimeSessionId(),
      lane_id: input.lane_id,
      codex_session_id: codexSessionId,
      transport: input.transport,
      status: "attached",
      last_heartbeat_at: nowIso
    };

    this.bySessionId.set(session.session_id, session);
    this.activeLaneSessions.set(session.lane_id, session.session_id);
    this.activeCodexSessions.set(session.codex_session_id, session.session_id);
    return { session: { ...session }, created: true };
  }

  get(sessionId: string): SessionRecord | undefined {
    const session = this.bySessionId.get(sessionId);
    return session ? { ...session } : undefined;
  }

  listByLane(laneId: string): SessionRecord[] {
    const sessions: SessionRecord[] = [];
    for (const session of this.bySessionId.values()) {
      if (session.lane_id === laneId) {
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

    session.last_heartbeat_at = new Date().toISOString();
    return { ...session };
  }

  terminate(sessionId: string): SessionRecord {
    const session = this.bySessionId.get(sessionId);
    if (!session) {
      throw new SessionRegistryError(`session ${sessionId} not found`);
    }

    session.status = "terminated";
    session.last_heartbeat_at = new Date().toISOString();
    this.activeLaneSessions.delete(session.lane_id);
    this.activeCodexSessions.delete(session.codex_session_id);
    return { ...session };
  }

  private generateRuntimeSessionId(): string {
    return `sess_${crypto.randomUUID()}`;
  }

  private generateCodexSessionId(): string {
    return `codex_${crypto.randomUUID()}`;
  }
}
