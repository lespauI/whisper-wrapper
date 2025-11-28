const webrtcVAD = require('../../../../src/renderer/utils/vad/webrtcVAD.js');
const energyVAD = require('../../../../src/renderer/utils/vad/energyVAD.js');

function genSineFrame(freq, amp, sampleRate, frameSize) {
  const out = new Float32Array(frameSize);
  const dt = 1 / sampleRate;
  for (let i = 0; i < frameSize; i++) {
    out[i] = amp * Math.sin(2 * Math.PI * freq * (i * dt));
  }
  return out;
}

describe('webrtcVAD adapter', () => {
  const sampleRate = 16000;
  const frameMs = 20;
  const frameSize = Math.round((sampleRate * frameMs) / 1000);

  // modules required above

  test('mode presets affect threshold via sensitivity', () => {
    const silentFrames = Array.from({ length: 40 }, () => new Float32Array(frameSize));
    const state = energyVAD.calibrate(silentFrames, sampleRate, { adaptive: false });
    const frame = genSineFrame(180, 0.05, sampleRate, frameSize);

    const cons = webrtcVAD.detect(frame, sampleRate, { ...state }, { mode: 'conservative' });
    const aggr = webrtcVAD.detect(frame, sampleRate, { ...state }, { mode: 'aggressive' });

    // Aggressive => lower sensitivity => higher threshold
    expect(aggr.features.thr).toBeGreaterThan(cons.features.thr);
  });
});
