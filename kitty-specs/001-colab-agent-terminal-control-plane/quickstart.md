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

1. `bun run lint`
2. `bun run typecheck`
3. `bun run static`
4. `bun run test`
5. `bun run security`
6. `bun run quality`

Expected result:
- All commands exit `0`.
- No ignore/skip bypass patterns (`@ts-ignore`, `eslint-disable`, `semgrep: ignore`, focused tests, `any`).
- Protocol parity gate passes bidirectionally between runtime and formal protocol assets.
- Coverage/traceability gates are tracked for WP07 and are not part of WP06 local command surface.

## Diagnostics and Failure Triage

1. If soak thresholds fail, inspect diagnostics metrics summary first.
2. If `terminal_output_backlog_depth` fails, reduce output burst size and inspect producer throttling.
3. If latency metrics fail, inspect lifecycle event volume and check for unexpected synchronous work in bus handlers.
4. Re-run focused suite after mitigation:
   - `bun test apps/runtime/tests/unit/protocol/runtime_metrics.test.ts`
   - `bun test apps/runtime/tests/soak/multi_session_soak.test.ts`

## MVP Boundary Checklist (WP06)

### Included in MVP (Slice-1)

- In-memory runtime metrics for lane create latency, session restore latency, and terminal backlog depth.
- Local soak harness for multi-session churn baseline checks.
- Strict local runtime gates for lint/type/protocol-parity/test/security.
- Explicit diagnostics metric events for operator triage.

### Deferred Post-MVP (Slice-2+)

- Durable metrics persistence and historical dashboards.
- Cross-host distributed soak workloads and long-horizon retention analytics.
- Expanded protocol boundary depth beyond the slice-1 canonical transport route.

Feature is WP06-ready when all scenarios and strict gates pass.
