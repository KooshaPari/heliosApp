import { buildSpawnTerminalCommand } from "../integrations/exec";
import type { LocalBusEnvelope } from "../protocol/types";
import {
  cloneBuffer,
  createTerminalBuffer,
  errorResponse,
  makeTerminalId,
  type ProtocolResponse,
  type TerminalBuffer,
  type TerminalRecord,
  type TerminalState,
} from "./terminal_plane_helpers";

type CommandDispatcher = (command: LocalBusEnvelope) => Promise<LocalBusEnvelope>;
type EventPublisher = (event: LocalBusEnvelope) => Promise<void>;

type SpawnTerminalInput = { command_id: string; correlation_id: string; workspace_id: string; lane_id: string; session_id: string; title?: string };
type InputTerminalInput = { command_id: string; correlation_id: string; workspace_id: string; lane_id: string; session_id: string; terminal_id: string; data: string };
type ResizeTerminalInput = { command_id: string; correlation_id: string; workspace_id: string; lane_id: string; session_id: string; terminal_id: string; cols: number; rows: number };

type TerminalPlaneOptions = {
  dispatchCommand: CommandDispatcher;
  publishEvent: EventPublisher;
  terminalBufferCapBytes: number;
};

export function createTerminalPlane(options: TerminalPlaneOptions) {
  const terminalBuffers = new Map<string, TerminalBuffer>();
  const terminals = new Map<string, TerminalRecord>();
  const textEncoder = new TextEncoder();
  let terminalState: TerminalState | undefined;

  const registerTerminal = (
    terminalId: string,
    workspaceId: string,
    laneId: string,
    sessionId: string,
  ): void => {
    terminals.set(terminalId, {
      terminal_id: terminalId,
      workspace_id: workspaceId,
      lane_id: laneId,
      session_id: sessionId,
      state: "active",
    });
    terminalBuffers.set(terminalId, createTerminalBuffer(options.terminalBufferCapBytes));
    terminalState = "active";
  };

  const getTerminal = (terminalId: string): TerminalRecord | undefined => {
    const terminal = terminals.get(terminalId);
    return terminal ? { ...terminal } : undefined;
  };

  const getTerminalBuffer = (terminalId: string): TerminalBuffer => {
    const buffer = terminalBuffers.get(terminalId);
    return cloneBuffer(buffer ?? createTerminalBuffer(options.terminalBufferCapBytes));
  };

  const applyEvent = (event: LocalBusEnvelope): void => {
    if (!event.topic) {
      return;
    }

    if (
      event.topic === "terminal.spawned" &&
      event.terminal_id &&
      event.workspace_id &&
      event.lane_id &&
      event.session_id
    ) {
      registerTerminal(event.terminal_id, event.workspace_id, event.lane_id, event.session_id);
      return;
    }

    if (event.topic !== "terminal.state.changed" || !event.terminal_id) {
      return;
    }

    const terminal = terminals.get(event.terminal_id);
    const nextState =
      event.payload &&
      typeof event.payload === "object" &&
      !Array.isArray(event.payload) &&
      typeof event.payload.state === "string"
        ? (event.payload.state as TerminalState)
        : undefined;

    if (!terminal || !nextState) {
      return;
    }

    terminal.state = nextState;
    terminalState = nextState;
  };

  const spawnTerminal = async (
    input: SpawnTerminalInput,
  ): Promise<ProtocolResponse<{
    terminal_id: string;
    lane_id: string | null;
    session_id: string | null;
    state: TerminalState;
    diagnostics?: Record<string, unknown>;
  }>> => {
    const terminalId = makeTerminalId(input.session_id);
    const response = await options.dispatchCommand(
      buildSpawnTerminalCommand({
        ...input,
        terminal_id: terminalId,
      }),
    );

    if (response.type === "response" && response.status === "ok") {
      const resultTerminalId =
        response.result &&
        typeof response.result === "object" &&
        !Array.isArray(response.result) &&
        typeof response.result.terminal_id === "string"
          ? response.result.terminal_id
        : terminalId;
      registerTerminal(resultTerminalId, input.workspace_id, input.lane_id, input.session_id);
    }

    return response as ProtocolResponse<{
      terminal_id: string;
      lane_id: string | null;
      session_id: string | null;
      state: TerminalState;
      diagnostics?: Record<string, unknown>;
    }>;
  };

  const inputTerminal = async (
    input: InputTerminalInput,
  ): Promise<ProtocolResponse<{ output_seq: number }>> => {
    const terminal = terminals.get(input.terminal_id);
    if (!terminal) {
      return errorResponse(input.correlation_id, "TERMINAL_NOT_FOUND", "Terminal not found");
    }

    if (
      terminal.workspace_id !== input.workspace_id ||
      terminal.lane_id !== input.lane_id ||
      terminal.session_id !== input.session_id
    ) {
      return errorResponse(
        input.correlation_id,
        "TERMINAL_CONTEXT_MISMATCH",
        "Terminal does not belong to this lane",
      );
    }

    if (input.data.length === 0) {
      return errorResponse(
        input.correlation_id,
        "INVALID_TERMINAL_INPUT",
        "payload.data is required",
      );
    }

    const buffer =
      terminalBuffers.get(input.terminal_id) ??
      createTerminalBuffer(options.terminalBufferCapBytes);
    terminalBuffers.set(input.terminal_id, buffer);

    const byteLen = textEncoder.encode(input.data).length;
    let overflowed = false;

    while (buffer.total_bytes + byteLen > buffer.cap_bytes && buffer.entries.length > 0) {
      const evicted = buffer.entries.shift();
      if (!evicted) {
        continue;
      }
      buffer.total_bytes -= evicted.bytes;
      buffer.dropped_bytes += evicted.bytes;
      overflowed = true;
    }

    if (buffer.total_bytes + byteLen > buffer.cap_bytes) {
      buffer.dropped_bytes += byteLen;
      overflowed = true;
    } else {
      const seq = buffer.next_seq++;
      buffer.entries.push({ seq, data: input.data, bytes: byteLen });
      buffer.total_bytes += byteLen;
    }

    const outputSeq = buffer.next_seq - 1;

    await options.publishEvent({
      id: `evt-output-${Date.now()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic: "terminal.output",
      workspace_id: input.workspace_id,
      lane_id: input.lane_id,
      session_id: input.session_id,
      terminal_id: input.terminal_id,
      correlation_id: input.correlation_id,
      payload: {
        data: input.data,
        overflowed,
        output_seq: outputSeq,
      },
    });

    if (overflowed) {
      terminal.state = "throttled";
      terminalState = "throttled";
      await options.publishEvent({
        id: `evt-throttled-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.state.changed",
        workspace_id: input.workspace_id,
        lane_id: input.lane_id,
        session_id: input.session_id,
        terminal_id: input.terminal_id,
        correlation_id: input.correlation_id,
        payload: {
          state: "throttled",
        },
      });
    }

    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      correlation_id: input.correlation_id,
      result: { output_seq: outputSeq },
    };
  };

  const resizeTerminal = async (
    input: ResizeTerminalInput,
  ): Promise<ProtocolResponse<{ cols: number; rows: number }>> => {
    const terminal = terminals.get(input.terminal_id);
    if (!terminal) {
      return errorResponse(input.correlation_id, "TERMINAL_NOT_FOUND", "Terminal not found");
    }

    if (
      terminal.workspace_id !== input.workspace_id ||
      terminal.lane_id !== input.lane_id ||
      terminal.session_id !== input.session_id
    ) {
      return errorResponse(
        input.correlation_id,
        "TERMINAL_CONTEXT_MISMATCH",
        "Terminal does not belong to this lane",
      );
    }

    if (terminal.state === "throttled") {
      terminal.state = "active";
      terminalState = "active";
      await options.publishEvent({
        id: `evt-recover-${Date.now()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic: "terminal.state.changed",
        workspace_id: input.workspace_id,
        lane_id: input.lane_id,
        session_id: input.session_id,
        terminal_id: input.terminal_id,
        correlation_id: input.correlation_id,
        payload: {
          state: "active",
          runtime_state: {
            session: "detached",
            terminal: "active",
          },
        },
      });
    }

    return {
      id: `res-${Date.now()}`,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      correlation_id: input.correlation_id,
      result: { cols: input.cols, rows: input.rows },
    };
  };

  return {
    applyEvent,
    getTerminal,
    getTerminalBuffer,
    getTerminalState: (): TerminalState | undefined => terminalState,
    inputTerminal,
    registerTerminal,
    resizeTerminal,
    spawnTerminal,
  };
}
