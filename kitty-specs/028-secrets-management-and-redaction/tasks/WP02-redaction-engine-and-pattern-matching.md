---
work_package_id: WP02
title: Redaction Engine and Pattern Matching
lane: "planned"
dependencies:
- WP01
base_branch: main
created_at: '2026-02-27T00:00:00+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: Phase 1 - Redaction Pipeline
assignee: ''
agent: ''
shell_pid: ''
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 - Redaction Engine and Pattern Matching

## Objectives & Success Criteria

- Implement a synchronous redaction engine that intercepts content at the audit sink boundary before persistence.
- Deliver default redaction patterns for AWS, GCP, GitHub, and OpenAI key formats.
- Support configurable and operator-tunable redaction rules.
- Generate a redaction audit trail proving redaction was applied to each persisted artifact.

Success criteria:
- Zero secrets appear in persisted audit logs or export bundles (SC-028-001).
- Redaction adds < 5ms latency to audit sink writes (SC-028-003).
- Default patterns detect common API key formats.
- Operator-tuned patterns reduce false positive rate below 1% (NFR-028-004).
- Redaction audit trail present for every persisted artifact (SC-028-005).

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/028-secrets-management-and-redaction/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/028-secrets-management-and-redaction/spec.md`
- WP01 outputs:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/encryption.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/credential-store.ts`
- Audit subsystem (spec 024):
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/audit/`

Constraints:
- Synchronous filter on audit sink path (not async post-processor).
- Overhead < 5ms (p95) per audit sink write (NFR-028-001).
- Binary content passes through without scanning.
- Patterns compiled once at startup for performance.
- Coverage >=85% with FR-028-004, FR-028-005, FR-028-006, FR-028-010 traceability.

Implementation command:
- `spec-kitty implement WP02`

## Subtasks & Detailed Guidance

### Subtask T006 - Implement redaction engine as synchronous filter on audit sink path

- Purpose: Ensure no secrets reach persistent storage by filtering at the audit sink boundary.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/redaction-engine.ts`.
  2. Implement `RedactionEngine` class:
     - `redact(content: string, context: RedactionContext): RedactionResult`:
       - Synchronous method (no async).
       - Apply all active redaction rules to content.
       - Replace matched secrets with `[REDACTED:<category>]` placeholder.
       - Return `{ redacted: string, matches: RedactionMatch[] }`.
     - `isTextContent(content: unknown): boolean`:
       - Return true for string content.
       - Return false for Buffer/binary content (bypass scanning).
     - `loadRules(rules: RedactionRule[]): void`:
       - Compile regex patterns once.
       - Store compiled patterns for reuse.
     - `getStats(): RedactionStats`:
       - Total scans, total matches, average latency.
  3. Define `RedactionContext` type: `{ artifactId: string, artifactType: string, correlationId: string }`.
  4. Define `RedactionResult` type: `{ redacted: string, matches: RedactionMatch[], latencyMs: number }`.
  5. Define `RedactionMatch` type: `{ category: string, ruleId: string, position: number, length: number }` (position/length of the redacted region, NOT the secret value).
  6. Integrate with audit sink:
     - Hook into audit sink write path (spec 024).
     - All text content passes through `redact()` before persistence.
     - Binary content bypasses redaction.
  7. Measure and track latency per redaction call for SLO monitoring.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/redaction-engine.ts`
- Validation:
  - Known secret patterns are replaced with redaction placeholder.
  - Binary content passes through unchanged.
  - Latency < 5ms for typical audit events (< 10KB content).
  - Redaction result includes match metadata without secret values.
  - Stats track scan count and latency.
- Parallel: No.

### Subtask T007 - Implement default redaction rules for common key patterns

- Purpose: Ship sensible defaults that catch common API key formats without operator configuration.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/redaction-rules.ts`.
  2. Define `RedactionRule` type:
     - `id: string` -- unique rule identifier.
     - `category: string` -- e.g., `aws_key`, `gcp_key`, `github_token`, `openai_key`, `generic_api_key`.
     - `pattern: RegExp` -- compiled regex pattern.
     - `description: string` -- human-readable description.
     - `enabled: boolean` -- whether the rule is active.
     - `falsePositiveRate?: string` -- documented expected FP rate.
  3. Implement default rules:
     - **AWS Access Key**: `AKIA[0-9A-Z]{16}` (category: `aws_access_key`).
     - **AWS Secret Key**: 40-character base64 string following "aws_secret" or similar context (category: `aws_secret_key`).
     - **GCP API Key**: `AIza[0-9A-Za-z\-_]{35}` (category: `gcp_api_key`).
     - **GitHub Token**: `gh[ps]_[A-Za-z0-9_]{36,}` and `github_pat_[A-Za-z0-9_]{22,}` (category: `github_token`).
     - **OpenAI API Key**: `sk-[A-Za-z0-9]{48,}` (category: `openai_key`).
     - **Generic Bearer Token**: `Bearer [A-Za-z0-9\-._~+/]+=*` in context of auth headers (category: `bearer_token`).
     - **Generic API Key**: `(?:api[_-]?key|apikey|api[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9\-._]{20,}` (category: `generic_api_key`).
     - **Connection String**: `(?:postgres|mysql|mongodb|redis)://[^\\s]+@[^\\s]+` (category: `connection_string`).
     - **Private Key Header**: `-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----` (category: `private_key`).
  4. Implement `getDefaultRules(): RedactionRule[]` factory.
  5. Each pattern should be tested with known positive and negative examples.
  6. Handle partial matches (truncated keys in wrapped lines):
     - Patterns should match fragments that are clearly part of a key (e.g., AKIA prefix).
     - Use word boundary assertions where appropriate to avoid over-matching.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/redaction-rules.ts`
- Validation:
  - Each default rule matches known positive examples.
  - Each default rule does not match known negative examples.
  - Partial key matches are handled (no unredacted fragments).
  - All rules have category and description.
- Parallel: No.

### Subtask T008 - Implement configurable and operator-tunable redaction rule management

- Purpose: Allow operators to add, modify, disable, and tune redaction rules.
- Steps:
  1. In `redaction-rules.ts`, implement `RedactionRuleManager`:
     - `addRule(rule: RedactionRule): void` -- add custom rule, compile pattern.
     - `removeRule(ruleId: string): void` -- remove rule by ID.
     - `enableRule(ruleId: string): void` / `disableRule(ruleId: string): void`.
     - `listRules(): RedactionRule[]` -- list all rules with enabled/disabled status.
     - `importRules(path: string): Promise<void>` -- load rules from JSON config file.
     - `exportRules(path: string): Promise<void>` -- save current rules to JSON config file.
  2. Implement rule persistence:
     - Rules stored in `<data-dir>/config/redaction-rules.json`.
     - Default rules are loaded first, then custom rules merged on top.
     - Custom rules can override default rules by using the same ID.
  3. Implement rule validation:
     - Validate regex syntax on addRule (catch compilation errors).
     - Reject rules with empty patterns or missing categories.
     - Warn on overly broad patterns (e.g., `.+` that would match everything).
  4. Implement false positive tracking:
     - Track redaction matches per rule.
     - Expose per-rule match counts via `getStats()`.
     - Operators can review match counts to identify rules with high false positive rates and tune patterns.
  5. Emit bus event on rule changes: `secrets.redaction.rules.changed`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/redaction-rules.ts`
- Validation:
  - Custom rules can be added and remove.
  - Rules persist across restarts.
  - Custom rules override default rules by ID.
  - Invalid regex is caught on add.
  - Overly broad patterns trigger warning.
  - Per-rule match counts are tracked.
- Parallel: No.

### Subtask T009 - Implement redaction audit trail

- Purpose: Prove that redaction was applied to each persisted artifact.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/audit-trail.ts`.
  2. Implement `RedactionAuditTrail` class:
     - `record(artifactId: string, result: RedactionResult, context: RedactionContext): void`:
       - Create redaction audit record.
       - Record: artifact ID, artifact type, timestamp, rules applied, match count per category (NOT matched values), latency.
       - Emit `secrets.redaction.applied` bus event.
     - `verify(artifactId: string): Promise<RedactionVerification>`:
       - Check if a redaction audit record exists for the artifact.
       - Return `{ verified: boolean, recordTimestamp?: Date, rulesApplied?: string[] }`.
     - `listRecords(filter?: { artifactType?: string, since?: Date }): Promise<RedactionAuditRecord[]>`.
  3. Define `RedactionAuditRecord` type:
     - `artifactId: string`, `artifactType: string`, `timestamp: Date`.
     - `rulesApplied: string[]` (rule IDs that were active during scan).
     - `matchesByCategory: Record<string, number>` (count of matches per category).
     - `latencyMs: number`.
     - `correlationId: string`.
  4. Store redaction audit records via spec 024 audit subsystem.
  5. Ensure audit records are themselves safe (no secret values, only metadata).
  6. Records must be immutable once written.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/audit-trail.ts`
- Validation:
  - Every redacted artifact has a corresponding audit record.
  - Audit records contain rule IDs and match counts, not secret values.
  - Verification returns true for redacted artifacts, false for unknown.
  - Records are immutable.
  - Bus events emitted for each redaction.
- Parallel: No.

### Subtask T010 - Add unit tests for redaction engine, patterns, rules, and audit trail

- Purpose: Lock redaction behavior and pattern correctness before integration with audit subsystem.
- Steps:
  1. Add `redaction-engine.test.ts`:
     - Test known AWS key is redacted.
     - Test known GitHub token is redacted.
     - Test known OpenAI key is redacted.
     - Test known connection string is redacted.
     - Test binary content passes through unchanged.
     - Test redaction latency < 5ms for 10KB content.
     - Test redaction result includes match metadata without values.
     - Test multiple secrets in same content all redacted.
     - Test partial key (truncated at line wrap) is redacted.
     - Test normal text content is not redacted (no false positives for common strings).
  2. Add `redaction-rules.test.ts`:
     - Test each default rule with positive and negative examples.
     - Test custom rule addition and removal.
     - Test rule enable/disable.
     - Test rule persistence (save and reload).
     - Test invalid regex rejection.
     - Test overly broad pattern warning.
     - Test per-rule match counting.
  3. Add `redaction-audit.test.ts`:
     - Test record creation for redacted artifact.
     - Test verification returns true for recorded artifact.
     - Test verification returns false for unknown artifact.
     - Test record contains no secret values.
     - Test bus event emission.
     - Test listing with filters.
  4. Map tests to requirements:
     - FR-028-004 (redaction engine): engine tests.
     - FR-028-005 (audit sink boundary): engine integration with sink.
     - FR-028-006 (configurable rules): rule management tests.
     - FR-028-010 (redaction audit): audit trail tests.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/__tests__/redaction-engine.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/__tests__/redaction-rules.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/secrets/__tests__/redaction-audit.test.ts`
- Validation:
  - All tests pass.
  - Coverage >=85% on redaction-engine.ts, redaction-rules.ts, audit-trail.ts.
  - FR-028-004, FR-028-005, FR-028-006, FR-028-010 each have at least one mapped test.
- Parallel: Yes (after T006-T009 are stable).

## Test Strategy

- Use known secret patterns as test fixtures (not real secrets).
- Benchmark redaction latency with `performance.now()` in tests.
- Rule persistence tests use temporary config directories.
- Audit trail tests use test spy on bus events.

## Risks & Mitigations

- Risk: Compiled regex performance degrades with many rules.
- Mitigation: Benchmark with 50+ rules; consider combined regex or Aho-Corasick if needed.
- Risk: False positives on base64-encoded non-secret content.
- Mitigation: Context-aware patterns (look for key= or token= prefixes); per-rule match tracking for tuning.

## Review Guidance

- Confirm redaction is synchronous on audit sink path.
- Confirm binary content bypasses scanning.
- Confirm default patterns cover AWS, GCP, GitHub, OpenAI formats.
- Confirm redaction placeholder includes category but not secret value.
- Confirm audit trail records contain no secret values.
- Confirm latency is measured and tracked.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
