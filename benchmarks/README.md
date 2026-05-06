# Benchmarks

**Status:** Informational

Performance benchmarks for heliosApp are maintained in the repository root:

- [Runtime Performance Baselines](../../runtime-performance-baselines.md)

## Benchmark Suites

| Suite | Location |
|---|---|
| Protocol / LocalBus | `apps/runtime/tests/bench/protocol/` |
| Renderer switch | `apps/runtime/tests/bench/renderer/` |
| Workspace ops | `apps/runtime/tests/bench/workspace/` |
| Diagnostics | `apps/runtime/tests/bench/diagnostics/` |

## CI Gates

Coverage and performance gates are defined in `.github/workflows/quality-gates.yml`
(Gate 5: Coverage, Gate 7: Static Analysis) and enforced via `bun run gates`.

Baseline numbers are tracked in `runtime-performance-baselines.md`. Regressions
beyond the declared thresholds trigger CI failures.

<!-- Expand with per-release delta tables and hardware profiles — see ADR-005. -->
