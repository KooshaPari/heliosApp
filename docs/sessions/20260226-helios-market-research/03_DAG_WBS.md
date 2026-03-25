# DAG and Work Breakdown Structure

## Execution DAG

1. Discovery and source validation
2. Architecture and ADR lock
3. Worktree orchestrator + terminal/mux core
4. Provider adapter integration
5. Policy + audit + collaboration layer
6. UX polish + performance hardening

Dependencies:
- Step 2 depends on step 1.
- Step 3 and step 4 depend on step 2.
- Step 5 depends on step 3 and step 4.
- Step 6 depends on step 5.

## WBS

### Stream A: Core runtime
- A1: ElectroBun shell bootstrap
- A2: PTY lifecycle manager
- A3: `par` integration for worktree task lanes
- A4: `zellij` mux integration
- A5: Session persistence and crash restore via `zmx`

### Stream B: AI orchestration
- B1: internal local bus contract
- B2: ACP client boundary adapter
- B3: provider adapter interface and runners
- B4: MCP integration
- B5: A2A federation adapter

### Stream C: Product surfaces
- C1: Workspace/project creation flow
- C2: New chat/provider picker flow
- C3: Freehand terminal mode UX
- C4: Tabs/splits/multi-project navigation
- C5: Share session UI (`upterm`, `tmate`)
- C6: Renderer switch control (`ghostty`/`rio`)

### Stream D: Governance
- D1: Policy engine and approval flows
- D2: Audit logging and replay
- D3: Secrets redaction and provider isolation

### Stream E: Performance and QA
- E1: Memory instrumentation
- E2: Throughput and latency benchmarks
- E3: Stability soak tests (25 terminals)
- E4: Worktree swarm stress tests (`par` + zellij + zmx)

## Milestones

- M1 (2 weeks): shell + `par` + zellij baseline with 8 concurrent terminals.
- M2 (4 weeks): 25 terminal target with zmx persistence baseline.
- M3 (6 weeks): provider adapters + ACP/MCP/A2A boundaries + policy gate alpha.
- M4 (8 weeks): collaboration workflows (`upterm`/`tmate`) + audit/replay + crash recovery.
- M5 (10-12 weeks): hardening and release candidate.

## Critical Path

- A1 -> A2 -> A3 -> A4 -> E1 -> E2 -> M2
- B1 -> B2 -> B3 -> D1 -> D2 -> M4

## Resource Notes

- At least one engineer dedicated to terminal/mux performance.
- One engineer dedicated to protocol/adapters.
- One engineer dedicated to policy/security/audit surface.
- One engineer dedicated to swarm worktree reliability (`par` + zmx lifecycle cleanup).
