export interface PolicyGate {
  evaluate(
    action: string,
    context: Record<string, unknown>
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }>;
}

export class DefaultPolicyGate implements PolicyGate {
  async evaluate(): Promise<{ allowed: boolean }> {
    return { allowed: true };
  }
}
