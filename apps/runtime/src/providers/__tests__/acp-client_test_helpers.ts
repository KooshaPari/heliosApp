import { InMemoryLocalBus } from "../../protocol/bus.js";
import { ACPClientAdapter, type PolicyGate } from "../acp-client.js";

export class MockPolicyGate implements PolicyGate {
  private shouldDeny = false;
  private denialReason = "Test denial";

  setShouldDeny(deny: boolean, reason?: string): void {
    this.shouldDeny = deny;
    if (reason) {
      this.denialReason = reason;
    }
  }

  async evaluate(
    _action: string,
    _context: Record<string, unknown>
  ): Promise<{ allowed: boolean; reason?: string }> {
    await Promise.resolve();
    if (this.shouldDeny) {
      return {
        allowed: false,
        reason: this.denialReason,
      };
    }
    return { allowed: true };
  }
}

export function makeAdapter() {
  const bus = new InMemoryLocalBus();
  const policyGate = new MockPolicyGate();
  return {
    bus,
    policyGate,
    adapter: new ACPClientAdapter(bus, policyGate),
  };
}
