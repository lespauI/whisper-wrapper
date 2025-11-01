Task: Add unit tests for IPC context prompt

Status: Completed

Summary
- Implemented `tests/unit/ipcHandlersOngoingTranscription.test.js`.
- Verifies `handleTranscribeAudio` passes a trimmed `contextPrompt` when provided.
- Verifies empty/whitespace prompts do not include `contextPrompt` in options.

Artifacts
- tests/unit/ipcHandlersOngoingTranscription.test.js
