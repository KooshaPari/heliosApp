---
work_package_id: WP06
title: Conversation Persistence and Session Restore
lane: "for_review"
dependencies: []
base_branch: main
base_commit: 97b8eb21808ff2064bcdf401fd6b9274054f9df0
created_at: '2026-03-01T11:17:12.006197+00:00'
subtasks: [T019, T020, T021]
shell_pid: "80561"
agent: "claude-opus"
history:
- date: '2026-03-01'
  action: created
  agent: spec-kitty
---

# WP06: Conversation Persistence and Session Restore

**Implementation command**: `spec-kitty implement WP06 --base WP04`

## Objective

Persist conversations and messages to GoldfishDB so they survive app restarts. Wire the sidebar conversation list to real persisted data. Implement session restore on app startup.

## Context

WP01 created the conversation persistence layer (T003). This WP wires it into the chat store and sidebar. The existing persistence module at `src/helios/bridge/persistence.ts` already handles settings and lane persistence via GoldfishDB.

## Subtasks

### T019: Wire Conversation Save/Load to Chat Store

**Purpose**: Auto-save conversations and messages as they are created/updated.

**Steps**:
1. In `chat.store.ts`, after each `sendMessage` and `receiveToken` completion:
   - Call `saveConversation()` to persist conversation metadata
   - Call `appendMessage()` to persist new messages
2. On `setActiveConversation(id)`:
   - Call `loadMessages(id)` to populate the message list
   - Only load if messages aren't already in memory
3. Auto-generate conversation titles:
   - Use the first user message (truncated to 50 chars) as the title
   - Update title after first agent response if a better summary is available

**Files**:
- `src/renderers/helios/stores/chat.store.ts` (modify)

**Validation**:
- [ ] Messages are persisted after each turn
- [ ] Conversations appear with correct titles
- [ ] Loading a conversation retrieves all its messages

---

### T020: Implement Session Restore on App Restart

**Purpose**: When the app opens, load the most recent conversation state.

**Steps**:
1. In `App.tsx` or app initialization:
   - Call `listConversations()` to get all saved conversations
   - Load the most recent conversation as the active one
   - Populate the sidebar with the conversation list
2. Restore terminal state:
   - The existing `loadSnapshot()` in persistence.ts handles lane/terminal state
   - Wire this into the terminal store to restore terminal sessions
3. Handle first-run case:
   - If no conversations exist, show the empty/welcome state

**Files**:
- `src/renderers/helios/App.tsx` (modify, add initialization logic)
- `src/renderers/helios/stores/chat.store.ts` (modify, add init action)

**Validation**:
- [ ] App shows last conversation on restart
- [ ] All past conversations appear in sidebar
- [ ] First-run shows welcome state correctly

---

### T021: Wire Sidebar to Persisted Data

**Purpose**: Replace mock data in the sidebar with real persisted conversations.

**Steps**:
1. In `Sidebar.tsx`, consume the chat store's conversation list
2. Add "Delete conversation" action (swipe or right-click menu)
3. Add search/filter for conversations (nice to have)
4. Sort by `updatedAt` descending

**Files**:
- `src/renderers/helios/components/sidebar/Sidebar.tsx` (modify)

**Validation**:
- [ ] Sidebar shows real conversations from persistence
- [ ] Creating a new conversation appears immediately
- [ ] Deleting a conversation removes it from list and storage

---

## Definition of Done

- [ ] Conversations persist across app restarts
- [ ] Sidebar shows real conversation history
- [ ] Session restore loads last active conversation
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## Risks

- GoldfishDB performance with many messages (thousands) — may need pagination
- Race condition: saving while streaming tokens — batch writes

## Reviewer Guidance

- Test: Create conversation, close app, reopen, verify conversation is there with full history
- Verify delete actually removes data from GoldfishDB (not just UI)

## Activity Log

- 2026-03-01T11:17:12Z – claude-opus – shell_pid=80561 – lane=doing – Assigned agent via workflow command
- 2026-03-01T11:21:34Z – claude-opus – shell_pid=80561 – lane=for_review – Conversation persistence with localStorage
