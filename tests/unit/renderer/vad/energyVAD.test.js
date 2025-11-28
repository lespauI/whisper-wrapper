const energyVAD = require('../../../../src/renderer/utils/vad/energyVAD.js');

function genSineFrame(freq, amp, sampleRate, frameSize, phase = 0) {
  const out = new Float32Array(frameSize);
  const dt = 1 / sampleRate;
  for (let i = 0; i < frameSize; i++) {
    out[i] = amp * Math.sin(2 * Math.PI * freq * (i * dt) + phase);
  }
  return out;
}

function genNoiseFrame(amp, frameSize) {
  const out = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    out[i] = (Math.random() * 2 - 1) * amp;
  }
  return out;
}

describe('energyVAD', () => {
  const sampleRate = 16000;
  const frameMs = 20;
  const frameSize = Math.round((sampleRate * frameMs) / 1000); // 320

  // module required above

  test('calibrate on silence yields sane baseline', () => {
    const silentFrames = Array.from({ length: 40 }, () => new Float32Array(frameSize)); // ~800ms
    const state = energyVAD.calibrate(silentFrames, sampleRate, { adaptive: true });
    expect(state.sampleRate).toBe(sampleRate);
    expect(state.frameSize).toBe(frameSize);
    expect(state.energyMean).toBeCloseTo(0, 5);
    // std should fallback to non-zero minimal value
    expect(state.energyStd).toBeGreaterThan(0);
    expect(state.zcrMean).toBeCloseTo(0, 2);
    expect(state.zcrStd).toBeGreaterThan(0);
  });

  test('detect: silence -> non-speech, sine tone -> speech', () => {
    const silentFrames = Array.from({ length: 40 }, () => new Float32Array(frameSize));
    const state = energyVAD.calibrate(silentFrames, sampleRate, { adaptive: true });

    const silent = new Float32Array(frameSize);
    const resSilent = energyVAD.detect(silent, sampleRate, state, { sensitivity: 0.6 });
    expect(resSilent.isSpeech).toBe(false);
    expect(resSilent.confidence).toBeGreaterThanOrEqual(0);
    expect(resSilent.confidence).toBeLessThanOrEqual(1);

    const tone = genSineFrame(200, 0.2, sampleRate, frameSize);
    const resTone = energyVAD.detect(tone, sampleRate, state, { sensitivity: 0.6 });
    expect(resTone.isSpeech).toBe(true);
    expect(resTone.confidence).toBeGreaterThan(0.3);
  });

  test('sensitivity maps to threshold as expected', () => {
    const silentFrames = Array.from({ length: 40 }, () => new Float32Array(frameSize));
    const state = energyVAD.calibrate(silentFrames, sampleRate, { adaptive: false });
    const frame = genSineFrame(150, 0.05, sampleRate, frameSize);

    const lo = energyVAD.detect(frame, sampleRate, { ...state }, { sensitivity: 0.3 });
    const hi = energyVAD.detect(frame, sampleRate, { ...state }, { sensitivity: 0.9 });
    // Higher sensitivity => lower threshold => features.thr is smaller
    expect(hi.features.thr).toBeLessThan(lo.features.thr);
  });

  test('__internals: rmsEnergy, zeroCrossingRate, meanStd', () => {
    const { __internals } = energyVAD;
    const frame = new Float32Array([0, 1, -1, 0.5, -0.5, 0]);
    expect(__internals.rmsEnergy(frame)).toBeGreaterThan(0);
    expect(__internals.zeroCrossingRate(frame)).toBeGreaterThan(0);
    const s = __internals.meanStd([1, 2, 3, 4]);
    expect(s.mean).toBeCloseTo(2.5, 5);
    expect(s.std).toBeGreaterThan(0);
  });
});
