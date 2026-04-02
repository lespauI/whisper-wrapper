# Meeting Notes Feature - Implementation Plan

## Summary
Add AI-generated meeting notes to the library. Notes are linked 1:1 to transcripts, stored as individual JSON files in `data/meeting-notes/`. Users can generate notes using Ollama, Claude CLI, or Codex CLI with configurable prompt templates. Notes appear as an expandable section in the library detail view.

## Key Decisions
- Storage: `data/meeting-notes/{transcriptId}.json` — individual files keyed by transcript ID
- AI backends: Ollama (reuse existing config), Claude CLI (`claude`), Codex CLI (`codex`) — via shell
- Default provider: Claude CLI with claude-sonnet-4-20250514
- Per-generation provider selection with a default in settings
- Multiple prompt templates stored in `data/meeting-notes-templates.json`
- Regeneration supported with different model/provider

## Affected Files
- `src/config.js` — add `meetingNotes` config section
- `src/services/meetingNotesService.js` — NEW: generate, store, load, delete notes
- `src/main/ipcHandlers.js` — add meetingNotes:* handlers
- `src/main/preload.js` — expose meetingNotes API
- `src/renderer/index.html` — add expandable notes section in library detail + settings UI
- `src/renderer/controllers/libraryController.js` — add notes UI logic
- `src/renderer/controllers/SettingsController.js` — add meeting notes settings
- `src/renderer/styles/main.css` — styles for notes section
- `data/meeting-notes-templates.json` — NEW: default prompt templates

### [x] Step 1: Backend Service & Config
- Add `meetingNotes` config section to `src/config.js`
- Create `src/services/meetingNotesService.js` with: generate (ollama/claude/codex), store, load, delete, list templates
- Create `data/meeting-notes-templates.json` with default prompt templates
- Add IPC handlers in `src/main/ipcHandlers.js`
- Expose API in `src/main/preload.js`

### [x] Step 2: Library UI - Expandable Notes Section
- Add expandable "Meeting Notes" section HTML in library detail view
- Add "Generate Notes" button with provider/template selection
- Add notes display with markdown rendering
- Add regenerate/delete notes functionality
- Wire up in `src/renderer/controllers/libraryController.js`
- Add CSS styles

### [x] Step 3: Settings UI for Meeting Notes
- Add "Meeting Notes" settings card in settings panel
- Default provider and model selection
- Meeting notes prompt template management (add/edit/delete)
- Wire up in `src/renderer/controllers/SettingsController.js`

### [x] Step 4: Security check

Please check all our meeting notes and transcripts are stored localy and never left machine to Git or any other place
