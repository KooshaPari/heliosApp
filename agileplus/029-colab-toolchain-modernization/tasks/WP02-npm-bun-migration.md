---
work_package_id: WP02
title: npm→bun Migration + Dependency Cleanup
lane: "done"
dependencies: []
subtasks: [T007, T008, T009, T010, T011, T012, T013]
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-02-28'
  action: created
  agent: claude-opus
---

# WP02: npm→bun Migration + Dependency Cleanup

## Objective

Eliminate every `npm` reference in the codebase (except legitimate npm registry URLs and the peerDependencies/node.ts compatibility layer) and remove/replace unused dependencies.

## Context

- **Audit findings**: 9 files contain npm references needing migration
- **Legitimate exceptions**: `src/main/peerDependencies/node.ts` (NPM_BINARY_PATH — intentional legacy compat), `src/main/plugins/npmRegistry.ts` (npm registry API URLs)
- **Dependencies to remove**: `ansi-to-html` (confirmed unused — zero imports)
- **Dependencies to replace**: `fs-extra` → bun-native fs APIs

## Implementation Command

```bash
agileplus implement WP02 --base WP01
```

---

## Subtask T007: Migrate package.json push:* scripts npm→bun

**Purpose**: Replace `npm version` commands in push scripts with bun equivalents.

**Steps**:
1. Open `package.json`, find lines 16-20 (push:* scripts)
2. Replace each `npm version` with `bun version`:
   - `"push:canary": "bun version prerelease --preid=canary && git push origin main --tags"`
   - `"push:patch": "bun version prepatch --preid=canary && git push origin main --tags"`
   - `"push:minor": "bun version preminor --preid=canary && git push origin main --tags"`
   - `"push:major": "bun version premajor --preid=canary && git push origin main --tags"`
   - `"push:stable": "bun version patch && git push origin main --tags"`
3. If `bun version` doesn't support these subcommands, use `bunx npm version` as fallback

**Files**: `package.json`

**Validation**:
- [ ] No `"npm version"` strings remain in package.json scripts
- [ ] push:* scripts use bun or bunx

---

## Subtask T008: Replace npm references in README.md

**Purpose**: Update user-facing documentation to reference bun.

**Steps**:
1. Find all `npm` references in `README.md` (lines ~62, 65, 68)
2. Replace:
   - `npm install` → `bun install`
   - `npm run dev` → `bun run dev` (or `task dev`)
   - `npm run build:stable` → `bun run build:stable` (or `task build`)

**Files**: `README.md`

**Validation**:
- [ ] No `npm install` or `npm run` in README.md

---

## Subtask T009: Replace npm references in test-plugin/README.md

**Purpose**: Update plugin documentation.

**Steps**:
1. Find `npm publish` reference (line ~145)
2. Replace with `bunx npm publish` or `bun publish`

**Files**: `test-plugin/README.md`

**Validation**:
- [ ] No bare `npm` commands in test-plugin/README.md

---

## Subtask T010: Replace npm/npx in webflow-plugin sources

**Purpose**: Update webflow plugin code and docs.

**Steps**:
1. In `webflow-plugin/src/commands/devlink.ts` (line ~173):
   - Change `'  1. Run: bun install (or npm install)\r\n'` → `'  1. Run: bun install\r\n'`
2. In `webflow-plugin/src/index.ts`:
   - Replace any `npx` references with `bunx`

**Files**: `webflow-plugin/src/commands/devlink.ts`, `webflow-plugin/src/index.ts`

**Validation**:
- [ ] No `npm install` fallback text in devlink.ts
- [ ] No `npx` references in webflow-plugin

---

## Subtask T011: Replace npm references in ColabTerminal.ts comments

**Purpose**: Update code comments/examples.

**Steps**:
1. In `src/renderers/components/ColabTerminal.ts`:
   - Find example comments containing `npm install` or `npm run dev`
   - Replace with `bun install` / `bun run dev`

**Files**: `src/renderers/components/ColabTerminal.ts`

**Validation**:
- [ ] No `npm` in code comments

---

## Subtask T012: Remove ansi-to-html dependency

**Purpose**: Remove confirmed unused dependency.

**Steps**:
1. Remove `"ansi-to-html"` from `package.json` dependencies
2. Run `bun install` to update lockfile
3. Verify no imports of `ansi-to-html` exist (should be zero)

**Files**: `package.json`, `bun.lock`

**Validation**:
- [ ] `ansi-to-html` not in package.json
- [ ] `grep -r "ansi-to-html" --include="*.ts"` returns nothing

---

## Subtask T013: Replace fs-extra with bun-native fs APIs

**Purpose**: Replace fs-extra dependency with bun/node builtins.

**Steps**:
1. Find all fs-extra imports: `grep -r "fs-extra" --include="*.ts"`
2. Expected locations: `setup-deps.ts`, `postBuild.ts`, `upload-artifacts.ts`
3. For each file, replace:
   - `import { cpSync, mkdirSync, existsSync } from "fs-extra"` → `import { cpSync, mkdirSync, existsSync } from "node:fs"`
   - `import { copySync } from "fs-extra"` → `import { cpSync } from "node:fs"` (rename `copySync` → `cpSync`)
   - `import { readJsonSync } from "fs-extra"` → use `JSON.parse(await Bun.file(path).text())` or `JSON.parse(readFileSync(path, 'utf-8'))`
   - `import { writeJsonSync } from "fs-extra"` → use `await Bun.write(path, JSON.stringify(data, null, 2))`
   - `import { ensureDirSync } from "fs-extra"` → `import { mkdirSync } from "node:fs"` with `{ recursive: true }`
   - `import { removeSync } from "fs-extra"` → `import { rmSync } from "node:fs"` with `{ recursive: true, force: true }`
4. Remove `"fs-extra"` from package.json dependencies
5. Run `bun install` to update lockfile

**Files**: `setup-deps.ts`, `postBuild.ts`, `upload-artifacts.ts`, `package.json`

**Validation**:
- [ ] No `fs-extra` imports remain
- [ ] `fs-extra` removed from package.json
- [ ] Build still succeeds (`bun run build:dev` or `task build`)
- [ ] Setup still works (`bun run setup`)

---

## Definition of Done

- [ ] `grep -rn "npm" --include="*.ts" --include="*.md" --include="*.json" --include="*.yml"` returns only:
  - `src/main/peerDependencies/node.ts` (NPM_BINARY_PATH — legitimate)
  - `src/main/plugins/npmRegistry.ts` (npm registry API URLs — legitimate)
- [ ] `ansi-to-html` removed from package.json
- [ ] `fs-extra` removed from package.json
- [ ] All fs-extra imports replaced with node:fs or Bun builtins
- [ ] `bun install` succeeds
- [ ] Build succeeds
- [ ] All 178 tests pass

## Risks

- **fs-extra API surface**: Some fs-extra methods may have subtle differences from node:fs equivalents. Test build and setup after replacement.
- **bun version subcommands**: `bun version` may not support all npm version subcommands. Use `bunx npm version` as fallback.

## Reviewer Guidance

- Grep for "npm" across entire repo — only legitimate exceptions should remain
- Verify fs-extra replacement didn't break build scripts (setup-deps.ts is critical path)
- Check that bun.lock was regenerated after dependency removal


## Activity Log

- 2026-02-28T12:35:24Z – unknown – lane=done – Implemented, PR #6 created
