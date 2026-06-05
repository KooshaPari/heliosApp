# MVP Agent IDE Chat + Terminal Journey Manifest

## Status

Stub: evidence capture required.

## Journey

- **Journey ID:** UJ-6
- **Title:** MVP Agent IDE Chat + Terminal Workspace
- **Actor:** User operating heliosApp as a terminal-first agent IDE
- **Source gap:** `/USER_JOURNEYS.md` lists UJ-1 through UJ-5, but none
  cover the core product flow in `/SPEC.md` and
  `/FUNCTIONAL_REQUIREMENTS.md`.

## Requirement Coverage

- `FR-MVP-001` through `FR-MVP-027`: persistent chat, streaming
  responses, inline tool calls, cancellation, PTY terminals,
  persistence, providers, lanes, sidebar, center chat panel, input
  controls, terminal panels, keyboard shortcuts.
- `FR-SHL-003`: terminal-first default layout with split panes, tab bar,
  and sidebar.
- `FR-TAB-001` through `FR-TAB-007`: terminal/agent/session/chat/project
  tabs bound to workspace, lane, and session context.
- `FR-LST-001` through `FR-LST-007`: lane list status display and
  keyboard navigation.

## Intended Evidence

| Evidence item | Status |
| --- | --- |
| Keyframes under `docs/journeys/keyframes/` | Missing |
| Recording under `docs/journeys/recordings/` | Missing |
| Verification log under `docs/journeys/evidence/` | Missing |

## Acceptance Trace

A complete evidence capture should show:

1. User opens heliosApp to the terminal-first desktop shell.
2. Sidebar shows workspace/lane navigation and conversation history.
3. User sends a prompt in the chat input.
4. Agent response streams in the center chat panel.
5. Tool calls appear inline.
6. Integrated terminal panel is spawned or attached to the active
   workspace/lane/session.
7. Lane/session/tab context changes keep visible surfaces synchronized.
8. User cancels or interrupts an in-progress agent action.
9. App restart or session restore preserves conversation, settings, and
   lane/session state.

## Verification Command

Run the eventual journey verifier when evidence files exist:

```bash
phenotype-journey verify docs/journeys/manifests/mvp-agent-ide-chat-terminal.md
```

Until keyframes and a recording are attached, this manifest is
intentionally not marked complete.
