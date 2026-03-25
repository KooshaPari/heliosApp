---
work_package_id: WP08
title: vLLM Adapter and Model Selector UI
lane: "done"
dependencies: []
base_branch: main
base_commit: 8d90af53aa1e54a9fec97ec4ca034d229297146d
created_at: '2026-03-01T11:17:15.529054+00:00'
subtasks: [T024, T026, T027]
shell_pid: "80858"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-01'
  action: created
  agent: agileplus
---

# WP08: vLLM Adapter and Model Selector UI

**Implementation command**: `agileplus implement WP08 --base WP07`

## Objective

Create the vLLM inference adapter for NVIDIA GPU inference. Build the model selector UI component. Wire the inference engine to the chat loop with hot-swap support.

## Context

vLLM runs as a server (typically on a Linux/WSL2 host with NVIDIA GPU) exposing an OpenAI-compatible API. The user configures the endpoint URL.

## Subtasks

### T024: Create vLLM Inference Adapter

**Purpose**: Implement InferenceEngine for GPU inference via a remote vLLM server.

**Steps**:
1. Create `src/helios/runtime/integrations/inference/vllm-adapter.ts`:
   - `init()`: Validate the vLLM endpoint URL is reachable (GET /v1/models)
   - `infer()`: POST to `{endpoint}/v1/chat/completions` with OpenAI-compatible format
   - `inferStream()`: POST with `stream: true`, parse SSE chunks
   - `listModels()`: GET `{endpoint}/v1/models`, return model list
   - `healthCheck()`: GET `{endpoint}/health` or `/v1/models`
   - `terminate()`: No-op (server is external)

2. Configuration:
   - Endpoint URL from settings (e.g., `http://192.168.1.100:8000`)
   - User provides the URL via settings UI

3. Error handling:
   - Server unreachable: Return "unavailable"
   - Auth required: Support optional API key header

**Files**:
- `src/helios/runtime/integrations/inference/vllm-adapter.ts` (new, ~90 lines)

**Validation**:
- [ ] Can connect to a running vLLM server
- [ ] Inference returns correct responses
- [ ] Streaming works with SSE parsing
- [ ] Graceful failure when server is down

---

### T026: Build Model Selector UI

**Purpose**: Dropdown in the chat input showing available models grouped by provider.

**Steps**:
1. Create `src/renderers/helios/components/chat/ModelSelector.tsx`:
   - Dropdown button showing current model name
   - On click, show grouped model list:
     - "Cloud" section: Anthropic models
     - "Local" section: MLX models (if Apple Silicon)
     - "Server" section: vLLM models (if configured)
     - "Fallback" section: llama.cpp models
   - Each model shows: name, provider badge, availability indicator
   - Unavailable models are grayed out with reason tooltip

2. Wire to EngineRegistry:
   - On mount, call `registry.listEngines()` to get providers
   - For each provider, call `engine.listModels()` to get models
   - On model select, call `registry.setActive(engineId)` and update store

**Files**:
- `src/renderers/helios/components/chat/ModelSelector.tsx` (new, ~80 lines)

**Validation**:
- [ ] Dropdown shows available models
- [ ] Models grouped by provider
- [ ] Unavailable models are visually distinct
- [ ] Selecting a model updates the active engine

---

### T027: Wire Inference Engine to Chat with Hot-Swap

**Purpose**: Route chat messages through the active InferenceEngine instead of directly to AcpClient.

**Steps**:
1. In `a2a-dispatch.ts` or create new `inference-dispatch.ts`:
   - Instead of directly calling AcpClient, call `registry.getActive().infer()`
   - For streaming: `registry.getActive().inferStream()`

2. Support hot-swap:
   - When user changes model mid-conversation, update the active engine
   - Next message uses the new engine
   - Conversation history is preserved (it's stored in the chat store, not the engine)

3. Persist the selected model in settings (GoldfishDB).

**Files**:
- `src/helios/bridge/a2a-dispatch.ts` (modify, route through registry)
- `src/renderers/helios/stores/chat.store.ts` (modify, track active model)

**Validation**:
- [ ] Changing model selector switches inference provider
- [ ] Chat works with the new provider
- [ ] Selected model persists across restarts

---

## Definition of Done

- [ ] vLLM adapter connects to external server
- [ ] Model selector shows all available models
- [ ] Hot-swap works without losing conversation
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## Risks

- vLLM server may not be running — must handle gracefully
- OpenAI-compatible API may have subtle differences from actual OpenAI API
- Model list refresh timing (when does it update?)

## Reviewer Guidance

- Test with and without a vLLM server running
- Verify hot-swap doesn't cause errors mid-stream
- Check model selector UI is clear and not overwhelming

## Activity Log

- 2026-03-01T11:17:15Z – claude-opus – shell_pid=80858 – lane=doing – Assigned agent via workflow command
- 2026-03-01T11:22:58Z – claude-opus – shell_pid=80858 – lane=for_review – vLLM adapter and model selector
- 2026-03-01T11:42:14Z – claude-opus – shell_pid=80858 – lane=done – Merged to main
