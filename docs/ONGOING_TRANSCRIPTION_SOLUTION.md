# Ongoing Transcription – Robust, Low‑Hallucination, Sentence‑Aware Chunks

## Goals

- Reduce/avoid hallucinations during silence or low SNR
- Avoid repeated sentences across chunk boundaries
- Preserve sentence continuity (don’t cut mid‑phrase) without adding latency
- Keep implementation simple, controllable, and fast

## Summary of Approach

We combine four techniques that work together:

1) VAD‑lite gating (start/stop)
- Start chunks only when speech crosses a level threshold for N consecutive samples.
- Stop at base duration if quiet; otherwise wait up to a small max extension window for a quiet moment.
- Drop chunks with insufficient speech activity.

2) Context discipline
- Keep the context prompt short (tail of incomplete clause only), and completely suppress during silence or when repetition is detected.
- This removes bias where Whisper “continues” the prompt during silence.

3) De‑duplication + repetition guards
- Remove overlapping prefix of the new text against the current transcript tail.
- Skip chunks that are duplicates of recent output or contain repetitive n‑grams (looping phrases).
- When repetition is detected, suppress context for a few seconds to break the loop.

4) Soft audio overlap (proposed; optional)
- Prepend ~300–500 ms of audio from the end of the previous chunk to the next chunk before transcription.
- This gives Whisper the trailing audio needed to finish words/sentences without hard aligning to a text prompt.
- Implemented by slicing the previous chunk’s Blob tail and concatenating it with the next chunk’s Blob before sending to IPC.

## Current State (Already Implemented)

- VAD‑lite: voice start gate (consecutive above‑threshold samples) before starting a chunk.
- Stop policy: base duration + up to 2s maxExtension waiting for a quiet moment.
- Silence gating: per‑chunk activity sampling (ratio/max level) to decide if a chunk is valid; skip otherwise.
- Context prompt: short tail, suppressed during silence and repetition cooldown; trimmed to ≤80 chars.
- Overlap de‑duplication: remove prefix duplication vs transcript tail.
- Repetition guard: duplicate/repetitive chunks are dropped; context suppressed for ~6s.

Code references (renderer):
- Chunk lifecycle: `src/renderer/controllers/RecordingController.js`
  - Start/stop logic: 770–910
  - Gating thresholds: 41–60
  - Silence detection and skips: ~840–870
  - Context prompt generation and gating: ~720–740
  - Text preprocessing/dedup/repetition: ~530–620
  - Queue processing: ~740–810

## Proposed: Soft Audio Overlap

Problem
- With strict, non‑overlapping chunks, last words often get cut, leading to restarts or repetition.

Solution
- Maintain `overlapMs` tail (default 400ms) of the previous chunk’s audio and prepend it to the next chunk before transcription.
- This is done at the Blob level; ffmpeg/whisper.cpp handles decoding/segmentation.

Algorithm
- On chunk complete (when we have `chunkBlob` and its actual duration):
  - Compute `tailBytes = floor(chunkBlob.size * (overlapMs / chunkDurationMs))`.
  - `lastTail = chunkBlob.slice(chunkBlob.size - tailBytes, chunkBlob.size, mimeType)`.
  - Store `this.ongoingTranscription.nextPrependTail = lastTail`.
- When processing the next chunk in the queue:
  - If `nextPrependTail` exists, build `combined = new Blob([nextPrependTail, queueItem.blob], { type: mimeType })` and send `combined` to IPC.
  - Clear `nextPrependTail` after use.
- If previous chunk was skipped (silence), clear `nextPrependTail`.

Why Blob concatenation works
- We already concatenate recording chunks for saving; ffmpeg extraction then decodes the stream.
- For WebM/Opus/WAV, ffmpeg is tolerant of back‑to‑back segments; precision is “good enough” for a short overlap.

Config
- `overlapMs` default 400; range 0–800.
- Toggle in UI as “Sentence‑aware overlap”.

## Parameters (Recommended Defaults)

- Chunk size: 5s base (UI‑selectable)
- Max extension: 2000ms (to catch quiet sentence ends)
- Voice start gate: level ≥22 for 4 consecutive samples
- Silence acceptance: minSpeechLevel 18, minSpeechRatio 0.25, minChunkBytes 8192
- Context tail: ≤80 chars, suppressed after silence or repetition streak (~6s)
- Overlap: 400ms (proposed)

## Edge Cases & Recovery

- Voice → Silence → Voice
  - Start gate prevents starting during silence; once speech resumes, chunking restarts.
  - Context suppressed during silence and briefly after repetition to prevent bias.

- Noisy environments
  - Increase `voiceStartLevel` and/or `minSpeechRatio`.
  - Optional: increase `maxExtensionTime` to 2500–3000ms.

- Fast speakers
  - Increase `overlapMs` to 500–600ms to better stitch words across boundaries.

## Implementation Plan (Overlap)

1) State additions (renderer)
- `ongoingTranscription.overlapMs` (default 400)
- `ongoingTranscription.nextPrependTail` (Blob|null)

2) Capture tail on chunk stop
- In `onstop` for `chunkRecorder`, slice tail bytes from `chunkBlob` using proportional bytes per ms and set `nextPrependTail`.

3) Use tail in worker
- In `processTranscriptionQueue`, if `nextPrependTail` present, replace `queueItem.blob` with a concatenated Blob and clear the tail.
- If chunk is skipped for silence, clear tail.

4) UI
- Add toggle & slider for overlap (Off / 200 / 400 / 600 / 800 ms).
- Tooltip: “Prepend tail of previous chunk to improve sentence continuity.”

5) Testing
- Scenarios: short phrases ending near 5s, voice‑silence‑voice, noisy background.
- Verify: fewer end‑of‑sentence truncations, reduced repetition across boundaries, no hallucinations during silence.

## Rollback / Safety

- Overlap is optional and can be disabled if a specific runtime/container dislikes concatenated WebM/WAV.
- All thresholds are tunable and can be exposed in UI.

## Notes

- If we later add an AudioWorklet for raw PCM capture, we can implement perfect sample‑accurate overlaps without container heuristics. For now, Blob concatenation plus ffmpeg has proven sufficient and simple.

