Project plan: Implement ONGOING_TRANSCRIPTION solution with tests

Subtasks

1) Locate spec and extract acceptance criteria
- Check for `ONGOING_TRANSCRIPTION_SOLUTION.md` and related docs
- If missing, infer criteria from code and UI

2) Verify/implement functionality in code
- Ensure ongoing transcription pipeline supports per-chunk context prompt
- Confirm UI shows latest chunk emphasized, with de-duplication of overlaps

3) Add unit tests for IPC context prompt
- Test that `handleTranscribeAudio` forwards `contextPrompt` when provided
- Test trimming and omission when prompt is empty

4) (Optional) Add unit tests for renderer helpers
- Validate overlap detection and preprocessing logic independently if feasible

5) Run test suite and adjust
- Run Jest projects (unit, integration, e2e placeholders) and ensure all pass

Notes
- The spec file `ONGOING_TRANSCRIPTION_SOLUTION.md` is not present in the repo; proceeding based on existing ongoing transcription implementation in `src/renderer/controllers/RecordingController.js` and IPC support in `src/main/ipcHandlers.js`.
