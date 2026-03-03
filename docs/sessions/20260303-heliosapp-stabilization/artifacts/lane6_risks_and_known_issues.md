# Lane 6 Risks and Known Issues

Generated: 2026-03-03T16:12:16Z
Scope: docs/repro closure for `20260303-heliosapp-stabilization`

## Residual Risks

| Risk | Severity | Determinism | Mitigation | Evidence |
|---|---|---|---|---|
| External push operations can fail under DNS/network restrictions (`Could not resolve host`). | Medium | Non-deterministic external dependency | Use retry-enabled push wrapper taxonomy (`dns_network`) and bounded backoff. | `docs/sessions/20260303-heliosapp-stabilization/05_KNOWN_ISSUES.md` |
| Mirror temporary object directory permissions can block mirror writes. | Medium | Deterministic on affected mirror path | Apply one-shot tmp-dir remediation command emitted by wrapper (`.objects/.tmp` / `objects/tmp`). | `docs/sessions/20260303-heliosapp-stabilization/05_KNOWN_ISSUES.md` |
| Warning inventory remains above zero in runtime scan, so strict warning-elimination is deferred. | Low | Deterministic until hardening lane runs | Keep tracked as follow-up hardening tasks in WBS Wave E/F; do not treat as lane-blocking. | `docs/sessions/20260303-heliosapp-stabilization/artifacts/biome-runtime-src-20260303.txt` |

## Lane 6 Closure Position

- No open blockers remain for docs/repro closure itself.
- Reproducibility artifacts now exist and are checksumed.
- Remaining risks are operational follow-ups, not closure blockers for this lane.

## Cross-links

- Known issues source: `docs/sessions/20260303-heliosapp-stabilization/05_KNOWN_ISSUES.md`
- Test matrix: `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_test_matrix.md`
- Checksums: `docs/sessions/20260303-heliosapp-stabilization/artifacts/lane6_artifact_checksums.sha256`
- WBS tracker: `docs/sessions/20260303-heliosapp-stabilization/03_DAG_WBS.md`
