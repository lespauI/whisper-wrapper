const seg = require('../../../../src/renderer/utils/vad/segmenter.js');

function genSilence(seconds, sampleRate) {
  return new Float32Array(Math.floor(seconds * sampleRate));
}

function genTone(seconds, sampleRate, freq = 220, amp = 0.2) {
  const n = Math.floor(seconds * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = amp * Math.sin(2 * Math.PI * freq * (i / sampleRate));
  }
  return out;
}

function concatFloat32(a, b, c) {
  const total = a.length + b.length + (c ? c.length : 0);
  const out = new Float32Array(total);
  out.set(a, 0);
  out.set(b, a.length);
  if (c) out.set(c, a.length + b.length);
  return out;
}

describe('segmenter.segment', () => {
  // module required above

  test('returns empty on empty input', () => {
    const res = seg.segment(new Float32Array(0), 16000, {});
    expect(res.segments).toEqual([]);
  });

  test('detects a single voiced segment with padding', () => {
    const sr = 16000;
    const pcm = concatFloat32(
      genSilence(1.0, sr),   // 0-1s silence
      genTone(3.0, sr),      // 1-4s tone (voiced)
      genSilence(1.0, sr)    // 4-5s silence
    );

    const opts = {
      frameMs: 20,
      calibrationMs: 800,
      sensitivity: 0.6,
      minSpeechMs: 240,
      minSilenceMs: 350,
      leadInMs: 200,
      hangoverMs: 250,
    };

    const res = seg.segment(pcm, sr, opts);
    const { segments } = res;
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBe(1);

    const s = segments[0];
    // Start should be ~1.0s minus lead-in (200ms) but not <0 => around 800ms
    expect(s.startMs).toBeGreaterThanOrEqual(600);
    expect(s.startMs).toBeLessThanOrEqual(1200);
    // End should be ~4.0s plus hangover (~4.25s)
    expect(s.endMs).toBeGreaterThanOrEqual(4000);
    expect(s.endMs).toBeLessThanOrEqual(4500);
  });
});
