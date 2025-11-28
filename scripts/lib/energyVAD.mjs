// ESM copy of the renderer VAD for Node verify scripts.
// Source of truth: src/renderer/utils/vad/energyVAD.js

const EPS = 1e-12;

function rmsEnergy(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const x = frame[i];
    sum += x * x;
  }
  return Math.sqrt(sum / Math.max(1, frame.length));
}

function zeroCrossingRate(frame) {
  let crossings = 0;
  let prev = frame[0] || 0;
  for (let i = 1; i < frame.length; i++) {
    const cur = frame[i];
    if ((prev > 0 && cur < 0) || (prev < 0 && cur > 0)) {
      crossings++;
    }
    prev = cur;
  }
  return crossings / Math.max(1, frame.length - 1);
}

function meanStd(values) {
  const n = values.length || 1;
  let m = 0;
  for (let i = 0; i < n; i++) m += values[i];
  m /= n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - m;
    v += d * d;
  }
  v = Math.sqrt(v / Math.max(1, n - 1));
  return { mean: m, std: v };
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

export function calibrate(frames, sampleRate, opts = {}) {
  const energies = [];
  const zcrs = [];
  const frameSize = frames && frames[0] ? frames[0].length : Math.round(sampleRate * 0.02);
  for (const f of frames) { energies.push(rmsEnergy(f)); zcrs.push(zeroCrossingRate(f)); }
  const e = meanStd(energies);
  const z = meanStd(zcrs);
  const energyMean = e.mean;
  const energyStd = e.std || Math.max(energyMean * 0.1, 1e-4);
  const zcrMean = z.mean;
  const zcrStd = z.std || 0.05;
  return { sampleRate, frameSize, energyMean, energyStd, zcrMean, zcrStd, adaptive: !!opts.adaptive };
}

export function detect(frame, sampleRate, state, opts = {}) {
  const sensitivity = typeof opts.sensitivity === 'number' ? opts.sensitivity : 0.6;
  const adaptive = opts.adaptive ?? state?.adaptive ?? true;
  const absEnergyFloor = typeof opts.absEnergyFloor === 'number' ? opts.absEnergyFloor : 0.003;
  const absZcrMax = typeof opts.absZcrMax === 'number' ? opts.absZcrMax : 0.25;
  const energy = rmsEnergy(frame);
  const zcr = zeroCrossingRate(frame);
  const baselineEnergyMean = state?.energyMean ?? Math.max(energy * 0.8, 1e-4);
  const baselineEnergyStd = state?.energyStd ?? Math.max(energy * 0.2, 1e-4);
  const baselineZcrMean = state?.zcrMean ?? 0.1;
  const baselineZcrStd = state?.zcrStd ?? 0.1;
  const k = (1 - sensitivity) * 2.5 + 0.5;
  const thr = baselineEnergyMean + k * baselineEnergyStd;
  const absGate = energy > absEnergyFloor && zcr < absZcrMax;
  let isSpeech = energy > thr || absGate;
  const zcrDelta = (baselineZcrMean - zcr) / (baselineZcrStd + EPS);
  if (!isSpeech && zcrDelta > 2.5 && energy > baselineEnergyMean * 1.05) { isSpeech = true; }
  const energyRatio = energy / (thr + EPS);
  const ce = clamp01((energyRatio - 1) * 2);
  const cz = clamp01((zcrDelta - 1) / 3);
  let confidence = clamp01(0.8 * ce + 0.2 * cz);
  if (!isSpeech && adaptive && state) {
    const a = 0.005;
    const eMean = state.energyMean * (1 - a) + energy * a;
    const eVar = Math.pow(state.energyStd, 2);
    const diff = energy - eMean;
    const eVarNew = (1 - a) * (eVar + a * diff * diff);
    state.energyMean = eMean;
    state.energyStd = Math.sqrt(Math.max(1e-8, eVarNew));
    const zMean = state.zcrMean * (1 - a) + zcr * a;
    const zDiff = zcr - zMean;
    const zVar = Math.pow(state.zcrStd, 2);
    const zVarNew = (1 - a) * (zVar + a * zDiff * zDiff);
    state.zcrMean = zMean;
    state.zcrStd = Math.sqrt(Math.max(1e-8, zVarNew));
  }
  return { isSpeech, confidence, features: { energy, zcr, thr } };
}

export const __internals = { rmsEnergy, zeroCrossingRate, meanStd };
