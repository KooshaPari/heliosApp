---
work_package_id: WP05
title: Terminal Panel and Multi-Terminal
lane: "done"
dependencies: []
base_branch: main
base_commit: bb58b13bc9aa5a5c0935d48915965346520c88c4
created_at: '2026-03-01T11:10:50.925356+00:00'
subtasks: [T011, T012, T013, T014]
shell_pid: "71038"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-01'
  action: created
  agent: spec-kitty
---

# WP05: Terminal Panel and Multi-Terminal

**Implementation command**: `spec-kitty implement WP05 --base WP02`

## Objective

Build a SolidJS terminal panel wrapping xterm.js with support for multiple concurrent terminal tabs. Wire terminal I/O to the existing terminal-bridge PTY system. Enable agent-driven command execution.

## Context

The existing terminal infrastructure is REAL and working:
- `src/helios/bridge/terminal-bridge.ts` — Spawns PTY via Bun.spawn(), handles I/O
- `src/helios/bridge/bus-rpc-bridge.ts` — Spawns terminal bridge on `terminal.spawn` success
- xterm.js is already a dependency (`@xterm/xterm: ^5.5.0`) with addons (fit, search, web-links, webgl)

The old renderer (`src/renderers/helios/index.ts`) already had xterm.js integration — study its approach but implement as proper SolidJS components.

## Subtasks

### T011: Build TerminalPanel SolidJS Component

**Purpose**: Wrap xterm.js in a SolidJS component with proper lifecycle management.

**Steps**:
1. Create `src/renderers/helios/components/terminal/TerminalPanel.tsx`:
   - Creates xterm.js Terminal instance on mount
   - Attaches FitAddon for auto-sizing
   - Attaches WebLinksAddon for clickable URLs
   - Handles container resize via ResizeObserver → fitAddon.fit()
   - Cleans up terminal on unmount (dispose)

2. Terminal configuration:
   - Theme matching app dark theme (background: #11111b, foreground: #cdd6f4)
   - Font: "JetBrains Mono", "Fira Code", monospace (14px)
   - Scrollback: 5000 lines
   - Cursor: block, blinking

3. Use `onMount` to create terminal, `onCleanup` to dispose:
   ```typescript
   const [termRef, setTermRef] = createSignal<HTMLDivElement>();
   onMount(() => {
     const term = new Terminal({ /* config */ });
     const fitAddon = new FitAddon();
     term.loadAddon(fitAddon);
     term.open(termRef()!);
     fitAddon.fit();
   });
   ```

**Files**:
- `src/renderers/helios/components/terminal/TerminalPanel.tsx` (new, ~100 lines)

**Validation**:
- [ ] Terminal renders in the bottom panel
- [ ] Terminal auto-sizes to container
- [ ] Terminal theme matches app theme
- [ ] No memory leaks on mount/unmount cycles

---

### T012: Build Terminal Tab Bar

**Purpose**: Support multiple terminal instances with a tab bar for switching.

**Steps**:
1. Create `src/renderers/helios/components/terminal/TerminalTabs.tsx`:
   - Tab bar at top of terminal area
   - Each tab: terminal name ("Terminal 1", "Terminal 2"), close button (X)
   - "+" button to create new terminal
   - Active tab highlighted
   - Tabs are reorderable (nice to have, not required for MVP)

2. Create `src/renderers/helios/stores/terminal.store.ts`:
   - State: `terminals: Array<{ id, name, isActive }>`, `activeTerminalId`
   - Actions: `createTerminal()`, `closeTerminal(id)`, `setActiveTerminal(id)`
   - Each terminal maps to a PTY session via terminal-bridge

3. Only the active terminal's xterm instance is visible (others are hidden but alive).

**Files**:
- `src/renderers/helios/components/terminal/TerminalTabs.tsx` (new, ~60 lines)
- `src/renderers/helios/stores/terminal.store.ts` (new, ~50 lines)

**Validation**:
- [ ] Can create multiple terminals via "+" button
- [ ] Can switch between terminals via tabs
- [ ] Can close terminals via X button
- [ ] Each terminal maintains independent state

---

### T013: Wire Terminal I/O to Terminal Bridge

**Purpose**: Connect xterm.js input/output to real PTY sessions via RPC.

**Steps**:
1. On terminal creation, call RPC to spawn PTY:
   ```typescript
   const result = await rpc.request("helios.terminal.spawn", {});
   // result contains terminalId
   ```

2. Wire xterm.js onData (user input) to RPC:
   ```typescript
   term.onData(data => {
     rpc.request("helios.terminal.write", { terminalId, data });
   });
   ```

3. Wire PTY output back to xterm.js:
   ```typescript
   webview.onMessage("helios.terminal.output", ({ terminalId, data }) => {
     if (terminalId === activeTerminalId) {
       term.write(data);
     }
   });
   ```

4. Wire terminal resize:
   ```typescript
   fitAddon.onResize(({ cols, rows }) => {
     rpc.request("helios.terminal.resize", { terminalId, cols, rows });
   });
   ```

5. Handle terminal exit:
   - Listen for `helios.terminal.exit` message
   - Show "[Process exited]" in terminal
   - Allow respawning

**Files**:
- `src/renderers/helios/components/terminal/TerminalPanel.tsx` (modify)
- `src/renderers/helios/stores/terminal.store.ts` (modify)

**Validation**:
- [ ] Typing in terminal sends characters to PTY
- [ ] PTY output appears in terminal (try `ls`, `echo hello`)
- [ ] Terminal resize works (shrink window, text reflows)
- [ ] Terminal exit is handled gracefully

---

### T014: Enable Agent-Driven Terminal Execution

**Purpose**: Allow the agent to execute commands in terminals and read output.

**Steps**:
1. Add RPC handler in bus-rpc-bridge for `helios.agent.terminal.exec`:
   - Input: `{ command: string, terminalId?: string }`
   - If terminalId provided, write command to that terminal
   - If not, spawn new terminal and write command
   - Return acknowledgment (output is streamed via terminal output channel)

2. In `a2a-dispatch.ts`, when agent response includes a tool_use for terminal:
   - Extract command from tool input
   - Call `helios.agent.terminal.exec` RPC
   - Create tool_call and tool_result messages in chat

3. In the terminal store, track which terminals are agent-controlled:
   - Visual indicator on tab (robot icon or colored border)

**Files**:
- `src/helios/bridge/bus-rpc-bridge.ts` (modify, add agent terminal exec handler)
- `src/helios/bridge/a2a-dispatch.ts` (modify, add terminal tool handling)
- `src/renderers/helios/stores/terminal.store.ts` (modify)

**Validation**:
- [ ] Agent can execute a command and output appears in terminal
- [ ] User sees which terminal the agent is using
- [ ] Agent terminal commands appear as tool calls in chat

---

## Definition of Done

- [ ] Terminal renders with xterm.js in bottom panel
- [ ] Multiple terminals supported via tab bar
- [ ] Terminal I/O works (keyboard input, command output)
- [ ] Agent can execute terminal commands
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## Risks

- xterm.js lifecycle with SolidJS: Must create terminal after DOM element is mounted
- FitAddon timing: Must call fit() after container has dimensions
- Terminal output buffering: High-throughput output (e.g., `cat large_file`) may need throttling

## Reviewer Guidance

- Test terminal with common commands: `ls`, `pwd`, `echo`, `vim` (cursor mode), `htop` (full-screen)
- Verify no memory leaks when creating/closing many terminals
- Check that agent terminal execution is visible to the user (not hidden)

## Activity Log

- 2026-03-01T11:10:51Z – claude-opus – shell_pid=71038 – lane=doing – Assigned agent via workflow command
- 2026-03-01T11:15:09Z – claude-opus – shell_pid=71038 – lane=for_review – Terminal panel with xterm.js, multi-tab, store
- 2026-03-01T11:42:12Z – claude-opus – shell_pid=71038 – lane=done – Merged to main
