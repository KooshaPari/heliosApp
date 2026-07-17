# Agent Context

## Active Technologies
- Pending update by spec-kitty agent context tooling.

- TypeScript (TS-native track, Bun runtime), Python 3.14+/PyPy 3.11 for supporting tooling where needed + Bun, runtime protocol bus in `apps/runtime/src/protocol/`, Codex CLI integration, `cliproxyapi++` harness bridge (001-colab-agent-terminal-control-plane)
- In-memory for this vertical slice (Codex session IDs used for continuity); durable persistence deferred to later increment (001-colab-agent-terminal-control-plane)
## Recent Changes
- 001-colab-agent-terminal-control-plane: Added TypeScript (TS-native track, Bun runtime), Python 3.14+/PyPy 3.11 for supporting tooling where needed + Bun, runtime protocol bus in `apps/runtime/src/protocol/`, Codex CLI integration, `cliproxyapi++` harness bridge
- Pending update by spec-kitty agent context tooling.
<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->


## Review Bot Governance

- Keep CodeRabbit PR blocking at the lowest level in `.coderabbit.yaml`: `pr_validation.block_on.severity: info`.
- Keep Gemini Code Assist severity at the lowest level in `.gemini/config.yaml`: `code_review.comment_severity_threshold: LOW`.
- Retrigger commands:
  - CodeRabbit: comment `@coderabbitai full review` on the PR.
  - Gemini Code Assist (when enabled in the repo): comment `@gemini-code-assist review` on the PR.
  - If comment-trigger is unavailable, retrigger both bots by pushing a no-op commit to the PR branch.
- Rate-limit discipline:
  - Use a FIFO queue for retriggers (oldest pending PR first).
  - Minimum spacing: one retrigger comment every 120 seconds per repo.
  - On rate-limit response, stop sending new triggers in that repo, wait 15 minutes, then resume queue processing.
  - Do not post duplicate trigger comments while a prior trigger is pending.

