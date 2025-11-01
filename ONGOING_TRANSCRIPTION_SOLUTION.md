Title: Ongoing Transcription – Solution Spec and Verification

Overview
- Provide live, ongoing transcription while recording.
- Record short chunks, transcribe them in the background, and append to an on‑screen stream.
- Use a context prompt from prior text to improve chunk stitching.
- De‑duplicate overlaps and emphasize the most recent chunk in the UI.

Scope
- Renderer: Record chunked audio and manage smart chunk boundaries.
- Main (IPC): Accept per‑chunk context prompt and pass to transcription.
- UI: Show an overlay with rolling text; latest chunk highlighted.
- Tests: Verify context prompt wiring and behavior.

Functional Requirements
1) Chunked recording
   - Start a secondary `MediaRecorder` per chunk.
   - Base chunk duration configurable (default 5s).
   - Smart stopping: after base duration, stop immediately if audio is quiet; otherwise wait up to 2s for quiet.

2) Background transcription worker
   - Push completed chunks into a FIFO queue for transcription.
   - Transcribe in a loop while enabled; skip tiny/silent chunks (<5KB or blank).

3) Context prompt
   - Generate prompt from the last ~400 chars of accumulated transcript (trim to sentence boundary when possible).
   - Send prompt with each chunk via `transcription:audio` IPC.
   - Main process includes `contextPrompt` in options sent to the transcription service.

4) Overlap handling and de‑duplication
   - Normalize whitespace and fix common split artifacts.
   - Detect and remove overlapping prefix compared to tail of accumulated transcript (case‑insensitive, min length ~12 chars).
   - Suppress near‑identical repeats compared to a short recent history of chunks.

5) UI behavior
   - Container toggled by a checkbox; default hidden.
   - Latest chunk rendered with distinct style (e.g., bold) while prior chunks remain normal.
   - Auto‑scroll to bottom as text grows.

Key Implementation Points
- Renderer: `src/renderer/controllers/RecordingController.js`
  - `initializeOngoingTranscription()`, `startChunkRecording()`, `addChunkToQueue()`
  - Worker: `startTranscriptionWorker()` + `processTranscriptionQueue()`
  - Prompt: `generateContextPrompt()`
  - De‑dupe helpers: `normalizeWhitespace()`, `findOverlap()`, `dedupeWithPrevious()`, `isDuplicateChunk()`, `rememberChunk()`, `preprocessChunkText()`
  - UI update: `updateOngoingTranscriptionDisplay()`

- IPC: `src/main/ipcHandlers.js`
  - `handleTranscribeAudio(event, audioData, prompt)` reads configurable settings and forwards `{ threads, translate, useInitialPrompt, contextPrompt }` to `TranscriptionService.transcribeBuffer` (with `contextPrompt` only when non‑blank).

Verification
- Unit tests added: `tests/unit/ipcHandlersOngoingTranscription.test.js`
  - Ensures `contextPrompt` is trimmed and forwarded when provided.
  - Ensures it is omitted when empty/whitespace.
- Existing unit tests for renderer/editor remain green.
  
Out of Scope
- True streaming via WebSockets or partial segment updates.
- Model accuracy tuning beyond prompt context.

Operational Notes
- Integration/E2E tests require a local Whisper setup; they are not mandatory to verify this feature wiring.
