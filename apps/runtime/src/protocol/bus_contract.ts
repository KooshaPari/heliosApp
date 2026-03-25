import type { MethodHandler } from "./methods.js";
import type { EventEnvelope, LocalBusEnvelope, ResponseEnvelope } from "./types.js";

export type CommandBusOptions = {
  maxDepth?: number;
};

export interface LocalBus {
  publish(event: unknown): Promise<void>;
  request(command: LocalBusEnvelope): Promise<LocalBusEnvelope>;
  registerMethod(method: string, handler: MethodHandler): void;
  send(envelope: unknown): Promise<ResponseEnvelope>;
  subscribe(topic: string, handler: (evt: EventEnvelope) => void | Promise<void>): () => void;
  destroy(): void;
  getActiveCorrelationId(): string | undefined;
}
