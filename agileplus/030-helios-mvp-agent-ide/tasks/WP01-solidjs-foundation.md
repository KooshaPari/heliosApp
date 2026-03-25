---
work_package_id: WP01
title: SolidJS Foundation and Shared Types
lane: "done"
dependencies: []
base_branch: main
base_commit: 5bd4acc240771a7c260fed821c1f967c713fe14e
created_at: '2026-03-01T10:43:54.923251+00:00'
subtasks: [T001, T002, T003, T004]
shell_pid: "31797"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-01'
  action: created
  agent: agileplus
---

# WP01: SolidJS Foundation and Shared Types

**Implementation command**: `agileplus implement WP01`

## Objective

Replace the raw HTML/JS helios renderer (`src/renderers/helios/index.ts`, ~1156 lines of imperative DOM manipulation) with a proper SolidJS component architecture. Define shared TypeScript types for all key entities (Conversation, Message, InferenceProvider). Extend the GoldfishDB persistence layer with conversation storage. Create the InferenceEngine strategy interface.

## Context

The current helios renderer is a monolithic HTML string with inline JavaScript that manipulates the DOM directly. It was built as a developer test harness for debugging the bus protocol, terminal bridge, and RPC layer. It needs to be replaced with a component-based SolidJS application that can serve as a real product UI.

The project already uses SolidJS (`solid-js: ^1.7.5` in package.json, `jsxImportSource: "solid-js"` in tsconfig.json). The ivde renderer (`src/renderers/ivde/`) already uses SolidJS components and can serve as a reference pattern.

**Key existing files**:
- `src/renderers/helios/index.ts` — Current monolithic renderer (REPLACE)
- `src/renderers/ivde/` — Reference SolidJS renderer (STUDY for patterns)
- `src/helios/bridge/persistence.ts` — Existing GoldfishDB adapter (EXTEND)
- `src/helios/runtime/integrations/acp_client/` — Existing ACP client (WRAP in strategy interface)
- `electrobun.config.ts` — Build config (may need esbuild-plugin-solid wiring)

## Subtasks

### T001: Create SolidJS Project Structure for Helios Renderer

**Purpose**: Establish the component directory structure and entry point for the new SolidJS-based renderer.

**Steps**:
1. Create directory structure:
   ```
   src/renderers/helios/
   ├── index.tsx          # Entry point - renders App into DOM
   ├── App.tsx            # Root component
   ├── components/        # Reusable UI components
   │   ├── chat/          # Chat-related components (WP03)
   │   ├── terminal/      # Terminal components (WP05)
   │   ├── sidebar/       # Sidebar components (WP02)
   │   └── common/        # Shared UI primitives
   ├── stores/            # SolidJS stores for state management
   │   └── app.store.ts   # Root application store
   ├── styles/            # CSS/Tailwind styles
   │   └── global.css     # Global styles with Tailwind directives
   └── types/             # Renderer-specific types
   ```

2. Create `index.tsx` entry point:
   - Import `render` from `solid-js/web`
   - Import `App` component
   - Render into the `#app` root element
   - Set up RPC message handlers for ElectroBun communication

3. Create `App.tsx` root component:
   - For now, render a placeholder layout div with "Helios IDE" text
   - Import global styles
   - This will be replaced by AppShell in WP02

4. Rename/archive the old `index.ts`:
   - Move to `index.legacy.ts` or delete entirely
   - The old file is a debug dashboard and will not be reused

5. Verify esbuild-plugin-solid is properly configured in the build:
   - Check `electrobun.config.ts` for JSX transform settings
   - The plugin is already a dependency (`esbuild-plugin-solid: ^0.5.0`)

**Files**:
- `src/renderers/helios/index.tsx` (new, ~30 lines)
- `src/renderers/helios/App.tsx` (new, ~20 lines)
- `src/renderers/helios/stores/app.store.ts` (new, ~40 lines)
- `src/renderers/helios/styles/global.css` (new, ~20 lines)
- `src/renderers/helios/index.ts` (delete or rename)

**Validation**:
- [ ] `bun run build:dev` compiles without errors
- [ ] The app opens and shows the placeholder UI
- [ ] No references to old index.ts remain in imports

---

### T002: Create Shared Types for Key Entities

**Purpose**: Define TypeScript interfaces for Conversation, Message, InferenceProvider, and related types used across the application.

**Steps**:
1. Create `src/helios/types/conversation.ts`:
   ```typescript
   export interface Conversation {
     id: string;
     title: string;
     createdAt: number; // Unix timestamp
     updatedAt: number;
     modelId: string;
     messages: Message[];
   }

   export interface Message {
     id: string;
     conversationId: string;
     role: "user" | "assistant" | "tool_call" | "tool_result";
     content: string;
     timestamp: number;
     metadata?: MessageMetadata;
   }

   export interface MessageMetadata {
     model?: string;
     tokenUsage?: { input: number; output: number };
     toolName?: string;
     toolInput?: Record<string, unknown>;
     toolOutput?: string;
     status?: "pending" | "streaming" | "complete" | "error" | "cancelled";
   }
   ```

2. Create `src/helios/types/inference.ts`:
   ```typescript
   export interface InferenceProvider {
     id: string;
     name: string;
     type: "cloud" | "local";
     backend: "anthropic" | "mlx" | "vllm" | "llamacpp";
     endpoint?: string;
     models: ModelInfo[];
     status: "available" | "unavailable" | "degraded";
   }

   export interface ModelInfo {
     id: string;
     name: string;
     contextWindow: number;
     providerId: string;
   }

   export interface InferenceRequest {
     model: string;
     messages: Array<{ role: string; content: string }>;
     maxTokens?: number;
     stream?: boolean;
   }

   export interface InferenceResponse {
     content: string;
     model: string;
     tokenUsage: { input: number; output: number };
     finishReason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
   }
   ```

3. Create `src/helios/types/index.ts` barrel export.

**Files**:
- `src/helios/types/conversation.ts` (new, ~40 lines)
- `src/helios/types/inference.ts` (new, ~45 lines)
- `src/helios/types/index.ts` (new, ~5 lines)

**Validation**:
- [ ] Types compile with `bun run typecheck` (tsgo --noEmit)
- [ ] Types are importable from other helios modules

---

### T003: Create Conversation Persistence Layer

**Purpose**: Extend the existing GoldfishDB persistence adapter to store and retrieve conversations and messages.

**Steps**:
1. Study existing persistence at `src/helios/bridge/persistence.ts`:
   - It already has `HeliosSettings`, `upsertLane`, `writeAuditEntry`, `saveSnapshot`, `loadSnapshot`
   - Uses GoldfishDB singleton pattern

2. Add conversation persistence methods:
   ```typescript
   // Add to persistence.ts or create persistence/conversations.ts
   export function saveConversation(conv: Conversation): void;
   export function loadConversation(id: string): Conversation | null;
   export function listConversations(): Array<{ id: string; title: string; updatedAt: number }>;
   export function deleteConversation(id: string): void;
   export function appendMessage(conversationId: string, message: Message): void;
   export function loadMessages(conversationId: string): Message[];
   ```

3. Use GoldfishDB's existing API patterns (key-value with table prefixes):
   - Table: `conversations` — stores conversation metadata
   - Table: `messages` — stores messages keyed by `{conversationId}:{messageId}`

**Files**:
- `src/helios/bridge/persistence.ts` (modify, add ~60 lines) OR
- `src/helios/bridge/persistence/conversations.ts` (new, ~80 lines)

**Validation**:
- [ ] Can save and load a conversation round-trip
- [ ] Can append messages and retrieve them in order
- [ ] listConversations returns conversations sorted by updatedAt descending

---

### T004: Create InferenceEngine Strategy Interface

**Purpose**: Define the abstract interface that all inference providers (ACP/Anthropic, MLX, vLLM, llama.cpp) will implement.

**Steps**:
1. Create `src/helios/runtime/integrations/inference/engine.ts`:
   ```typescript
   import type { InferenceRequest, InferenceResponse } from "../../types/inference.ts";

   export interface InferenceEngine {
     readonly id: string;
     readonly name: string;
     readonly type: "cloud" | "local";

     init(): Promise<void>;
     infer(request: InferenceRequest): Promise<InferenceResponse>;
     inferStream(request: InferenceRequest): AsyncIterable<string>;
     listModels(): Promise<ModelInfo[]>;
     healthCheck(): Promise<"healthy" | "degraded" | "unavailable">;
     terminate(): Promise<void>;
   }
   ```

2. Create `src/helios/runtime/integrations/inference/registry.ts`:
   ```typescript
   export class EngineRegistry {
     private engines: Map<string, InferenceEngine> = new Map();
     private activeEngine: InferenceEngine | null = null;

     register(engine: InferenceEngine): void;
     setActive(engineId: string): void;
     getActive(): InferenceEngine;
     listEngines(): InferenceEngine[];
   }
   ```

3. Create `src/helios/runtime/integrations/inference/index.ts` barrel export.

**Files**:
- `src/helios/runtime/integrations/inference/engine.ts` (new, ~30 lines)
- `src/helios/runtime/integrations/inference/registry.ts` (new, ~50 lines)
- `src/helios/runtime/integrations/inference/index.ts` (new, ~5 lines)

**Validation**:
- [ ] Interfaces compile cleanly
- [ ] EngineRegistry can register and switch between engines
- [ ] Existing AcpClient can be adapted to implement InferenceEngine (verify interface compatibility)

---

## Definition of Done

- [ ] SolidJS renderer compiles and renders in ElectroBun webview
- [ ] All shared types are defined and importable
- [ ] Conversation persistence CRUD operations work
- [ ] InferenceEngine interface is defined with registry
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] Existing 282 tests still pass

## Risks

- **ElectroBun + SolidJS JSX**: The build pipeline must correctly transform JSX. The esbuild-plugin-solid is already a dependency but may need configuration in electrobun.config.ts.
- **GoldfishDB API surface**: If GoldfishDB doesn't support the needed query patterns, may need to use raw key-value with manual indexing.
- **Old renderer removal**: Deleting index.ts removes the only working UI. The new SolidJS placeholder must render successfully before the old file is removed.

## Reviewer Guidance

- Verify the SolidJS entry point renders in the ElectroBun webview (not just in a browser)
- Check that types match the spec's entity definitions
- Verify GoldfishDB operations are properly transactional
- Ensure the InferenceEngine interface supports both sync and streaming inference

## Activity Log

- 2026-03-01T10:43:55Z – claude-opus – shell_pid=31797 – lane=doing – Assigned agent via workflow command
- 2026-03-01T11:10:38Z – claude-opus – shell_pid=31797 – lane=for_review – Ready: SolidJS foundation, types, inference engine, persistence
- 2026-03-01T11:42:10Z – claude-opus – shell_pid=31797 – lane=done – Merged to main
