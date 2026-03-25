---
work_package_id: WP04
title: Agent Chat Loop Wiring
lane: "done"
dependencies: []
base_branch: main
base_commit: 3ccbc7b9bf23cb68bc7a1846df0127baae8d63c0
created_at: '2026-03-01T11:13:24.843462+00:00'
subtasks: [T007, T009, T010]
shell_pid: "76288"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-01'
  action: created
  agent: agileplus
---

# WP04: Agent Chat Loop Wiring

**Implementation command**: `agileplus implement WP04 --base WP03`

## Objective

Wire the chat UI to the ACP client via ElectroBun RPC for end-to-end agent conversations. Implement conversation context management and action interrupt/cancel functionality.

## Context

The existing `a2a-dispatch.ts` provides `agent.run` and `agent.cancel` RPC handlers. The ACP client (`src/helios/runtime/integrations/acp_client/client.ts`) makes real HTTP calls to the Anthropic API. This WP connects the UI layer (ChatPanel/ChatInput from WP03) to these backends.

**Key existing files**:
- `src/helios/bridge/a2a-dispatch.ts` — agent.run/cancel/list/status handlers
- `src/helios/runtime/integrations/acp_client/client.ts` — HTTP client for Anthropic API
- `src/helios/bridge/bus-rpc-bridge.ts` — RPC bridge (poll-based event forwarding, 100ms interval)
- ElectroBun RPC: `bun.requests` (renderer→main), `webview.messages` (main→renderer)

**RPC flow**: Renderer calls `rpc.request("helios.agent.run", { prompt, history })` → bus-rpc-bridge → a2a-dispatch → AcpClient → Anthropic API → response streamed back via `webview.send()`.

## Subtasks

### T007: Wire Agent Chat to ACP Client with Streaming

**Purpose**: When user sends a message, call the agent and stream the response into the chat panel.

**Steps**:
1. Create `src/renderers/helios/stores/chat.store.ts`:
   - SolidJS store holding: `conversations`, `activeConversationId`, `isStreaming`
   - Actions: `sendMessage(text)`, `receiveToken(token)`, `completeMessage()`, `setActiveConversation(id)`

2. Implement `sendMessage` flow:
   - Create a user Message and append to active conversation
   - Create a placeholder assistant Message with status "streaming"
   - Call `rpc.request("helios.agent.run", { prompt: text, conversationId })`
   - Listen for streaming tokens via `webview.onMessage("helios.agent.token", callback)`
   - On each token, append to the assistant message content
   - On completion, set message status to "complete"

3. Update `a2a-dispatch.ts` to support streaming:
   - Currently `agent.run` returns the full response as a single payload
   - Modify to emit intermediate tokens via `webview.send("helios.agent.token", { token, conversationId })`
   - The AcpClient already receives the response — need to forward incrementally
   - If ACP doesn't support streaming, simulate by forwarding the full response at once (graceful degradation)

4. Wire ChatInput's onSend to `chatStore.sendMessage()`.

**Files**:
- `src/renderers/helios/stores/chat.store.ts` (new, ~80 lines)
- `src/helios/bridge/a2a-dispatch.ts` (modify, add streaming support)
- `src/renderers/helios/components/chat/ChatInput.tsx` (modify, wire to store)
- `src/renderers/helios/components/chat/ChatPanel.tsx` (modify, wire to store)

**Validation**:
- [ ] Sending a message triggers an API call
- [ ] Response text appears in the chat (even if not truly streaming)
- [ ] Conversation state updates correctly
- [ ] Error states (no API key, network failure) show user-friendly messages

---

### T009: Implement Conversation Context Management

**Purpose**: Maintain multi-turn conversation history and pass it as context to the agent.

**Steps**:
1. In `chat.store.ts`, maintain a `messages` array per conversation
2. When calling `agent.run`, pass the full message history:
   ```typescript
   const history = conversation.messages.map(m => ({
     role: m.role === "user" ? "user" : "assistant",
     content: m.content
   }));
   rpc.request("helios.agent.run", { prompt: text, history });
   ```
3. In `a2a-dispatch.ts`, forward the history to AcpClient:
   - The AcpClient's `infer` method already accepts messages array
   - Prepend system message if needed
4. Limit context window: If history exceeds ~100k tokens, truncate oldest messages (keep system + last N)

**Files**:
- `src/renderers/helios/stores/chat.store.ts` (modify)
- `src/helios/bridge/a2a-dispatch.ts` (modify)

**Validation**:
- [ ] Agent responses reference information from earlier in the conversation
- [ ] Very long conversations don't crash (truncation works)

---

### T010: Add Agent Action Interrupt/Cancel

**Purpose**: Allow users to stop an in-progress agent response.

**Steps**:
1. In ChatInput, when `isStreaming` is true:
   - Replace "Send" button with "Stop" button (red, square icon)
   - Clicking Stop calls `chatStore.cancelResponse()`

2. In `chat.store.ts`, implement `cancelResponse()`:
   - Call `rpc.request("helios.agent.cancel", { conversationId })`
   - Set message status to "cancelled"
   - Re-enable the input

3. In `a2a-dispatch.ts`, `agent.cancel` already exists — verify it aborts the AcpClient request properly.

**Files**:
- `src/renderers/helios/components/chat/ChatInput.tsx` (modify)
- `src/renderers/helios/stores/chat.store.ts` (modify)

**Validation**:
- [ ] Stop button appears during streaming
- [ ] Clicking Stop halts the response
- [ ] Partial response is preserved in chat
- [ ] User can send new messages after cancelling

---

## Definition of Done

- [ ] User can send a message and receive an agent response in the chat
- [ ] Multi-turn conversations maintain context
- [ ] User can cancel an in-progress response
- [ ] Errors display user-friendly messages
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## Risks

- **Streaming support**: AcpClient may not support true token streaming. Fallback to full-response display is acceptable for MVP.
- **RPC message ordering**: Tokens must arrive in order. ElectroBun RPC should guarantee ordering within a connection.
- **API key requirement**: Must handle missing HELIOS_ACP_API_KEY gracefully.

## Reviewer Guidance

- Test with a real Anthropic API key to verify end-to-end flow
- Verify cancel actually aborts the HTTP request (not just hides the UI)
- Check that conversation history doesn't include tool_call/tool_result messages in the API payload (only user/assistant)

## Activity Log

- 2026-03-01T11:13:25Z – claude-opus – shell_pid=76288 – lane=doing – Assigned agent via workflow command
- 2026-03-01T11:16:52Z – claude-opus – shell_pid=76288 – lane=for_review – Chat loop, multi-turn context, cancel
- 2026-03-01T11:42:12Z – claude-opus – shell_pid=76288 – lane=done – Merged to main
