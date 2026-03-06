# AGENTS.md

A machine-readable instruction file for AI agents working on this repository.
Place sub-`AGENTS.md` files in subdirectories to extend or override these rules locally.

---

## Design Principles

- **Simplicity**: smallest agent setup that works; avoid unnecessary complexity.
- **Transparency**: make planning and decision-making steps explicit.
- **Modularity**: keep concerns separated (UI, services, tests, config).
- **Robustness**: specify fallback behaviour and error-handling; never silently swallow errors.
- **Spec-Driven**: this file is the source of truth; defer to it over assumptions.

---

## Global Rules

- Follow this file and any closer `AGENTS.md` as primary instructions after system rules.
- Conflict resolution priority: **System > RULES.md > AGENTS.md > User request**.
- Ask clarifying questions when requirements are ambiguous rather than making large speculative changes.
- Prefer **minimal, targeted edits**; preserve existing style and conventions unless asked to refactor.
- For tasks spanning 3+ files, write a brief plan and confirm scope before coding.
- Do not add code comments unless explicitly requested.

---

## Safety and Permissions

**Allowed without asking:**
- Read files, list directories, search the codebase
- Run lint, format, and unit tests on changed files
- Write new tests in `tests/`
- Suggest changes as diffs or patches

**Ask before:**
- Adding or removing packages from `package.json`
- Running full test suites, full builds, or packaging steps
- Modifying `src/main/index.js`, IPC handlers, or preload scripts (Electron security boundary)
- Changing any CI/CD or build configuration

**Never:**
- Commit API keys, tokens, or credentials to Git
- Expose secrets or sensitive data in outputs or logs
- Rename, move, or delete files without an explicit user instruction
- Use `rm -rf` without a targeted, confirmed instruction
- Force-push to any branch
- Bypass security controls or access resources outside the allowed environment

---

## Project Context

**Name**: Whisper Wrapper
**Description**: An Electron desktop application providing a GUI for OpenAI's Whisper speech-to-text model. Supports file upload, direct audio recording, VAD (voice activity detection), transcription editing, and multi-format export.

**Stack:**
- **Runtime**: Node.js v16+, npm v8+
- **Framework**: Electron (main + renderer processes)
- **UI**: Vanilla HTML/CSS/JS in `src/renderer/`
- **Services**: JavaScript ES modules in `src/services/`
- **HTTP**: axios ^1.2.2
- **Config storage**: electron-store ^8.1.0
- **Audio/video**: ffmpeg-static ^5.1.0, fluent-ffmpeg ^2.1.2
- **AI**: openai ^3.2.1 (OpenAI Whisper API), local whisper.cpp binary
- **Testing**: Jest ^29 (unit/integration), Playwright ^1.52 (E2E)
- **Linting**: ESLint ^8, Prettier ^2

**Architecture:**
```
src/
  main/         # Electron main process — window management, IPC, menus
  renderer/     # Renderer process — HTML UI, controllers, styles, utils
    controllers/  # UI controllers (modular MVC)
  services/     # Business logic — transcription, recording, file, export, Ollama
  utils/        # Shared utilities
  config/       # App configuration defaults
tests/
  unit/         # Jest unit tests
  integration/  # Jest integration tests
  e2e/          # Playwright E2E tests
scripts/        # Build, setup, and utility scripts
data/           # Templates and application data
```

**Key files:**
- `src/main/ipcHandlers.js` — IPC bridge between main and renderer
- `src/main/preload.js` — Electron context bridge (security boundary)
- `src/services/localWhisperService.js` — Local whisper.cpp integration
- `src/services/transcriptionService.js` — OpenAI Whisper API integration
- `src/services/recordingService.js` — Audio capture and VAD
- `src/config/index.js` — Configuration management

---

## Build, Test & Lint Commands

```bash
# Install dependencies
npm install

# Start in development mode
npm start

# Lint (run after every change)
npm run lint

# Format
npm run format

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Coverage report
npm run test:coverage

# Build for production
npm run build

# Package application
npm run package

# Setup local Whisper binary
npm run setup-whisper        # macOS/Linux
npm run setup-whisper:windows  # Windows
```

Run `npm run lint` after every code change. Run `npm run test:unit` at minimum before marking a task done.

---

## Coding Conventions

- **Language**: JavaScript (ES2021); no TypeScript in `src/` (TypeScript used only for type definitions in `devDependencies`)
- **Modules**: CommonJS (`require`/`module.exports`) in main process; be consistent with surrounding file
- **Style**: enforced by ESLint + Prettier — 4-space indent, single quotes, semicolons, Unix line endings
- **Variables**: `const` by default; `let` only when reassignment is needed; never `var`
- **Naming**: `camelCase` for variables and functions; `PascalCase` for classes; `kebab-case` for filenames
- **No unused vars**: ESLint warns on unused variables — remove them
- **No console**: ESLint warns on `console.*` — use proper error propagation instead
- **Error handling**: never use empty `catch` blocks; let errors propagate or log with context; no silent fallbacks
- **IPC security**: all IPC handlers must validate inputs before use; never pass raw user input to shell commands
- **Tests**: new features require unit tests; bug fixes require regression tests; never delete a failing test to make CI green
- **Test naming**: `*.test.js` inside `tests/unit/`, `tests/integration/`, or `tests/e2e/`

---

## Agents Catalog

### @code-agent
- **Trigger**: feature implementation, bug fixes, refactoring
- **Role**: implement changes following existing patterns in `src/`; run lint and unit tests after changes
- **Boundary**: propose changes; do not commit or push without explicit instruction

### @test-agent
- **Trigger**: writing or updating tests
- **Role**: quality engineer; add tests in `tests/unit/` or `tests/integration/`; ensure coverage ≥70% for changed modules
- **Boundary**: never delete a failing test; never mock away the behaviour under test

### @code-reviewer
- **Trigger**: PR reviews, security audits, performance reviews
- **Role**: review for correctness, security (IPC boundary, no secrets), performance, and convention adherence
- **Boundary**: propose patches only; never merge without human approval

### @docs-agent
- **Trigger**: documentation tasks (README, changelogs, architecture notes)
- **Role**: update `docs/` and `README.md`; keep examples accurate and concise
- **Boundary**: writes to `docs/` and root `.md` files only; no edits to `src/`

### @devops-agent
- **Trigger**: CI/CD changes, build scripts, packaging, setup scripts
- **Role**: improve build reliability and packaging safety
- **Boundary**: never modify production config or secrets without explicit approval

---

## Workflows

### Code Change Flow

1. Restate the requirement; confirm scope if ambiguous.
2. Locate relevant files with search tools; identify impacted services and IPC handlers.
3. Plan the change in 3–5 short steps; get approval for changes spanning 3+ files.
4. Apply minimal edits; preserve surrounding style.
5. Run `npm run lint` and `npm run test:unit`; report results and fix failures.
6. Summarise what changed and why; do not commit unless explicitly asked.

### Definition of Done

- [ ] `npm run lint` passes with no new errors
- [ ] All relevant unit and integration tests pass
- [ ] New functionality has corresponding unit tests
- [ ] No secrets or credentials introduced
- [ ] IPC inputs validated (if touching main/renderer boundary)

---

## Output Formats

- **Default**: concise explanation with headings and bullets; no filler text.
- **Code**: fenced blocks with language tag; minimal inline comments.
- **Comparisons**: Markdown tables, one concept per row.
- **Reports**: 2–3 sentence summary first, then sections ordered by importance.

---

## Lessons Learned

Agents append new rules here after user corrections to prevent recurring mistakes.

### Format for New Entries

```
### [YYYY-MM-DD] — Short description of the mistake
- **Context:** Which file, module, or situation triggered the correction.
- **Rule:** The exact constraint to apply going forward.
- **Example:** (optional) Before/after code snippet.
```
