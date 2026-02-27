# 001 Colab Agent Terminal Control Plane - Plan

## Slice Boundaries
- Slice 1 (current): in-memory runtime state, non-durable lifecycle/audit processing.
- Slice 2 (placeholder contract only in WP08): durable audit persistence and session checkpoint replay.

## Slice-2 Durability Placeholder Contract
- `apps/runtime/src/sessions/checkpoint_store.ts` defines `CheckpointStore`.
- `apps/runtime/src/audit/durable_store.ts` defines `AuditDurableStore`.
- Slice-1 implementations remain non-operational placeholders and must not silently persist state.

## Compliance Additions in WP08
- Retention policy model with minimum 30-day default policy.
- Retention enforcement hook emits deletion-proof audit records.
- Export contract includes completeness fields and recursive sensitive-field redaction.
