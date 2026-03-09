# Auto

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Investigation & Cleanup Plan
<!-- chat-id: 2eb88fed-598e-4ffc-a346-cdadc5735027 -->

Investigation complete. Cleanup plan written below.

---

# Project Cleanup Plan

## 1. Dead / Empty Files

| File | Issue |
|------|-------|
| `src/renderer/new_index.js` | Empty file (0 bytes) — leftover from abandoned refactor |
| `whishper-wrapper.iml` | IntelliJ IDEA project file — should not be in repo |
| `refine-with-ai_progress.md` | Stale progress tracker (phases 3-5 incomplete, superseded by actual implementation) |
| `E2E_TEST_COVERAGE_ANALYSIS.md` | Analysis document in project root — should live in `docs/` if kept at all |

**Action:** Delete `new_index.js`, `whishper-wrapper.iml`, and `refine-with-ai_progress.md`. Move or delete `E2E_TEST_COVERAGE_ANALYSIS.md`.

---

## 2. Duplicate / Conflicting Configuration

### 2a. Two config systems
- **`src/config.js`** — hand-rolled JSON-file-based config (351 lines). Used by all `src/main/` and `src/services/` code via `require('../config')`.
- **`src/config/index.js`** + `src/config/default.js` — `electron-store`-based `ConfigManager` class. Only referenced from `src/main/ipcHandlers.js` (one line imports `default.js`).

These two systems define overlapping settings with different key names (e.g., `whisper.defaultModel` vs `transcription.model`), different defaults, and different storage backends. The `ConfigManager` class appears largely unused at runtime.

**Action:** Consolidate to one config system. Decide which to keep (likely `src/config.js` since it's the one everything actually uses), remove the other, and reconcile defaults.

### 2b. Duplicate ESLint config
- `.eslintrc.js` at project root
- `eslintConfig` key inside `package.json`

Both define identical-ish config. Having both is ambiguous (`.eslintrc.js` takes precedence).

**Action:** Remove the `eslintConfig` block from `package.json`.

---

## 3. Unused Dependencies

| Package | Status |
|---------|--------|
| `lodash` | **Not imported anywhere** in `src/` or `scripts/` |
| `form-data` | **Not imported anywhere** in `src/` or `scripts/` |
| `spectron` (devDep) | **Not imported anywhere** — deprecated Electron testing lib |
| `ts-node` (devDep) | **Not imported anywhere** — project uses JS, not TS in runtime |
| `@types/lodash`, `@types/jest`, `@types/node`, `@types/uuid`, `@types/fluent-ffmpeg` (devDeps) | Type declarations for a pure-JS project with no `tsconfig.json` for src — only useful if an IDE consumes them, but most are for unused packages |

**Action:** Remove `lodash`, `form-data`, `spectron`, `ts-node`, and unnecessary `@types/*` packages. Keep `@types/node` if desired for IDE support.

---

## 4. Stale / Orphaned Test Data

| File | Issue |
|------|-------|
| `tests/data/silince.waw` | Typo in filename ("silince" → "silence", ".waw" → ".wav"). Not referenced by any test. |
| `tests/data/summary-test.wav` | Only referenced in a comment in `tests/e2e/generateTranscriptionMeta.test.js` |
| `tests/data/test.wav` | Check if actually used by any test |

**Action:** Audit references; rename or delete orphaned files.

---

## 5. Stale Documentation Files in `tests/e2e/`

| File | Issue |
|------|-------|
| `tests/e2e/FEATURE_SPLIT_SUMMARY.md` | Internal dev notes, not test code |
| `tests/e2e/REFACTORED_SUMMARY.md` | Internal dev notes, not test code |
| `tests/e2e/TEST_SUMMARY.md` | Internal dev notes, not test code |

**Action:** Move to `docs/` or delete if no longer relevant.

---

## 6. `.gitignore` Gaps

- `whishper-wrapper.iml` and `*.iml` not in `.gitignore`
- Comment in Russian on line 66 (`# YOUR CUSTOM STUFF (оставил как было!)`) — clean up

**Action:** Add `*.iml` to `.gitignore`. Clean up comment.

---

## 7. Architecture / Zencoder Rule Files

- `.architecture/whisper-wrapper/` — 6 markdown files (architecture overview, component diagram, implementation plan, etc.)
- `.zencoder/rules/` — 18 rule files from previous Zencoder sessions

**Action:** Review `.architecture/` for staleness against current codebase. The `.zencoder/rules/` are auto-generated context — consider pruning stale ones that reference completed/removed features.

---

## 8. `data/` Directory

The `data/` directory is gitignored (`/data/*`) but exists in the repo as an empty directory. This directory is used at runtime for config storage (`data/config.json`).

**Action:** Confirm this is intentional. Consider adding a `.gitkeep` if the empty directory should be tracked, or remove it from the repo and let the app create it at runtime.

---

## 9. Minor Code Quality Issues

- `src/config.js` uses `console.log` and `console.error` extensively — ESLint warns on `no-console`
- `src/config/index.js` exports a singleton `new ConfigManager()` that's mostly unused
- E2E tests use TypeScript (`.ts`) but Jest is configured for `.js` only — the Playwright tests have their own `playwright.config.ts` which is fine, but `jest.config.js` also matches `tests/e2e/**/*.test.js` which would pick up the 2 `.test.js` files in `tests/e2e/` root (e.g., `generateTranscriptionMeta.test.js`, `realVideoTranscription.test.js`) — these may not be intended as Jest tests

**Action:** Audit the 2 `.test.js` files in `tests/e2e/` root to determine if they should be Jest or Playwright tests. Fix any misplacement.

---

## Summary of Cleanup Steps

### [x] Step: Remove dead and empty files
<!-- chat-id: 9d5426c2-0e55-4ebe-aaa1-cfee75b45877 -->
- Delete `src/renderer/new_index.js`
- Delete `whishper-wrapper.iml`
- Delete `refine-with-ai_progress.md`
- Move or delete `E2E_TEST_COVERAGE_ANALYSIS.md`

### [x] Step: Consolidate configuration system
<!-- chat-id: a6ddda42-c45b-4b57-b5f3-e60af47ac346 -->
- Kept `src/config.js` as the single active config system (used by all source files)
- Removed `src/config/index.js` (unused `ConfigManager` class — zero imports)
- Kept `src/config/default.js` (still used by `ipcHandlers.js` for `availableModels` and by 2 unit tests)
- Updated `scripts/verify-setup.js` to remove existence check for deleted file
- Updated `AGENTS.md` key files section
- All 521 unit tests pass, no lint regressions

### [x] Step: Remove unused dependencies
<!-- chat-id: 51a13c80-8272-48f8-a9cd-c57abd0e8564 -->
- Removed `lodash`, `form-data` from dependencies
- Removed `spectron`, `ts-node`, `@types/fluent-ffmpeg`, `@types/jest`, `@types/lodash`, `@types/uuid` from devDependencies
- Kept `@types/node` for IDE support
- Ran `npm install` — 162 packages removed
- No test or lint regressions (pre-existing failures unchanged)

### [x] Step: Clean up ESLint duplication
<!-- chat-id: 45580c54-c7c3-43d2-b88d-b531db8a0efc -->
- Removed `eslintConfig` block from `package.json` (`.eslintrc.js` is the authoritative config)
- Lint output unchanged (no regressions)

### [x] Step: Clean up test artifacts and stale docs
<!-- chat-id: 131ed7ec-826d-460c-9561-8228ffa0be98 -->
- Deleted `tests/data/silince.waw` (orphaned — not referenced by any test, had typos in name and extension)
- Kept `tests/data/summary-test.wav` (used by `generateTranscriptionMeta.test.js`) and `tests/data/test.wav` (used by `realVideoTranscription.test.js` and `transcription-e2e.test.js`)
- Deleted `tests/e2e/FEATURE_SPLIT_SUMMARY.md`, `REFACTORED_SUMMARY.md`, `TEST_SUMMARY.md` (stale dev notes, not test code)
- Audited `tests/e2e/` root `.test.js` files: both are Jest tests correctly matched by the Jest `e2e` project config; Playwright only picks up `.spec.ts` in `tests/e2e/tests/` — no conflict, no change needed
- No test or lint regressions (pre-existing failures unchanged)

### [x] Step: Update .gitignore and minor hygiene
<!-- chat-id: 2abaa488-1c11-4d1e-98ba-3386c9cc6bee -->
- Added `*.iml` to `.gitignore` under IDE section
- Replaced Russian comment (`оставил как было!`) with clean English label (`# Project-specific`)
- Reviewed `.architecture/`: updated `project-structure.md` to remove deleted `src/config/index.js` reference. Broader staleness noted (docs reference `components/` directory that doesn't exist — project uses `controllers/`) but full rewrite is out of scope
- Reviewed `.zencoder/rules/`: 18 auto-generated context files — advisory only, no functional impact, left as-is
- No lint regressions (pre-existing issues unchanged)

### [ ] Step: Verify
- Run `npm run lint`
- Run `npm run test:unit`
- Confirm no regressions

### [ ] Step: Review

Review the sollution and update plan.md if needed
