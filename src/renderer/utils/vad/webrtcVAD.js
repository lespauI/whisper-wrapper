/**
 * WebRTC-class VAD adapter exposing the same interface as energyVAD.
 *
 * This adapter wraps the lightweight energy/ZCR VAD and applies
 * WebRTC-like aggressiveness presets (conservative/balanced/aggressive)
 * which map to sensitivity and min duration/hangover tunables.
 *
 * Exports:
 *  - calibrate(frames: Float32Array[], sampleRate: number, opts?): CalibrationState
 *  - detect(frame: Float32Array, sampleRate: number, state?: CalibrationState, opts?): { isSpeech, confidence }
 *  - MODE_PRESETS: preset mapping for reference (ms)
 */

import { calibrate as baseCalibrate, detect as baseDetect } from './energyVAD.js';

// Sensitivity/duration presets chosen to emulate WebRTC VAD aggressiveness
// Higher aggressiveness → stricter (fewer false positives), requires longer speech,
// longer silence to stop, and a lower sensitivity (higher threshold).
export const MODE_PRESETS = {
    conservative: {
        sensitivity: 0.70,
        minSpeechMs: 200,
        minSilenceMs: 300,
        hangoverMs: 200,
    },
    balanced: {
        sensitivity: 0.55,
        minSpeechMs: 240,
        minSilenceMs: 350,
        hangoverMs: 250,
    },
    aggressive: {
        sensitivity: 0.40,
        minSpeechMs: 320,
        minSilenceMs: 450,
        hangoverMs: 350,
    },
};

/**
 * Calibrate using the base VAD implementation.
 * @param {Float32Array[]} frames
 * @param {number} sampleRate
 * @param {{ adaptive?: boolean }} [opts]
 */
export function calibrate(frames, sampleRate, opts = {}) {
    return baseCalibrate(frames, sampleRate, opts);
}

/**
 * Detect speech using base VAD with WebRTC-like strictness mapping.
 * @param {Float32Array} frame
 * @param {number} sampleRate
 * @param {*} [state]
 * @param {{ sensitivity?: number, adaptive?: boolean, mode?: 'conservative'|'balanced'|'aggressive' }} [opts]
 * @returns {{ isSpeech: boolean, confidence: number, features?: any }}
 */
export function detect(frame, sampleRate, state, opts = {}) {
    const mode = opts.mode || 'balanced';
    const preset = MODE_PRESETS[mode] || MODE_PRESETS.balanced;
    const sensitivity = typeof opts.sensitivity === 'number' ? opts.sensitivity : preset.sensitivity;
    return baseDetect(frame, sampleRate, state, { ...opts, sensitivity });
}

