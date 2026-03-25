---
work_package_id: WP04
title: Constitution + MLX ADR
lane: "done"
dependencies: []
subtasks: [T019, T020, T021, T022, T023, T024]
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-02-28'
  action: created
  agent: claude-opus
---

# WP04: Constitution + MLX ADR

## Objective

Create the project constitution (CONSTITUTION.md) encoding non-negotiable toolchain decisions and an Architecture Decision Record (ADR) evaluating MLX vs llama.cpp for local inference.

## Context

- **Constitution pattern**: Phenotype repos use CLAUDE.md for agent governance; CONSTITUTION.md is the project-level governance doc encoding immutable toolchain decisions
- **Sibling conventions**: bun runtime, Biome (lineWidth: 100), vitest, Taskfile.yml, strict TypeScript
- **MLX research**: MLX gives ~53% faster inference on Apple Silicon (unified memory, zero-copy); llama.cpp requires C++ toolchain (cmake + zig)
- **MLX.zig bindings**: Available at github.com/jaco-bro/MLX.zig (March 2025)
- **llama.cpp.zig bindings**: Available at github.com/Deins/llama.cpp.zig (mature)
- **Recommendation**: MLX primary on Apple Silicon + llama.cpp fallback on other platforms

## Implementation Command

```bash
spec-kitty implement WP04 --base WP01
```

---

## Subtask T019: Create CONSTITUTION.md

**Purpose**: Establish the governance document structure.

**Steps**:
1. Create `CONSTITUTION.md` at repo root
2. Add header and purpose statement:
   ```markdown
   # Co(lab) Project Constitution

   Non-negotiable toolchain and architecture decisions for the co(lab) desktop application.
   Changes to this document require explicit team consensus.
   ```
3. Add table of contents with sections: Runtime, Testing, Formatting, Task Runner, Quality Lanes, Library Preferences, Architecture Principles, Performance Targets

**Files**: `CONSTITUTION.md` (new, target < 200 lines)

**Validation**:
- [ ] File exists at repo root
- [ ] Has clear structure with section headers

---

## Subtask T020: Document runtime + testing + formatting decisions

**Purpose**: Encode the core toolchain stack.

**Steps**:
1. Add Runtime section:
   ```markdown
   ## Runtime
   - **Runtime**: Bun (current: 1.2.20+)
   - **Desktop framework**: ElectroBun (Zig-based, 12MB base)
   - **Language**: TypeScript 5.4+ with `strict: true`
   - **Target**: ES2022, Bundler module resolution
   ```
2. Add Testing section:
   ```markdown
   ## Testing
   - **Framework**: Vitest
   - **Command**: `task test` or `bunx vitest run`
   - **Coverage**: Required for new modules
   ```
3. Add Formatting section:
   ```markdown
   ## Formatting & Linting
   - **Tool**: Biome
   - **Line width**: 100 characters
   - **Indent**: 2 spaces (tabs forbidden)
   - **Config**: `biome.json` at repo root
   ```

**Files**: `CONSTITUTION.md` (extend)

**Validation**:
- [ ] Runtime, Testing, Formatting sections present and accurate

---

## Subtask T021: Document library preferences + bun builtins policy

**Purpose**: Establish dependency guidelines.

**Steps**:
1. Add Library Preferences section:
   ```markdown
   ## Library Preferences
   - **Prefer bun builtins** over npm packages for: filesystem ops (Bun.file, Bun.write), HTTP (fetch), subprocess (Bun.spawn), testing (vitest with bun)
   - **Prefer node: imports** over npm shims: `node:fs`, `node:path`, `node:crypto`
   - **Forbidden**: Dependencies that duplicate bun/node builtins (e.g., fs-extra, node-fetch, cross-env)
   - **Required review**: Any new dependency > 100KB or with > 5 transitive deps
   ```

**Files**: `CONSTITUTION.md` (extend)

**Validation**:
- [ ] Library preferences section present
- [ ] Bun builtins policy clearly stated

---

## Subtask T022: Document architecture principles

**Purpose**: Encode structural decisions.

**Steps**:
1. Add Architecture section:
   ```markdown
   ## Architecture Principles
   - **Feature flags**: Use `HELIOS_SURFACE_EDITOR` build var for mode switching
   - **RPC pattern**: ElectroBun RPCSchema — `bun.requests` (renderer→main), `webview.messages` (main→renderer)
   - **State management**: Bus-driven state machine (LocalBus + InMemoryLocalBus)
   - **Worktree discipline**: Canonical folders on `main` only; feature work in `-wtrees/` directories
   - **File size**: Target ≤ 350 lines per file; ≤ 500 hard limit
   ```
2. Add Task Runner section:
   ```markdown
   ## Task Runner
   - **Tool**: Taskfile.yml (go-task v3.x)
   - **Quality lanes**: quality, quality:quick, quality:ci, quality:pre-push, quality:release-lint
   - **Alias**: `check` → `quality`
   - **CI gate**: `task quality:ci` (non-mutating)
   ```
3. Add Performance Targets section:
   ```markdown
   ## Performance Targets
   - **App binary**: ≤ 25MB base (ElectroBun target)
   - **Dev build**: < 10 seconds
   - **Test suite**: < 30 seconds
   - **Inference TTFT**: < 100ms (MLX), < 200ms (llama.cpp fallback)
   ```

**Files**: `CONSTITUTION.md` (extend)

**Validation**:
- [ ] Architecture, Task Runner, Performance sections present
- [ ] Total file < 200 lines

---

## Subtask T023: Create docs/adr/001-mlx-inference-evaluation.md

**Purpose**: Create the ADR evaluating MLX vs llama.cpp.

**Steps**:
1. Create `docs/adr/` directory if it doesn't exist
2. Create `001-mlx-inference-evaluation.md` with ADR format:
   ```markdown
   # ADR 001: MLX as Primary Inference Engine

   ## Status
   Proposed

   ## Context
   Co(lab) vendors llama.cpp for local LLM inference, requiring a C++ toolchain
   (cmake + zig) for builds. Apple's MLX framework offers native Apple Silicon
   support with unified memory and ~53% faster inference.

   ## Decision
   Adopt MLX as the primary inference engine on macOS Apple Silicon.
   Retain llama.cpp as fallback for non-Apple platforms.

   ## Consequences
   ...
   ```

**Files**: `docs/adr/001-mlx-inference-evaluation.md` (new)

**Validation**:
- [ ] ADR file exists with proper format
- [ ] Status is "Proposed" (not accepted — this is evaluation only)

---

## Subtask T024: Document MLX migration path + fallback strategy

**Purpose**: Complete the ADR with technical details.

**Steps**:
1. Add Performance Comparison section:
   ```markdown
   ## Performance Comparison

   | Metric | MLX | llama.cpp (Metal) |
   |--------|-----|-------------------|
   | Token generation | ~230 tok/s | ~150 tok/s |
   | Time to first token | 50-100ms | 100-150ms |
   | Model loading | 5-10s | 30s+ |
   | Memory overhead | Minimal (unified) | Higher (copy overhead) |
   | Binary size | ~12-18MB | ~5-8MB |
   ```

2. Add Integration Surface section listing files that interact with llama.cpp:
   - `setup-deps.ts` (vendoring + cmake build)
   - `postBuild.ts` (zig build of llama CLI)
   - Any inference API call sites

3. Add Migration Path:
   ```markdown
   ## Migration Path
   1. Add MLX.zig bindings (github.com/jaco-bro/MLX.zig)
   2. Create unified inference interface (strategy pattern)
   3. Implement MLX backend behind interface
   4. Runtime detection: Apple Silicon → MLX, else → llama.cpp
   5. Deprecate direct llama.cpp calls, route through interface
   ```

4. Add Fallback Strategy:
   ```markdown
   ## Fallback Strategy
   - Primary: MLX on Apple Silicon (M1+)
   - Fallback: llama.cpp with Metal backend on older Macs
   - Fallback: llama.cpp with CPU backend on non-Apple platforms
   - Detection: Check `process.arch` and `process.platform` at startup
   ```

5. Add Risks and Open Questions

**Files**: `docs/adr/001-mlx-inference-evaluation.md` (extend)

**Validation**:
- [ ] Performance comparison table present with cited numbers
- [ ] Integration surface identified (list of files)
- [ ] Migration path is step-by-step
- [ ] Fallback strategy covers all platforms

---

## Definition of Done

- [ ] `CONSTITUTION.md` exists at repo root, < 200 lines
- [ ] Covers: Runtime, Testing, Formatting, Task Runner, Quality Lanes, Library Preferences, Architecture, Performance Targets
- [ ] `docs/adr/001-mlx-inference-evaluation.md` exists with full ADR
- [ ] ADR covers: performance comparison, integration surface, migration path, fallback strategy
- [ ] Both documents are well-formatted and actionable

## Risks

- **Constitution scope creep**: Keep it under 200 lines. Be concise — link to ADRs for detailed rationale.
- **MLX evaluation accuracy**: Numbers are from research (Feb 2025). Note that benchmarks may vary by model size and hardware generation.

## Reviewer Guidance

- Verify CONSTITUTION.md is consistent with sibling Phenotype repos (heliosApp, clipproxyapi++)
- Check that MLX performance numbers cite sources
- Ensure fallback strategy covers all deployment targets
- Constitution should NOT contain implementation details — only decisions and principles


## Activity Log

- 2026-02-28T12:35:25Z – unknown – lane=done – Implemented, PR #6 created
