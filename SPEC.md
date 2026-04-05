# HeliosApp Specification

**Version:** 2026.03A.0  
**Status:** Active  
**Last Updated:** 2026-03-26  
**Owner:** Phenotype Engineering

---

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Monorepo Layout](#monorepo-layout)
4. [Core Data Models](#core-data-models)
5. [Protocol Specification](#protocol-specification)
6. [State Machines](#state-machines)
7. [HTTP API](#http-api)
8. [LocalBus Methods](#localbus-methods)
9. [LocalBus Topics](#localbus-topics)
10. [Provider Adapters](#provider-adapters)
11. [Persistence Layer](#persistence-layer)
12. [Performance Targets](#performance-targets)
13. [Quality Gates](#quality-gates)
14. [Technology Stack](#technology-stack)
15. [Security Model](#security-model)
16. [Observability](#observability)
17. [Recovery and Resilience](#recovery-and-resilience)
18. [Testing Strategy](#testing-strategy)
19. [Deployment and Distribution](#deployment-and-distribution)
20. [Future Roadmap](#future-roadmap)

---

## 1. Introduction

HeliosApp is a developer-focused AI runtime environment designed to provide a unified interface for human developers and AI agents to collaborate within isolated workspace lanes. The system combines terminal multiplexing, session management, and multi-provider AI inference in a single desktop application.

### 1.1 Purpose

This specification defines the complete technical architecture, protocols, interfaces, and operational characteristics of heliosApp. It serves as the authoritative reference for:

- Implementation teams building heliosApp components
- Integration partners connecting to heliosApp APIs
- QA teams validating functionality
- DevOps teams deploying and operating heliosApp

### 1.2 Scope

This specification covers:

- **Core Runtime:** Message bus, session management, PTY lifecycle, provider system
- **Desktop Shell:** ElectroBun-based native application, UI components, context management
- **Web Renderer:** SolidJS-based terminal and chat interface
- **Protocol Specifications:** LocalBus envelopes, HTTP API, provider protocols
- **Infrastructure:** Persistence, observability, recovery, security

### 1.3 Definitions

| Term | Definition |
|------|------------|
| **Lane** | An isolated execution context within a workspace, bound to a git worktree and optionally a par task |
| **Session** | A user's connection to a lane, managing terminal and agent state |
| **PTY** | Pseudo-terminal, a virtual terminal providing bidirectional communication with shell processes |
| **LocalBus** | The in-process message bus coordinating all runtime subsystems |
| **Provider** | An AI inference backend (Anthropic, MLX, llama.cpp, etc.) |
| **Renderer** | Terminal display backend (Ghostty, Rio) |
| **Muxer** | Terminal multiplexer adapter (Zellij) |

### 1.4 References

- ADR-HELIOS-001: LocalBus V1 Protocol
- ADR-HELIOS-002: State Machine Architecture
- ADR-HELIOS-003: Provider Adapter Interface
- SOTA-001: State of the Art Research
- PRD.md: Product Requirements Document
- FUNCTIONAL_REQUIREMENTS.md: Detailed functional requirements

---

## 2. Architecture Overview

HeliosApp follows an event-driven monorepo architecture built around a central message bus (LocalBus V1) that coordinates all subsystems through typed command/event/response envelopes.

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Desktop Shell (ElectroBun)                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  EditorlessControlPlane                                  │   │
│  │  - Tab management (terminal, agent, session, chat, project)│   │
│  │  - Panel system (lane list, status, actions)              │   │
│  │  - Context store (active workspace/lane/session)           │   │
│  │  - Settings persistence                                    │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │ LocalBus V1 (26 methods, 40 topics)│
┌─────────────────────────────┼───────────────────────────────────┘
│                             ▼
│  ┌─────────────────────────────────────────────────────────────┐
│  │                     Runtime Engine (Bun)                    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  │ Sessions │ │   PTY    │ │ Providers│ │ Recovery │     │
│  │  │ (6 state)│ │ (6 state)│ │ (Router) │ │ (6 state)│     │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  │  Audit   │ │ Secrets  │ │  Policy  │ │  Zellij  │     │
│  │  │ (SQLite) │ │ (Encrypt)│ │ (Deny-   │ │  (Mux)   │     │
│  │  └──────────┘ └──────────┘ │  default)│ └──────────┘     │
│  │                            └──────────┘                   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │  │Integrations││ Config  │ │ Registry │                  │
│  │  │(Zellij,   │ │ (Typed) │ │ (Binding)│                  │
│  │  │upterm,    │ │         │ │          │                  │
│  │  │tmate)     │ │         │ │          │                  │
│  │  └──────────┘ └──────────┘ └──────────┘                  │
│  └────────────────────────────┬──────────────────────────────┘
│                               │ HTTP API (Bun fetch handler)
┌───────────────────────────────▼────────────────────────────────┐
│                      Web Renderer (SolidJS)                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Terminal Panel   │  │ Chat Panel       │  │ Sidebar      │  │
│  │ (xterm.js 6.x)   │  │ (Streaming)      │  │ (Conversations)│  │
│  │                  │  │                  │  │              │  │
│  │ - ANSI colors    │  │ - Tool calls     │  │ - Lane list  │  │
│  │ - Cursor control │  │ - Interrupt      │  │ - Status     │  │
│  │ - Resize         │  │ - Context        │  │ - Navigation │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Architectural Patterns

#### 2.2.1 Event-Driven LocalBus

The LocalBus is an in-process message bus with 26 registered methods and 40 topics. It uses typed envelopes:

- **CommandEnvelope:** Method-based dispatch with workspace/lane/session/terminal context
- **EventEnvelope:** Topic-based pub/sub with monotonic sequence numbers
- **ResponseEnvelope:** Success/error with correlation tracking

Benefits:
- Sub-millisecond dispatch latency
- Full TypeScript type safety
- Centralized observability (audit, metrics)
- Lifecycle ordering enforcement

#### 2.2.2 State Machines

Every lifecycle-critical entity uses explicit state machines:

| Entity | States | Purpose |
|--------|--------|---------|
| Lane | 8 states | Workspace isolation, PAR task binding |
| Session | 6 states | User connection lifecycle |
| PTY | 6 states | Terminal process management |
| Renderer | 7 states | Backend switching with rollback |
| Recovery | 6 states | Crash detection and restoration |

#### 2.2.3 Adapter/Plugin Pattern

Pluggable adapters for:
- **AI Inference:** Anthropic (cloud), MLX (Apple Silicon), llama.cpp/vLLM (NVIDIA)
- **Terminal Multiplexers:** Zellij, PAR
- **Session Sharing:** upterm, tmate
- **Renderer Backends:** Ghostty, Rio

#### 2.2.4 Red-Black Transactions

Atomic renderer switching with automatic rollback:
- Attempt hot-swap when supported
- Fall back to restart-with-restore
- Rollback on any failure
- No data loss during switch

---

## 3. Monorepo Layout

```
heliosApp/
├── apps/
│   ├── runtime/              # Core runtime engine
│   │   ├── src/
│   │   │   ├── protocol/     # LocalBus implementation
│   │   │   ├── sessions/     # Session lifecycle management
│   │   │   ├── pty/          # PTY lifecycle manager
│   │   │   ├── providers/    # AI provider adapters
│   │   │   ├── recovery/     # Crash recovery system
│   │   │   ├── audit/        # Audit logging
│   │   │   ├── secrets/      # Secret management and redaction
│   │   │   ├── policy/       # Command policy engine
│   │   │   ├── registry/     # Terminal-to-lane-session binding
│   │   │   ├── config/       # Settings and feature flags
│   │   │   ├── diagnostics/  # Performance instrumentation
│   │   │   ├── integrations/ # Zellij, sharing, MCP
│   │   │   └── workspace/    # Workspace CRUD operations
│   │   ├── tests/            # Unit and integration tests
│   │   └── package.json
│   │
│   ├── desktop/              # Desktop shell (ElectroBun)
│   │   ├── src/
│   │   │   ├── main.ts       # Main process entry
│   │   │   ├── runtime_client.ts  # LocalBus HTTP client
│   │   │   ├── context_store.ts   # Active context state
│   │   │   ├── tabs/         # Tab surfaces (5 types)
│   │   │   ├── panels/       # Lane list, status, actions
│   │   │   └── settings/     # Renderer preferences
│   │   └── package.json
│   │
│   ├── renderer/             # Web renderer (SolidJS)
│   │   ├── src/
│   │   │   ├── App.tsx       # Root component
│   │   │   ├── components/
│   │   │   │   ├── chat/     # ChatPanel, ChatInput, MessageBubble
│   │   │   │   ├── terminal/ # TerminalPanel, TerminalTabs (xterm.js)
│   │   │   │   └── sidebar/  # Conversation list, lane navigation
│   │   │   └── stores/       # SolidJS signal-based stores
│   │   └── package.json
│   │
│   └── colab-renderer/       # Collaborative renderer (multi-user)
│       └── src/
│
├── packages/
│   ├── runtime-core/         # Shared types, API client, helpers
│   │   ├── src/
│   │   │   ├── types/        # Conversation, Message, Workspace, etc.
│   │   │   ├── api/          # Anthropic API client (ky-based)
│   │   │   ├── config/       # Config helpers
│   │   │   └── utils/        # ID utilities
│   │   └── package.json
│   │
│   ├── ids/                  # ULID-based ID generation
│   │   ├── src/
│   │   │   ├── index.ts      # ID generation with prefixes
│   │   │   ├── validation.ts # ID validation
│   │   │   └── parsing.ts    # ID parsing utilities
│   │   └── package.json
│   │
│   ├── errors/               # Error type definitions
│   │   ├── src/
│   │   │   ├── index.ts      # Error taxonomy
│   │   │   └── codes.ts      # Error codes by category
│   │   └── package.json
│   │
│   ├── logger/               # Pino-based structured logging
│   │   ├── src/
│   │   │   └── index.ts      # Logger factory
│   │   └── package.json
│   │
│   └── types/                # Base TypeScript type definitions
│       └── src/
│
├── docs/                     # VitePress documentation site
│   ├── .vitepress/
│   ├── guide/
│   ├── reference/
│   └── package.json
│
├── specs/                    # Protocol specifications
│   ├── envelope-schema.json
│   ├── methods.json          # 26 method definitions
│   ├── topics.json           # 40 topic definitions
│   └── state-machines.md
│
├── scripts/                  # Build and utility scripts
│   ├── build.ts
│   ├── dependency-registry.ts
│   └── governance-check.ts
│
├── tools/                    # Gate testing fixtures
│   └── test-fixtures/
│
├── deps-registry.json        # Prerelease dependency tracking
├── deps-changelog.json       # Dependency change history
├── bun.lock                  # Bun lockfile
├── package.json              # Root workspace definition
├── tsconfig.base.json        # Shared TypeScript config
├── biome.json                # Linting and formatting
└── turbo.json                # Turborepo configuration
```

---

## 4. Core Data Models

### 4.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Entity Relationships                           │
│                                                                      │
│   ┌──────────┐        ┌──────────┐        ┌──────────┐              │
│   │ Workspace│ 1----* │   Lane   │ 1----* │ Session  │              │
│   │          │        │          │        │          │              │
│   │ - id     │        │ - id     │        │ - id     │              │
│   │ - name   │        │ - ws_id  │        │ - lane_id│              │
│   │ - path   │        │ - state  │        │ - term_id│              │
│   │ - state  │        │ - path   │        │ - state  │              │
│   └──────────┘        └────┬─────┘        └────┬─────┘              │
│                            │                   │                    │
│                            │ 1                 │ 1                  │
│                            │                   │                    │
│                            ▼                   ▼                    │
│                       ┌──────────┐        ┌──────────┐              │
│                       │PAR Task  │        │ Terminal │              │
│                       │          │        │          │              │
│                       │ - task_id│        │ - id     │              │
│                       │ - status │        │ - ss_id  │              │
│                       └──────────┘        │ - state  │              │
│                                           └────┬─────┘              │
│                                                │                     │
│                                                │ 1                  │
│                                                │                    │
│                                                ▼                    │
│                                           ┌──────────┐              │
│                                           │   PTY    │              │
│                                           │          │              │
│                                           │ - pid    │              │
│                                           │ - state  │              │
│                                           └──────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Workspace

```typescript
interface Workspace {
  /** Workspace ID (ws_{ulid}) */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Root directory path */
  rootPath: string;
  
  /** Current state */
  state: 'active' | 'closed' | 'deleted' | 'stale';
  
  /** Associated project metadata */
  project?: {
    type: 'git' | 'local';
    url?: string;        // For git clones
    branch?: string;     // Default branch
    lastFetch?: number;  // Timestamp
  };
  
  /** Settings override */
  settings: Partial<AppSettings>;
  
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}
```

### 4.3 Lane

```typescript
interface Lane {
  /** Lane ID (ln_{ulid}) */
  id: string;
  
  /** Parent workspace */
  workspaceId: string;
  
  /** Display name */
  name: string;
  
  /** Current state (state machine) */
  state: 'idle' | 'creating' | 'active' | 'paused' | 'cleanup' | 'closed' | 'failed' | 'terminated';
  
  /** Git worktree path */
  worktreePath: string;
  
  /** PAR task binding (if using PAR orchestration) */
  parTaskId?: string;
  
  /** Session bindings */
  sessions: string[];  // ss_{ulid}[]
  
  /** Terminal bindings */
  terminals: string[]; // tm_{ulid}[]
  
  /** Creation metadata */
  createdAt: number;
  createdBy: string;  // User or agent ID
  
  /** State timestamps */
  stateHistory: StateTransition[];
  
  /** Orphan detection metadata */
  lastActivityAt: number;
  checkPointAt?: number;
}

interface StateTransition {
  from: string;
  to: string;
  event: string;
  timestamp: number;
  actor?: string;
}
```

### 4.4 Session

```typescript
interface Session {
  /** Session ID (ss_{ulid}) */
  id: string;
  
  /** Parent lane */
  laneId: string;
  
  /** Workspace context */
  workspaceId: string;
  
  /** Associated terminal */
  terminalId?: string;  // tm_{ulid}
  
  /** Current state (state machine) */
  state: 'created' | 'attaching' | 'attached' | 'detaching' | 'detached' | 'terminated';
  
  /** User or agent identifier */
  actor: {
    type: 'user' | 'agent';
    id: string;
  };
  
  /** Connection metadata */
  transport: {
    type: 'local' | 'remote';
    clientInfo?: string;
  };
  
  /** Heartbeat tracking */
  heartbeats: {
    lastReceivedAt: number;
    missedCount: number;
  };
  
  /** Timestamps */
  createdAt: number;
  attachedAt?: number;
  detachedAt?: number;
  terminatedAt?: number;
}
```

### 4.5 Terminal

```typescript
interface Terminal {
  /** Terminal ID (tm_{ulid}) */
  id: string;
  
  /** Associated session */
  sessionId: string;
  
  /** Workspace/lane context */
  workspaceId: string;
  laneId: string;
  
  /** Current state */
  state: 'spawning' | 'running' | 'throttled' | 'closed';
  
  /** PTY process reference */
  ptyId?: string;
  
  /** Terminal configuration */
  config: {
    shell: string;
    cwd: string;
    env: Record<string, string>;
    dimensions: {
      cols: number;
      rows: number;
    };
  };
  
  /** Output buffering */
  buffer: {
    maxSize: number;
    currentSize: number;
    backpressureEnabled: boolean;
  };
  
  /** Share state */
  sharing?: {
    type: 'upterm' | 'tmate';
    url?: string;
    readOnly: boolean;
    startedAt: number;
    expiresAt?: number;
  };
  
  /** Timestamps */
  spawnedAt?: number;
  lastActivityAt: number;
  closedAt?: number;
}
```

### 4.6 Conversation

```typescript
interface Conversation {
  /** Conversation ID */
  id: string;
  
  /** Associated lane */
  laneId: string;
  
  /** Associated workspace */
  workspaceId: string;
  
  /** Display title (auto-generated or user-edited) */
  title: string;
  
  /** Message history */
  messages: Message[];
  
  /** Model configuration */
  model: {
    provider: string;   // anthropic, mlx, llamacpp, etc.
    modelId: string;
    parameters: GenerationParameters;
  };
  
  /** Active tool definitions */
  tools?: ToolDefinition[];
  
  /** Conversation state */
  state: 'active' | 'archived' | 'deleted';
  
  /** Token usage statistics */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
}

interface Message {
  /** Message ID */
  id: string;
  
  /** Message role */
  role: 'user' | 'assistant' | 'system' | 'tool_call' | 'tool_result';
  
  /** Message content */
  content: string;
  
  /** For tool_call role */
  toolCalls?: ToolCall[];
  
  /** For tool_result role */
  toolCallId?: string;
  
  /** Generation metadata */
  metadata?: {
    model?: string;
    finishReason?: string;
    latency?: number;
  };
  
  /** Timestamp */
  timestamp: number;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface GenerationParameters {
  temperature: number;
  maxTokens: number;
  topP?: number;
  stopSequences?: string[];
}
```

### 4.7 Protocol Envelopes

#### 4.7.1 Command Envelope

```typescript
interface CommandEnvelope {
  /** Unique envelope ID (env_{ulid}) */
  id: string;
  
  /** Correlation ID for linking (cor_{ulid}) */
  correlation_id: string;
  
  /** Envelope type discriminator */
  type: 'command';
  
  /** Registered method name */
  method: string;  // One of 26 registered methods
  
  /** Method-specific payload */
  payload: unknown;
  
  /** Execution context */
  context: {
    workspace_id?: string;  // ws_{ulid}
    lane_id?: string;       // ln_{ulid}
    session_id?: string;    // ss_{ulid}
    terminal_id?: string;   // tm_{ulid}
  };
  
  /** Unix timestamp (milliseconds) */
  timestamp: number;
}
```

#### 4.7.2 Event Envelope

```typescript
interface EventEnvelope {
  /** Unique envelope ID (evt_{ulid}) */
  id: string;
  
  /** Links to originating command */
  correlation_id?: string;
  
  /** Envelope type discriminator */
  type: 'event';
  
  /** Registered topic name */
  topic: string;  // One of 40 registered topics
  
  /** Event payload */
  payload: unknown;
  
  /** Execution context */
  context: {
    workspace_id?: string;
    lane_id?: string;
    session_id?: string;
    terminal_id?: string;
  };
  
  /** Unix timestamp */
  timestamp: number;
  
  /** Monotonically increasing per topic */
  sequence: number;
}
```

#### 4.7.3 Response Envelope

```typescript
interface ResponseEnvelope {
  /** Unique envelope ID (rsp_{ulid}) */
  id: string;
  
  /** Matches command correlation_id */
  correlation_id: string;
  
  /** Envelope type discriminator */
  type: 'response';
  
  /** Response status */
  status: 'success' | 'error';
  
  /** Success payload */
  result?: unknown;
  
  /** Error details */
  error?: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
  
  /** Unix timestamp */
  timestamp: number;
}

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'METHOD_NOT_FOUND'
  | 'HANDLER_ERROR'
  | 'TIMEOUT'
  | 'BACKPRESSURE'
  | 'INVALID_STATE_TRANSITION'
  | 'ENTITY_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR';
```

---

## 5. Protocol Specification

### 5.1 LocalBus Protocol

The LocalBus protocol provides in-process message passing with the following characteristics:

#### 5.1.1 Design Principles

1. **Type Safety:** All envelopes are fully typed in TypeScript
2. **Correlation Tracking:** Every command links to its events and response
3. **Lifecycle Ordering:** State machine transitions are validated
4. **Failure Isolation:** Subscriber failures don't affect other subscribers
5. **Observability:** All envelopes flow through audit and metrics

#### 5.1.2 Method Registry

Methods are registered at startup. Each method has:
- Unique name
- Input payload type
- Output result type
- Handler function

```typescript
interface MethodHandler {
  (payload: unknown, context: Context): Promise<unknown>;
}

interface MethodRegistration {
  name: string;
  handler: MethodHandler;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
}
```

#### 5.1.3 Topic Registry

Topics are registered at startup. Each topic has:
- Unique name
- Payload schema
- Subscriber set

```typescript
interface EventSubscriber {
  (event: EventEnvelope): void | Promise<void>;
}

interface TopicRegistration {
  name: string;
  payloadSchema: JSONSchema;
  subscribers: Set<EventSubscriber>;
}
```

#### 5.1.4 Dispatch Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Command   │────▶│   Validate   │────▶│   Lookup    │────▶│   Execute   │
│   Envelope  │     │   Schema     │     │   Handler   │     │   Handler   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                              ┌─────────────────────────────────────┘
                              │
                              ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Response  │◀────│   Create     │◀────│   Publish   │◀────│   Result    │
│   Envelope  │     │   Response   │     │   Events    │     │   / Error   │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
```

### 5.2 HTTP API Protocol

The runtime exposes an HTTP API for external communication:

#### 5.2.1 Authentication

```typescript
// API key authentication
interface AuthContext {
  type: 'api_key';
  keyId: string;
  scopes: string[];
  workspaceId?: string;
}

// Session token authentication (from desktop)
interface SessionAuthContext {
  type: 'session';
  sessionId: string;
  userId: string;
}
```

#### 5.2.2 Request/Response Format

```typescript
// Request
interface APIRequest<T> {
  auth: AuthContext;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: T;
  headers: Record<string, string>;
}

// Response
interface APIResponse<T> {
  status: number;
  body: {
    success: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
      details?: unknown;
    };
    meta?: {
      requestId: string;
      timestamp: number;
      duration: number;
    };
  };
}
```

#### 5.2.3 Streaming Endpoints

Streaming endpoints use Server-Sent Events (SSE):

```
GET /v1/conversations/{id}/stream

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type": "content", "delta": "Hello"}

data: {"type": "content", "delta": " world"}

data: {"type": "tool_call", "tool_call": {"id": "...", "name": "read_file"}}

data: {"type": "done"}
```

---

## 6. State Machines

### 6.1 Lane State Machine

The lane state machine manages workspace isolation and PAR task lifecycle.

#### 6.1.1 States

```
                    ┌─────────────┐
                    │    idle     │
                    └──────┬──────┘
                           │ CREATE
                           ▼
              ┌────────────────────────┐
              │      creating        │
              │  (provision worktree │
              │   bind par task)      │
              └──────┬────────┬──────┘
                     │        │
            PROVISIONED    FAILED
                     │        │
                     ▼        ▼
              ┌─────────┐ ┌──────┐
              │  active │ │failed│
              └─┬─┬───┬─┘ └───┬──┘
                │ │   │       │
         PAUSE  │ │   │ CLEANUP
                │ │   │       │
                ▼ │   │       │
           ┌──────┘   │       │
           │ paused   │       │ RETRY
           └───┬──────┘       │
               │              │
          RESUME             │
               │              ▼
               │         ┌────────┐
               └────────▶│cleanup │
                         └─┬──────┘
                           │
                    COMPLETED/FAILED
                           │
                           ▼
                    ┌─────────┐
                    │ closed  │
                    │ (final) │
                    └─────────┘
```

#### 6.1.2 State Definitions

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| idle | Initial state, not yet created | creating |
| creating | Provisioning resources, binding PAR task | active, failed |
| active | Fully operational, ready for sessions | paused, cleanup, failed |
| paused | Suspended, processes frozen | active, cleanup |
| cleanup | Terminating resources, cleaning up | closed, failed |
| closed | Final state, resources released | - |
| failed | Error state, cleanup pending | cleanup (retry or force) |
| terminated | Forced termination | - |

#### 6.1.3 Entry/Exit Actions

| Transition | Entry Actions |
|------------|---------------|
| → creating | provisionWorktree, bindParTask |
| → active | emitLaneCreated |
| → paused | suspendProcesses |
| → cleanup | terminateAllPtys, cleanupWorktree, unbindParTask |
| → closed | emitLaneClosed, archiveMetrics |
| → failed | logError, notifyParent |

### 6.2 Session State Machine

Manages user/agent connection lifecycle.

#### 6.2.1 States

```
                ┌─────────────┐
                │   created   │
                └──────┬──────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
    ┌──────────┐  ┌──────────┐ ┌───────────┐
    │ attaching│  │terminate │ │terminated │
    └────┬─────┘  └──────────┘ └───────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────┐
│attached│ │failed│
└───┬────┘ └──────┘
    │
    │ DETACH/HEARTBEAT_TIMEOUT
    ▼
┌───────────┐
│ detaching │
└─────┬─────┘
      │
      ▼
┌───────────┐
│ detached  │
└─────┬─────┘
      │
      │ REATTACH/TERMINATE
      ▼
   [reattach/terminate]
```

#### 6.2.2 State Definitions

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| created | Initial state, not yet attached | attaching, terminated |
| attaching | Allocating resources, binding to lane | attached, failed |
| attached | Active connection, ready for commands | detaching |
| detaching | Flushing buffers, cleaning up | detached |
| detached | Cleanly disconnected | attaching, terminated |
| terminated | Final state, resources released | - |

### 6.3 PTY State Machine

Manages terminal process lifecycle.

#### 6.3.1 States

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| idle | Initial state, process not spawned | spawning |
| spawning | Forking process, setting up PTY | active, errored |
| active | Process running, I/O flowing | throttled, stopped, errored |
| throttled | Output paused due to backpressure | active, stopped |
| errored | Process error or spawn failure | spawning (retry), stopped |
| stopped | Process terminated, resources cleaning | - |

### 6.4 Renderer State Machine

Manages renderer backend switching.

#### 6.4.1 States

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| uninitialized | Initial state, no renderer active | initializing |
| initializing | Setting up renderer | running, errored |
| running | Renderer active, processing I/O | switching, stopping |
| switching | Atomic switch in progress | running (commit), running (rollback) |
| stopping | Graceful shutdown | stopped |
| stopped | Renderer terminated | - |
| errored | Renderer failure | stopped, initializing (recovery) |

### 6.5 Recovery State Machine

Manages crash detection and restoration.

#### 6.5.1 States

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| idle | Normal operation, monitoring | detecting |
| detecting | Confirming crash, collecting info | inventorying, idle (false alarm) |
| inventorying | Scanning checkpoints, sessions | restoring, failed |
| restoring | Rebuilding state from checkpoints | reconciling |
| reconciling | Validating state, cleaning orphans | live |
| live | Recovery complete, normal operation | detecting, safe_mode |
| safe_mode | Crash loop detected, limited features | detecting (after diagnostics) |
| failed | Recovery impossible, data loss | - |

---

## 7. HTTP API

### 7.1 Endpoints

#### 7.1.1 Protocol Dispatch

```
POST /v1/protocol/dispatch
Content-Type: application/json

Request:
{
  "envelope": {
    "id": "env_01H...",
    "correlation_id": "cor_01H...",
    "type": "command",
    "method": "terminal.spawn",
    "payload": {
      "shell": "/bin/zsh",
      "cwd": "/home/user/project"
    },
    "context": {
      "workspace_id": "ws_01H...",
      "lane_id": "ln_01H...",
      "session_id": "ss_01H..."
    },
    "timestamp": 1711459200000
  }
}

Response (200 OK):
{
  "success": true,
  "data": {
    "terminal_id": "tm_01H..."
  },
  "meta": {
    "requestId": "req_01H...",
    "timestamp": 1711459200050,
    "duration": 50
  }
}

Response (400 Bad Request):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid shell path: /bin/invalid",
    "details": {
      "field": "payload.shell",
      "constraint": "file_exists"
    }
  }
}
```

#### 7.1.2 Workspace Management

```
# Create workspace
POST /v1/workspaces

# Get workspace
GET /v1/workspaces/{id}

# List workspaces
GET /v1/workspaces

# Update workspace
PUT /v1/workspaces/{id}

# Delete workspace
DELETE /v1/workspaces/{id}

# Open workspace (activate)
POST /v1/workspaces/{id}/open

# Close workspace (deactivate)
POST /v1/workspaces/{id}/close
```

#### 7.1.3 Lane Management

```
# Create lane in workspace
POST /v1/workspaces/{id}/lanes
Request: { "name": "feature-branch", "par_mode": true }
Response: { "lane_id": "ln_01H...", "state": "creating" }

# Get lane
GET /v1/workspaces/{id}/lanes/{laneId}

# List lanes
GET /v1/workspaces/{id}/lanes

# Attach to lane
POST /v1/workspaces/{id}/lanes/{laneId}/attach

# Cleanup lane
POST /v1/workspaces/{id}/lanes/{laneId}/cleanup

# Get lane status
GET /v1/workspaces/{id}/lanes/{laneId}/status
```

#### 7.1.4 Session Management

```
# Create/attach session
POST /v1/workspaces/{id}/lanes/{laneId}/sessions
Request: {
  "transport": "local",
  "actor": { "type": "user", "id": "user_123" }
}
Response: {
  "session_id": "ss_01H...",
  "state": "attaching"
}

# Detach session
POST /v1/sessions/{sessionId}/detach

# Terminate session
DELETE /v1/sessions/{sessionId}

# Send heartbeat
POST /v1/sessions/{sessionId}/heartbeat
```

#### 7.1.5 Terminal Management

```
# Spawn terminal
POST /v1/workspaces/{id}/lanes/{laneId}/terminals
Request: {
  "shell": "/bin/zsh",
  "cwd": "/home/user/project",
  "env": { "PATH": "/usr/local/bin" },
  "dimensions": { "cols": 80, "rows": 24 }
}
Response: {
  "terminal_id": "tm_01H...",
  "state": "spawning"
}

# Resize terminal
POST /v1/terminals/{terminalId}/resize
Request: { "cols": 120, "rows": 40 }

# Send input
POST /v1/terminals/{terminalId}/input
Request: { "data": "ls -la\n" }

# Get output stream
GET /v1/terminals/{terminalId}/output
Response: text/event-stream

# Close terminal
DELETE /v1/terminals/{terminalId}
```

#### 7.1.6 Provider Management

```
# List providers
GET /v1/providers
Response: {
  "providers": [
    { "id": "anthropic", "name": "Anthropic", "healthy": true, "capabilities": {...} },
    { "id": "mlx", "name": "MLX", "healthy": true, "capabilities": {...} }
  ]
}

# Generate (non-streaming)
POST /v1/providers/{providerId}/generate
Request: {
  "conversation_id": "conv_01H...",
  "model": "claude-3-sonnet-20240229",
  "messages": [...],
  "parameters": { "temperature": 0.7, "max_tokens": 4096 }
}
Response: {
  "content": "...",
  "usage": { "input_tokens": 100, "output_tokens": 500 }
}

# Stream generation
POST /v1/providers/{providerId}/stream
Response: text/event-stream
```

#### 7.1.7 Conversation Management

```
# Create conversation
POST /v1/workspaces/{id}/conversations
Request: { "title": "Implement feature X" }

# Get conversation
GET /v1/conversations/{id}

# List conversations
GET /v1/workspaces/{id}/conversations

# Add message
POST /v1/conversations/{id}/messages
Request: {
  "role": "user",
  "content": "Help me refactor this code"
}

# Delete conversation
DELETE /v1/conversations/{id}
```

#### 7.1.8 Audit and Diagnostics

```
# Query audit log
GET /v1/audit?workspace_id=ws_01H...&start=1711459200000&end=1711545600000

# Get metrics
GET /v1/diagnostics/metrics

# Get health status
GET /v1/health

# Get cliproxy harness status
GET /v1/harness/cliproxy/status
```

### 7.2 Error Handling

All errors follow a consistent structure:

```typescript
interface APIError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfter?: number;  // Seconds to wait before retry
}

type ErrorCode =
  // Client errors (4xx)
  | 'BAD_REQUEST'           // 400 - Invalid request format
  | 'VALIDATION_ERROR'      // 400 - Schema validation failed
  | 'UNAUTHORIZED'          // 401 - Authentication required
  | 'FORBIDDEN'             // 403 - Permission denied
  | 'NOT_FOUND'             // 404 - Resource not found
  | 'CONFLICT'              // 409 - Resource conflict
  | 'UNPROCESSABLE_ENTITY'  // 422 - Semantic error
  
  // Server errors (5xx)
  | 'INTERNAL_ERROR'        // 500 - Unexpected server error
  | 'NOT_IMPLEMENTED'       // 501 - Feature not implemented
  | 'SERVICE_UNAVAILABLE'   // 503 - Service temporarily unavailable
  | 'TIMEOUT'               // 504 - Operation timed out
  
  // Application specific
  | 'INVALID_STATE_TRANSITION'
  | 'ENTITY_NOT_FOUND'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED';
```

---

## 8. LocalBus Methods

### 8.1 Method Overview

| Category | Count | Methods |
|----------|-------|---------|
| Workspace | 4 | workspace.create, workspace.open, project.clone, project.init |
| Session | 6 | session.create, session.attach, session.terminate, terminal.spawn, terminal.resize, terminal.input |
| Lane | 3 | lane.create, lane.attach, lane.cleanup |
| Renderer | 2 | renderer.switch, renderer.capabilities |
| Agent | 2 | agent.run, agent.cancel |
| Sharing | 4 | share.upterm.start, share.upterm.stop, share.tmate.start, share.tmate.stop |
| Zellij | 2 | zmx.checkpoint, zmx.restore |
| Policy | 1 | approval.request.resolve |
| Boundary | 3 | boundary.local.dispatch, boundary.tool.dispatch, boundary.a2a.dispatch |

### 8.2 Workspace Methods

#### 8.2.1 workspace.create

Creates a new workspace.

```typescript
// Request
interface WorkspaceCreateRequest {
  name: string;
  rootPath: string;
  project?: {
    type: 'git' | 'local';
    url?: string;
  };
}

// Response
interface WorkspaceCreateResponse {
  workspace_id: string;
  state: 'active';
}

// Context
// - None required

// Events emitted
// - workspace.created
// - workspace.opened (if auto-open)
```

#### 8.2.2 workspace.open

Opens an existing workspace.

```typescript
// Request
interface WorkspaceOpenRequest {
  workspace_id: string;
}

// Response
interface WorkspaceOpenResponse {
  workspace_id: string;
  lanes: Lane[];
  state: 'active';
}

// Events emitted
// - workspace.opened
```

### 8.3 Session Methods

#### 8.3.1 session.create

Creates a new session in a lane.

```typescript
// Request
interface SessionCreateRequest {
  lane_id: string;
  actor: {
    type: 'user' | 'agent';
    id: string;
  };
}

// Response
interface SessionCreateResponse {
  session_id: string;
  state: 'created';
}

// Context required
// - workspace_id
// - lane_id

// Events emitted
// - session.created
```

#### 8.3.2 session.attach

Attaches to an existing session.

```typescript
// Request
interface SessionAttachRequest {
  session_id: string;
}

// Response
interface SessionAttachResponse {
  session_id: string;
  terminal_ids: string[];
  state: 'attached';
}

// Events emitted
// - session.attached
// - terminal.output (for each terminal)
```

### 8.4 Terminal Methods

#### 8.4.1 terminal.spawn

Spawns a new terminal in a session.

```typescript
// Request
interface TerminalSpawnRequest {
  shell: string;
  cwd: string;
  env?: Record<string, string>;
  dimensions?: {
    cols: number;
    rows: number;
  };
}

// Response
interface TerminalSpawnResponse {
  terminal_id: string;
  state: 'spawning';
}

// Context required
// - workspace_id
// - lane_id
// - session_id

// Events emitted
// - terminal.spawned
// - terminal.output (when process outputs)
// - terminal.state_changed (when PTY state changes)
```

#### 8.4.2 terminal.input

Sends input to a terminal.

```typescript
// Request
interface TerminalInputRequest {
  terminal_id: string;
  data: string;  // Can include ANSI sequences
}

// Response
interface TerminalInputResponse {
  bytes_written: number;
}

// Events emitted
// - terminal.input_received (for audit)
```

### 8.5 Agent Methods

#### 8.5.1 agent.run

Starts an agent run in a conversation.

```typescript
// Request
interface AgentRunRequest {
  conversation_id: string;
  prompt: string;
  tools?: string[];  // Tool names to allow
  model?: string;     // Override default model
}

// Response
interface AgentRunResponse {
  run_id: string;
  state: 'running';
}

// Context required
// - workspace_id
// - lane_id
// - session_id

// Events emitted
// - agent.run.started
// - agent.run.chunk (streaming output)
// - agent.run.tool_call (when agent uses tool)
// - agent.run.completed
// - agent.run.failed
```

### 8.6 Boundary Methods

#### 8.6.1 boundary.tool.dispatch

Dispatches a tool call to the appropriate handler.

```typescript
// Request
interface ToolDispatchRequest {
  tool_call: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
  context: {
    workspace_id: string;
    lane_id: string;
    session_id?: string;
  };
}

// Response
interface ToolDispatchResponse {
  tool_call_id: string;
  result: unknown;
  latency: number;
}

// Events emitted
// - tool.execution.started
// - tool.execution.completed
```

---

## 9. LocalBus Topics

### 9.1 Topic Overview

| Category | Count | Topics |
|----------|-------|--------|
| Workspace | 4 | workspace.created, workspace.opened, workspace.closed, workspace.deleted |
| Lane | 5 | lane.created, lane.state_changed, lane.shared, lane.cleaning, lane.closed |
| Session | 6 | session.created, session.attached, session.detached, session.terminated, session.heartbeat_timeout |
| Terminal | 7 | terminal.spawned, terminal.output, terminal.input_received, terminal.resized, terminal.state_changed, terminal.stopped, terminal.sharing_changed |
| Agent | 5 | agent.run.started, agent.run.chunk, agent.run.tool_call, agent.run.completed, agent.run.failed |
| System | 8 | harness.status.changed, settings.changed, feature_flag.changed, renderer.switched, renderer.error, audit.recorded, diagnostics.metric, diagnostics.slo_violation |

### 9.2 Lifecycle Topics

#### 9.2.1 workspace.opened

Emitted when a workspace becomes active.

```typescript
interface WorkspaceOpenedEvent {
  topic: 'workspace.opened';
  payload: {
    workspace_id: string;
    name: string;
    root_path: string;
    lanes: string[];
  };
}
```

#### 9.2.2 lane.state_changed

Emitted on every lane state transition.

```typescript
interface LaneStateChangedEvent {
  topic: 'lane.state_changed';
  payload: {
    lane_id: string;
    workspace_id: string;
    from: LaneState;
    to: LaneState;
    event: string;
    duration_ms: number;
  };
}
```

#### 9.2.3 session.attached

Emitted when a session successfully attaches.

```typescript
interface SessionAttachedEvent {
  topic: 'session.attached';
  payload: {
    session_id: string;
    lane_id: string;
    workspace_id: string;
    actor: { type: string; id: string };
    terminal_ids: string[];
  };
}
```

### 9.3 Terminal Topics

#### 9.3.1 terminal.output

Emitted when a terminal produces output.

```typescript
interface TerminalOutputEvent {
  topic: 'terminal.output';
  payload: {
    terminal_id: string;
    session_id: string;
    lane_id: string;
    workspace_id: string;
    data: string;  // Base64-encoded binary data
    encoding: 'utf8' | 'base64';
    timestamp: number;
  };
}
```

### 9.4 Agent Topics

#### 9.4.1 agent.run.chunk

Emitted for each streaming chunk from an agent.

```typescript
interface AgentRunChunkEvent {
  topic: 'agent.run.chunk';
  payload: {
    run_id: string;
    conversation_id: string;
    content_delta: string;
    finish_reason?: string;
  };
}
```

#### 9.4.2 agent.run.tool_call

Emitted when an agent invokes a tool.

```typescript
interface AgentRunToolCallEvent {
  topic: 'agent.run.tool_call';
  payload: {
    run_id: string;
    tool_call: ToolCall;
    execution_id: string;
  };
}
```

---

## 10. Provider Adapters

### 10.1 Provider Interface

```typescript
interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  
  initialize(config: ProviderConfig): Promise<void>;
  getCapabilities(): ProviderCapabilities;
  health(): Promise<HealthStatus>;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  stream(request: StreamRequest): AsyncIterable<StreamChunk>;
  listModels(): Promise<ModelInfo[]>;
  cancel(requestId: string): Promise<void>;
  dispose(): Promise<void>;
}
```

### 10.2 Supported Providers

| Provider | ID | Location | Models | Tool Use | Vision |
|----------|-----|----------|--------|----------|--------|
| Anthropic | anthropic | Cloud | Claude 3 family | Yes | Yes |
| MLX | mlx | Local (Apple Silicon) | Llama, Mistral | No | No |
| llama.cpp | llamacpp | Local (NVIDIA) | Various GGUF | Varies | No |
| vLLM | vllm | Local/Server | Various | Varies | No |

### 10.3 Provider Router

The provider router manages request distribution:

```typescript
class ProviderRouter {
  // Select provider based on request and preferences
  selectProvider(
    request: GenerateRequest,
    preferences: ProviderPreference
  ): ProviderAdapter;
  
  // Check health of all providers
  checkHealth(): Promise<Map<string, HealthStatus>>;
  
  // Execute with automatic failover
  async executeWithFailover<T>(
    operation: (p: ProviderAdapter) => Promise<T>
  ): Promise<T>;
}
```

---

## 11. Persistence Layer

### 11.1 Storage Strategy

| Data Type | Storage | Retention | Purpose |
|-----------|---------|-----------|---------|
| Audit events | SQLite | 30 days | Compliance, replay |
| Settings | JSON files | Permanent | User preferences |
| Workspace metadata | JSON files | Until deleted | Project organization |
| Session state | JSON files | Until cleanup | Recovery restoration |
| Terminal buffers | In-memory | Session lifetime | Hot data |
| Metrics | In-memory | Configurable | Performance monitoring |

### 11.2 SQLite Schema

```sql
-- Audit events table
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  correlation_id TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL,
  payload TEXT,  -- JSON
  workspace_id TEXT,
  lane_id TEXT,
  session_id TEXT,
  INDEX idx_timestamp (timestamp),
  INDEX idx_correlation (correlation_id),
  INDEX idx_workspace (workspace_id)
);

-- Auto-cleanup old events
CREATE TRIGGER purge_old_audit_events
AFTER INSERT ON audit_events
BEGIN
  DELETE FROM audit_events
  WHERE timestamp < (strftime('%s', 'now') - 2592000) * 1000;  -- 30 days
END;
```

### 11.3 Recovery State Persistence

```typescript
interface RecoveryState {
  version: string;
  savedAt: number;
  lanes: Array<{
    id: string;
    state: LaneState;
    worktreePath: string;
    sessions: Array<{
      id: string;
      terminalIds: string[];
      zellijSessionName?: string;
    }>;
    zmxCheckpointPath?: string;
  }>;
  checksum: string;  // SHA-256 of serialized data
}
```

---

## 12. Performance Targets

### 12.1 Latency SLAs

| Metric | Target | P95 | P99 |
|--------|--------|-----|-----|
| LocalBus dispatch | <5ms | 5ms | 10ms |
| PTY spawn | <200ms | 200ms | 500ms |
| Session attach | <100ms | 100ms | 300ms |
| Audit write | <10ms | 10ms | 50ms |
| Renderer switch | <500ms | 500ms | 1000ms |
| Provider first token | - | 500ms (cloud) | 2000ms |
| Gate pipeline | <10min | 10min | - |

### 12.2 Throughput Targets

| Metric | Target |
|--------|--------|
| LocalBus events/sec | 10,000 |
| Concurrent sessions | 50 |
| Concurrent terminals | 100 |
| Audit events/sec | 1,000 |

### 12.3 Resource Targets

| Metric | Target |
|--------|--------|
| Memory (base) | <500MB |
| Memory (per session) | <50MB |
| Disk (logs) | <1GB/day |
| CPU (idle) | <5% |

---

## 13. Quality Gates

### 13.1 CI Pipeline

| Stage | Tool | Threshold |
|-------|------|-----------|
| Type check | tsc --noEmit | Zero errors |
| Lint | Biome + oxlint | Zero warnings |
| Unit tests | Bun test | 100% pass |
| E2E tests | Playwright | 100% pass |
| Coverage | Bun test --coverage | 85% minimum |
| Security scan | GitGuardian | Zero findings |
| Static analysis | Custom | Zero anti-patterns |
| Bypass detection | Custom | Zero bypasses |

### 13.2 Gate Bypass Detection

Scans for:
- `// @ts-ignore` without justification
- `// @ts-expect-error` without matching error
- `test.skip`, `test.only`, `test.todo`
- `biome-ignore`, `eslint-disable` without ADR
- `console.log` in production code

### 13.3 Local Gate Execution

```bash
# Run all gates locally
bun run gates

# Individual gates
bun run typecheck
bun run lint
bun run test
bun run test:e2e
bun run test:coverage
```

---

## 14. Technology Stack

### 14.1 Runtime

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Bun | 1.2.20+ |
| Language | TypeScript | 7.x |
| Strict mode | Enabled | - |
| Module system | ESM | - |

### 14.2 UI Framework

| Layer | Technology | Version |
|-------|------------|---------|
| Desktop shell | ElectroBun | latest |
| Web UI | SolidJS | 1.9.x |
| Terminal | xterm.js | 6.x |
| HTTP client | ky | 1.14.3 |

### 14.3 Infrastructure

| Layer | Technology | Version |
|-------|------------|---------|
| Logging | pino | 10.x |
| Build | esbuild | 0.27.x |
| Testing | Bun test | Built-in |
| E2E testing | Playwright | 1.58 |
| Linting | Biome | 2.4.9 |
| Docs | VitePress | 1.6.4 |

### 14.4 Task Orchestration

| Tool | Purpose |
|------|---------|
| Turborepo | Monorepo task orchestration |
| go-task | Task runner (Taskfile.yml) |
| just | Alternative task runner (justfile) |

---

## 15. Security Model

### 15.1 Secret Management

```typescript
interface SecretStore {
  // Store encrypted credential
  store(providerId: string, credential: Credential): Promise<void>;
  
  // Retrieve credential (audited)
  retrieve(providerId: string): Promise<Credential>;
  
  // Rotate credential
  rotate(providerId: string, newCredential: Credential): Promise<void>;
  
  // Revoke credential
  revoke(providerId: string): Promise<void>;
}

// Encryption at rest using OS keychain
// Access audit trail for compliance
```

### 15.2 Redaction Engine

```typescript
interface RedactionEngine {
  // Default patterns
  patterns: RedactionPattern[] = [
    { name: 'api_key', regex: /[a-zA-Z0-9]{32,64}/g },
    { name: 'password', regex: /password[:\s]*[^\s]+/gi },
    { name: 'token', regex: /token[:\s]*[^\s]+/gi },
    { name: 'secret', regex: /secret[:\s]*[^\s]+/gi },
    { name: 'credential', regex: /credential[:\s]*[^\s]+/gi },
  ];
  
  // Redact sensitive data from content
  redact(content: string): { redacted: string; matches: RedactionMatch[] };
}
```

### 15.3 Command Policy Engine

```typescript
interface PolicyEngine {
  // Evaluate command against policy
  evaluate(
    command: string,
    context: PolicyContext
  ): PolicyDecision;
}

type PolicyDecision =
  | { action: 'allow' }
  | { action: 'block'; reason: string }
  | { action: 'require_approval'; request: ApprovalRequest };
```

---

## 16. Observability

### 16.1 Metrics

```typescript
interface MetricsCollector {
  // Latency metrics
  recordLatency(name: string, value: number, labels?: Record<string, string>): void;
  
  // Gauge metrics
  recordGauge(name: string, value: number, labels?: Record<string, string>): void;
  
  // Counter metrics
  incrementCounter(name: string, labels?: Record<string, string>): void;
}

// Key metrics
const KEY_METRICS = {
  // Bus
  'bus.dispatch_latency': 'latency',
  'bus.publish_latency': 'latency',
  'bus.queue_depth': 'gauge',
  
  // PTY
  'pty.spawn_latency': 'latency',
  'pty.output_bytes': 'counter',
  'pty.backpressure_events': 'counter',
  
  // Provider
  'provider.request_latency': 'latency',
  'provider.tokens_generated': 'counter',
  'provider.errors': 'counter',
  
  // Session
  'session.attach_latency': 'latency',
  'session.active_count': 'gauge',
} as const;
```

### 16.2 SLOs

| Metric | P50 | P95 | Target |
|--------|-----|-----|--------|
| Input-to-echo | 30ms | 60ms | Yes |
| Input-to-render | 60ms | 150ms | Yes |
| Frame rate | 60 FPS | 55 FPS | Yes |
| Memory | 500 MB | 750 MB | Yes |
| Startup | 2s | 5s | Yes |

### 16.3 Audit Logging

All significant actions are logged:
- User actions (workspace open, lane create, etc.)
- Agent actions (tool calls, completions)
- System actions (state changes, errors)
- Security events (credential access, policy violations)

---

## 17. Recovery and Resilience

### 17.1 Crash Detection

```typescript
interface CrashDetector {
  // Monitor process health
  watchProcess(pid: number, name: string): void;
  
  // Detect crash conditions
  onCrash: EventEmitter<CrashEvent>;
}

interface CrashEvent {
  component: string;
  exitCode?: number;
  signal?: string;
  timestamp: number;
  lastHeartbeat?: number;
}
```

### 17.2 Checkpoint System

```typescript
interface CheckpointSystem {
  // Create checkpoint
  checkpoint(laneId: string): Promise<Checkpoint>;
  
  // Restore from checkpoint
  restore(checkpointId: string): Promise<RestoreResult>;
  
  // List available checkpoints
  listCheckpoints(laneId: string): Promise<Checkpoint[]>;
}
```

### 17.3 Safe Mode

Entered when crash loop detected (3+ crashes in 60 seconds):
- Disable non-essential features
- Enable extended diagnostics
- Require user acknowledgment to continue

---

## 18. Testing Strategy

### 18.1 Test Pyramid

| Level | Tool | Target | Coverage |
|-------|------|--------|----------|
| Unit | Bun test | 70% | Required |
| Integration | Bun test | 20% | Required |
| E2E | Playwright | 10% | Required |

### 18.2 Test Patterns

```typescript
// Unit test example
describe('SessionService', () => {
  test('attach transitions state correctly', async () => {
    const session = await service.create(laneId, actor);
    expect(session.state).toBe('created');
    
    await service.attach(session.id);
    const updated = await service.get(session.id);
    expect(updated.state).toBe('attached');
  });
});

// E2E test example
test('user can create lane and spawn terminal', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="new-lane"]');
  await page.fill('[data-testid="lane-name"]', 'test-lane');
  await page.click('[data-testid="create-lane"]');
  
  await expect(page.locator('[data-testid="terminal-panel"]')).toBeVisible();
});
```

### 18.3 Mocking Strategy

```typescript
// Mock provider for testing
const mockProvider: ProviderAdapter = {
  id: 'mock',
  async generate(request) {
    return {
      requestId: request.requestId,
      content: 'Mock response',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: request.model,
      metadata: {},
      finishReason: 'stop',
    };
  },
  // ... other methods
};
```

---

## 19. Deployment and Distribution

### 19.1 Build Pipeline

```
Source → Type Check → Lint → Unit Tests → Build → Package → Sign → Distribute
```

### 19.2 Platform Targets

| Platform | Minimum Version | Architecture |
|----------|-----------------|--------------|
| macOS | 13.0 (Ventura) | ARM64 (Apple Silicon), x64 |
| Linux | Ubuntu 22.04 | x64 |
| Windows | 11 | x64 (Phase 3) |

### 19.3 Distribution Channels

- GitHub Releases (primary)
- Homebrew (macOS)
- APT repository (Linux)

---

## 20. Future Roadmap

### 20.1 Phase 2: Remote Workspace Sync

- CRDT-based state synchronization
- Cross-machine lane handoff
- Conflict resolution

### 20.2 Phase 3: Multi-User Collaborative Lanes

- Concurrent editing
- Presence indicators
- Access control per lane

### 20.3 Phase 4: Plugin Marketplace

- Provider adapter distribution
- MCP tool registry
- Versioned contracts

### 20.4 Phase 5: Cloud-Hosted Runtime

- Fully remote agent execution
- Auth and billing integration
- Resource isolation

---

## Appendix A: ID Standards

All IDs follow the format `{prefix}_{ulid}`:

| Entity | Prefix | Example |
|--------|--------|---------|
| Workspace | ws_ | ws_01HMG... |
| Lane | ln_ | ln_01HMG... |
| Session | ss_ | ss_01HMG... |
| Terminal | tm_ | tm_01HMG... |
| Conversation | conv_ | conv_01HMG... |
| Correlation | cor_ | cor_01HMG... |
| Run | run_ | run_01HMG... |
| Event | evt_ | evt_01HMG... |

## Appendix B: Error Codes

| Code | HTTP Status | Retryable | Description |
|------|-------------|-----------|-------------|
| VALIDATION_ERROR | 400 | No | Request failed schema validation |
| METHOD_NOT_FOUND | 404 | No | Method not registered |
| HANDLER_ERROR | 500 | Varies | Handler threw exception |
| TIMEOUT | 504 | Yes | Operation timed out |
| BACKPRESSURE | 503 | Yes | System overloaded |
| INVALID_STATE_TRANSITION | 409 | No | State machine violation |
| ENTITY_NOT_FOUND | 404 | No | Referenced entity doesn't exist |
| PERMISSION_DENIED | 403 | No | Insufficient permissions |
| PROVIDER_ERROR | 502 | Varies | AI provider error |
| INTERNAL_ERROR | 500 | No | Unexpected error |

## Appendix C: Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| ANTHROPIC_API_KEY | Yes* | - | Anthropic API key |
| HELIOS_ACP_API_KEY | No | - | Fallback ACP key |
| HELIOS_DEFAULT_MODEL | No | claude-sonnet-4-20250514 | Default model |
| ANTHROPIC_BASE_URL | No | https://api.anthropic.com | API base URL |
| NODE_ENV | No | production | Environment mode |
| HELIOS_LOG_LEVEL | No | info | Logging level |
| HELIOS_DATA_DIR | No | ~/.helios | Data directory |

## Appendix D: File Locations

| Purpose | Path |
|---------|------|
| Settings | `~/.helios/settings.json` |
| Workspaces | `~/.helios/workspaces/` |
| Audit DB | `~/.helios/audit.db` |
| Logs | `~/.helios/logs/` |
| Checkpoints | `~/.helios/checkpoints/` |
| Models (local) | `~/.helios/models/` |
| Provider configs | `~/.helios/providers/` |
| Secrets | `~/.helios/secrets/` (encrypted) |
| Cache | `~/.helios/cache/` |
| Temp | `~/.helios/tmp/` |

## Appendix E: State Machine Detailed Specifications

### E.1 Lane State Machine Complete Definition

```typescript
// Lane state transition table
const LANE_TRANSITIONS = {
  idle: {
    CREATE: {
      target: 'creating',
      guards: ['workspaceExists', 'nameValid'],
      actions: ['logCreateAttempt'],
    },
  },
  
  creating: {
    PROVISIONED: {
      target: 'active',
      actions: ['emitLaneCreated', 'startHeartbeat'],
    },
    FAILED: {
      target: 'failed',
      actions: ['logError', 'cleanupPartial'],
    },
  },
  
  active: {
    PAUSE: {
      target: 'paused',
      actions: ['suspendProcesses', 'saveCheckpoint'],
    },
    CLEANUP: {
      target: 'cleanup',
      guards: ['noActiveSessions'],
      actions: ['notifyCleanupStart'],
    },
    CRASH: {
      target: 'failed',
      actions: ['captureCrashDump', 'notifyFailure'],
    },
  },
  
  paused: {
    RESUME: {
      target: 'active',
      actions: ['restoreProcesses', 'loadCheckpoint'],
    },
    CLEANUP: {
      target: 'cleanup',
      actions: ['cleanupFromPaused'],
    },
  },
  
  cleanup: {
    COMPLETED: {
      target: 'closed',
      actions: ['emitLaneClosed', 'archiveMetrics', 'cleanupResources'],
    },
    FAILED: {
      target: 'failed',
      actions: ['escalateCleanup', 'notifyAdmin'],
    },
  },
  
  failed: {
    RETRY: {
      target: 'cleanup',
      guards: ['retryCountBelowMax'],
      actions: ['incrementRetryCount', 'emitRetryAttempt'],
    },
    FORCE_CLOSE: {
      target: 'cleanup',
      actions: ['forceTerminate', 'emitForceClose'],
    },
  },
  
  closed: {},  // Final state
  terminated: {},  // Final state
} as const;

// Lane state entry actions
const LANE_ENTRY_ACTIONS = {
  creating: [
    'provisionWorktree',
    'bindParTask',
    'initializeLaneState',
    'createZellijSession',
  ],
  
  active: [
    'emitLaneCreated',
    'startHeartbeatMonitoring',
    'enableCommandProcessing',
    'restoreFromCheckpointIfExists',
  ],
  
  paused: [
    'suspendAllProcesses',
    'saveFullCheckpoint',
    'notifyUsersOfPause',
    'disableCommandProcessing',
  ],
  
  cleanup: [
    'terminateAllPtys',
    'terminateZellijSession',
    'cleanupWorktree',
    'unbindParTask',
    'archiveConversations',
    'cleanupSharedSessions',
  ],
  
  closed: [
    'emitLaneClosed',
    'archiveFinalMetrics',
    'cleanupTemporaryFiles',
    'notifyCleanupComplete',
  ],
  
  failed: [
    'captureFailureState',
    'logFailureDetails',
    'notifyStakeholders',
    'scheduleRetryOrCleanup',
  ],
} as const;

// Lane state exit actions
const LANE_EXIT_ACTIONS = {
  active: [
    'stopHeartbeatMonitoring',
    'disableCommandProcessing',
  ],
  
  paused: [
    'resumeAllProcesses',
    'enableCommandProcessing',
  ],
  
  creating: [
    'cleanupOnFailureIfNeeded',
  ],
} as const;
```

### E.2 Session State Machine Complete Definition

```typescript
const SESSION_TRANSITIONS = {
  created: {
    ATTACH: {
      target: 'attaching',
      guards: ['laneExists', 'laneAcceptsSessions'],
      actions: ['logAttachAttempt'],
    },
    TERMINATE: {
      target: 'terminated',
      actions: ['cleanupSession', 'emitSessionTerminated'],
    },
  },
  
  attaching: {
    READY: {
      target: 'attached',
      guards: ['resourcesAllocated', 'laneBindingSuccessful'],
      actions: ['emitSessionAttached', 'startHeartbeats', 'enableCommands'],
    },
    TIMEOUT: {
      target: 'failed',
      actions: ['releaseResources', 'logTimeout', 'notifyFailure'],
    },
    REJECTED: {
      target: 'detached',
      actions: ['queueForRetry', 'notifyRejection'],
    },
    FAILED: {
      target: 'failed',
      actions: ['releaseResources', 'logFailure'],
    },
  },
  
  attached: {
    DETACH: {
      target: 'detaching',
      guards: ['noPendingCommands'],
      actions: ['notifyDetachStart', 'startGracefulShutdown'],
    },
    TERMINATE: {
      target: 'terminated',
      actions: ['gracefulShutdown', 'cleanupSession', 'emitTerminated'],
    },
    HEARTBEAT_TIMEOUT: {
      target: 'failed',
      actions: ['markUnhealthy', 'notifyTimeout', 'cleanupSession'],
    },
    CONNECTION_LOST: {
      target: 'detaching',
      actions: ['handleDisconnect', 'startReconnectionTimer'],
    },
  },
  
  detaching: {
    FLUSHED: {
      target: 'detached',
      actions: ['confirmDetach', 'cleanupResources', 'emitDetached'],
    },
    FORCE: {
      target: 'detached',
      guards: ['forceAllowed'],
      actions: ['forceDetach', 'discardBuffers', 'emitForceDetached'],
    },
    TIMEOUT: {
      target: 'detached',
      actions: ['forceAfterTimeout', 'emitForceDetached'],
    },
  },
  
  detached: {
    REATTACH: {
      target: 'attaching',
      actions: ['logReattachAttempt', 'restoreSessionState'],
    },
    TERMINATE: {
      target: 'terminated',
      actions: ['finalCleanup', 'emitTerminated'],
    },
    EXPIRE: {
      target: 'terminated',
      guards: ['idleTimeExceeded'],
      actions: ['expireSession', 'emitExpired'],
    },
  },
  
  failed: {
    RETRY: {
      target: 'attaching',
      guards: ['retryAllowed', 'retryCountBelowMax'],
      actions: ['incrementRetryCount', 'logRetryAttempt'],
    },
    GIVE_UP: {
      target: 'terminated',
      actions: ['finalCleanup', 'emitTerminated'],
    },
  },
  
  terminated: {},  // Final state
} as const;
```

### E.3 PTY State Machine Complete Definition

```typescript
const PTY_TRANSITIONS = {
  idle: {
    SPAWN: {
      target: 'spawning',
      guards: ['shellValid', 'cwdExists', 'permissionsOk'],
      actions: ['logSpawnAttempt', 'reserveResources'],
    },
  },
  
  spawning: {
    READY: {
      target: 'active',
      guards: ['processSpawned', 'ptyCreated'],
      actions: ['emitSpawned', 'startOutputStreaming', 'enableInput'],
    },
    ERROR: {
      target: 'errored',
      actions: ['logSpawnFailure', 'releaseResources', 'notifyFailure'],
    },
    TIMEOUT: {
      target: 'errored',
      actions: ['killOrphanedProcess', 'logTimeout', 'releaseResources'],
    },
  },
  
  active: {
    THROTTLE: {
      target: 'throttled',
      guards: ['backpressureDetected'],
      actions: ['enableBackpressure', 'notifyConsumers'],
    },
    RESIZE: {
      target: 'active',  // Self-transition
      actions: ['sendSigwinch', 'updateDimensions'],
    },
    INPUT: {
      target: 'active',  // Self-transition
      actions: ['writeToPty', 'resetIdleTimer'],
    },
    SIGNAL: {
      target: 'active',  // Self-transition
      actions: ['deliverSignal'],
    },
    STOP: {
      target: 'stopped',
      guards: ['gracefulStopAllowed'],
      actions: ['initiateGracefulStop', 'notifyStopping'],
    },
    KILL: {
      target: 'stopped',
      actions: ['forceKill', 'emitKilled'],
    },
    ERROR: {
      target: 'errored',
      actions: ['logError', 'notifyError'],
    },
    PROCESS_EXIT: {
      target: 'stopped',
      actions: ['handleProcessExit', 'emitStopped'],
    },
  },
  
  throttled: {
    DRAIN: {
      target: 'active',
      guards: ['bufferBelowThreshold'],
      actions: ['disableBackpressure', 'resumeStreaming'],
    },
    STOP: {
      target: 'stopped',
      actions: ['stopFromThrottled', 'cleanup'],
    },
    KILL: {
      target: 'stopped',
      actions: ['forceKill', 'cleanup'],
    },
  },
  
  errored: {
    RETRY: {
      target: 'spawning',
      guards: ['retryAllowed', 'retryCountBelowMax'],
      actions: ['incrementRetryCount', 'logRetry'],
    },
    GIVE_UP: {
      target: 'stopped',
      actions: ['finalCleanup', 'emitStopped'],
    },
    FORCE_STOP: {
      target: 'stopped',
      actions: ['forceCleanup', 'emitStopped'],
    },
  },
  
  stopped: {},  // Final state
} as const;
```

## Appendix F: Detailed Protocol Schemas

### F.1 JSON Schema for CommandEnvelope

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "heliosApp/schemas/command-envelope",
  "title": "CommandEnvelope",
  "type": "object",
  "required": ["id", "correlation_id", "type", "method", "payload", "context", "timestamp"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^env_[0-9A-Z]{26}$",
      "description": "Unique envelope ID with env_ prefix"
    },
    "correlation_id": {
      "type": "string",
      "pattern": "^cor_[0-9A-Z]{26}$",
      "description": "Correlation ID linking to events/responses"
    },
    "type": {
      "type": "string",
      "enum": ["command"],
      "description": "Envelope type discriminator"
    },
    "method": {
      "type": "string",
      "description": "Registered method name",
      "examples": ["terminal.spawn", "session.attach", "lane.create"]
    },
    "payload": {
      "type": "object",
      "description": "Method-specific payload"
    },
    "context": {
      "type": "object",
      "properties": {
        "workspace_id": {
          "type": "string",
          "pattern": "^ws_[0-9A-Z]{26}$"
        },
        "lane_id": {
          "type": "string",
          "pattern": "^ln_[0-9A-Z]{26}$"
        },
        "session_id": {
          "type": "string",
          "pattern": "^ss_[0-9A-Z]{26}$"
        },
        "terminal_id": {
          "type": "string",
          "pattern": "^tm_[0-9A-Z]{26}$"
        }
      }
    },
    "timestamp": {
      "type": "integer",
      "minimum": 1609459200000,
      "description": "Unix timestamp in milliseconds"
    }
  }
}
```

### F.2 JSON Schema for EventEnvelope

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "heliosApp/schemas/event-envelope",
  "title": "EventEnvelope",
  "type": "object",
  "required": ["id", "type", "topic", "payload", "context", "timestamp", "sequence"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^evt_[0-9A-Z]{26}$"
    },
    "correlation_id": {
      "type": "string",
      "pattern": "^cor_[0-9A-Z]{26}$"
    },
    "type": {
      "type": "string",
      "enum": ["event"]
    },
    "topic": {
      "type": "string",
      "description": "Registered topic name"
    },
    "payload": {
      "type": "object"
    },
    "context": {
      "type": "object"
    },
    "timestamp": {
      "type": "integer"
    },
    "sequence": {
      "type": "integer",
      "minimum": 1,
      "description": "Monotonically increasing sequence number per topic"
    }
  }
}
```

### F.3 JSON Schema for ResponseEnvelope

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "heliosApp/schemas/response-envelope",
  "title": "ResponseEnvelope",
  "type": "object",
  "required": ["id", "correlation_id", "type", "status", "timestamp"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^rsp_[0-9A-Z]{26}$"
    },
    "correlation_id": {
      "type": "string",
      "pattern": "^cor_[0-9A-Z]{26}$"
    },
    "type": {
      "type": "string",
      "enum": ["response"]
    },
    "status": {
      "type": "string",
      "enum": ["success", "error"]
    },
    "result": {
      "type": "object",
      "description": "Present when status is success"
    },
    "error": {
      "type": "object",
      "required": ["code", "message", "retryable"],
      "properties": {
        "code": {
          "type": "string",
          "enum": ["VALIDATION_ERROR", "METHOD_NOT_FOUND", "HANDLER_ERROR", "TIMEOUT", "BACKPRESSURE", "INVALID_STATE_TRANSITION", "ENTITY_NOT_FOUND", "PERMISSION_DENIED", "PROVIDER_ERROR", "INTERNAL_ERROR"]
        },
        "message": {
          "type": "string"
        },
        "retryable": {
          "type": "boolean"
        },
        "details": {
          "type": "object"
        }
      }
    },
    "timestamp": {
      "type": "integer"
    }
  }
}
```

## Appendix G: Provider Capability Matrix

| Provider | Models | Context Window | Tool Use | Vision | Streaming | Local | GPU |
|----------|--------|----------------|----------|--------|-----------|-------|-----|
| Anthropic Claude 3 Opus | claude-3-opus | 200K | Yes | Yes | Yes | No | N/A |
| Anthropic Claude 3 Sonnet | claude-3-sonnet | 200K | Yes | Yes | Yes | No | N/A |
| Anthropic Claude 3 Haiku | claude-3-haiku | 200K | Yes | Yes | Yes | No | N/A |
| MLX Llama 3.2 3B | mlx-community/Llama-3.2-3B | 128K | No | No | Yes | Yes | Apple |
| MLX Mistral 7B | mlx-community/Mistral-7B | 32K | No | No | Yes | Yes | Apple |
| llama.cpp Llama 3 70B | various | 8K-128K | Varies | Varies | Yes | Yes | NVIDIA |
| llama.cpp CodeLlama 34B | various | 16K | Varies | No | Yes | Yes | NVIDIA |

## Appendix H: Settings Schema

```typescript
interface AppSettings {
  // General
  theme: 'light' | 'dark' | 'system';
  language: string;
  
  // Terminal
  defaultShell: string;
  scrollbackLines: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  
  // Provider
  defaultProvider: string;
  defaultModel: string;
  fallbackProvider?: string;
  
  // Renderer
  rendererEngine: 'ghostty' | 'rio';
  rendererHotSwap: boolean;
  
  // Performance
  maxConcurrentTerminals: number;
  outputBufferSize: number;
  throttleThreshold: number;
  
  // Security
  redactionEnabled: boolean;
  customRedactionPatterns: string[];
  protectedPaths: string[];
  
  // Audit
  auditEnabled: boolean;
  auditRetentionDays: number;
  
  // Advanced
  enableExperimentalFeatures: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  developerMode: boolean;
}
```

## Appendix I: Change Log

| Version | Date | Changes |
|---------|------|---------|
| 2026.03A.0 | 2026-03-26 | Initial specification |
| 2026.03A.1 | 2026-03-27 | Added detailed state machines, protocol schemas |

---

*End of Specification*
