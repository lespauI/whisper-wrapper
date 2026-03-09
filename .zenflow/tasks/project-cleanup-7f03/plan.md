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

### [ ] Step: Consolidate configuration system
- Decide on single config system (`src/config.js` vs `src/config/`)
- Remove the unused one
- Reconcile any differing defaults

### [ ] Step: Remove unused dependencies
- Remove `lodash`, `form-data` from dependencies
- Remove `spectron`, `ts-node`, stale `@types/*` from devDependencies
- Run `npm install` to update lockfile

### [ ] Step: Clean up ESLint duplication
- Remove `eslintConfig` block from `package.json`

### [ ] Step: Clean up test artifacts and stale docs
- Audit and fix `tests/data/` files (rename `silince.waw`, remove orphans)
- Move or delete summary markdown files from `tests/e2e/`
- Audit `tests/e2e/` root `.test.js` files for correct test runner placement

### [ ] Step: Update .gitignore and minor hygiene
- Add `*.iml` to `.gitignore`
- Clean up Russian comment
- Review `.architecture/` and `.zencoder/rules/` for staleness

### [ ] Step: Verify
- Run `npm run lint`
- Run `npm run test:unit`
- Confirm no regressions

### [ ] Step: Review

Review the sollution and update plan.md if needed
