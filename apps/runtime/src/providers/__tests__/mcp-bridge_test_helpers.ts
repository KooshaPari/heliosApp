import { InMemoryLocalBus } from "../../protocol/bus.js";
import type { MCPConfig } from "../adapter.js";
import { MCPBridgeAdapter } from "../mcp-bridge.js";

export const defaultMcpConfig: MCPConfig = {
  serverPath: "stdio",
  args: [],
  timeout: 30000,
};

export function createBridge() {
  const bus = new InMemoryLocalBus();
  const adapter = new MCPBridgeAdapter(bus);
  return { adapter, bus };
}

export async function createInitializedBridge() {
  const { adapter, bus } = createBridge();
  await adapter.init(defaultMcpConfig);
  return { adapter, bus };
}
