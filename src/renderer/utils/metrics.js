/**
 * VAD Metrics (per recording session)
 * Shape: {
 *   sessionId,
 *   analyzedFrames,
 *   silentFrames,
 *   voicedFrames,
 *   droppedChunks,
 *   sentSegments,
 *   avgDecisionMs,
 *   ambiguousDecisions
 * }
 */

const DEFAULTS = () => ({
  sessionId: null,
  analyzedFrames: 0,
  silentFrames: 0,
  voicedFrames: 0,
  droppedChunks: 0,
  sentSegments: 0,
  avgDecisionMs: 0,
  ambiguousDecisions: 0,
});

let current = DEFAULTS();
let lastPublishTs = 0;
let lastLogTs = 0;

function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

function publish(throttleMs = 500) {
  const t = nowMs();
  if (t - lastPublishTs < throttleMs) return;
  lastPublishTs = t;
  try {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.updateVADMetrics === 'function') {
      window.electronAPI.updateVADMetrics({ ...current, _ts: Date.now() });
    }
  } catch (e) {
    // Best-effort only
  }
}

function maybeLog(throttleMs = 2000) {
  const t = nowMs();
  if (t - lastLogTs < throttleMs) return;
  lastLogTs = t;
  try {
    // Lightweight, single-line summary for dev visibility
    // eslint-disable-next-line no-console
    console.log(
      `VAD metrics [${current.sessionId || 'n/a'}]: frames=${current.analyzedFrames} (V=${current.voicedFrames}/S=${current.silentFrames}) ` +
      `amb=${current.ambiguousDecisions} drops=${current.droppedChunks} sentSeg=${current.sentSegments} avgMs=${current.avgDecisionMs.toFixed(2)}`
    );
  } catch {}
}

export function startSession(sessionId) {
  current = DEFAULTS();
  current.sessionId = sessionId || `vad_${Date.now().toString(36)}`;
  lastPublishTs = 0;
  lastLogTs = 0;
  publish(0);
  maybeLog(0);
}

export function endSession() {
  publish(0);
}

export function getMetrics() {
  return { ...current };
}

/**
 * Update per-frame decision metrics.
 * @param {Object} d
 * @param {boolean} d.isSpeech
 * @param {number} d.confidence 0..1
 * @param {number} d.decisionMs wall time for decision
 */
export function onFrameDecision({ isSpeech, confidence, decisionMs }) {
  current.analyzedFrames += 1;
  if (isSpeech) current.voicedFrames += 1; else current.silentFrames += 1;
  const n = current.analyzedFrames;
  if (Number.isFinite(decisionMs) && decisionMs >= 0) {
    // Running average
    current.avgDecisionMs = ((current.avgDecisionMs * (n - 1)) + decisionMs) / n;
  }
  // Ambiguous if near 0.5 (±0.15)
  const ambBand = 0.15;
  if (confidence > (0.5 - ambBand) && confidence < (0.5 + ambBand)) {
    current.ambiguousDecisions += 1;
  }
  publish();
  maybeLog();
}

export function onDroppedChunk() {
  current.droppedChunks += 1;
  publish();
}

export function onSentSegment(count = 1) {
  current.sentSegments += Math.max(1, Number(count) || 1);
  publish();
}

export default {
  startSession,
  endSession,
  getMetrics,
  onFrameDecision,
  onDroppedChunk,
  onSentSegment,
};

