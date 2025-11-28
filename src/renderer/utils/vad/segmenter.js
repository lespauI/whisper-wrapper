/**
 * Offline PCM segmenter using energyVAD with lead-in/hangover and min durations.
 *
 * API:
 *  segment(pcm: Float32Array, sampleRate: number, opts): {
 *    segments: Array<{ startMs: number, endMs: number }>,
 *    debug?: any
 *  }
 *
 * Options (all optional; sensible defaults applied):
 *  - frameMs: number (default 20)
 *  - calibrationMs: number (default 800)
 *  - sensitivity: number (0..1, default 0.6)
 *  - minSpeechMs: number (default 240)
 *  - minSilenceMs: number (default 350)
 *  - leadInMs: number (default 200)
 *  - hangoverMs: number (default 250)
 */

import { calibrate as vadCalibrate, detect as vadDetect } from './energyVAD.js';

/**
 * Frame PCM into non-overlapping chunks of size frameSize.
 */
function framePCM(pcm, frameSize) {
  const frames = [];
  for (let i = 0; i + frameSize <= pcm.length; i += frameSize) {
    frames.push(pcm.subarray(i, i + frameSize));
  }
  return frames;
}

/**
 * Merge segments if they overlap or touch.
 * @param {{startMs:number,endMs:number}[]} segs
 */
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

/**
 * Segment mono PCM using energyVAD decisions and min durations + paddings.
 * @param {Float32Array} pcm
 * @param {number} sampleRate
 * @param {object} opts
 * @returns {{ segments: Array<{ startMs: number, endMs: number }>, debug?: any }}
 */
export function segment(pcm, sampleRate, opts = {}) {
  if (!(pcm instanceof Float32Array)) {
    throw new Error('segment: pcm must be Float32Array');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('segment: invalid sampleRate');
  }

  const frameMs = opts.frameMs ?? 20; // 20ms frames
  const calibrationMs = opts.calibrationMs ?? 800;
  const sensitivity = opts.sensitivity ?? 0.6;
  const minSpeechMs = opts.minSpeechMs ?? 240;
  const minSilenceMs = opts.minSilenceMs ?? 350;
  const leadInMs = opts.leadInMs ?? 200;
  const hangoverMs = opts.hangoverMs ?? 250;

  const frameSize = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const frames = framePCM(pcm, frameSize);
  const totalFrames = frames.length;

  if (totalFrames === 0) {
    return { segments: [], debug: { frameMs, frameSize, totalFrames: 0 } };
  }

  // Calibration on first N ms (or all if shorter)
  const calFramesCount = Math.max(1, Math.min(totalFrames, Math.round(calibrationMs / frameMs)));
  const calState = vadCalibrate(frames.slice(0, calFramesCount), sampleRate, { adaptive: true });

  const minSpeechFrames = Math.max(1, Math.round(minSpeechMs / frameMs));
  const minSilenceFrames = Math.max(1, Math.round(minSilenceMs / frameMs));
  const leadInFrames = Math.max(0, Math.round(leadInMs / frameMs));
  const hangoverFrames = Math.max(0, Math.round(hangoverMs / frameMs));

  const decisions = new Array(totalFrames);
  const features = new Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    const res = vadDetect(frames[i], sampleRate, calState, {
      sensitivity,
      adaptive: true,
    });
    decisions[i] = !!res.isSpeech;
    features[i] = res.features;
  }

  // Run-length based segmentation
  const rawSegments = [];
  let runState = 'silence';
  let speechRun = 0;
  let silenceRun = 0;
  let startIdx = 0;

  for (let i = 0; i < totalFrames; i++) {
    const d = decisions[i];
    if (runState === 'silence') {
      if (d) {
        if (speechRun === 0) startIdx = i; // tentative start
        speechRun++;
        if (speechRun >= minSpeechFrames) {
          runState = 'speech';
          silenceRun = 0;
        }
      } else {
        speechRun = 0;
      }
    } else {
      // runState === 'speech'
      if (!d) {
        silenceRun++;
        if (silenceRun >= minSilenceFrames) {
          // close segment before the sustained silence
          const endIdx = i - silenceRun + 1; // last speech frame + 1
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

  // Apply lead-in and hangover, convert to ms
  const padded = rawSegments.map(seg => {
    const start = Math.max(0, seg.startFrame - leadInFrames);
    const end = Math.min(totalFrames, seg.endFrame + hangoverFrames);
    return {
      startMs: start * frameMs,
      endMs: end * frameMs,
    };
  });

  const merged = mergeOverlapping(padded);

  const debug = {
    frameMs,
    frameSize,
    totalFrames,
    minSpeechMs,
    minSilenceMs,
    leadInMs,
    hangoverMs,
    calFramesCount,
    decisions,
    features,
    rawSegments,
  };

  return { segments: merged, debug };
}

export default { segment };

