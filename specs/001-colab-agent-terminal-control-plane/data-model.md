# 001 Colab Agent Terminal Control Plane - Data Model

## Slice-2 Placeholder Entities

### SessionCheckpoint (slice-2, deferred)
- `checkpoint_id`: string
- `workspace_id`: string
- `lane_id`: string
- `session_id`: string
- `created_at`: RFC3339 timestamp
- `cursor`: string
- `payload`: object

### DurableAuditRecord (slice-2, deferred)
- `recorded_at`: RFC3339 timestamp
- `sequence`: number | null
- `outcome`: accepted | rejected
- `reason`: string | null
- `envelope`: protocol envelope payload

## Retention and Export Compliance (slice-1 active)
- Retention policy defaults to `retention_days = 30` minimum.
- Expired records are deleted via retention hook.
- Deletion proof is emitted as `audit.retention.deleted`.
- Export records include required identifiers:
  - `envelope_id`, `envelope_type`, `correlation_id`
  - `workspace_id`, `lane_id`, `session_id`, `terminal_id`
  - `method_or_topic`
- Sensitive fields are recursively redacted to `[REDACTED]`.
