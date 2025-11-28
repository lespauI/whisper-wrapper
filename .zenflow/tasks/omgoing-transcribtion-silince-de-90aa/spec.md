# Technical Specification: Ongoing Transcription Silence/Noise Detection and Hallucination Prevention

## Technical Context
- Runtime: Electron desktop app (Node.js 16+, Chromium renderer)
- Language: JavaScript (CommonJS in main/services, ES modules in renderer)
- Existing audio/transcription stack:
  - Renderer: `MediaRecorder` + WebAudio (`AudioContext`, analyser) for capture and visualization
  - Main: Local Whisper via `whisper.cpp` through `src/services/localWhisperService.js` (FFmpeg used for conversion)
  - IPC routes in `src/main/ipcHandlers.js` (`transcription:file`, `transcription:audio`)
- Dependencies already present: `fluent-ffmpeg`, `ffmpeg-static`, `jest`, `@playwright/test`
- Target addition: on-device VAD and segmentation in renderer with fallback to lightweight energy-based VAD when a native/WebRTC VAD isn’t available

## Technical Implementation Brief
- Two-stage gating to prevent hallucinations without losing speech:
  1) Pre-capture/ongoing gating in renderer: continuous VAD over 10–30 ms frames with lookback/hangover to determine when to start/stop chunking and when to enqueue chunks for transcription. When input is silent/noise only, do not enqueue chunks.
  2) In-chunk segmentation in renderer: for a recorded chunk, perform fast offline VAD over PCM to split into voiced subsegments. Only send voiced subsegments to `transcription:audio` with context prompt for continuity. Add lead-in (lookback) and hangover to preserve first/last phonemes.
- Calibration: measure noise floor for 500–1000 ms at session start; optionally adaptive updates every N seconds when confidence is high and no speech is detected.
- Strictness modes map to thresholds/min durations:
  - Conservative: lower sensitivity, longer hangover (minimize missed speech)
  - Balanced: defaults from PRD
  - Aggressive: higher sensitivity, shorter hangover (maximize skipping)
- Fallback strategy: if WebRTC-class VAD is unavailable, use energy + zero-crossing rate (ZCR) heuristic VAD tuned by calibrated noise floor. Prefer pass-through in ambiguous cases and tag segments with low confidence.
- Observability: collect per-session metrics: frames analyzed, silent frames skipped, voiced frames sent, segments dropped/kept, avg decision time, ambiguous decisions. Expose via console logs in dev and a summary object retrievable for QA.
- Minimal invasiveness: integrate with existing `RecordingController` flow. Replace current “smart chunking” level thresholding with VAD signals; keep IPC and Whisper services unchanged where possible. Optional IPC method for batch segments can be introduced later but not required initially.

## Source Code Structure
- Renderer (new):
  - `src/renderer/utils/vad/energyVAD.js` — Energy + ZCR based VAD implementation with calibration and tunables.
  - `src/renderer/utils/vad/webrtcVAD.js` — Thin wrapper adapter for a WebRTC VAD dependency (optional, feature-flagged).
  - `src/renderer/utils/vad/segmenter.js` — Offline segmentation over PCM using the VAD; returns voiced intervals with lead-in/hangover.
  - `src/renderer/utils/ringBuffer.js` — Fixed-size ring buffer for lookback frames.
  - `src/renderer/utils/wavEncoder.js` — Encode Float32 PCM (mono, 16 kHz) to WAV (PCM 16) for sending subsegments to main.
  - `src/renderer/utils/metrics.js` — Client-side metrics collector for VAD decisions and queue behavior.
- Renderer (changes):
  - `src/renderer/controllers/RecordingController.js` —
    - Wire in VAD during recording: frame extraction via `AudioWorklet` or `ScriptProcessorNode` fallback.
    - Replace “audioLevelThreshold” smart stopping with VAD-driven start/stop and quiet-moment detection.
    - Before queueing a chunk for transcription, run `segmenter` to drop empty chunks or split into subsegments; enqueue only voiced subsegments (converted to WAV via `wavEncoder`). Maintain context prompt continuity between consecutive subsegments.
    - Update UI status to show “Listening…” during silence.
- Main (optional additions):
  - `src/main/ipcHandlers.js` — keep `transcription:audio` unchanged; optionally add `transcription:audioSegments` later for batch submission (Phase 3+). Expose `recording:vadMetrics:get` to fetch metrics for QA.
- Config:
  - `src/config/default.js` and `src/config.js` — add `vad` block and map to simplified config getters/setters. Provide mode presets.

## Contracts
- Config additions (`src/config/default.js`):
  - `vad: { enabled: true, mode: 'balanced', calibrationMs: 800, adaptive: true, sensitivity: 0.6, minSpeechMs: 240, minSilenceMs: 350, leadInMs: 200, hangoverMs: 250 }`
  - `recording: { ...existing, silenceIndicator: true }`
- Config setters/getters (`src/config.js`):
  - Allow runtime updates for `vad.enabled`, `vad.mode`, and tunables; persist like existing whisper settings.
- Renderer internal VAD interface:
  - `VAD.detect(frame: Float32Array, sampleRate: number): { isSpeech: boolean, confidence: number }`
  - `VAD.calibrate(frames: Float32Array[], sampleRate: number): CalibrationState`
  - `segmenter.segment(pcm: Float32Array, sampleRate: number, cfg): Array<{ startMs: number, endMs: number, confidence: number }>`
  - `wavEncoder.encodeMono16kLE(pcm: Float32Array, sampleRate: number): ArrayBuffer` (re-sample if needed)
- Renderer queue item (internal):
  - `{ chunkNumber: number, blob?: Blob, wavBuffers?: ArrayBuffer[], timestamp: number }`
- IPC (existing, unchanged):
  - `transcription:audio` accepts `ArrayBuffer` of audio (webm/wav) and optional context prompt; returns `{ success, text, segments }`.
- IPC (optional future):
  - `transcription:audioSegments` accepts `{ buffers: ArrayBuffer[], contextPrompt?: string }` and returns combined result with ordered segments.
- Metrics shape:
  - `VADMetrics = { sessionId: string, analyzedFrames: number, silentFrames: number, voicedFrames: number, droppedChunks: number, sentSegments: number, avgDecisionMs: number, ambiguousDecisions: number }`
  - Exposed via renderer console and an IPC getter `recording:vadMetrics:get` (non-persistent).

## Delivery Phases
1) Phase 1 — Pre-capture gating (energy-based) and silence UI
   - Add `energyVAD`, `ringBuffer`, minimal metrics collector, and wire into `RecordingController` to start/stop chunking based on VAD instead of level threshold.
   - Show “Listening…” when silent; do not enqueue chunks that contain no voiced frames.
   - Config: `vad.enabled`, `vad.mode` with presets (map to constants in `energyVAD`).
   - MVP: Empty/silent input yields no hallucinated text; speech still reaches transcription as whole chunks.

2) Phase 2 — In-chunk segmentation
   - Add `segmenter` and `wavEncoder`; when a chunk completes, decode to PCM via `AudioContext.decodeAudioData`, run segmentation, encode voiced subsegments to WAV, enqueue subsegments individually for `transcription:audio` with context prompt continuity.
   - Preserve ordering and add lead-in/hangover around segments; skip fully silent chunks.
   - MVP: A 10 s mixed chunk yields only speech subsegments, in order, without losing first syllables.

3) Phase 3 — WebRTC VAD integration + strictness
   - Integrate optional WebRTC VAD adapter (`webrtcVAD`) and a feature flag `vad.engine: 'energy' | 'webrtc'`.
   - Implement strictness modes (conservative/balanced/aggressive) mapping to sensitivity, min speech/silence, and hangover.
   - MVP: Better robustness in noisy environments; mode switch observable in metrics.

4) Phase 4 — Observability, calibration, and settings surface
   - Add calibration flow on recording start; optional adaptive updates during long silence windows.
   - IPC getter for metrics; lightweight UI toggles in the existing record tab (enable/disable gating, mode select). Persist settings via config.
   - MVP: Per-session metrics available; user can tune behavior without code changes.

## Verification Strategy
- Common commands
  - Lint: `npm run lint`
  - Unit tests: `npm run test:unit`
  - Integration tests: `npm run test:integration`
  - E2E (optional, manual verification assists): `npm run start:e2e:quick`

- Helper scripts to add (Phase 1 when scaffolding):
  - `scripts/gen-fixtures.sh` — Generate simple audio fixtures with silence and noise using ffmpeg. Examples:
    - `ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 5 tests/fixtures/audio/silence_5s.wav`
    - `ffmpeg -f lavfi -i anoisesrc=color=white:amplitude=0.02:r=16000 -t 5 tests/fixtures/audio/noise_low_5s.wav`
    - `ffmpeg -f lavfi -i sine=frequency=220:sample_rate=16000 -t 5 tests/fixtures/audio/tone_5s.wav`
    - `ffmpeg -i tests/fixtures/audio/tone_5s.wav -af "silencedetect=noise=-45dB:d=0.2" -f null -` (verification only)
  - `scripts/verify-vad.js` — Node script that loads WAVs, runs `energyVAD` frame-by-frame, prints voiced/silent ratio, and estimates segments.
  - `scripts/verify-segmentation.js` — Loads a fixture (speech + silence), runs `segmenter`, prints segments, and writes debug WAVs for each segment to `tests/fixtures/out/`.
  - `scripts/bench-vad.js` — Measures average per-frame decision time over 5–10 seconds PCM to ensure added P50 latency budget is met.

- Sample input artifacts
  - Silence/noise/tone fixtures: generated locally by `scripts/gen-fixtures.sh` (agent-generated, no network).
  - Real speech samples: discoverable online (e.g., short open-licensed clips) or provided by the user for best realism. The agent may fetch small Creative Commons samples if network is permitted, else proceed with tone/noise plus manual tests.

- MCP servers to assist verification
  - Filesystem server — generate and read fixtures and outputs.
  - Shell/process server — run `ffmpeg` (via `ffmpeg-static` or system ffmpeg) and helper scripts.
  - HTTP server (optional) — download open-licensed speech samples when allowed.

- Deliverable verification by phase
  1) Phase 1
     - Run `node scripts/verify-vad.js tests/fixtures/audio/silence_5s.wav` → expect >95% silent frames, 0 voiced segments.
     - Start app, enable ongoing transcription, keep quiet: expect UI “Listening…”, no text emitted for ≥5 s.
     - Speak briefly: expect immediate chunking and text with no prior hallucinations.
  2) Phase 2
     - Create a mixed file: 2 s silence + 3 s tone/noise labeled “speech surrogate” + 2 s silence (via `gen-fixtures.sh`).
     - Run `node scripts/verify-segmentation.js` → expect one segment ~3 s with lead-in/hangover padding.
     - In app, record a single mixed chunk (silence → speech → silence). Verify only the speech portion is enqueued to Whisper and text appears once; no extraneous tokens before/after.
  3) Phase 3
     - Switch modes via settings (conservative/balanced/aggressive). With constant low-level noise playing, verify silent frames skipped increases with aggressive mode, and missed speech does not increase materially in conservative mode (manual + console metrics).
  4) Phase 4
     - Verify metrics endpoint `recording:vadMetrics:get` returns increasing counters during a session; ensure calibration reduces false positives in noisy rooms (manual check, console output, and scripted bench).

- Notes
  - If system `ffprobe` isn’t available, verification scripts should not depend on it (use WAV headers and simple analysis).
  - For portability, helper scripts should rely on `ffmpeg-static` when available; fall back to system `ffmpeg` otherwise.

