# Testing Strategy

## Test Objectives

- Validate terminal responsiveness and stability at concurrency target.
- Validate policy enforcement and command safety invariants.
- Validate provider adapter correctness and isolation.
- Validate session replay, crash recovery, and audit integrity.

## Test Layers

### Unit
- Policy evaluator decisions.
- Provider adapter request/response normalization.
- Session state reducers and persistence codecs.

### Integration
- PTY + mux adapter lifecycle.
- Provider runner orchestration and timeout/retry behavior.
- MCP bridge calls and permission boundaries.

### End-to-End
- New project flow (clone/init/open).
- New chat flow with provider selection.
- Freehand terminal parity under heavy load.
- AI-assisted apply/rollback path with audit trail.

## Performance and Reliability

- Soak tests: 25 active terminals for extended sessions.
- Burst tests: high-output command streams.
- Startup latency tests.
- Memory ceiling tests with representative workload profiles.

## Security Tests

- Blocked command/path policy enforcement.
- Secrets redaction validation in logs and UI.
- Provider credential isolation and leakage tests.

## Exit Criteria for v1

- 0 critical policy bypasses.
- 0 data-loss bugs in session restore for tested scenarios.
- Memory and latency metrics hit agreed thresholds on reference hardware.
- Provider adapter conformance suite green for launch providers.
