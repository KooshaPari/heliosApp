import { describe, expect, it } from "vitest";
import { TestProvider, makeRegistration, makeRegistry } from "./registry_test_helpers.js";

describe("ProviderRegistry: Filtering", () => {
  it("should list providers by type", async () => {
    const { registry } = makeRegistry();
    const acpAdapter = new TestProvider();
    const mcpAdapter = new TestProvider();

    await registry.register(makeRegistration("acp-provider", "acp"), acpAdapter);
    await registry.register(makeRegistration("mcp-provider", "mcp"), mcpAdapter);

    const acpProviders = registry.listByType("acp");
    const mcpProviders = registry.listByType("mcp");

    expect(acpProviders).toHaveLength(1);
    expect(mcpProviders).toHaveLength(1);
  });

  it("should list providers by workspace", async () => {
    const { registry } = makeRegistry();
    const adapter1 = new TestProvider();
    const adapter2 = new TestProvider();

    await registry.register(makeRegistration("provider-ws1", "acp", "ws-1"), adapter1);
    await registry.register(makeRegistration("provider-ws2", "acp", "ws-2"), adapter2);

    const ws1Providers = registry.listByWorkspace("ws-1");
    const ws2Providers = registry.listByWorkspace("ws-2");

    expect(ws1Providers).toHaveLength(1);
    expect(ws2Providers).toHaveLength(1);
  });
});
