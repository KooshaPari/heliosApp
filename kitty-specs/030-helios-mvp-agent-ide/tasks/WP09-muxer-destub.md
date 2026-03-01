---
work_package_id: WP09
title: Muxer De-stub and Session Sharing
lane: "doing"
dependencies: []
base_branch: main
base_commit: e3c5bc01c4feb2d23783c0d7905bf6628379b69e
created_at: '2026-03-01T11:17:19.325866+00:00'
subtasks: [T028, T029, T030]
shell_pid: "81046"
history:
- date: '2026-03-01'
  action: created
  agent: spec-kitty
---

# WP09: Muxer De-stub and Session Sharing

**Implementation command**: `spec-kitty implement WP09 --base WP05`

## Objective

Replace the in-memory-only muxer dispatch with real adapter calls. Wire muxer.spawn to actually create Zellij/Tmate/UPterm sessions. Add session sharing UI.

## Context

The audit revealed that `src/helios/bridge/muxer-dispatch.ts` tracks sessions in a Map but never calls the real adapters. The real adapters exist and work:
- `src/helios/runtime/integrations/zellij/command.ts` — Real Zellij CLI integration
- `src/helios/runtime/integrations/tmate/command.ts` — Real Tmate session management
- `src/helios/runtime/integrations/upterm/command.ts` — Real UPterm sharing

## Subtasks

### T028: Wire muxer-dispatch.spawn() to Real Adapters

**Purpose**: When muxer.spawn is called, actually create a multiplexer session.

**Steps**:
1. In `muxer-dispatch.ts`, modify the `spawn` handler:
   - Currently: creates in-memory record only
   - New: based on `type` parameter, call the real adapter:
     - `type: "zellij"` → `zellijCommand.createSession(sessionName)`
     - `type: "tmate"` → `tmateCommand.createSession()`
     - `type: "upterm"` → `uptermCommand.startSession(sessionName)`
   - Store the real session ID/handle in the session record
   - Handle adapter not available (CLI not installed) gracefully

2. Import real adapters:
   ```typescript
   import { createSession as zellijCreate } from "../runtime/integrations/zellij/command.ts";
   import { createSession as tmateCreate } from "../runtime/integrations/tmate/command.ts";
   import { startSession as uptermStart } from "../runtime/integrations/upterm/command.ts";
   ```

**Files**:
- `src/helios/bridge/muxer-dispatch.ts` (modify, ~30 lines changed)

**Validation**:
- [ ] muxer.spawn with type "zellij" creates a real Zellij session (if installed)
- [ ] muxer.spawn with type "tmate" creates a real Tmate session
- [ ] muxer.spawn gracefully fails if CLI is not installed

---

### T029: Wire muxer attach/detach/kill to Real Adapters

**Purpose**: Make attach, detach, and kill operations real.

**Steps**:
1. `attach`: Call the appropriate adapter's attach/connect method
2. `detach`: Call detach (or no-op if adapter doesn't support it)
3. `kill`: Call the adapter's destroy/kill method AND remove from in-memory map

**Files**:
- `src/helios/bridge/muxer-dispatch.ts` (modify, ~20 lines changed)

**Validation**:
- [ ] kill actually terminates the session process
- [ ] Session is removed from both in-memory map and external tool

---

### T030: Add Session Sharing UI

**Purpose**: Add a "Share" button in the terminal panel that generates a sharing link.

**Steps**:
1. Add "Share" button to terminal tab bar (next to terminal name)
2. On click:
   - Call `rpc.request("helios.muxer.spawn", { type: "upterm" })` or show provider chooser
   - Display the returned sharing URL in a modal/toast
   - Copy URL to clipboard automatically
3. Show "Sharing active" indicator on the terminal tab when shared

**Files**:
- `src/renderers/helios/components/terminal/TerminalTabs.tsx` (modify)
- `src/renderers/helios/components/common/ShareModal.tsx` (new, ~40 lines)

**Validation**:
- [ ] Share button appears in terminal tabs
- [ ] Clicking Share generates a sharing URL
- [ ] URL is copied to clipboard
- [ ] Sharing indicator visible on active shared terminals

---

## Definition of Done

- [ ] muxer.spawn creates real sessions
- [ ] muxer.kill terminates real sessions
- [ ] Session sharing works end-to-end
- [ ] Graceful degradation when tools aren't installed
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## Risks

- Users may not have zellij/tmate/upterm installed
- Session cleanup on app crash (orphaned sessions)

## Reviewer Guidance

- Test with at least one real muxer tool installed
- Verify error messages are helpful when tools are missing
- Check that kill actually cleans up processes (no zombies)
