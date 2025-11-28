/**
 * WAV encoder: Float32 mono PCM [-1,1] -> PCM16 WAV (ArrayBuffer)
 *
 * API:
 *  encodePCM16(monoFloat32: Float32Array, sampleRate: number): ArrayBuffer
 */

/**
 * Clamp a number to [-1, 1]
 * @param {number} x
 */
function clampUnit(x) {
  if (x > 1) return 1;
  if (x < -1) return -1;
  return x;
}

/**
 * Encode mono Float32 PCM into a PCM16 WAV ArrayBuffer.
 * @param {Float32Array} monoFloat32 - normalized mono samples in [-1, 1]
 * @param {number} sampleRate - samples per second (e.g., 16000)
 * @returns {ArrayBuffer}
 */
export function encodePCM16(monoFloat32, sampleRate) {
  if (!monoFloat32 || typeof monoFloat32.length !== 'number') {
    throw new Error('encodePCM16: monoFloat32 must be a Float32Array');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('encodePCM16: invalid sampleRate');
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8; // 2
  const blockAlign = numChannels * bytesPerSample; // 2
  const byteRate = sampleRate * blockAlign;
  const dataSize = monoFloat32.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true); // file size minus RIFF header
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format: 1=PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples (little endian int16)
  let offset = 44;
  for (let i = 0; i < monoFloat32.length; i++, offset += 2) {
    const s = Math.round(clampUnit(monoFloat32[i]) * 32767);
    view.setInt16(offset, s, true);
  }

  return buffer;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export default { encodePCM16 };

