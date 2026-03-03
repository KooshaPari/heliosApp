import type { LocalBusEnvelope } from "./types.js";

export interface LocalBus {
  publish(event: LocalBusEnvelope): Promise<void>;
  request(command: LocalBusEnvelope): Promise<LocalBusEnvelope>;
}

export class InMemoryLocalBus implements LocalBus {
  private readonly eventLog: LocalBusEnvelope[] = [];

  getEvents(): LocalBusEnvelope[] {
    return [...this.eventLog];
  }

  async publish(event: LocalBusEnvelope): Promise<void> {
    this.eventLog.push(event);
  }

  async request(_command: LocalBusEnvelope): Promise<LocalBusEnvelope> {
    return {
      id: _command.id,
      type: "response",
      ts: new Date().toISOString(),
      status: "ok",
      result: {},
    };
  }
}
