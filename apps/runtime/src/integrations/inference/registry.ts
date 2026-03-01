import type { InferenceEngine } from "./engine";

export class EngineRegistry {
  private engines: Map<string, InferenceEngine> = new Map();
  private activeEngineId: string | null = null;

  register(engine: InferenceEngine): void {
    this.engines.set(engine.id, engine);
    if (this.activeEngineId === null) {
      this.activeEngineId = engine.id;
    }
  }

  unregister(engineId: string): void {
    this.engines.delete(engineId);
    if (this.activeEngineId === engineId) {
      const first = this.engines.keys().next();
      this.activeEngineId = first.done ? null : first.value;
    }
  }

  setActive(engineId: string): void {
    if (!this.engines.has(engineId)) {
      throw new Error(`Engine "${engineId}" not registered`);
    }
    this.activeEngineId = engineId;
  }

  getActive(): InferenceEngine {
    if (this.activeEngineId === null) {
      throw new Error("No active inference engine");
    }
    const engine = this.engines.get(this.activeEngineId);
    if (!engine) {
      throw new Error(`Active engine "${this.activeEngineId}" not found`);
    }
    return engine;
  }

  getEngine(engineId: string): InferenceEngine | undefined {
    return this.engines.get(engineId);
  }

  listEngines(): InferenceEngine[] {
    return Array.from(this.engines.values());
  }

  hasActiveEngine(): boolean {
    return this.activeEngineId !== null;
  }
}
