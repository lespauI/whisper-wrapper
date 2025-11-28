/*
 * Verify VAD on WAV fixtures.
 * Usage:
 *   node scripts/verify-vad.js tests/fixtures/audio/silence_5s.wav
 *   node scripts/verify-vad.js tests/fixtures/audio/tone_5s.wav
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Dynamic import of ESM energyVAD (Node-friendly copy under scripts/lib)
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

function segmentFromDecisions(decisions, frameMs, opts) {
  // Minimal segmenter for verify/printing purposes
  const minSpeechMs = opts.minSpeechMs ?? 240;
  const minSilenceMs = opts.minSilenceMs ?? 350;
  const minSpeechFrames = Math.max(1, Math.round(minSpeechMs / frameMs));
  const minSilenceFrames = Math.max(1, Math.round(minSilenceMs / frameMs));

  const segments = [];
  let runState = 'silence';
  let speechRun = 0;
  let silenceRun = 0;
  let startIdx = 0;

  for (let i = 0; i < decisions.length; i++) {
    const d = decisions[i];
    if (runState === 'silence') {
      if (d) {
        speechRun++;
        if (speechRun === 1) startIdx = i; // tentative start
        if (speechRun >= minSpeechFrames) {
          runState = 'speech';
          silenceRun = 0;
        }
      } else {
        speechRun = 0;
      }
    } else {
      // in speech
      if (!d) {
        silenceRun++;
        if (silenceRun >= minSilenceFrames) {
          const endIdx = i - silenceRun + 1; // end before silence stretch
          segments.push({ startFrame: startIdx, endFrame: endIdx });
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
    segments.push({ startFrame: startIdx, endFrame: decisions.length });
  }

  // Map to ms
  return segments.map(s => ({ startMs: s.startFrame * frameMs, endMs: s.endFrame * frameMs }));
}

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/verify-vad.js <path-to-wav>');
    process.exit(1);
  }

  const { calibrate, detect } = await loadEnergyVAD();

  const { sampleRate, pcm } = readWavPCM16Mono(path.resolve(file));
  const frameMs = 20; // 20ms frames
  const { frames } = framePCM(pcm, sampleRate, frameMs);

  // Calibration: first ~800ms or all if shorter
  const calibrationFrames = frames.slice(0, Math.max(1, Math.round(800 / frameMs)));
  const state = calibrate(calibrationFrames, sampleRate, { adaptive: true });

  let voiced = 0;
  let silent = 0;
  const decisions = new Array(frames.length);
  const sensitivity = 0.6; // default

  for (let i = 0; i < frames.length; i++) {
    const { isSpeech } = detect(frames[i], sampleRate, state, { sensitivity, adaptive: true });
    decisions[i] = isSpeech;
    if (isSpeech) voiced++; else silent++;
  }

  const voicedPct = ((voiced / Math.max(1, frames.length)) * 100).toFixed(2);
  const silentPct = ((silent / Math.max(1, frames.length)) * 100).toFixed(2);

  const segments = segmentFromDecisions(decisions, frameMs, { minSpeechMs: 240, minSilenceMs: 350 });

  console.log('File:', file);
  console.log('Sample rate:', sampleRate);
  console.log('Frames:', frames.length, `(${frameMs}ms each)`);
  console.log('Voiced frames:', voiced, `(${voicedPct}%)`);
  console.log('Silent frames:', silent, `(${silentPct}%)`);
  console.log('Segments:', segments.length, segments);
})();
