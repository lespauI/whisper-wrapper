/*
 * Benchmark VAD per-frame decision time for available engines/modes.
 * Usage:
 *   node scripts/bench-vad.js [wavPath] [frameMs]
 * Defaults:
 *   wavPath = tests/fixtures/audio/noise_5s.wav
 *   frameMs = 20
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadESM(modPath) {
  const url = pathToFileURL(modPath).href;
  return import(url);
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

function hrtimeMs(startNs, endNs) {
  return Number(endNs - startNs) / 1e6;
}

async function run() {
  const wavPath = process.argv[2] || path.resolve('tests/fixtures/audio/noise_5s.wav');
  const frameMs = parseInt(process.argv[3] || '20', 10);

  const { sampleRate, pcm } = readWavPCM16Mono(wavPath);
  const { frames } = framePCM(pcm, sampleRate, frameMs);
  const calFrames = frames.slice(0, Math.max(1, Math.round(800 / frameMs)));

  const energy = await loadESM(path.resolve(__dirname, './lib/energyVAD.mjs'));
  const webrtc = await loadESM(path.resolve(__dirname, './lib/webrtcVAD.mjs'));

  const engines = [
    { name: 'energy', api: energy, modes: ['balanced'] },
    { name: 'webrtc', api: webrtc, modes: ['conservative', 'balanced', 'aggressive'] },
  ];

  console.log('Benchmarking VAD per-frame decision times');
  console.log('File:', wavPath);
  console.log('Sample rate:', sampleRate, 'Hz');
  console.log('Frames:', frames.length, `(${frameMs}ms)`);

  for (const eng of engines) {
    for (const mode of eng.modes) {
      const state = eng.api.calibrate(calFrames, sampleRate, { adaptive: true });
      const t0 = process.hrtime.bigint();
      let voiced = 0;
      for (let i = 0; i < frames.length; i++) {
        const opts = eng.name === 'webrtc' ? { mode, adaptive: true } : { sensitivity: 0.6, adaptive: true };
        const { isSpeech } = eng.api.detect(frames[i], sampleRate, state, opts);
        if (isSpeech) voiced++;
      }
      const t1 = process.hrtime.bigint();
      const totalMs = hrtimeMs(t0, t1);
      const avgPerFrameMs = totalMs / Math.max(1, frames.length);
      const voicedPct = ((voiced / Math.max(1, frames.length)) * 100).toFixed(1);
      console.log(`- ${eng.name}${eng.name === 'webrtc' ? ` (${mode})` : ''}: avg ${avgPerFrameMs.toFixed(4)} ms/frame, voiced ${voicedPct}%`);
    }
  }
}

run().catch((e) => {
  console.error('Benchmark error:', e);
  process.exit(1);
});

