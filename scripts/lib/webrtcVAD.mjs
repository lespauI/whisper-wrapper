// Node-friendly ESM adapter mirroring renderer webrtcVAD.
// Uses the scripts/lib/energyVAD.mjs as base and applies WebRTC-like presets.

import { calibrate as baseCalibrate, detect as baseDetect } from './energyVAD.mjs';

export const MODE_PRESETS = {
  conservative: { sensitivity: 0.70, minSpeechMs: 200, minSilenceMs: 300, hangoverMs: 200 },
  balanced:     { sensitivity: 0.55, minSpeechMs: 240, minSilenceMs: 350, hangoverMs: 250 },
  aggressive:   { sensitivity: 0.40, minSpeechMs: 320, minSilenceMs: 450, hangoverMs: 350 },
};

export function calibrate(frames, sampleRate, opts = {}) {
  return baseCalibrate(frames, sampleRate, opts);
}

export function detect(frame, sampleRate, state, opts = {}) {
  const mode = opts.mode || 'balanced';
  const preset = MODE_PRESETS[mode] || MODE_PRESETS.balanced;
  const sensitivity = typeof opts.sensitivity === 'number' ? opts.sensitivity : preset.sensitivity;
  return baseDetect(frame, sampleRate, state, { ...opts, sensitivity });
}

