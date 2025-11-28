/*
 * Verify offline segmentation on WAV fixtures and write per-segment debug WAVs.
 * Usage:
 *   node scripts/verify-segmentation.js [<path-to-wav>]
 * If no file is provided, uses tests/fixtures/audio/mixed_silence_tone_silence_7s.wav
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadEnergyVAD() {
  const vadPath = path.resolve(__dirname, './lib/energyVAD.mjs');
  try {
    const mod = await import(pathToFileURL(vadPath).href);
    return mod;
  } catch (e) {
    console.error('Failed to import energyVAD module:', e);
    process.exit(1);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readWavPCM16Mono(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  let offset = 12;
  let sampleRate = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const next = offset + 8 + size;
    if (id === 'fmt ') {
      const audioFormat = buf.readUInt16LE(offset + 8);
      numChannels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
      if (audioFormat !== 1) throw new Error('Only PCM format supported');
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset = next;
  }
  if (!dataOffset) throw new Error('WAV data chunk not found');
  if (numChannels !== 1) throw new Error('Only mono WAV supported');
  if (bitsPerSample !== 16) throw new Error('Only 16-bit PCM supported');
  const samples = dataSize / 2;
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const s = buf.readInt16LE(dataOffset + i * 2);
    out[i] = s / 32768;
  }
  return { sampleRate, pcm: out };
}

function framePCM(pcm, sampleRate, frameMs) {
  const frameSize = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const frames = [];
  for (let i = 0; i + frameSize <= pcm.length; i += frameSize) {
    frames.push(pcm.subarray(i, i + frameSize));
  }
  return { frames, frameSize };
}

function mergeOverlapping(segs) {
  if (segs.length <= 1) return segs;
  segs.sort((a,b) => a.startMs - b.startMs);
  const out = [];
  let cur = { ...segs[0] };
  for (let i = 1; i < segs.length; i++) {
    const s = segs[i];
    if (s.startMs <= cur.endMs) {
      cur.endMs = Math.max(cur.endMs, s.endMs);
    } else {
      out.push(cur);
      cur = { ...s };
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  const { calibrate, detect } = await loadEnergyVAD();

  const inputFile = process.argv[2] || path.resolve(__dirname, '../tests/fixtures/audio/mixed_silence_tone_silence_7s.wav');
  const absInput = path.resolve(inputFile);
  if (!fs.existsSync(absInput)) {
    console.error('Input file not found:', absInput);
    console.error('Hint: run bash scripts/gen-fixtures.sh first.');
    process.exit(1);
  }

  const { sampleRate, pcm } = readWavPCM16Mono(absInput);
  const frameMs = 20;
  const calibrationMs = 800;
  const sensitivity = 0.6;
  const minSpeechMs = 240;
  const minSilenceMs = 350;
  const leadInMs = 200;
  const hangoverMs = 250;

  const { frames, frameSize } = framePCM(pcm, sampleRate, frameMs);
  const totalFrames = frames.length;
  const calFramesCount = Math.max(1, Math.min(totalFrames, Math.round(calibrationMs / frameMs)));
  const state = calibrate(frames.slice(0, calFramesCount), sampleRate, { adaptive: true });

  const minSpeechFrames = Math.max(1, Math.round(minSpeechMs / frameMs));
  const minSilenceFrames = Math.max(1, Math.round(minSilenceMs / frameMs));
  const leadInFrames = Math.max(0, Math.round(leadInMs / frameMs));
  const hangoverFrames = Math.max(0, Math.round(hangoverMs / frameMs));

  const decisions = new Array(totalFrames);
  for (let i = 0; i < totalFrames; i++) {
    const { isSpeech } = detect(frames[i], sampleRate, state, { sensitivity, adaptive: true });
    decisions[i] = !!isSpeech;
  }

  const rawSegments = [];
  let runState = 'silence';
  let speechRun = 0;
  let silenceRun = 0;
  let startIdx = 0;
  for (let i = 0; i < totalFrames; i++) {
    const d = decisions[i];
    if (runState === 'silence') {
      if (d) {
        if (speechRun === 0) startIdx = i;
        speechRun++;
        if (speechRun >= minSpeechFrames) {
          runState = 'speech';
          silenceRun = 0;
        }
      } else {
        speechRun = 0;
      }
    } else {
      if (!d) {
        silenceRun++;
        if (silenceRun >= minSilenceFrames) {
          const endIdx = i - silenceRun + 1;
          rawSegments.push({ startFrame: startIdx, endFrame: endIdx });
          runState = 'silence';
          speechRun = 0;
          silenceRun = 0;
        }
      } else {
        silenceRun = 0;
      }
    }
  }
  if (runState === 'speech') {
    rawSegments.push({ startFrame: startIdx, endFrame: totalFrames });
  }

  const padded = rawSegments.map(seg => {
    const start = Math.max(0, seg.startFrame - leadInFrames);
    const end = Math.min(totalFrames, seg.endFrame + hangoverFrames);
    return { startMs: start * frameMs, endMs: end * frameMs };
  });
  const segments = mergeOverlapping(padded);

  console.log('File:', absInput);
  console.log('Sample rate:', sampleRate);
  console.log('Frames:', totalFrames, `(${frameMs}ms each)`);
  console.log('Segments:', segments.length, segments);

  // Write per-segment WAVs
  const outDir = path.resolve(__dirname, '../tests/fixtures/out');
  ensureDir(outDir);
  segments.forEach((seg, idx) => {
    const startSample = Math.max(0, Math.floor((seg.startMs / 1000) * sampleRate));
    const endSample = Math.min(pcm.length, Math.ceil((seg.endMs / 1000) * sampleRate));
    const slice = pcm.subarray(startSample, endSample);
    const wav = encodePCM16(slice, sampleRate);
    const outPath = path.join(outDir, `segment_${idx + 1}_${Math.round(seg.startMs)}ms_${Math.round(seg.endMs)}ms.wav`);
    fs.writeFileSync(outPath, Buffer.from(wav));
    console.log('Wrote', outPath);
  });

  if (segments.length === 0) {
    console.warn('No segments detected. Adjust sensitivity/hangover thresholds as needed.');
  }
}

function encodePCM16(monoFloat32, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = monoFloat32.length * bytesPerSample;
  const totalSize = 44 + dataSize;
  const ab = new ArrayBuffer(totalSize);
  const view = new DataView(ab);
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < monoFloat32.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, monoFloat32[i]));
    view.setInt16(off, Math.round(s * 32767), true);
  }
  return ab;
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

