---
work_package_id: WP10
title: File Context, First-Run, and Quality
lane: "for_review"
dependencies: []
base_branch: main
base_commit: 1245abe02cdb233a85a2582417ed8a64f9d3838e
created_at: '2026-03-01T11:17:21.985420+00:00'
subtasks: [T031, T032, T033, T034, T035, T036]
shell_pid: "81180"
agent: "claude-opus"
history:
- date: '2026-03-01'
  action: created
  agent: spec-kitty
---

# WP10: File Context, First-Run, and Quality

**Implementation command**: `spec-kitty implement WP10 --base WP05`

## Objective

Build the file context panel showing agent-accessed files with diff views. Create the first-run setup flow. Add error handling UI. Pass all quality gates.

## Context

This is the polish WP that ties everything together. It depends on the chat loop (WP04) and terminal (WP05) being functional.

## Subtasks

### T031: Build FileContext Panel

**Purpose**: Show which files the agent is reading or modifying in a right sidebar.

**Steps**:
1. Create `src/renderers/helios/components/context/FileContextPanel.tsx`:
   - List of files the agent has accessed in the current conversation
   - Each file shows: path, access type (read/write), timestamp
   - Click to expand and see file content or diff
   - Collapsible panel on the right side (or toggle-able)

2. Track file access in chat store:
   - When agent tool calls include file_read or file_write, record the file path
   - Store as `accessedFiles: Array<{ path, type, timestamp }>`

**Files**:
- `src/renderers/helios/components/context/FileContextPanel.tsx` (new, ~70 lines)
- `src/renderers/helios/stores/chat.store.ts` (modify, add file tracking)

**Validation**:
- [ ] Files accessed by agent appear in the panel
- [ ] Read vs write access is distinguished visually

---

### T032: Build DiffView Component

**Purpose**: Show proposed file changes as a unified diff.

**Steps**:
1. Create `src/renderers/helios/components/context/DiffView.tsx`:
   - Shows unified diff format (green for additions, red for deletions)
   - Line numbers on both sides
   - Collapsible unchanged sections
   - Simple implementation: split old/new content by lines, compute diff
   - Use a lightweight diff algorithm (or simple line-by-line comparison for MVP)

**Files**:
- `src/renderers/helios/components/context/DiffView.tsx` (new, ~80 lines)

**Validation**:
- [ ] Diffs render with correct coloring
- [ ] Line numbers are correct
- [ ] Large diffs don't crash the renderer

---

### T033: Wire Accept/Reject Actions

**Purpose**: Let users approve or reject agent-proposed file changes.

**Steps**:
1. Add Accept/Reject buttons to DiffView
2. Accept: Call RPC to write the file, update tool_result message to "accepted"
3. Reject: Update tool_result message to "rejected", notify agent in chat

**Files**:
- `src/renderers/helios/components/context/DiffView.tsx` (modify)
- `src/renderers/helios/stores/chat.store.ts` (modify)

**Validation**:
- [ ] Accept writes the file to disk
- [ ] Reject sends feedback to agent
- [ ] Both update the UI state correctly

---

### T034: First-Run Setup Flow

**Purpose**: Guide new users through initial configuration.

**Steps**:
1. Create `src/renderers/helios/components/common/SetupWizard.tsx`:
   - Step 1: Welcome screen with app description
   - Step 2: API key input (Anthropic API key)
   - Step 3: Hardware detection results (show what's available)
   - Step 4: Default model selection
   - Skip button (use defaults, configure later)

2. Show wizard when no API key is configured (check settings store)
3. Save configuration to GoldfishDB settings

**Files**:
- `src/renderers/helios/components/common/SetupWizard.tsx` (new, ~100 lines)

**Validation**:
- [ ] Wizard shows on first run
- [ ] API key is saved and used for inference
- [ ] Wizard doesn't show again after completion
- [ ] Skip button works with reasonable defaults

---

### T035: Error Handling and Connection Recovery UI

**Purpose**: Show user-friendly errors with recovery actions.

**Steps**:
1. Create `src/renderers/helios/components/common/Toast.tsx`:
   - Notification toasts for success/error/warning/info
   - Auto-dismiss after 5s, manual dismiss on click
   - Stack multiple toasts vertically

2. Add error handling to chat store:
   - API errors: Show toast with "Retry" button
   - Connection lost: Show banner with "Reconnecting..." + retry
   - Model unavailable: Suggest switching models

**Files**:
- `src/renderers/helios/components/common/Toast.tsx` (new, ~50 lines)
- `src/renderers/helios/stores/chat.store.ts` (modify, add error handling)

**Validation**:
- [ ] Errors show as toasts
- [ ] Retry actually retries the failed action
- [ ] Multiple errors don't overwhelm the UI

---

### T036: Quality Gate Pass

**Purpose**: Ensure all code passes lint, typecheck, and tests.

**Steps**:
1. Run `bun run lint` and fix all errors/warnings
2. Run `bun run typecheck` (tsgo --noEmit) and fix all type errors
3. Run `bun run test` and fix any failing tests
4. Run `bun run format` to ensure consistent formatting
5. Verify `task quality:ci` passes end-to-end

**Files**: Various (fix whatever fails)

**Validation**:
- [ ] `bun run lint` — 0 errors
- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run test` — all tests pass
- [ ] `task quality:ci` — passes

---

## Definition of Done

- [ ] File context panel shows agent file operations
- [ ] Diff view renders with accept/reject
- [ ] First-run wizard guides new users
- [ ] Error toasts work
- [ ] All quality gates pass
- [ ] `task quality:ci` passes end-to-end

## Risks

- Diff algorithm complexity — keep it simple for MVP
- Quality gate may reveal issues in other WPs
- First-run wizard must not be annoying for repeat users

## Reviewer Guidance

- Test the full user journey: first run → setup → chat → terminal → file review
- Verify quality gate passes in CI-like environment
- Check that error recovery actually works (disconnect network, verify retry)

## Activity Log

- 2026-03-01T11:17:22Z – claude-opus – shell_pid=81180 – lane=doing – Assigned agent via workflow command
- 2026-03-01T11:21:51Z – claude-opus – shell_pid=81180 – lane=for_review – File context, diff view, setup wizard, toasts
