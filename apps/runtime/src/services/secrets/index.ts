/**
 * Secrets Service - Secret and Credential Management
 *
 * Provides unified access to secrets management including:
 * - Credential storage and retrieval
 * - Encryption and decryption
 * - Redaction of sensitive data
 * - Protected path detection
 * - Audit trail tracking
 * - Redaction rule management
 *
 * @module services/secrets
 */

// Audit Trail
export type {
  AuditFilter,
  RedactionAuditRecord,
} from "../../secrets/audit-trail.js";
export { RedactionAuditTrail } from "../../secrets/audit-trail.js";

// Credential Store
export type { CredentialAccessContext } from "../../secrets/credential-store.js";
export {
  CredentialAccessDeniedError,
  CredentialAlreadyExistsError,
  CredentialNotFoundError,
  CredentialStore,
} from "../../secrets/credential-store.js";

// Encryption
export type { EncryptedPayload } from "../../secrets/encryption.js";
export { EncryptionService } from "../../secrets/encryption.js";

// Protected Paths
export type {
  ProtectedPathAcknowledgment,
  ProtectedPathMatch,
  ProtectedPathPattern,
} from "../../secrets/protected-paths.js";
export {
  ProtectedPathConfig,
  ProtectedPathDetector,
} from "../../secrets/protected-paths.js";

// Redaction Engine
export type {
  RedactionContext,
  RedactionMatch,
  RedactionResult,
  RedactionRule,
  RedactionStats,
} from "../../secrets/redaction-engine.js";
export { RedactionEngine } from "../../secrets/redaction-engine.js";

// Redaction Rules
export {
  getDefaultRules,
  RedactionRuleManager,
} from "../../secrets/redaction-rules.js";
