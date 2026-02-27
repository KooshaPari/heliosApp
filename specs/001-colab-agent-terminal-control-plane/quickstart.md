# 001 Colab Agent Terminal Control Plane - Quickstart

## WP08 Compliance Checks

Run targeted WP08 suites:

```bash
bun test apps/runtime/tests/unit/audit
bun test apps/runtime/tests/unit/sessions/test_checkpoint_store.test.ts
bun test apps/runtime/tests/integration/recovery
```

## Slice-2 Placeholder Verification

- Checkpoint interface exists and is non-operational in slice-1:
  - `apps/runtime/src/sessions/checkpoint_store.ts`
- Audit durability interface exists and is non-operational in slice-1:
  - `apps/runtime/src/audit/durable_store.ts`

## Retention/Export Verification

- Retention policy minimum is enforced at config construction time.
- Retention enforcement emits `audit.retention.deleted` proof events.
- Export contract includes required correlation/identity fields.
- Sensitive fields are redacted recursively in exports.
