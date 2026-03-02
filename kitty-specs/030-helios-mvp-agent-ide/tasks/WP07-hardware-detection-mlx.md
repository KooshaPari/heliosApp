---
work_package_id: WP07
title: Hardware Detection and MLX Adapter
lane: "done"
dependencies: []
base_branch: main
base_commit: 566ba40040cf864c37996abe8aa5df8c6f54018b
created_at: '2026-03-01T11:10:53.095532+00:00'
subtasks: [T022, T023, T025]
shell_pid: "71158"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-01'
  action: created
  agent: spec-kitty
---

# WP07: Hardware Detection and MLX Adapter

**Implementation command**: `spec-kitty implement WP07 --base WP01`

## Objective

Create a hardware detection module that identifies available GPU/compute resources. Implement the MLX inference adapter for Apple Silicon. Refactor the existing ACP client and llama.cpp integration to implement the InferenceEngine strategy interface from WP01.

## Context

The InferenceEngine interface and EngineRegistry were created in WP01 (T004). This WP provides concrete implementations.

Existing code:
- `src/helios/runtime/integrations/acp_client/client.ts` — Real Anthropic HTTP client
- `llama-cli/` directory — Contains llama.cpp binary/wrapper
- ADR 001 (`docs/adr/001-mlx-inference-evaluation.md`) — Proposes MLX as primary local inference

## Subtasks

### T022: Create Hardware Detection Module

**Purpose**: Detect available hardware (Apple Silicon, NVIDIA GPU, CPU-only) at app startup.

**Steps**:
1. Create `src/helios/runtime/integrations/inference/hardware.ts`:
   ```typescript
   export interface HardwareCapabilities {
     platform: "darwin" | "linux" | "win32";
     arch: "arm64" | "x64";
     hasAppleSilicon: boolean;
     hasNvidiaGpu: boolean;
     gpuName?: string;
     gpuMemoryMB?: number;
     cpuCores: number;
     ramMB: number;
   }

   export async function detectHardware(): Promise<HardwareCapabilities>;
   ```

2. Detection logic:
   - `hasAppleSilicon`: `process.platform === "darwin" && process.arch === "arm64"`
   - `hasNvidiaGpu`: Run `nvidia-smi --query-gpu=name,memory.total --format=csv,noheader` via Bun.spawn. If exits 0, parse GPU name and memory.
   - CPU cores: `navigator.hardwareConcurrency` or `os.cpus().length`
   - RAM: `os.totalmem()`

3. Cache the result (hardware doesn't change during a session).

**Files**:
- `src/helios/runtime/integrations/inference/hardware.ts` (new, ~60 lines)

**Validation**:
- [ ] On Apple Silicon Mac: `hasAppleSilicon: true`
- [ ] On Linux with NVIDIA: `hasNvidiaGpu: true`, GPU name populated
- [ ] On CPU-only machine: both false, cpuCores populated

---

### T023: Create MLX Inference Adapter

**Purpose**: Implement InferenceEngine for local inference on Apple Silicon via MLX.

**Steps**:
1. Create `src/helios/runtime/integrations/inference/mlx-adapter.ts`:
   - Implements InferenceEngine interface
   - `init()`: Check if `mlx_lm` Python package is available (`python3 -c "import mlx_lm"`)
   - `infer()`: Spawn `python3 -m mlx_lm.generate --model <model> --prompt <prompt>` and capture output
   - `inferStream()`: Use `--streaming` flag if available, yield tokens
   - `listModels()`: Return hardcoded list of known MLX-compatible models (can be extended later)
   - `healthCheck()`: Verify mlx_lm is importable and Apple Silicon is detected
   - `terminate()`: Kill any running inference subprocess

2. Model path configuration:
   - Default model directory: `~/.cache/mlx-models/`
   - User-configurable via settings

3. Error handling:
   - Python not installed: Return "unavailable" from healthCheck
   - mlx_lm not installed: Return "unavailable" with install instructions
   - Model not downloaded: Prompt user to download

**Files**:
- `src/helios/runtime/integrations/inference/mlx-adapter.ts` (new, ~100 lines)

**Validation**:
- [ ] On Apple Silicon with mlx_lm installed: healthCheck returns "healthy"
- [ ] On non-Apple hardware: healthCheck returns "unavailable"
- [ ] Inference produces a response for a simple prompt

---

### T025: Refactor ACP and llama.cpp into Strategy Interface

**Purpose**: Wrap existing AcpClient as an InferenceEngine implementation. Create llama.cpp adapter.

**Steps**:
1. Create `src/helios/runtime/integrations/inference/anthropic-adapter.ts`:
   - Wraps existing AcpClient from `acp_client/client.ts`
   - `init()`: Validates endpoint and API key
   - `infer()`: Delegates to `acpClient.infer()`
   - `inferStream()`: If ACP supports streaming, use it; otherwise yield full response
   - `listModels()`: Return Anthropic model list (claude-sonnet, claude-opus, etc.)
   - `healthCheck()`: Delegates to AcpClient health tracking

2. Create `src/helios/runtime/integrations/inference/llamacpp-adapter.ts`:
   - `init()`: Check if llama-cli binary exists in project directory
   - `infer()`: Spawn `./llama-cli/llama-cli -m <model> -p <prompt>` and capture output
   - `listModels()`: Scan llama-cli directory for .gguf model files
   - `healthCheck()`: Verify binary exists and is executable

3. Register all adapters in the EngineRegistry during app bootstrap.

**Files**:
- `src/helios/runtime/integrations/inference/anthropic-adapter.ts` (new, ~70 lines)
- `src/helios/runtime/integrations/inference/llamacpp-adapter.ts` (new, ~80 lines)

**Validation**:
- [ ] AnthropicAdapter wraps AcpClient without breaking existing functionality
- [ ] LlamaCppAdapter detects binary presence
- [ ] EngineRegistry can switch between adapters
- [ ] Existing agent.run RPC still works (no regression)

---

## Definition of Done

- [ ] Hardware detection returns correct capabilities
- [ ] MLX adapter works on Apple Silicon (or returns unavailable gracefully)
- [ ] Anthropic adapter wraps AcpClient correctly
- [ ] llama.cpp adapter wraps existing binary
- [ ] EngineRegistry has all 3 adapters registered
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## Risks

- MLX requires Python environment — not all users will have it
- llama.cpp binary may be platform-specific
- nvidia-smi may not be in PATH on all systems

## Reviewer Guidance

- Verify adapters don't break the existing AcpClient flow
- Check graceful degradation when providers are unavailable
- Verify hardware detection is cached (only runs once)

## Activity Log

- 2026-03-01T11:10:53Z – claude-opus – shell_pid=71158 – lane=doing – Assigned agent via workflow command
- 2026-03-01T11:15:15Z – claude-opus – shell_pid=71158 – lane=for_review – Hardware detection, MLX, Anthropic, llama.cpp adapters
- 2026-03-01T11:42:14Z – claude-opus – shell_pid=71158 – lane=done – Merged to main
