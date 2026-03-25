---
work_package_id: WP01
title: Zellij CLI Adapter and Session Lifecycle
lane: "for_review"
dependencies: []
base_branch: main
base_commit: 04dfbaad4ac7293e3868738d9ff6f9931df3349a
created_at: '2026-02-27T11:58:00.609535+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
phase: Phase 1 - Zellij Foundation
assignee: ''
agent: "claude-wp01-009"
shell_pid: "51017"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP01 - Zellij CLI Adapter and Session Lifecycle

## Objectives & Success Criteria

- Build a typed zellij CLI wrapper that detects zellij availability and version.
- Deliver session create, reattach, and terminate operations via the CLI wrapper.
- Maintain a session-to-lane binding registry for lookup and reconciliation.

Success criteria:
- Sessions are created with named convention `helios-lane-<laneId>` and bound to lanes.
- Session create completes in p95 < 2 seconds (NFR-009-001).
- Reattach restores a session after simulated restart in p95 < 3 seconds (NFR-009-003).
- Terminate cleans up the zellij session completely.

## Context & Constraints

Primary references:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/009-zellij-mux-session-adapter/spec.md`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/kitty-specs/009-zellij-mux-session-adapter/plan.md`
- Spec 008 (lane orchestrator) for lane identity

Constraints:
- All zellij operations via CLI shelling (Bun.spawn); no Rust FFI.
- Zellij must be pre-installed; clear error if missing.
- One session per lane (FR-009-002).

Implementation command:
- `spec-kitty implement WP01`

## Subtasks & Detailed Guidance

### Subtask T001 - Implement zellij CLI wrapper with version detection

- Purpose: provide a typed, testable interface for zellij CLI operations.
- Steps:
  1. Implement `ZellijCli` class in `apps/runtime/src/integrations/zellij/cli.ts`:
     - `checkAvailability(): Promise<{ available: boolean, version?: string, path?: string }>` -- runs `zellij --version`, parses output.
     - `run(args: string[], options?: { timeout?: number }): Promise<{ stdout: string, stderr: string, exitCode: number }>` -- general-purpose CLI runner via Bun.spawn.
     - `listSessions(): Promise<ZellijSession[]>` -- runs `zellij list-sessions`, parses output into typed records.
  2. Define `ZellijSession` type: `{ name: string, created: Date, attached: boolean }`.
  3. Implement minimum version check: require zellij >= 0.40.0 (or appropriate minimum).
  4. Handle the case where zellij is not in PATH: throw `ZellijNotFoundError` with installation guidance.
  5. Set a default timeout of 10 seconds for CLI commands.
  6. Log all CLI invocations at debug level with command, args, and duration.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/cli.ts`
- Validation checklist:
  - [ ] `checkAvailability` detects zellij presence and version.
  - [ ] `listSessions` returns typed session records.
  - [ ] Missing zellij throws with guidance message.
  - [ ] CLI timeout is enforced.
  - [ ] Debug logging for all CLI calls.
- Edge cases:
  - Zellij binary exists but is broken (segfault on --version): handle non-zero exit code.
  - Very old zellij version: detect and reject with version requirement message.
  - CLI command hangs: timeout kills the process and throws.

### Subtask T002 - Implement session create operation

- Purpose: create zellij sessions bound to lanes.
- Steps:
  1. Implement `createSession(laneId: string, options?: SessionOptions): Promise<MuxSession>` in `apps/runtime/src/integrations/zellij/session.ts`:
     - `SessionOptions`: `{ layout?: string, cwd?: string }`.
     - `MuxSession`: `{ sessionName: string, laneId: string, createdAt: Date, panes: PaneRecord[], tabs: TabRecord[] }`.
  2. Generate session name: `helios-lane-${laneId}`.
  3. Check if a session with this name already exists (via `listSessions`); if so, return error or reattach.
  4. Invoke zellij to create a new detached session with the given name and working directory.
  5. Verify the session was created by listing sessions again.
  6. Register the session in the binding registry (T005).
  7. Measure and log create latency for NFR-009-001.
  8. Return the `MuxSession` record.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/session.ts`
- Validation checklist:
  - [ ] Session created with correct naming convention.
  - [ ] Duplicate session name detected.
  - [ ] Session appears in `listSessions` after create.
  - [ ] Binding registry updated.
  - [ ] Create latency measured.
- Edge cases:
  - Lane already has a session: return existing session or error based on policy.
  - Zellij reports error on create: parse stderr, throw typed error.
  - Session create succeeds but session immediately crashes: detect and report.

### Subtask T003 - Implement session reattach operation

- Purpose: restore sessions after runtime restart using zellij native persistence.
- Steps:
  1. Implement `reattachSession(sessionName: string): Promise<MuxSession>` in `apps/runtime/src/integrations/zellij/session.ts`.
  2. Verify the session exists via `listSessions`.
  3. If session exists, attach to the session using the zellij CLI (detached mode).
  4. Query the session pane layout to rebuild the `MuxSession` record.
  5. Re-register in the binding registry with the associated lane ID.
  6. If the session does not exist, throw `SessionNotFoundError`.
  7. Measure reattach latency for NFR-009-003.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/session.ts`
- Validation checklist:
  - [ ] Existing sessions are reattached successfully.
  - [ ] Pane topology is reconstructed after reattach.
  - [ ] Missing sessions throw `SessionNotFoundError`.
  - [ ] Binding registry updated after reattach.
  - [ ] Reattach latency measured.
- Edge cases:
  - Session exists but is corrupted: detect and publish recovery-failure event.
  - Session exists but has different pane count than expected: log warning, use actual topology.
  - Multiple sessions with similar names: exact match required.

### Subtask T004 - Implement session terminate operation

- Purpose: cleanly shut down zellij sessions and release resources.
- Steps:
  1. Implement `terminateSession(sessionName: string): Promise<void>` in `apps/runtime/src/integrations/zellij/session.ts`.
  2. Run `zellij kill-session <sessionName>` via the CLI wrapper.
  3. Verify the session is gone via `listSessions`.
  4. If session still exists after kill, wait 2 seconds and retry once.
  5. Remove the session from the binding registry.
  6. Publish a `mux.session.terminated` event.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/session.ts`
- Validation checklist:
  - [ ] Session is killed via zellij CLI.
  - [ ] Session no longer appears in list after kill.
  - [ ] Binding registry entry removed.
  - [ ] Terminated event published.
- Edge cases:
  - Session already terminated: idempotent, no error.
  - Session cannot be killed (zellij bug): log error, force cleanup binding registry anyway.
  - Terminate during active user interaction: panes close, PTYs terminate.

### Subtask T005 - Implement session-to-lane binding registry

- Purpose: maintain the authoritative mapping between mux sessions and lanes.
- Steps:
  1. Implement `MuxRegistry` class in `apps/runtime/src/integrations/zellij/registry.ts`:
     - `bind(sessionName: string, laneId: string, session: MuxSession): void` -- creates binding.
     - `getBySession(sessionName: string): MuxBinding | undefined`.
     - `getByLane(laneId: string): MuxBinding | undefined`.
     - `unbind(sessionName: string): void`.
     - `list(): MuxBinding[]`.
  2. Define `MuxBinding`: `{ sessionName, laneId, session: MuxSession, boundAt: Date }`.
  3. Enforce one-to-one: one session per lane, one lane per session.
  4. Provide `getOrphaned(): MuxBinding[]` returning bindings whose sessions no longer exist in zellij.
- Files:
  - `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp/apps/runtime/src/integrations/zellij/registry.ts`
- Validation checklist:
  - [ ] One-to-one binding enforced.
  - [ ] Lookup by session name and lane ID both work.
  - [ ] Duplicate binding throws.
  - [ ] `getOrphaned` detects stale bindings.
- Edge cases:
  - Bind a lane that already has a session: throw with existing session info.
  - Unbind non-existent binding: no-op.
  - Concurrent bind/unbind: serialize with simple locking.

## Test Strategy

- Unit test CLI wrapper with mocked Bun.spawn (verify command construction, parse output).
- Unit test binding registry CRUD and one-to-one enforcement.
- Integration test: create a real zellij session, verify it appears in list, terminate, verify gone.
- Integration test: create session, simulate restart (new runtime instance), reattach.

## Risks & Mitigations

- Risk: zellij CLI output format changes between versions.
- Mitigation: version detection + output parsing with fallback patterns.
- Risk: detached session creation is unreliable.
- Mitigation: verify session exists after create, retry once on failure.

## Review Guidance

- Validate CLI wrapper handles all zellij error modes gracefully.
- Validate binding registry enforces one-to-one invariant.
- Confirm reattach reconstructs pane topology correctly.
- Verify session naming convention is consistent.

## Activity Log

- 2026-02-27T00:00:00Z -- system -- lane=planned -- Prompt created.
- 2026-02-27T11:58:00Z – claude-wp01-009 – shell_pid=51017 – lane=doing – Assigned agent via workflow command
- 2026-02-27T12:12:45Z – claude-wp01-009 – shell_pid=51017 – lane=for_review – Ready for review
