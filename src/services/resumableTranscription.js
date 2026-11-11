const { execFile } = require('child_process');
const { createHash, randomBytes } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const run = promisify(execFile);
const chunkSeconds = 240;
const activeJobs = new Map();

function hasDecoderLoop(segments) {
    let stalled = 0;
    let identical = 0;
    let identicalStalled = false;
    let previousText = '';
    let lastEnd = 0;
    let previousPhrases = new Set();
    const words = [];
    for (const segment of segments) {
        const tokens = segment.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
        if (!tokens.length) continue;
        const text = tokens.join(' ');
        const stationary = segment.end - segment.start < 0.04;
        const consecutive = segment.start - lastEnd <= 1;
        const identicalToPrevious = consecutive && text === previousText;
        identical = identicalToPrevious ? identical + 1 : 1;
        identicalStalled = stationary || (identicalToPrevious && identicalStalled);
        stalled = stationary && consecutive ? stalled + 1 : Number(stationary);
        if (stalled >= 2 || (identical >= 4 && identicalStalled) || segment.start < lastEnd - 1) return true;
        const phrases = new Set();
        for (let index = 0; index + 20 <= tokens.length; index++) {
            const phrase = tokens.slice(index, index + 20).join(' ');
            if (segment.start - lastEnd <= 3 && previousPhrases.has(phrase)) return true;
            phrases.add(phrase);
        }
        if (segment.start - lastEnd > 3) words.push('');
        words.push(...tokens);
        previousPhrases = phrases;
        previousText = text;
        lastEnd = segment.end;
    }

    const recent = new Map();
    for (let index = 0; index + 6 <= words.length; index++) {
        const tokens = words.slice(index, index + 6);
        if (tokens.includes('')) continue;
        const phrase = tokens.join(' ');
        const previous = recent.get(phrase) || [];
        const nearby = previous.filter(start => index - start <= 60);
        if (nearby.length && index - nearby[nearby.length - 1] < 6) continue;
        if (nearby.length >= 2) return true;
        nearby.push(index);
        recent.set(phrase, nearby);
    }
    return false;
}

function sliceAudio(file, start, length, output) {
    return run('ffmpeg', ['-nostdin', '-v', 'error', '-ss', String(start), '-i', file,
        '-map', '0:a:0', '-t', String(length), '-ac', '1', '-ar', '16000',
        '-c:a', 'pcm_s16le', '-y', output]);
}

function validSegments(result) {
    return result.success && Array.isArray(result.segments) &&
        (result.segments.length || !result.text?.trim()) &&
        result.segments.every(segment => Number.isFinite(segment.start) &&
            Number.isFinite(segment.end) && segment.end >= segment.start && typeof segment.text === 'string');
}

async function boundaryNearPause(file, position) {
    const start = position - 3;
    const { stderr } = await run('ffmpeg', ['-nostdin', '-hide_banner', '-ss', String(start),
        '-i', file, '-map', '0:a:0', '-t', '6', '-af', 'silencedetect=noise=-34dB:d=0.16', '-f', 'null', '-']);
    let boundary = position;
    let distance = Infinity;
    for (const match of stderr.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)) {
        const end = Number(match[1]);
        const duration = Number(match[2]);
        const pause = start + end - duration / 2;
        if (Math.abs(pause - position) < distance) {
            boundary = pause;
            distance = Math.abs(pause - position);
        }
    }
    return Math.round(boundary * 1000) / 1000;
}

async function recoverRepeats(result, file, duration, offset, scratch, options, transcribe) {
    if (!validSegments(result) || !hasDecoderLoop(result.segments)) return result;

    const segments = [];
    const retryOptions = {
        ...options, resetDecoderContext: true, useInitialPrompt: false,
        initialPrompt: '', contextPrompt: ''
    };
    const retryAudio = path.join(scratch, 'retry.wav');
    const boundaries = [0];
    const windowSeconds = duration <= 60 ? 30 : 60;
    for (let position = windowSeconds; position < duration - 3; position += windowSeconds) {
        boundaries.push(await boundaryNearPause(file, position));
    }
    boundaries.push(duration);
    for (let index = 1; index < boundaries.length; index++) {
        const from = boundaries[index - 1];
        const to = boundaries[index];
        try {
            await sliceAudio(file, from, to - from, retryAudio);
            const retry = await transcribe(retryAudio, retryOptions);
            const hadSpeech = result.segments.some(segment => segment.text.trim() &&
                segment.end >= from && segment.start < to);
            if (!validSegments(retry) || hasDecoderLoop(retry.segments) ||
                (hadSpeech && !retry.segments.some(segment => segment.text.trim() && segment.end > segment.start))) {
                throw new Error('Retry did not produce usable segments');
            }
            for (const segment of retry.segments) {
                segments.push({ ...segment, start: Math.max(from, Math.min(to, from + segment.start)),
                    end: Math.max(from, Math.min(to, from + segment.end)) });
            }
        } catch (error) {
            console.warn(`Whisper recovery failed at ${offset + from}s: ${error.message}`);
            const time = seconds => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);
            segments.push({ start: from, end: to,
                text: `[Требуется проверка аудио ${time(offset + from)}–${time(offset + to)}]` });
        }
    }
    return { ...result, segments: segments.map((segment, id) => ({ ...segment, id })),
        text: segments.map(segment => segment.text).join(' ').trim() };
}

async function transcribeChunks(filePath, options, transcribe, directory, boundaries) {
    const duration = boundaries[boundaries.length - 1];
    const scratch = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'whisper-chunk-'));
    const segments = [];
    const languages = new Set();
    try {
        for (let index = 1; index < boundaries.length; index++) {
            const start = boundaries[index - 1];
            const length = boundaries[index] - start;
            const checkpoint = path.join(directory, `${index - 1}.json`);
            let chunk;
            try {
                chunk = JSON.parse(await fs.promises.readFile(checkpoint, 'utf8'));
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                const audio = path.join(scratch, 'chunk.wav');
                await sliceAudio(filePath, start, length, audio);
                const raw = await transcribe(audio, options);
                const result = await recoverRepeats(raw, audio, length, start, scratch, options, transcribe);
                if (!validSegments(result)) {
                    throw new Error(`Invalid transcription segments at ${start}s`);
                }
                chunk = { segments: result.segments, languages: result.languages || [result.language] };
                await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
                const pending = path.join(directory, `.${start}-${randomBytes(8).toString('hex')}.tmp`);
                await fs.promises.writeFile(pending, JSON.stringify(chunk), { mode: 0o600 });
                await fs.promises.rename(pending, checkpoint);
            }
            for (const language of chunk.languages) {
                if (language && language !== 'auto') languages.add(language);
            }
            for (const segment of chunk.segments) {
                const offset = time => Math.round((start + Math.min(length, Math.max(0, time))) * 1000) / 1000;
                segments.push({ ...segment, id: segments.length, start: offset(segment.start), end: offset(segment.end) });
            }
        }
    } finally {
        await fs.promises.rm(scratch, { recursive: true, force: true });
    }
    await fs.promises.rm(directory, { recursive: true, force: true });
    return {
        success: true, segments, text: segments.map(segment => segment.text).join(' ').trim(),
        model: options.model, duration, language: languages.size > 1 ? 'mixed' : [...languages][0] || options.language
    };
}

async function transcribeResumableFile(filePath, options, transcribe, checkpointRoot) {
    let info;
    try {
        const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=duration:format=duration', '-of', 'json', filePath]);
        info = JSON.parse(stdout);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        console.warn('ffprobe is unavailable; transcription cannot resume after interruption');
        return transcribe(filePath, options);
    }
    const streamDuration = Number(info.streams?.[0]?.duration);
    const duration = streamDuration > 0 ? streamDuration : Number(info.format?.duration);
    if (!Number.isFinite(duration) || duration <= 0) return transcribe(filePath, options);

    const decodeOptions = { ...options, preserveDecoderOutput: true };
    if (duration <= chunkSeconds) {
        const result = await transcribe(filePath, decodeOptions);
        if (!validSegments(result) || !hasDecoderLoop(result.segments)) return result;
        const scratch = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'whisper-retry-'));
        try {
            return await recoverRepeats(result, filePath, duration, 0, scratch, decodeOptions, transcribe);
        } finally {
            await fs.promises.rm(scratch, { recursive: true, force: true });
        }
    }

    const boundaries = [0];
    for (let position = chunkSeconds; position < duration - 3; position += chunkSeconds) {
        boundaries.push(await boundaryNearPause(filePath, position));
    }
    boundaries.push(duration);

    const hash = createHash('sha256');
    hash.update(JSON.stringify({ version: 3, options, boundaries }));
    for await (const bytes of fs.createReadStream(filePath)) hash.update(bytes);
    const directory = path.join(checkpointRoot, hash.digest('hex'));

    if (activeJobs.has(directory)) return activeJobs.get(directory);
    const job = transcribeChunks(filePath, decodeOptions, transcribe, directory, boundaries);
    activeJobs.set(directory, job);
    try {
        return await job;
    } finally {
        activeJobs.delete(directory);
    }
}

module.exports = { transcribeResumableFile };
