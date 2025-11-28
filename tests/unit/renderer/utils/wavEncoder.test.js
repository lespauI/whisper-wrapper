const wav = require('../../../../src/renderer/utils/wavEncoder.js');

function viewFromBuffer(ab) {
  return new DataView(ab);
}

describe('wavEncoder.encodePCM16', () => {
  // module required above

  test('validates inputs', () => {
    expect(() => wav.encodePCM16(null, 16000)).toThrow();
    expect(() => wav.encodePCM16(new Float32Array(1), 0)).toThrow();
  });

  test('creates valid RIFF/WAVE header and data', () => {
    const samples = new Float32Array([0, 1, -1, 0.5, -0.5]);
    const sr = 16000;
    const ab = wav.encodePCM16(samples, sr);
    const dv = viewFromBuffer(ab);

    // Header tags
    const str = (off, len) => String.fromCharCode(...Array.from({ length: len }, (_, i) => dv.getUint8(off + i)));
    expect(str(0,4)).toBe('RIFF');
    expect(str(8,4)).toBe('WAVE');
    expect(str(12,4)).toBe('fmt ');
    expect(str(36,4)).toBe('data');

    // Sample rate
    expect(dv.getUint32(24, true)).toBe(sr);

    // Data size matches samples * 2 bytes
    const dataSize = dv.getUint32(40, true);
    expect(dataSize).toBe(samples.length * 2);

    // First few PCM16 samples (little endian)
    expect(dv.getInt16(44, true)).toBe(0);
    expect(dv.getInt16(46, true)).toBe(32767);
    expect(dv.getInt16(48, true)).toBe(-32767);
  });
});
