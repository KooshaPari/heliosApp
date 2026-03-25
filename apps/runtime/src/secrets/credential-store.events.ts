import { randomBytes } from "node:crypto";
import type { LocalBus } from "../protocol/bus.js";
import type { LocalBusEnvelope } from "../protocol/types.js";

export async function emitCredentialEvent(
  bus: LocalBus | null,
  topic: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (bus === null) return;
  const envelope: LocalBusEnvelope = {
    id: `secrets:${topic}:${Date.now()}:${randomBytes(4).toString("hex")}`,
    type: "event",
    ts: new Date().toISOString(),
    topic,
    payload,
  };
  await bus.publish(envelope);
}
