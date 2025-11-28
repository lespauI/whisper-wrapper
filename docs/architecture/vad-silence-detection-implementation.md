# VAD‑Based Silence/Noise Gating and Offline Segmentation — Implementation

This document describes the implementation that prevents hallucinations by avoiding transcription of silence/noise both before capture and after chunk completion.

## Overview
- Real‑time pre‑capture gating: VAD decisions on 20 ms frames drive a small state machine that starts/stops chunk recorders with lead‑in and hangover.
- Offline segmentation: After chunk completion, PCM is segmented using the same thresholds to emit only voiced subsegments to Whisper.
- Presets: `conservative` | `balanced` | `aggressive` alter sensitivity and min durations for different noise conditions.

## Modules
- Recording controller: `src/renderer/controllers/RecordingController.js`
  - Sets up VAD engine, runs calibration, manages gating state, and enqueues subsegments to Whisper.
- Energy/ZCR VAD: `src/renderer/utils/vad/energyVAD.js`
  - `calibrate(frames, sr)` builds a baseline from presumed noise; `detect(frame, sr, state, opts)` returns `{ isSpeech, confidence }`.
- Offline segmenter: `src/renderer/utils/vad/segmenter.js`
  - Segments mono PCM with min speech/silence and lead‑in/hangover; returns `[ { startMs, endMs } ]`.
- WebRTC‑class adapter: `src/renderer/utils/vad/webrtcVAD.js`
  - Maps WebRTC‑like aggressiveness to sensitivity/duration tunables; delegates to energy VAD.
- PCM16 WAV encoder: `src/renderer/utils/wavEncoder.js`
- Ring buffer utility (for lookback/hangover in future flows): `src/renderer/utils/ringBuffer.js`
- Metrics and IPC: `src/renderer/utils/metrics.js`, `src/main/ipcHandlers.js`
- Config defaults: `src/config/default.js`

## Data Flow
1. Start recording → load VAD config, select engine (`energy`|`webrtc`), apply preset (`mode`).
2. Calibrate for ~800 ms (noise baseline) and begin frame decisions.
3. VAD state machine:
   - Silence: show "Listening…"; do not start a chunk.
   - Speech crosses `minSpeechMs`: start chunk and backfill by `leadInMs`.
   - Sustained silence for `minSilenceMs`: stop chunk; extend by `hangoverMs`.
4. On chunk completion: decode to PCM → `segmenter.segment` → encode voiced intervals → enqueue each subsegment to Whisper in order with rolling prompt context.

## Key Algorithms
### Energy + ZCR VAD (energyVAD)
- Features per frame: RMS energy and zero‑crossing rate.
- Calibration: mean/std of energy and zcr from initial frames; guards against degenerate std by floors.
- Decision: `energy > mean + k*std` (k from sensitivity), or absolute floor + low ZCR; confidence blended from energy ratio and zcr deviation; slow adaptive baseline updates during non‑speech.
- Reference: `src/renderer/utils/vad/energyVAD.js:1`

### Offline Segmenter
- Frames PCM at `frameMs` (20 ms default), calibrates, then runs a run‑length state machine:
  - Require `minSpeechMs` to open a speech segment (avoid spikes).
  - Require `minSilenceMs` to close a segment (avoid chopping).
  - Apply `leadInMs` and `hangoverMs` paddings, then merge overlaps.
- Reference: `src/renderer/utils/vad/segmenter.js:1`

### VAD Presets and Engine Selection
- Runtime preset mapping drives: `sensitivity`, `minSpeechMs`, `minSilenceMs`, `hangoverMs`.
- Energy and WebRTC presets are similar but tuned per engine.
- Applied in `RecordingController._applyVADRuntime` and `initializeOngoingTranscription`.
- Reference: `src/renderer/controllers/RecordingController.js:260`

## Configuration
- Defaults: `src/config/default.js:1`
  - `vad: { engine, enabled, mode, calibrationMs, adaptive, sensitivity, minSpeechMs, minSilenceMs, leadInMs, hangoverMs }`
  - `recording: { silenceIndicator }`
- Runtime updates via config IPC; UI wires to `#vad-enabled`, `#vad-mode`, `#vad-engine`.

## IPC and Metrics
- Renderer collects per‑session metrics and snapshots to main via:
  - Getter: `recording:vadMetrics:get`
  - Setter: `recording:vadMetrics:set`
- Reference: `src/main/ipcHandlers.js:1`, `src/renderer/utils/metrics.js:1`

## Performance
- Real‑time decisions: sub‑millisecond per 20 ms frame on typical hardware.
- Offline segmentation: linear in samples; runs post‑chunk to avoid UI stalls.
- Budget verified with `scripts/bench-vad.js`.

## Verification
- Fixtures: `scripts/gen-fixtures.sh` → `tests/fixtures/audio/*`
- VAD ratios: `scripts/verify-vad.js <wav>`
- Segments + WAVs: `scripts/verify-segmentation.js` → `tests/fixtures/out/`
- Unit tests: `tests/unit/renderer/vad/*`, `tests/unit/renderer/utils/*`

## Future Work
- Multi‑band features or spectral entropy for robust classification in music.
- Buffered lookback at the capture graph using `ringBuffer` for tighter lead‑in.
- Optional diarization‑aware segmentation for multi‑speaker scenarios.

