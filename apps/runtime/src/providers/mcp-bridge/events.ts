import type { LocalBus } from "../../protocol/bus.js";

export interface EventPublisher {
  publish(topic: string, payload: Record<string, unknown>): Promise<void>;
}

export class BestEffortEventPublisher implements EventPublisher {
  constructor(private readonly bus: LocalBus | null) {}

  async publish(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.bus) {
      return;
    }

    try {
      await this.bus.publish({
        id: `mcp-${Date.now()}-${Math.random()}`,
        type: "event",
        ts: new Date().toISOString(),
        topic,
        payload,
      });
    } catch (_error) {}
  }
}
