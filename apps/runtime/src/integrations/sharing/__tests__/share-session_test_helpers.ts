import { InMemoryLocalBus } from "../../../protocol/bus.js";
import { type PolicyGate, ShareSessionManager } from "../share-session.js";

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
    if (this.shouldDeny) {
      return {
        allowed: false,
        reason: this.denialReason,
      };
    }
    return { allowed: true };
  }
}

export function createShareManager() {
  const bus = new InMemoryLocalBus();
  const policyGate = new MockPolicyGate();
  const manager = new ShareSessionManager(bus, policyGate);

  return { bus, manager, policyGate };
}
