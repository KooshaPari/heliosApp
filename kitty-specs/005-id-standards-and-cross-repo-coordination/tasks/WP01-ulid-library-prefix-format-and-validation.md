---
work_package_id: WP01
title: "ULID Library, Prefix Format, and Validation"
lane: "planned"
dependencies: []
subtasks: ["T001", "T002", "T003", "T004", "T005", "T006"]
phase: "Phase 1 - Foundation"
assignee: ""
agent: ""
---

# Work Package Prompt: WP01 - ULID Library, Prefix Format, and Validation

## Objectives & Success Criteria

- Implement self-contained ULID generation with monotonic ordering within the same millisecond.
- Define prefix registry mapping entity types to canonical prefixes.
- Provide `generateId`, `validateId`, and `parseId` public API.
- Zero runtime dependencies.

Success criteria:
- Zero collisions in 10M ID generation test.
- All generated IDs match format `^[a-z]{2,3}_[0-9A-HJKMNP-TV-Z]{26}$`.
- Generation < 0.01ms (p95); validation < 0.005ms (p95).
- Monotonic ordering confirmed within same millisecond.
- No runtime imports from node_modules.

## Context & Constraints

- Plan: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/005-id-standards-and-cross-repo-coordination/plan.md`
- Spec: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/005-id-standards-and-cross-repo-coordination/spec.md`
- Target directory: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/`

Constraints:
- Zero runtime dependencies (NFR-004).
- No heap allocation beyond output string (NFR-003).
- URL-safe, filename-safe, JSON-safe (alphanumeric + underscore only).
- Crockford base32 encoding for ULID body.

## Subtasks & Detailed Guidance

### Subtask T001 - Implement self-contained ULID generation

- Purpose: provide globally unique, lexicographically sortable identifiers without external dependencies.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/ulid.ts`.
  2. Implement Crockford base32 encoding table: `0123456789ABCDEFGHJKMNPQRSTVWXYZ`.
  3. Implement `encodeTime(timestamp: number): string` — encode Unix ms timestamp into 10-char Crockford base32.
  4. Implement `encodeRandom(): string` — generate 16-char random component using `crypto.getRandomValues`.
  5. Implement monotonic state: track `lastTimestamp` and `lastRandom`. If same millisecond, increment `lastRandom` instead of generating new random.
  6. Implement `generateUlid(): string` — combine time + random, enforce monotonicity.
  7. Handle overflow of random component at same millisecond: throw with clear error (wait for next ms in caller).
  8. Export `generateUlid` and `encodeTime` (for parsing).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/ulid.ts`
- Validation checklist:
  - [ ] Output is exactly 26 characters.
  - [ ] All characters are valid Crockford base32.
  - [ ] Two IDs generated in same ms are monotonically ordered.
  - [ ] IDs from different ms are lexicographically ordered by time.
  - [ ] No imports from node_modules.
- Edge cases:
  - Clock skew backward — use max of current time and last timestamp.
  - Random overflow at same ms — should be astronomically rare; throw and retry.
  - `crypto.getRandomValues` not available — fail fast (Bun always provides it).
- Parallel: No.

### Subtask T002 - Define prefix registry

- Purpose: map entity types to canonical, collision-free prefixes.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/prefixes.ts`.
  2. Define `EntityType` string literal union: `'workspace' | 'lane' | 'session' | 'terminal' | 'run' | 'correlation'`.
  3. Define `PREFIX_MAP` as a frozen `Record<EntityType, string>`:
     - workspace → `ws`
     - lane → `ln`
     - session → `ss`
     - terminal → `tm`
     - run → `rn`
     - correlation → `cor`
  4. Define `REVERSE_PREFIX_MAP`: `Record<string, EntityType>` — for parsing.
  5. Implement `getPrefix(entityType: EntityType): string`.
  6. Implement `getEntityType(prefix: string): EntityType | undefined`.
  7. Validate all prefixes are unique and 2-3 chars lowercase alpha only.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/prefixes.ts`
- Validation checklist:
  - [ ] All six entity types have unique prefixes.
  - [ ] Reverse map resolves all prefixes.
  - [ ] Maps are frozen (immutable).
  - [ ] Prefixes are 2-3 lowercase alpha characters.
- Edge cases:
  - Future prefix additions — registry is append-only by convention.
  - Unknown entity type passed to `getPrefix` — TypeScript union prevents this at compile time.
- Parallel: No.

### Subtask T003 - Implement generateId public API

- Purpose: provide the primary ID generation entry point used by all subsystems.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/index.ts`.
  2. Implement `generateId(entityType: EntityType): string`:
     - Get prefix from registry.
     - Generate ULID.
     - Return `${prefix}_${ulid}`.
  3. Implement `generateCorrelationId(): string` — convenience for `generateId('correlation')`.
  4. Re-export `EntityType` and all public types.
  5. Validate output matches format regex before return (debug assertion, stripped in production).
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/index.ts`
- Validation checklist:
  - [ ] Output format: `{2-3 lowercase}_{26 Crockford base32}`.
  - [ ] `generateCorrelationId` returns `cor_...`.
  - [ ] Multiple calls produce unique results.
  - [ ] Return type is `string` (not branded type for cross-repo compat).
- Edge cases:
  - Very rapid calls (>1M/sec) — monotonic counter handles same-ms generation.
- Parallel: No.

### Subtask T004 - Implement validateId

- Purpose: provide validation for incoming IDs from external sources.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/validate.ts`.
  2. Implement `validateId(raw: string): { valid: true; entityType: EntityType } | { valid: false; reason: string }`.
  3. Step 1: check for underscore separator — if missing, return `{ valid: false, reason: 'Missing separator' }`.
  4. Step 2: split into prefix and body.
  5. Step 3: check prefix against `REVERSE_PREFIX_MAP` — if unknown, return `{ valid: false, reason: 'Unknown prefix: ${prefix}' }`.
  6. Step 4: check body length === 26.
  7. Step 5: check all body characters are valid Crockford base32 (`/^[0-9A-HJKMNP-TV-Z]{26}$/`).
  8. Step 6: return `{ valid: true, entityType }`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/validate.ts`
- Validation checklist:
  - [ ] Valid IDs return `{ valid: true }` with correct entity type.
  - [ ] Missing separator returns specific error.
  - [ ] Unknown prefix returns specific error.
  - [ ] Wrong body length returns specific error.
  - [ ] Invalid characters return specific error.
  - [ ] Empty string returns error.
- Edge cases:
  - Multiple underscores — split on first only.
  - Lowercase ULID body — should fail (Crockford base32 is uppercase).
  - Prefix with numbers — should fail (prefixes are alpha only).
- Parallel: No.

### Subtask T005 - Implement parseId

- Purpose: extract entity type and timestamp from any valid ID.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/parse.ts`.
  2. Implement `parseId(raw: string): { entityType: EntityType; timestamp: Date; ulid: string } | null`.
  3. First, call `validateId` — if invalid, return null.
  4. Extract prefix and ULID body.
  5. Decode timestamp from first 10 chars of ULID body (reverse Crockford base32 → milliseconds since epoch).
  6. Construct `Date` from decoded timestamp.
  7. Return structured result.
  8. Implement `decodeTime(encoded: string): number` — reverse of `encodeTime`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/src/parse.ts`
- Validation checklist:
  - [ ] Round-trip: generate ID, parse, verify timestamp is within 1ms of generation time.
  - [ ] Entity type extraction matches generation input.
  - [ ] Invalid ID returns null (not throw).
  - [ ] ULID body is included in parse result.
- Edge cases:
  - Very old timestamps (epoch) — should decode correctly.
  - Maximum timestamp (year 10889) — should decode without overflow.
- Parallel: No.

### Subtask T006 - Add Vitest unit tests

- Purpose: lock ID generation, validation, and parsing behavior.
- Steps:
  1. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/ulid.test.ts`.
  2. Test ULID format: 26 chars, valid Crockford base32.
  3. Test monotonicity: generate 1000 IDs in tight loop, verify lexicographic ordering.
  4. Test backward clock: mock time going backward, verify IDs still monotonic.
  5. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/generate.test.ts`.
  6. Test `generateId` for each entity type: correct prefix, valid format.
  7. Test `generateCorrelationId`: prefix is `cor`.
  8. Test uniqueness: 10,000 IDs, zero duplicates.
  9. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/validate.test.ts`.
  10. Test valid IDs for all entity types.
  11. Test invalid: empty string, no separator, unknown prefix, short body, invalid chars, lowercase body.
  12. Create `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/parse.test.ts`.
  13. Test round-trip: generate, parse, verify entity type and timestamp.
  14. Test invalid ID: returns null.
  15. Add FR traceability: `// FR-001` through `// FR-009`.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/ulid.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/generate.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/validate.test.ts`
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/packages/ids/tests/parse.test.ts`
- Validation checklist:
  - [ ] >= 30 test cases across all files.
  - [ ] FR traceability comments present.
  - [ ] Tests run in < 5 seconds.
- Edge cases:
  - Test with tampered ULID (valid chars but manipulated timestamp).
  - Test prefix boundary: 2-char and 3-char prefixes both work.
- Parallel: Yes (after T003/T004/T005 APIs are stable).

## Test Strategy

- Unit tests via Vitest for correctness.
- Monotonicity tests use tight loops and lexicographic comparison.
- Validation tests emphasize negative cases.
- Parse tests use round-trip verification.

## Risks & Mitigations

- Risk: Crockford base32 encoding has off-by-one in excluded characters (I, L, O, U).
- Mitigation: test against official Crockford base32 reference vectors.

## Review Guidance

- Confirm ULID encoding matches Crockford base32 exactly.
- Confirm monotonic increment handles same-ms correctly.
- Confirm validation regex matches spec.
- Confirm zero runtime dependencies (check package.json).

## Activity Log

- 2026-02-27 – system – lane=planned – Prompt generated.
