export type TerminalLifecycleState = "idle" | "spawning" | "active" | "throttled" | "closed";

export type TerminalContext = {
  terminalId: string;
  workspaceId: string;
  laneId: string;
  sessionId: string;
  title: string;
  state: TerminalLifecycleState;
  lastOutputSeq: number;
};

type SpawnInput = {
  terminalId: string;
  workspaceId: string;
  laneId: string;
  sessionId: string;
  title?: string;
};

type ExpectedContext = {
  workspaceId: string;
  laneId: string;
  sessionId: string;
};

export class TerminalRegistry {
  private readonly terminals = new Map<string, TerminalContext>();
  private readonly terminalsBySession = new Map<string, Set<string>>();

  spawn(input: SpawnInput): TerminalContext {
    const existing = this.terminals.get(input.terminalId);
    if (existing) {
      const existingSessionSet = this.terminalsBySession.get(existing.sessionId);
      if (existingSessionSet) {
        existingSessionSet.delete(existing.terminalId);
        if (existingSessionSet.size === 0) {
          this.terminalsBySession.delete(existing.sessionId);
        }
      }
    }

    const terminal: TerminalContext = {
      terminalId: input.terminalId,
      workspaceId: input.workspaceId,
      laneId: input.laneId,
      sessionId: input.sessionId,
      title: input.title ?? "Terminal",
      state: "spawning",
      lastOutputSeq: 0,
    };

    this.terminals.set(terminal.terminalId, terminal);
    let sessionSet = this.terminalsBySession.get(terminal.sessionId);
    if (!sessionSet) {
      sessionSet = new Set<string>();
      this.terminalsBySession.set(terminal.sessionId, sessionSet);
    }
    sessionSet.add(terminal.terminalId);
    return terminal;
  }

  get(terminalId: string): TerminalContext | undefined {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return undefined;
    }
    return { ...terminal };
  }

  listBySession(sessionId: string): TerminalContext[] {
    const terminalIds = this.terminalsBySession.get(sessionId);
    if (!terminalIds) {
      return [];
    }
    return Array.from(terminalIds)
      .map(terminalId => this.terminals.get(terminalId))
      .filter((terminal): terminal is TerminalContext => terminal !== undefined)
      .map(terminal => ({ ...terminal }));
  }

  setState(terminalId: string, state: TerminalLifecycleState): TerminalContext | undefined {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return undefined;
    }
    terminal.state = state;
    return { ...terminal };
  }

  incrementOutputSeq(terminalId: string): number {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return 0;
    }
    terminal.lastOutputSeq += 1;
    return terminal.lastOutputSeq;
  }

  remove(terminalId: string): void {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return;
    }
    this.terminals.delete(terminalId);
    const sessionSet = this.terminalsBySession.get(terminal.sessionId);
    if (!sessionSet) {
      return;
    }
    sessionSet.delete(terminalId);
    if (sessionSet.size === 0) {
      this.terminalsBySession.delete(terminal.sessionId);
    }
  }

  removeBySession(sessionId: string): void {
    const terminalIds = this.terminalsBySession.get(sessionId);
    if (!terminalIds) {
      return;
    }
    for (const terminalId of terminalIds) {
      this.terminals.delete(terminalId);
    }
    this.terminalsBySession.delete(sessionId);
  }

  isOwnedBy(terminalId: string, context: ExpectedContext): boolean {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return false;
    }
    return (
      terminal.workspaceId === context.workspaceId &&
      terminal.laneId === context.laneId &&
      terminal.sessionId === context.sessionId
    );
  }
}
