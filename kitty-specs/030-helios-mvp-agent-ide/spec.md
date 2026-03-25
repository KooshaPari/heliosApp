# Feature Specification: Helios MVP Agent IDE

**Feature Branch**: `030-helios-mvp-agent-ide`
**Created**: 2026-03-01
**Status**: Draft
**Input**: Transform the helios debug dashboard into a production-quality agent-first desktop IDE

## User Scenarios & Testing

### User Story 1 - Chat with an AI Agent (Priority: P1)

A developer opens Helios and immediately sees a chat interface. They type a natural language prompt describing what they want to build or fix. The agent responds with a plan, begins executing tool calls (file edits, terminal commands), and streams results back in real time. The developer can see the agent's reasoning, approve or reject individual actions, and provide follow-up instructions.

**Why this priority**: The core value proposition of an agent-first IDE is the conversational coding experience. Without a working chat loop, nothing else matters.

**Independent Test**: Open the app, type "Create a hello world Express server", and observe the agent respond with a plan, create files, and run the server — all visible in the chat panel.

**Acceptance Scenarios**:

1. **Given** the app is open with no active conversation, **When** the user types a prompt and presses Enter, **Then** the agent begins responding within 2 seconds with visible streaming text
2. **Given** an active conversation, **When** the agent proposes a file edit, **Then** the user sees the proposed change with accept/reject controls
3. **Given** an active conversation, **When** the agent executes a terminal command, **Then** the command output streams into an embedded terminal panel
4. **Given** an active conversation, **When** the user sends a follow-up message, **Then** the agent responds with context from the full conversation history
5. **Given** no API key configured, **When** the user tries to chat, **Then** a clear setup prompt guides them to configure their inference provider

---

### User Story 2 - Integrated Terminal with Agent Awareness (Priority: P1)

A developer can open one or more terminal panels within the IDE. Terminals are real PTY sessions running the user's preferred shell. The agent can read terminal output and execute commands in these terminals. The developer can also use terminals manually, independently of the agent.

**Why this priority**: Terminal access is fundamental to any development workflow. Agent-driven terminal commands are a core differentiator.

**Independent Test**: Open a terminal tab, run `ls`, see output. Then ask the agent "run the tests" and see it execute in the same or new terminal.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user opens a terminal panel, **Then** a real shell session starts with the user's default shell and working directory
2. **Given** an active terminal, **When** the user types commands, **Then** output renders correctly including colors, cursor positioning, and scrollback
3. **Given** an active agent conversation, **When** the agent needs to run a command, **Then** it executes in a visible terminal and the user sees the output in real time
4. **Given** multiple terminals open, **When** the user switches between them, **Then** each terminal retains its state and scrollback history

---

### User Story 3 - Conversation History and Session Persistence (Priority: P2)

A developer can view their past conversations in a sidebar, resume any previous conversation, and start new ones. Conversations persist across app restarts. Each conversation retains its full message history, associated files, and terminal state.

**Why this priority**: Session continuity prevents lost context and enables long-running development workflows.

**Independent Test**: Start a conversation, close the app, reopen it, and see the conversation in the sidebar with full history intact.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user looks at the left sidebar, **Then** they see a list of past conversations ordered by most recent
2. **Given** a list of conversations, **When** the user clicks one, **Then** the full conversation history loads in the chat panel
3. **Given** an active conversation, **When** the app is closed and reopened, **Then** the conversation appears in the sidebar and can be resumed
4. **Given** multiple conversations, **When** the user starts a new conversation, **Then** a new entry appears at the top of the sidebar

---

### User Story 4 - Model Selection and Inference Provider Configuration (Priority: P2)

A developer can choose which AI model powers the agent — local models on their own hardware or cloud-hosted models. The app auto-detects available hardware (Apple Silicon GPU, NVIDIA GPU) and suggests the optimal provider. Users can switch models mid-conversation or set a default.

**Why this priority**: Flexibility in model choice is a key differentiator over locked-in products. Supporting local inference enables offline use and privacy-sensitive workflows.

**Independent Test**: Open settings, see detected hardware capabilities, select a local model, and verify the agent responds using local inference.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user clicks the model selector in the chat input area, **Then** they see available models grouped by provider (local vs cloud)
2. **Given** Apple Silicon hardware, **When** the app starts, **Then** local models are available for selection with estimated performance
3. **Given** NVIDIA GPU hardware (via WSL2/Linux), **When** the app starts, **Then** GPU-accelerated models are available for selection
4. **Given** no GPU hardware, **When** the app starts, **Then** CPU-based local models and cloud models are available with performance warnings
5. **Given** an active conversation, **When** the user switches models, **Then** subsequent messages use the new model while history is preserved

---

### User Story 5 - Multiplexer Session Management (Priority: P3)

A developer working on complex tasks can create multiple isolated workspaces (lanes), each with their own terminal sessions, git worktrees, and agent context. They can switch between lanes or share terminal sessions with collaborators via upterm or tmate.

**Why this priority**: Multi-lane workflows enable parallel development tasks and collaboration, but are not required for basic single-task usage.

**Independent Test**: Create a second lane, see it appear in the lane list, switch to it, and verify it has independent terminal and agent state.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user creates a new lane, **Then** a new isolated workspace is provisioned with its own terminal and session
2. **Given** multiple lanes, **When** the user switches between them, **Then** each lane shows its own terminal state, conversation, and file context
3. **Given** an active terminal, **When** the user initiates session sharing, **Then** a shareable link is generated and displayed for collaborators
4. **Given** a shared session, **When** a collaborator connects, **Then** both users see the same terminal in real time

---

### User Story 6 - File Context and Code Review (Priority: P3)

A developer can see which files the agent is reading or modifying in a side panel. When the agent proposes changes, the developer sees a diff view. They can approve changes file-by-file or request modifications.

**Why this priority**: Visibility into agent actions builds trust and enables meaningful code review within the IDE.

**Independent Test**: Ask the agent to modify a file, see the diff in the review panel, approve it, and verify the file is updated.

**Acceptance Scenarios**:

1. **Given** an active agent conversation, **When** the agent reads a file, **Then** the file appears in the context panel with a "reading" indicator
2. **Given** the agent proposes a file change, **When** the change is ready, **Then** a diff view shows additions and deletions clearly
3. **Given** a proposed change, **When** the user approves it, **Then** the file is written to disk and the agent continues
4. **Given** a proposed change, **When** the user rejects it, **Then** the agent acknowledges and offers alternatives

---

### Edge Cases

- What happens when the inference provider is unreachable mid-conversation? The app displays a connection error with retry options and suggests switching to a local model.
- What happens when a terminal process hangs? The user can force-kill the terminal and spawn a new one without losing conversation history.
- What happens when the app crashes during a file write? Pending changes are stored in a write-ahead log and recovered on restart.
- What happens when local model download is interrupted? Partial downloads are resumed from where they left off.
- What happens when disk space is insufficient for local models? The app warns before download and suggests cloud alternatives.

## Requirements

### Functional Requirements

**Chat and Agent Loop**:
- **FR-001**: System MUST provide a persistent chat interface where users can send natural language prompts
- **FR-002**: System MUST stream agent responses in real time with visible token-by-token rendering
- **FR-003**: System MUST display the agent's tool calls (file reads, writes, terminal commands) inline in the chat
- **FR-004**: System MUST support multi-turn conversations with full context retention
- **FR-005**: System MUST allow users to interrupt or cancel an in-progress agent action

**Terminal**:
- **FR-010**: System MUST spawn real PTY shell sessions using the user's default shell
- **FR-011**: System MUST render terminal output with full ANSI color and cursor support
- **FR-012**: System MUST support multiple concurrent terminal instances
- **FR-013**: System MUST allow the agent to execute commands in any open terminal
- **FR-014**: System MUST support terminal resize events

**Persistence**:
- **FR-020**: System MUST persist all conversations across app restarts
- **FR-021**: System MUST persist user settings (preferred model, theme, keybindings)
- **FR-022**: System MUST persist lane and session state for recovery

**Inference**:
- **FR-030**: System MUST support at least one cloud inference provider (Anthropic API)
- **FR-031**: System MUST support local inference on Apple Silicon hardware
- **FR-032**: System MUST support local/server inference on NVIDIA GPU hardware
- **FR-033**: System MUST auto-detect available hardware capabilities at startup
- **FR-034**: System MUST allow users to switch inference providers without losing conversation state
- **FR-035**: System MUST fall back gracefully when a selected provider becomes unavailable

**Multiplexer**:
- **FR-040**: System MUST support creating isolated workspace lanes with independent state
- **FR-041**: System MUST support terminal session sharing via external tools
- **FR-042**: Muxer dispatch MUST delegate to real adapter implementations (not in-memory tracking only)

**UI Layout**:
- **FR-050**: System MUST provide a left sidebar for conversation history and navigation
- **FR-051**: System MUST provide a center panel for the active chat conversation
- **FR-052**: System MUST provide a bottom input area with model selector and send controls
- **FR-053**: System MUST provide integrated terminal panels (bottom or side)
- **FR-054**: System MUST support keyboard shortcuts for common actions (new chat, toggle terminal, switch tabs)

### Key Entities

- **Conversation**: A sequence of user and agent messages with metadata (created_at, model used, title). Contains Messages and references to Files.
- **Message**: A single turn in a conversation — user prompt, agent response, tool call, or tool result. Has role, content, timestamps.
- **Lane**: An isolated workspace with its own terminal sessions, git context, and agent state. Maps to a physical worktree.
- **Session**: A terminal PTY session within a lane. Has shell type, working directory, scrollback buffer.
- **InferenceProvider**: A configured backend for model inference — cloud API endpoint or local runtime. Has type, endpoint, models, health status.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can send a prompt and receive a streaming agent response within 3 seconds on cloud inference, within 5 seconds on local inference
- **SC-002**: Terminal sessions launch and display first output within 1 second
- **SC-003**: Conversations persist and are fully recoverable after app restart — 100% data retention
- **SC-004**: The app binary remains under 25MB base size (excluding downloaded models)
- **SC-005**: Users can complete a basic coding task (create a file, run it, iterate) entirely through chat in under 5 minutes
- **SC-006**: The app functions with no internet connection when a local model is configured
- **SC-007**: 90% of first-time users can start their first agent conversation without consulting documentation

## Assumptions

- Users have Bun 1.2.20+ installed on their system
- The Anthropic API key is provided by the user (no bundled keys)
- Local model weights are downloaded separately (not bundled with the app)
- The initial release targets macOS; Windows/Linux support follows
- ElectroBun provides sufficient webview capabilities for the SolidJS-based UI
- Users are developers comfortable with terminal-based workflows

## Out of Scope

- Code editor with syntax highlighting (future feature — focus is agent chat + terminal for MVP)
- Git integration UI (lanes use git worktrees internally but no GUI for git operations)
- Plugin/extension marketplace
- Team collaboration features beyond terminal sharing
- Mobile or web deployment
- Model fine-tuning or training
