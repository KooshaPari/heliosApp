# Quickstart: Colab Agent Terminal Control Plane (Slice 1)

## Goal

Validate the first end-to-end vertical slice for `codex` CLI orchestration with `cliproxyapi++` harness and native fallback, with strict hardening gates from WP06.

## Prerequisites

1. Bun installed and available in PATH (`bun --version` tested on 1.2.9).
2. TypeScript compiler available (`tsc --version` tested on 5.9.3).
3. Security scanners available:
   - `semgrep --version` (tested on 1.151.0)
   - `gitleaks version` (tested on 8.30.0)
4. Repository root: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp`.

## Scenario A: Canonical Harness Path

1. Validate lifecycle commands and runtime metrics emission:
   - `bun test apps/runtime/tests/unit/protocol/runtime_metrics.test.ts`
2. Confirm lane create lifecycle is healthy:
   - Expected metrics include `lane_create_latency_ms`.
3. Confirm session attach with restore path is healthy:
   - Expected metrics include `session_restore_latency_ms`.

Expected result:
- Session transport path remains usable for canonical flow.
- Metrics stream publishes `diagnostics.metric` events for lane create and session restore latency.
- Runtime diagnostics (`createRuntime().getDiagnostics()`) include metric summaries.

## Scenario B: Harness Degradation Fallback

1. Execute forced error path in lifecycle command tests (`force_error: true` payload path).
2. Validate runtime remains responsive after failure commands.
3. Confirm diagnostics include status tags (`status=error`) in metric payload tags.

Expected result:
- Runtime does not crash.
- Failure response is normalized with stable error code.
- Metrics continue to emit and include error-status samples.

## Scenario C: Multi-Session Tab Control + Soak

1. Run multi-session soak harness:
   - `bun test apps/runtime/tests/soak/multi_session_soak.test.ts`
2. Validate trend metrics and thresholds:
  - `lane_create_latency_ms p95 <= 30ms`
  - `session_restore_latency_ms p95 <= 35ms`
   - `terminal_output_backlog_depth p95 <= 64`

Expected result:
- Repeated lane/session churn remains deterministic.
- No cross-session leakage under sustained load simulation.
- Backlog metrics remain under threshold bands.

## Strict Quality and Security Gates

Run all mandatory runtime hardening gates from repository root (runtime scope: `apps/runtime/**`):

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
