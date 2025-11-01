Task: Add unit tests for renderer helpers

Status: Completed

Summary
- Implemented low-impact extraction of pure helper logic to `src/utils/transcriptionChunkUtils.js` (CommonJS for easy Jest usage).
- Updated `src/renderer/controllers/RecordingController.js` wrappers to defer to the shared utils without behavioral change.
- Added unit tests: `tests/unit/utils/transcriptionChunkUtils.test.js` covering normalization, overlap detection, deduplication, and preprocessing.

Artifacts
- src/utils/transcriptionChunkUtils.js
- tests/unit/utils/transcriptionChunkUtils.test.js
- Updated imports/wrappers in src/renderer/controllers/RecordingController.js
