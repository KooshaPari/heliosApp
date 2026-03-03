# Typecheck Debt Snapshot - 2026-03-03

## Scope
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp`
- `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp-colab`

## Commands
- `heliosApp`: `bun run typecheck`
- `heliosApp-colab`: `bunx tsc --noEmit`

## Summary
- `heliosApp`: pass (0 TypeScript errors).
- `heliosApp-colab`: fail with large existing debt (4,771 compiler error lines captured).

## Categorized Findings (`heliosApp-colab`)

### 1) JSX and UI typing gaps
- Dominant code: `TS7026` (2,084 occurrences)
- Symptom: missing `JSX.IntrinsicElements` and JSX runtime/type wiring in many TSX files.
- Impact: broad compile failure in renderer/plugin UI paths.

### 2) Missing global/runtime types
- Dominant codes: `TS2584` (753), `TS2304` (458), `TS2580` (77), `TS2867` (9)
- Symptom: unresolved globals (`console`, `window`, `process`, `require`, `Bun`, DOM types).
- Impact: Node/Bun/DOM environment boundary is not consistently modeled in TS config/type roots.

### 3) Implicit `any` and parameter typing debt
- Dominant codes: `TS7006` (467), `TS7031` (278)
- Symptom: callback args and destructured params are untyped across high-churn UI modules.
- Impact: strict-mode compile noise and weak static guarantees.

### 4) Dependency/module resolution gaps
- Dominant code: `TS2307` (171)
- Symptom: missing module/type declarations (for example `electrobun`, `solid-js`, node built-ins in some contexts).
- Impact: typecheck cannot model external/runtime dependencies reliably.

### 5) Hygiene and API-shape mismatches
- Dominant codes: `TS6133` (206), `TS2741` (88), `TS2554` (41), plus smaller tails.
- Symptom: unused symbols and prop/signature mismatch clusters.
- Impact: lower severity than environment/JSX gaps, but adds noise and maintenance drag.

## Top Hotspot Files (`heliosApp-colab`)
- `src/renderers/ivde/slates/GitSlate.tsx` (600)
- `src/renderers/ivde/index.tsx` (547)
- `src/main/index.ts` (412)
- `webflow-plugin/src/renderer/WebflowSlate.tsx` (383)
- `src/renderers/ivde/slates/AgentSlate.tsx` (172)
- `src/renderers/ivde/slates/WebSlate.tsx` (165)
- `src/renderers/ivde/FileTree.tsx` (159)
- `src/renderers/ivde/settings/ColabCloudSettings.tsx` (155)
- `src/renderers/ivde/settings/LlamaSettings.tsx` (145)
- `src/renderers/ivde/settings/PluginSettings.tsx` (142)

## Residual Debt
- All `heliosApp-colab` findings above are pre-existing and remain unresolved in this lane.
- This run focused on governance and CI/local command alignment, not broad TS debt remediation.
