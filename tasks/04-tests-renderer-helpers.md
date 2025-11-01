Task: Add unit tests for renderer helpers

Status: Pending

Summary
- Goal: Validate helper logic in `RecordingController` responsible for overlap handling:
  - `normalizeWhitespace`, `findOverlap`, `dedupeWithPrevious`, `isDuplicateChunk`, `rememberChunk`, `preprocessChunkText`.
- Note: `RecordingController.js` is authored as an ES module and is not directly importable in the current Jest CJS setup without adding transforms or refactoring helpers into a separate module. To keep changes minimal and avoid build config changes, this task is deferred.

Proposal
- Option A (low-impact refactor): Extract helper methods into `src/renderer/utils/transcriptionChunkUtils.js` and import them in `RecordingController.js`. Then add focused unit tests for the helpers.
- Option B (Jest transform): Introduce Babel/Jest transform to allow ESM imports in unit tests. Heavier change.

Decision Needed
- Confirm preference (A recommended). On approval, will implement in a follow-up.
