import type { MCPConfig } from "../adapter.js";

export type MCPConnectionState = {
  connected: boolean;
  lastConnectionAttempt: Date;
  reconnectAttempts: number;
  reconnectBackoffMs: number;
};

const DEFAULT_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export class MCPConnectionManager {
  private state: MCPConnectionState = {
    connected: false,
    lastConnectionAttempt: new Date(),
    reconnectAttempts: 0,
    reconnectBackoffMs: DEFAULT_BACKOFF_MS,
  };

  getState(): MCPConnectionState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.connected;
  }

  markDisconnected(): void {
    this.state.connected = false;
  }

  async connect(config: MCPConfig): Promise<void> {
    if (!config.serverPath) {
      throw new Error("Config missing serverPath");
    }

    try {
      if (
        config.serverPath.includes("localhost") ||
        config.serverPath.includes("127.0.0.1")
      ) {
        this.state.connected = true;
        this.state.reconnectAttempts = 0;
        return;
      }

      this.state.connected = true;
    } catch (error) {
      this.state.lastConnectionAttempt = new Date();
      this.state.reconnectAttempts += 1;
      throw error;
    }
  }

  async reconnect(config: MCPConfig): Promise<void> {
    const timeSinceLastAttempt = Date.now() - this.state.lastConnectionAttempt.getTime();
    if (timeSinceLastAttempt < this.state.reconnectBackoffMs) {
      throw new Error("Reconnection backoff active");
    }

    try {
      await this.connect(config);
    } catch (error) {
      this.state.reconnectBackoffMs = Math.min(
        this.state.reconnectBackoffMs * 2,
        MAX_BACKOFF_MS
      );
      throw error;
    }
  }
}
