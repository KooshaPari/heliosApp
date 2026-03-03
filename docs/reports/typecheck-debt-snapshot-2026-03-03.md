# Typecheck Debt Snapshot - 2026-03-03

## Scope
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp-wtrees/ts-debt-parity-20260303`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/colab-wtrees/ts-debt-parity-20260303`

## Commands
- `heliosApp`: `bun run typecheck`
- `heliosApp-colab`: `bun run typecheck`

## Summary
- `heliosApp`: fail in pre-existing runtime registry/session tests (197 compiler error lines in current run).
- `heliosApp-colab`: fail with existing debt, with measurable reductions in this lane (`639 -> 610` compiler error lines).

## Before/After (`heliosApp-colab`)

| metric | before | after | delta |
|---|---:|---:|---:|
| total `error TS` lines | 639 | 610 | -29 |
| `TS7006` | 53 | 44 | -9 |
| `TS7031` | 25 | 3 | -22 |

## Categorized Findings (`heliosApp-colab`)

### 1) Property and API-shape mismatches
- Dominant codes: `TS2339` (226), `TS2322` (137), `TS2554` (40), `TS2345` (32)
- Symptom: missing property/type narrowing and argument-shape mismatches in renderer and main process paths.
- Impact: compile noise concentrated in high-churn UI and RPC boundaries.

### 2) Implicit `any` and parameter typing debt
- Dominant codes: `TS7006` (44), `TS7031` (3)
- Symptom: callback args and destructured params are untyped across high-churn UI modules.
- Impact: strict-mode compile noise and weak static guarantees.

## Top Hotspot Files (`heliosApp-colab`)
- `src/renderers/ivde/slates/GitSlate.tsx` (66)
- `src/renderers/ivde/index.tsx` (64)
- `src/renderers/ivde/slates/WebSlate.tsx` (32)
- `src/renderers/ivde/slates/AgentSlate.tsx` (28)
- `src/renderers/ivde/CodeEditor.tsx` (27)
- `src/renderers/ivde/FileTree.tsx` (27)
- `src/renderers/ivde/slates/TerminalSlate.tsx` (26)
- `src/renderers/ivde/slates/PluginSlate.tsx` (26)
- `src/main/index.ts` (24)
- `src/renderers/ivde/DiffEditor.tsx` (24)

## Residual Debt
- All `heliosApp-colab` findings above are pre-existing and remain unresolved in this lane.
- This run focused on targeted debt reduction and parity/typecheck evidence refresh in the existing lane.
- `heliosApp` currently has enum casing and context-key drift in runtime registry tests; protocol parity tests still pass.
