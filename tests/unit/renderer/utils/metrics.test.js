const metrics = require('../../../../src/renderer/utils/metrics.js');

describe('VAD Metrics', () => {
  // module required above

  test('session lifecycle and counters', () => {
    metrics.startSession('test_session');
    let m = metrics.getMetrics();
    expect(m.sessionId).toBe('test_session');
    expect(m.analyzedFrames).toBe(0);
    expect(m.voicedFrames).toBe(0);
    expect(m.silentFrames).toBe(0);

    // Two frames: one speech, one silence, with decision times
    metrics.onFrameDecision({ isSpeech: true, confidence: 0.9, decisionMs: 2 });
    metrics.onFrameDecision({ isSpeech: false, confidence: 0.4, decisionMs: 4 });
    m = metrics.getMetrics();
    expect(m.analyzedFrames).toBe(2);
    expect(m.voicedFrames).toBe(1);
    expect(m.silentFrames).toBe(1);
    expect(m.avgDecisionMs).toBeGreaterThan(0);

    // Ambiguous band around 0.5 ± 0.15 (i.e., (0.35; 0.65))
    const beforeAmb = m.ambiguousDecisions;
    metrics.onFrameDecision({ isSpeech: true, confidence: 0.49, decisionMs: 1 });
    m = metrics.getMetrics();
    expect(m.ambiguousDecisions).toBe(beforeAmb + 1);

    // Dropped and sent segments counters
    metrics.onDroppedChunk();
    metrics.onSentSegment(3);
    m = metrics.getMetrics();
    expect(m.droppedChunks).toBeGreaterThanOrEqual(1);
    expect(m.sentSegments).toBeGreaterThanOrEqual(3);

    metrics.endSession();
  });
});
