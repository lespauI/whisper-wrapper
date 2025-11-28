Title: Silence/noise hallucination check on silince.waw

Summary
- Verified VAD + offline segmentation against a pure-silence file and mixed fixtures.
- Pure silence is correctly detected as 100% silent and yields 0 segments (skipped).
- Likely source of observed hallucinations: testing path bypassed the VAD/segmentation pipeline (e.g., direct LocalWhisperService transcription) or VAD disabled in UI/config.
- Pink/white noise can still be partially flagged as speech by the simple energy VAD; use webrtc engine + aggressive mode when needed.

Repro Steps (run from repo root)
1) Place silence file per report (extension doesn’t matter; WAV header required):
   - Copied for convenience: `cp tests/fixtures/audio/silence_5s.wav tests/data/silince.waw`

2) Verify frame-level VAD:
   - Command: `node scripts/verify-vad.js tests/data/silince.waw`
   - Observed output:
     - Sample rate: 16000
     - Frames: 250 (20ms each)
     - Voiced frames: 0 (0.00%)
     - Silent frames: 250 (100.00%)
     - Segments: 0 []

3) Verify offline segmentation (same engine used by ongoing transcription queue):
   - Command: `node scripts/verify-segmentation.js tests/data/silince.waw`
   - Observed output: `Segments: 0 []` (no segments -> chunk skipped in queue).

4) Sanity check mixed file behavior (preserves speech, skips silence):
   - Command: `node scripts/verify-segmentation.js tests/fixtures/audio/mixed_silence_tone_silence_7s.wav`
   - Observed output: `Segments: 1 [ { startMs: ~1800, endMs: ~5200 } ]` and a debug WAV written.

Notes on possible mismatch with your test
- If you invoked `scripts/test-transcription.js` or used LocalWhisperService directly, that path bypasses the VAD gating/segmentation and will feed Whisper directly — Whisper may hallucinate on silence there.
- The ongoing transcription path (renderer) always segments chunks first; fully silent chunks are dropped with log: `had no voiced segments — skipped`.
- Ensure VAD is enabled in the UI (Skip silence/noise) and/or `vad.enabled: true` in config. Balanced or Aggressive mode recommended.

Noise handling guidance
- On `tests/fixtures/audio/noise_5s.wav`, the simple energy VAD can mark a large portion as speech.
- For noisy laptops/rooms, switch engine to `webrtc` and mode to `aggressive`. This tightens thresholds and reduces false positives.

Quick checks in app
- Start ongoing transcription with VAD enabled. Stay silent:
  - Expect: no chunks enqueued; status shows “Listening…”.
- Speak briefly:
  - Expect: a short chunk recorded and enqueued; only the voiced segment transcribed.

Recommendation
- For direct-file transcription (outside ongoing pipeline), add a Whisper-level guard to treat very short/low-confidence outputs as silence (e.g., drop when no segments or text is empty/garbage). This doesn’t affect the ongoing pipeline but prevents hallucinations in `LocalWhisperService` tests on silence-only files.

