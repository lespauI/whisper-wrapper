# Ongoing Transcription: Silence/Noise Detection (VAD) and Anti‑Hallucination

This feature reduces hallucinations during ongoing transcription by avoiding transcription of silence and background noise. It combines real‑time input gating with offline segmentation so only voiced speech is sent to Whisper.

## Why
- Whisper often hallucinates when fed silence or stationary noise.
- Laptop mics and typical rooms have persistent noise floors.
- We need low‑latency ongoing transcription without losing speech that’s mixed with silence in the same chunk.

## What It Does
- Pre‑capture gating: VAD runs on 10–30 ms frames while recording. During silence/noise, the app holds (“Listening…”) and does not start a chunk. Speech triggers chunk start with lead‑in padding; sustained silence ends the chunk with hangover padding.
- Offline segmentation per chunk: When a chunk ends, it’s decoded to PCM and segmented with the same VAD logic (min speech/silence, lead‑in/hangover). Only voiced subsegments are enqueued to Whisper, preserving continuity without hallucinating silent parts.

## How To Use
- Recording tab → enable “Ongoing transcription”.
- By default VAD gating is on. The status shows “Listening…” during silence, and starts recording as soon as you speak.
- Settings → “VAD Gating”:
  - Engine: `energy` (default) or `webrtc`
  - Mode: `conservative`, `balanced` (default), `aggressive`
  - Settings persist across restarts.

## Settings Reference
- Config keys (defaults shown):
  - `vad.enabled: true`
  - `vad.engine: 'energy'` (or `'webrtc'`)
  - `vad.mode: 'balanced'`
  - `vad.calibrationMs: 800`, `vad.adaptive: true`
  - `vad.sensitivity: 0.6`
  - `vad.minSpeechMs: 240`, `vad.minSilenceMs: 350`
  - `vad.leadInMs: 200`, `vad.hangoverMs: 250`
  - `recording.silenceIndicator: true`
- UI: toggle enabled/engine/mode; other tunables derive from presets and can be adjusted in config.

## Recommended Modes
- Quiet room, normal voice: `balanced` (default)
- Noisy environment (fans/AC/streets): `aggressive`
- Very soft speakers / distant mic: `conservative`

## Behavior With Mixed Audio
- Example: 10 s chunk with 2 s silence → 5 s speech → 3 s silence
  - Real‑time: chunk starts shortly before speech (lead‑in) and stops after hangover.
  - Offline: only the ~5 s voiced interval is sent to Whisper. Silence is skipped; no lost syllables thanks to padding.

## Performance
- Frame‑level gating adds microseconds per frame and runs in the renderer audio graph.
- Offline segmentation runs only after a chunk finishes and operates in O(N) over PCM.
- Decision latency governed by min speech/silence and padding (tunable by mode).

## Troubleshooting
- Hallucinations remain: switch to `aggressive`; increase `minSilenceMs`; ensure microphone isn’t auto‑gain boosting noise.
- Missed soft speech: switch to `conservative`; slightly raise `sensitivity`; reduce `minSpeechMs`.
- On laptops with constant fan noise: try `webrtc` engine with `balanced` or `aggressive`.

## Verify It Works
- Generate fixtures: `bash scripts/gen-fixtures.sh`
- VAD check: `node scripts/verify-vad.js tests/fixtures/audio/silence_5s.wav`
  - Expect >95% silent frames.
- Segmentation check: `node scripts/verify-segmentation.js`
  - Expect a single voiced segment for the mixed file.

## Implementation Links
- Recording controller with VAD gating and segmentation queue: `src/renderer/controllers/RecordingController.js`
- Energy/ZCR VAD: `src/renderer/utils/vad/energyVAD.js`
- Offline segmenter: `src/renderer/utils/vad/segmenter.js`
- WebRTC VAD adapter: `src/renderer/utils/vad/webrtcVAD.js`
- WAV encoder: `src/renderer/utils/wavEncoder.js`
- Metrics and IPC getter: `src/renderer/utils/metrics.js`, `src/main/ipcHandlers.js`
- Config defaults: `src/config/default.js`

