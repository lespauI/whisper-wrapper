# Technical Specification: Store Transcriptions

## Complexity Assessment

**Medium** — Requires a new service, IPC wiring, Ollama integration for summarization/labeling, a lightweight index for search, and basic UI for browsing/searching. No complex algorithms, but several moving parts need to integrate cleanly.

---

## Technical Context

- **Runtime**: Electron (Node.js main process + Chromium renderer)
- **Language**: JavaScript (CommonJS in main/services, browser JS in renderer)
- **Key existing dependencies**: `axios`, `uuid`, `fs` (Node built-in)
- **Ollama**: already integrated via `src/services/ollamaService.js` — `axios` calls to `http://localhost:11434`
- **Storage**: `data/` directory is already git-ignored (`/data/*` in `.gitignore`), so everything stored there stays local
- **Config**: app reads/writes `data/config.json`; `config.js` defines `app.dataDirectory`
- **IPC pattern**: `ipcMain.handle` in `src/main/ipcHandlers.js`; renderer calls via `window.electronAPI.*`
- **Preload**: `src/main/preload.js` exposes IPC to renderer

---

## Implementation Approach

### Storage Layout

```
data/
  transcriptions/
    {uuid}.txt           ← raw transcription text
    index.json           ← lightweight metadata index (array of entries)
```

Each index entry:
```json
{
  "id": "uuid-v4",
  "date": "2024-01-15T10:30:00.000Z",
  "title": "auto-generated or filename-derived",
  "summary": "2-3 sentence Ollama summary",
  "labels": ["meeting", "technical"],
  "sourceFile": "original-audio-filename.wav",
  "language": "en",
  "duration": 123,
  "model": "base",
  "wordCount": 456,
  "filePath": "data/transcriptions/{uuid}.txt"
}
```

### Workflow Integration

After a transcription completes (both file and recording paths), the app will:
1. Save the `.txt` file under `data/transcriptions/`
2. Call Ollama (if available/enabled) to generate a summary and labels
3. Write/update `data/transcriptions/index.json`
4. Notify the renderer that a new transcription was stored

Ollama is optional — if unavailable or disabled, summary/labels are left empty and the transcription is still stored.

### Search / Find

Search is done entirely in-process by filtering the in-memory index (loaded at startup, refreshed on changes). Fields searched: title, summary, labels, sourceFile, date range. No external search engine needed.

---

## Source Code Changes

### New Files

| File | Purpose |
|------|---------|
| `src/services/transcriptionStoreService.js` | Core service: save, list, search, get, delete transcriptions |
| `tests/unit/services/transcriptionStoreService.test.js` | Unit tests |

### Modified Files

| File | Change |
|------|--------|
| `src/main/ipcHandlers.js` | Instantiate `TranscriptionStoreService`; register new IPC handlers |
| `src/main/preload.js` | Expose new IPC channels to renderer |
| `src/renderer/index.html` | Add "Library" tab / panel with search UI |
| `src/renderer/controllers/` | Add `libraryController.js` for library tab logic |

---

## API / Interface Changes

### IPC Channels (main process → renderer)

| Channel | Args | Returns |
|---------|------|---------|
| `transcriptions:store` | `{ text, metadata }` | `{ success, entry }` |
| `transcriptions:list` | `{ query?, dateFrom?, dateTo?, labels? }` | `{ entries: [...] }` |
| `transcriptions:get` | `{ id }` | `{ entry, text }` |
| `transcriptions:delete` | `{ id }` | `{ success }` |
| `transcriptions:reindex` | — | `{ count }` |

### Preload API additions (`window.electronAPI`)

```js
transcriptions: {
  store(text, metadata),
  list(filters),
  get(id),
  delete(id),
  reindex()
}
```

### OllamaService — new method

`async generateTranscriptionMeta(text, model?)` → `{ summary, labels }` using a structured prompt. Falls back to `{ summary: '', labels: [] }` on error.

---

## `TranscriptionStoreService` Responsibilities

```
constructor()
  - resolve transcriptionsDir: data/transcriptions/
  - ensure directory exists
  - load index from index.json (or initialize empty)

async store(text, metadata)
  - generate uuid
  - write {uuid}.txt
  - call ollamaService.generateTranscriptionMeta(text) if ollama available
  - build index entry
  - append to index, persist index.json
  - return entry

list(filters)
  - filter in-memory index by query (full-text on title/summary/labels/sourceFile), date range, labels
  - return sorted by date desc

async get(id)
  - find entry in index
  - read {uuid}.txt
  - return { entry, text }

async delete(id)
  - remove txt file
  - remove from index, persist

async reindex()
  - scan all *.txt files in dir
  - rebuild index from existing files + existing meta
  - persist
```

---

## Auto-store Hook

In `ipcHandlers.js`, after transcription completes (`handleTranscribeFile`, `handleTranscribeAudio`, and the recording stop/save path), call:
```js
await this.transcriptionStoreService.store(transcriptionText, {
  sourceFile: originalFileName,
  language, duration, model
});
```

This is fire-and-forget from the user's perspective (Ollama call is async but saving the txt is immediate).

---

## Verification Approach

### Lint
```bash
npm run lint
```

### Unit Tests
```bash
npm run test:unit
```
Tests for `TranscriptionStoreService`:
- `store()` saves `.txt` and updates `index.json`
- `list()` with filters returns correct subset
- `get()` returns entry + text content
- `delete()` removes file and index entry
- Ollama failure → still stores without summary/labels

### Manual Verification
1. Start app, transcribe an audio file
2. Verify `data/transcriptions/{uuid}.txt` created
3. Verify `data/transcriptions/index.json` contains entry with summary/labels
4. Open Library tab, search by keyword → finds transcription
5. Confirm `data/` not staged in git (`git status`)
