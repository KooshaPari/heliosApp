---
work_package_id: WP03
title: Chat Panel and Message Rendering
lane: "doing"
dependencies: []
base_branch: main
base_commit: 56569cfcbc2df300daf414f759c1a742b416e507
created_at: '2026-03-01T11:12:30.908346+00:00'
subtasks: [T005, T006, T008]
shell_pid: "74724"
agent: "claude-opus"
history:
- date: '2026-03-01'
  action: created
  agent: spec-kitty
---

# WP03: Chat Panel and Message Rendering

**Implementation command**: `spec-kitty implement WP03 --base WP02`

## Objective

Build the chat panel with a scrollable message list that supports streaming text, markdown rendering, and inline tool call display. Build the chat input area with model selector.

## Context

This is the core UI that users interact with. Messages from the user appear right-aligned or with a user avatar. Agent messages appear left-aligned with streaming text. Tool calls (file edits, terminal commands) render as collapsible blocks within the message flow.

**Design reference**: Cursor/Windsurf chat panels — clean, minimal, focused on readability.

**Types available from WP01**: `Message`, `MessageMetadata`, `Conversation` from `src/helios/types/`.

## Subtasks

### T005: Build ChatPanel Component

**Purpose**: Render a scrollable list of messages with role-based styling and streaming support.

**Steps**:
1. Create `src/renderers/helios/components/chat/ChatPanel.tsx`:
   - Props: `{ messages: Message[], isStreaming: boolean }`
   - Render messages in a scrollable container
   - Auto-scroll to bottom on new messages (with "scroll to bottom" button if user scrolled up)
   - Role-based styling:
     - `user`: Right-aligned bubble, lighter background
     - `assistant`: Left-aligned, full-width, with avatar icon
     - `tool_call`: Collapsible block with tool icon
     - `tool_result`: Collapsible block with result icon

2. Create `src/renderers/helios/components/chat/MessageBubble.tsx`:
   - Props: `{ message: Message }`
   - Render content as plain text (markdown rendering can be added later)
   - Show timestamp on hover
   - Show token usage for assistant messages (if available)
   - Streaming indicator (blinking cursor) when message status is "streaming"

3. Handle empty state: Show a welcome message when no messages exist:
   - "How can I help you today?"
   - Suggested prompts as clickable cards

**Files**:
- `src/renderers/helios/components/chat/ChatPanel.tsx` (new, ~100 lines)
- `src/renderers/helios/components/chat/MessageBubble.tsx` (new, ~80 lines)

**Validation**:
- [ ] Messages render with correct role styling
- [ ] Auto-scroll works on new messages
- [ ] Streaming cursor animation visible during streaming
- [ ] Empty state shows welcome message

---

### T006: Build ChatInput Component

**Purpose**: Create the text input area with send button and model selector.

**Steps**:
1. Create `src/renderers/helios/components/chat/ChatInput.tsx`:
   - Multi-line textarea that grows with content (min 1 line, max 8 lines)
   - Send button (right side, enabled only when text is non-empty)
   - Model selector dropdown (left side, shows current model name)
   - Enter sends message, Shift+Enter adds newline
   - Disable input while agent is responding (show "Stop" button instead of "Send")

2. Style:
   - Bottom of center panel, sticky
   - Rounded border, subtle shadow
   - Placeholder text: "Ask anything..."
   - Send button: accent color, icon (arrow or send icon via Unicode)

**Files**:
- `src/renderers/helios/components/chat/ChatInput.tsx` (new, ~90 lines)

**Validation**:
- [ ] Textarea grows with content
- [ ] Enter sends, Shift+Enter adds newline
- [ ] Send button disabled when empty
- [ ] Model selector shows current model
- [ ] Input disabled during streaming (shows Stop button)

---

### T008: Build Tool Call Display Components

**Purpose**: Render agent tool calls (file operations, terminal commands) inline in the chat.

**Steps**:
1. Create `src/renderers/helios/components/chat/ToolCallBlock.tsx`:
   - Props: `{ message: Message }` where role is "tool_call"
   - Collapsible block with header showing tool name and icon
   - Expanded view shows tool input (formatted JSON or readable summary)
   - Status indicator: pending (spinner), complete (checkmark), error (red X)

2. Create `src/renderers/helios/components/chat/ToolResultBlock.tsx`:
   - Props: `{ message: Message }` where role is "tool_result"
   - Shows tool output (truncated if long, expandable)
   - Color-coded: success (green border), error (red border)

3. Tool type icons/labels:
   - `file_read`: "Reading file" + file path
   - `file_write`: "Editing file" + file path
   - `terminal_command`: "Running command" + command text
   - Default: tool name as-is

**Files**:
- `src/renderers/helios/components/chat/ToolCallBlock.tsx` (new, ~70 lines)
- `src/renderers/helios/components/chat/ToolResultBlock.tsx` (new, ~50 lines)

**Validation**:
- [ ] Tool calls render as collapsible blocks
- [ ] Tool results show success/error state
- [ ] Long outputs truncate with expand button
- [ ] File paths and commands are formatted readably

---

## Definition of Done

- [ ] Chat panel renders messages with correct styling per role
- [ ] Streaming text shows token-by-token with cursor
- [ ] Chat input sends messages on Enter
- [ ] Tool calls render inline with collapse/expand
- [ ] Empty state shows welcome message
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## Risks

- Streaming performance: Rapid signal updates may cause jank. Use `batch` from SolidJS if needed.
- Markdown rendering: Deferred to a later WP — plain text only for now.
- Auto-scroll conflicts with user scroll: Need careful intersection observer logic.

## Reviewer Guidance

- Check that streaming feels smooth (no visible flicker)
- Verify tool call blocks are informative but not overwhelming
- Confirm the chat input UX matches Cursor/Windsurf (Enter to send, Shift+Enter for newline)

## Activity Log

- 2026-03-01T11:12:31Z – claude-opus – shell_pid=74724 – lane=doing – Assigned agent via workflow command
