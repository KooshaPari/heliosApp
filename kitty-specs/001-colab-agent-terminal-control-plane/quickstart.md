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

Expected result:
- Session transport resolves to `cliproxy_harness`.
- Terminal output streams without local runtime lockup.
- Diagnostics show harness status `healthy`.

## Scenario B: Harness Degradation Fallback

1. Stop or invalidate `cliproxyapi++` harness.
2. Attempt new `codex` session creation in control plane.
3. Observe diagnostics and routing behavior.

Expected result:
- Runtime does not crash.
- New session degrades to `native_openai` transport.
- Diagnostic panel includes explicit degrade reason and timestamp.

## Scenario C: Multi-Session Tab Control

1. Create multiple lanes and sessions in one workspace.
2. Switch active context repeatedly across tabs.
3. Validate command history and active terminal mapping per lane.

Expected result:
- Context switches remain deterministic and fast.
- No cross-lane session ID leakage.
- Event ordering remains valid for lifecycle-critical operations.

## Test and Quality Gates

1. Run unit/integration tests with Vitest.
2. Run UI flow validation with Playwright.
3. Run lint/type/static checks at strict settings (no ignore/skip).
4. Run regression checks for fallback route and event schema compliance.
5. Run protocol parity checks against formal assets (`specs/protocol/v1/methods.json`, `specs/protocol/v1/topics.json`) and verify no unmapped entries.

Feature is ready for `/spec-kitty.tasks` when all scenarios and gates pass.

## Formal Protocol Parity Verification (WP09)

Run parity checks after any protocol contract/runtime/task update:

```bash
node tools/gates/protocol-parity.mjs
bun test apps/runtime/tests/unit/protocol/protocol_parity_gate.test.ts
```

Valid annotations in `contracts/protocol-parity-matrix.json`:

- `status: implemented` for shipped surfaces.
- `status: deferred` with at least one `Txxx` task reference.
- `status: extension` for explicit Helios deltas (for example `harness.status.changed`, `lane.attached`).
