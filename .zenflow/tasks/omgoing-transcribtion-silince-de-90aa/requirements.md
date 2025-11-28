# Feature Specification: Ongoing Transcription Silence/Noise Detection and Hallucination Prevention

## User Stories*

### User Story 1 - Real-time transcript avoids hallucinations
**Acceptance Scenarios**:
1. Given the microphone is capturing only background noise or silence, When ongoing transcription is running, Then no spurious or hallucinated text is emitted and the UI indicates idle/listening appropriately.
2. Given intermittent low-level noise (e.g., laptop fan, HVAC), When ongoing transcription is running, Then no partial random words are emitted and the stream remains clean until speech is detected.

### User Story 2 - Preserve speech within noisy/silent chunks
**Acceptance Scenarios**:
1. Given a 10-second audio chunk with 5 seconds of noise/silence and 5 seconds of true speech, When processed, Then only the speech segments are transcribed and surfaced in order without losing the first words.
2. Given speech that starts immediately after a brief silence, When detection occurs, Then the first syllables/words are preserved via short lookback/hangover buffering and not clipped.

### User Story 3 - Low-latency, responsive experience
**Acceptance Scenarios**:
1. Given a typical laptop microphone and CPU, When ongoing transcription is active, Then additional latency from silence/noise detection remains imperceptible to the user (see Success Criteria) and does not reduce update frequency.
2. Given extended periods of silence, When detection skips sending silent audio, Then CPU/network usage and cost are reduced versus baseline by skipping non-speech frames.

### User Story 4 - Configurable and adaptive behavior
**Acceptance Scenarios**:
1. Given a noisy environment (constant AC hum), When the user runs or accepts auto-calibration, Then the system adapts the noise floor and speech thresholds and continues to avoid hallucinations without missing normal speech.
2. Given advanced settings are changed (thresholds, min speech duration), When a session continues, Then changes take effect immediately and are reflected in logs/metrics for troubleshooting.

### User Story 5 - Observability and safety
**Acceptance Scenarios**:
1. Given a recording session, When it ends, Then metrics are available for silent frames skipped, voiced frames processed, and detection errors to aid tuning and QA.
2. Given detection confidence is low/ambiguous, When a decision must be made, Then the system prefers pass-through-to-transcribe rather than dropping, to minimize content loss (with a low-confidence flag for downstream handling).

---

## Requirements*

### Functional Requirements
- Detect and gate silence/noise before transcription to prevent hallucinated text on silent/noisy input.
- Preserve and transcribe voiced content within partially silent/noisy chunks via sub-segmentation (don’t discard the whole chunk).
- Provide real-time operation suitable for ongoing/streaming transcription with minimal added latency.
- Implement on-device, lightweight voice activity/noise detection (e.g., WebRTC VAD–class or equivalent) with:
  - Adaptive noise floor calibration at session start and optional continuous adaptation.
  - Configurable thresholds: VAD sensitivity, minimum speech duration, minimum silence duration, hangover/lead-in.
  - Short lookback/lead-in buffer (e.g., 150–300 ms) to avoid clipping first phonemes when speech starts.
- Support two gating stages:
  1) Pre-capture/record gating (don’t enqueue frames that are clearly non-speech).
  2) In-chunk segmentation (for already-recorded chunks, split and only send voiced subsegments to transcription).
- Maintain temporal alignment across subsegments so the resulting transcript remains ordered and continuous.
- Expose a “strictness” mode: conservative (minimize missed speech), balanced (default), aggressive (maximize skip to save cost/resources).
- Provide user-visible feedback during silence (e.g., “Listening…”) without emitting text.
- Fail safe: if detection is unavailable or confidence is ambiguous, pass audio through to transcription rather than risk content loss, tagging low confidence for analytics.

### Non-Functional Requirements
- Performance/Latency: Keep added median latency under the budget in Success Criteria. Detection must run in real time on typical laptop CPUs without GPU.
- Efficiency: Skip silent frames to reduce compute/network cost when using remote transcription; ensure negligible overhead when audio is mostly speech.
- Reliability: No crashes or deadlocks under long silences or rapid speech/noise transitions. Handle buffer backpressure gracefully.
- Compatibility: Work with built-in laptop microphones and common OS audio stacks; no special hardware required.
- Accessibility/UX: Indicators for recording state and silence; no sudden transcript flicker or backtracking caused by gating.
- Privacy/Security: Perform VAD locally; only send audio that contains speech to remote services (if used). Do not persist raw audio unless explicitly enabled for debugging.

### Configuration & Controls
- Toggle: Enable/disable silence/noise gating (default: enabled).
- Modes: Conservative, Balanced (default), Aggressive.
- Thresholds: VAD sensitivity, min speech duration (e.g., 200–300 ms), min silence duration (e.g., 300–500 ms), hangover/lead-in (e.g., 150–300 ms).
- Calibration: One-tap auto-calibration at session start; optional background adaptation.
- Logging: Per-session summary metrics and optional detailed debug traces (redacted, off by default).

### Edge Cases
- Very quiet speakers (low amplitude speech close to noise floor) — prefer conservative gating to reduce missed speech.
- Non-speech transients (keyboard clicks, mouse, cough) — avoid interpreting as sustained speech.
- Mixed language or accented speech — gating must remain language-agnostic.
- Long continuous speech — ensure no periodic clipping at VAD boundaries; support hangover smoothing.
- Extremely noisy environments — allow user to switch to Conservative mode to reduce false negatives.

### Assumptions (defaults if unspecified)
- Ongoing transcription is streaming or near-real-time; chunk sizes can be adjusted or sub-segmented internally.
- On-device VAD is permitted; cloud transcription may be used for ASR, but VAD happens locally.
- Acceptable to change chunking strategy (e.g., process sub-1s frames internally) while keeping external APIs stable.
- Multi-platform desktop/laptop support; mobile out of scope for this iteration.

### [NEEDS CLARIFICATION]
1. Which transcription backend is in use today (local Whisper/PyTorch, whisper.cpp, OpenAI API, other)? Are we allowed to change chunk sizes and send subsegments?
2. What is the end-to-end latency budget for “ongoing” updates (target and absolute max at P50/P95)?
3. Is it acceptable to add an on-device VAD dependency (e.g., WebRTC VAD class) and a brief calibration step at session start?
4. What should the user-facing behavior be during silence: show a placeholder (e.g., “Listening…”) or emit nothing?
5. Are there privacy constraints prohibiting sending any non-speech frames to remote services and/or storing audio for debugging/tuning?

---

## Success Criteria*
- Hallucination prevention: ≥95% of purely silent/noise windows produce no emitted text (P95), measured on internal test sets and pilot sessions.
- Content preservation: ≤2% missed leading words when speech follows silence (measured via alignment on test clips); no systematic clipping at segment boundaries.
- Latency: Additional median latency added by detection ≤20 ms per emitted update (P50), ≤60 ms (P95).
- Efficiency: When idle/silent, CPU usage and remote ASR cost reduced proportionally by skipping ≥80% of non-speech frames.
- Stability: No crashes/memory growth in 1-hour continuous sessions with mixed silence/speech.
- Configurability: Thresholds/modes adjustable at runtime; calibration improves performance in noisy environments without manual tuning.

