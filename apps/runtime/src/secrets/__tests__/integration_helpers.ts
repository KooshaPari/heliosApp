import { randomBytes } from "node:crypto";
import { CredentialStore } from "../credential-store.js";
import { EncryptionService } from "../encryption.js";
import { RedactionEngine } from "../redaction-engine.js";
import { getDefaultRules } from "../redaction-rules.js";
import { ProtectedPathDetector } from "../protected-paths.js";
import { AuditSink } from "../../audit/audit-sink.js";
import type { LocalBus } from "../../protocol/bus.js";

export function makeFixedEncryption(): EncryptionService {
  const fixedKey = randomBytes(32);
  return new EncryptionService({ masterKeyOverride: async () => fixedKey });
}

export function makeStore(dataDir: string, bus: LocalBus): CredentialStore {
  return new CredentialStore({ dataDir, bus, encryption: makeFixedEncryption() });
}

export function makeEngine(): RedactionEngine {
  const engine = new RedactionEngine();
  engine.loadRules(getDefaultRules());
  return engine;
}

export function makeRedactFn(engine: RedactionEngine): (text: string) => string {
  return (text: string) =>
    engine.redact(text, {
      artifactId: `redact:${Date.now()}`,
      artifactType: "audit_payload",
      correlationId: "integration-test",
    }).redacted;
}

export function makeAuditSink(engine: RedactionEngine): AuditSink {
  return new AuditSink({ redactFn: makeRedactFn(engine) });
}

export function makeProtectedPathDetector(options: ConstructorParameters<typeof ProtectedPathDetector>[0] = {}): ProtectedPathDetector {
  return new ProtectedPathDetector(options);
}
