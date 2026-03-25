import type { LocalBus } from "../../protocol/bus.js";

export async function publishAcpEvent(
  bus: LocalBus | null,
  topic: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!bus) {
    return;
  }

  try {
    await bus.publish({
      id: `acp-${Date.now()}-${Math.random()}`,
      type: "event",
      ts: new Date().toISOString(),
      topic,
      payload,
    });
  } catch (error) {
    // Best-effort telemetry; failures should not break provider flows.
    console.warn(`Failed to publish ACP event ${topic}:`, error);
  }
}
