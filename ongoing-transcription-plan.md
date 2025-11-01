Ongoing Transcription — Implementation Plan (Completed)

Tasks

1) Locate spec and extract acceptance criteria — Completed
- Authored `ONGOING_TRANSCRIPTION_SOLUTION.md` capturing chunking, worker, context prompt, de‑dup, and UI.

2) Verify/implement functionality in code — Completed
- Confirmed renderer and IPC implementations match the spec; no major code gaps.

3) Add unit tests for IPC context prompt — Completed
- Added `tests/unit/ipcHandlersOngoingTranscription.test.js`.

4) Add unit tests for renderer helpers — Completed
- Extracted pure helpers to `src/utils/transcriptionChunkUtils.js` and added tests in `tests/unit/utils/transcriptionChunkUtils.test.js`.

5) Run test suite and adjust — Completed
- Unit and integration suites pass; Whisper E2E/integration opt‑in via env flags.

Validation summary
- Chunked recording with smart stops: Implemented in `src/renderer/controllers/RecordingController.js`.
- Background transcription worker: Implemented with a FIFO queue and continuous processing loop.
- Context prompt wiring: Renderer generates context; main IPC forwards `contextPrompt` to `TranscriptionService.transcribeBuffer`.
- Overlap handling and de‑dup: Helper utilities normalize whitespace, detect overlaps, and remove duplicates.
- UI behavior: Latest chunk emphasized; rolling text auto‑scrolls; container toggled by checkbox.

Testing
- IPC prompt tests ensure correct option forwarding.
- Utility tests ensure normalization, overlap detection, and preprocessing correctness.
- Whisper E2E/Integration are skipped by default to keep CI green; enable with `RUN_WHISPER_TESTS=1`.
