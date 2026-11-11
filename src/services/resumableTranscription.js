const { execFile } = require('child_process');
const { createHash, randomBytes } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const run = promisify(execFile);
const chunkSeconds = 240;
const checkpointSchemaVersion = 1;
const algorithmVersion = 4;
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

function checkCanceled(signal) {
    if (signal?.aborted) throw new Error('Transcription canceled');
}

function isCanceled(error, signal) {
    return signal?.aborted || error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function sliceAudio(file, start, length, output, signal) {
    return run('ffmpeg', ['-nostdin', '-v', 'error', '-ss', String(start), '-i', file,
        '-map', '0:a:0', '-t', String(length), '-ac', '1', '-ar', '16000',
        '-c:a', 'pcm_s16le', '-y', output], { signal, killSignal: 'SIGKILL' });
}

function validSegments(result) {
    return result.success && Array.isArray(result.segments) &&
        (result.segments.length || !result.text?.trim()) &&
        result.segments.every(segment => Number.isFinite(segment.start) &&
            Number.isFinite(segment.end) && segment.start >= 0 && segment.end >= segment.start &&
            typeof segment.text === 'string');
}

function withResultContract(result, duration = null) {
    const valid = validSegments(result);
    const issues = valid ? [] : [{
        code: 'invalid_segments',
        ...(Number.isFinite(duration) ? { start: 0, end: duration } : {}),
        message: 'Decoder returned invalid transcription segments'
    }];
    return {
        ...result,
        status: valid ? 'complete' : 'partial',
        partial: !valid,
        issues,
        resumeId: null
    };
}

async function boundaryNearPause(file, position, signal) {
    const start = position - 3;
    const { stderr } = await run('ffmpeg', ['-nostdin', '-hide_banner', '-ss', String(start),
        '-i', file, '-map', '0:a:0', '-t', '6', '-af', 'silencedetect=noise=-34dB:d=0.16', '-f', 'null', '-'],
    { signal, killSignal: 'SIGKILL' });
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
    if (!validSegments(result) || !hasDecoderLoop(result.segments)) {
        return { ...result, partial: false, issues: [] };
    }

    const segments = [];
    const issues = [];
    const retryOptions = {
        ...options, resetDecoderContext: true, useInitialPrompt: false,
        initialPrompt: '', contextPrompt: ''
    };
    const retryAudio = path.join(scratch, 'retry.wav');
    const boundaries = [0];
    const windowSeconds = duration <= 60 ? 30 : 60;
    for (let position = windowSeconds; position < duration - 3; position += windowSeconds) {
        boundaries.push(await boundaryNearPause(file, position, options.signal));
    }
    boundaries.push(duration);
    const time = seconds => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);

    for (let index = 1; index < boundaries.length; index++) {
        const from = boundaries[index - 1];
        const to = boundaries[index];
        if (options.signal?.aborted) {
            issues.push({ code: 'canceled', start: offset + from, end: offset + to, message: 'Transcription canceled' });
            break;
        }
        try {
            await sliceAudio(file, from, to - from, retryAudio, options.signal);
            const retry = await transcribe(retryAudio, retryOptions);
            checkCanceled(options.signal);
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
            if (isCanceled(error, options.signal)) {
                issues.push({ code: 'canceled', start: offset + from, end: offset + to, message: 'Transcription canceled' });
                break;
            }
            console.warn(`Whisper recovery failed at ${offset + from}s: ${error.message}`);
            issues.push({ code: 'decoder_recovery_failed', start: offset + from, end: offset + to, message: error.message });
            segments.push({ start: from, end: to,
                text: `[Требуется проверка аудио ${time(offset + from)}–${time(offset + to)}]`, issue: true });
        }
    }
    return {
        ...result,
        segments: segments.map((segment, id) => ({ ...segment, id })),
        text: segments.map(segment => segment.text).join(' ').trim(),
        partial: issues.length > 0,
        status: issues.length ? 'partial' : 'complete',
        issues,
        sourceSegments: result.segments
    };
}

async function atomicWrite(filePath, content) {
    const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}-${randomBytes(8).toString('hex')}.tmp`);
    try {
        await fs.promises.writeFile(temporaryPath, content, { mode: 0o600, flag: 'wx' });
        await fs.promises.rename(temporaryPath, filePath);
    } catch (error) {
        try {
            await fs.promises.unlink(temporaryPath);
        } catch (cleanupError) {
            if (cleanupError.code !== 'ENOENT') error.cleanupError = cleanupError;
        }
        throw error;
    }
}

function validCheckpoint(checkpoint, resumeId, start, end) {
    if (!checkpoint || checkpoint.schemaVersion !== checkpointSchemaVersion ||
        checkpoint.algorithmVersion !== algorithmVersion ||
        checkpoint.resumeId !== resumeId || checkpoint.start !== start || checkpoint.end !== end ||
        !Array.isArray(checkpoint.segments) || !Array.isArray(checkpoint.languages) ||
        !Array.isArray(checkpoint.issues)) return false;
    if (checkpoint.partial || checkpoint.issues.length ||
        !checkpoint.languages.every(language => typeof language === 'string')) return false;
    const duration = end - start;
    return checkpoint.segments.every(segment => segment && Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) && segment.start >= 0 && segment.end >= segment.start &&
        segment.end <= duration + 0.01 && typeof segment.text === 'string');
}

async function readCheckpoint(filePath, resumeId, start, end) {
    let checkpoint;
    try {
        checkpoint = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        if (!(error instanceof SyntaxError)) throw error;
        await fs.promises.unlink(filePath);
        return null;
    }
    if (validCheckpoint(checkpoint, resumeId, start, end)) return checkpoint;
    await fs.promises.unlink(filePath);
    return null;
}

async function ensureManifest(directory, manifest) {
    await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
    const manifestPath = path.join(directory, 'manifest.json');
    try {
        const existing = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
        if (existing.schemaVersion === manifest.schemaVersion && existing.algorithmVersion === manifest.algorithmVersion &&
            existing.resumeId === manifest.resumeId &&
            JSON.stringify(existing.boundaries) === JSON.stringify(manifest.boundaries) &&
            JSON.stringify(existing.decoderIdentity) === JSON.stringify(manifest.decoderIdentity) &&
            existing.model === manifest.model) return;
    } catch (error) {
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    await atomicWrite(manifestPath, JSON.stringify(manifest));
}

function issueMarker(start, end, message) {
    const time = seconds => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);
    return { start, end, text: `[Требуется проверка аудио ${time(start)}–${time(end)}]`, issue: true, message };
}

function buildResult(segments, languages, duration, options, resumeId, issues) {
    const hasIssues = issues.length > 0;
    return {
        success: true,
        status: hasIssues ? 'partial' : 'complete',
        partial: hasIssues,
        issues,
        resumeId,
        segments: segments.map((segment, id) => ({ ...segment, id })),
        text: segments.map(segment => segment.text).join(' ').trim(),
        model: options.model,
        duration,
        language: languages.size > 1 ? 'mixed' : [...languages][0] || options.language
    };
}

async function transcribeChunks(filePath, options, transcribe, directory, boundaries, resumeId) {
    const duration = boundaries[boundaries.length - 1];
    const scratch = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'whisper-chunk-'));
    const segments = [];
    const languages = new Set();
    const issues = [];
    try {
        for (let index = 1; index < boundaries.length; index++) {
            const start = boundaries[index - 1];
            const end = boundaries[index];
            const length = end - start;
            const checkpoint = path.join(directory, `${index - 1}.json`);
            let chunk = null;
            chunk = await readCheckpoint(checkpoint, resumeId, start, end);

            if (!chunk) {
                if (options.signal?.aborted) {
                    issues.push({ code: 'canceled', start, end, message: 'Transcription canceled' });
                    if (!segments.length) throw new Error('Transcription canceled');
                    break;
                }
                try {
                    const audio = path.join(scratch, 'chunk.wav');
                    await sliceAudio(filePath, start, length, audio, options.signal);
                    const raw = await transcribe(audio, options);
                    const result = await recoverRepeats(raw, audio, length, start, scratch, options, transcribe);
                    if (!validSegments(result)) throw new Error(`Invalid transcription segments at ${start}s`);
                    chunk = {
                        schemaVersion: checkpointSchemaVersion,
                        algorithmVersion,
                        resumeId,
                        start,
                        end,
                        segments: result.segments,
                        sourceSegments: result.sourceSegments,
                        languages: result.languages || [result.language],
                        partial: result.partial === true,
                        issues: result.issues || []
                    };
                    await atomicWrite(checkpoint, JSON.stringify(chunk));
                } catch (error) {
                    const canceled = isCanceled(error, options.signal);
                    const issue = {
                        code: canceled ? 'canceled' : chunk ? 'checkpoint_write_failed' : 'chunk_transcription_failed',
                        start,
                        end,
                        message: canceled ? 'Transcription canceled' : error.message
                    };
                    issues.push(issue);
                    if (chunk) {
                        for (const language of chunk.languages) {
                            if (language && language !== 'auto') languages.add(language);
                        }
                        for (const segment of chunk.segments) {
                            const offset = time => Math.round((start + Math.min(length, Math.max(0, time))) * 1000) / 1000;
                            segments.push({ ...segment, id: segments.length, start: offset(segment.start), end: offset(segment.end) });
                        }
                        issues.push(...chunk.issues);
                    } else if (!canceled) {
                        segments.push(issueMarker(start, end, issue.message));
                    }
                    if (canceled) break;
                    continue;
                }
            }

            for (const language of chunk.languages) {
                if (language && language !== 'auto') languages.add(language);
            }
            for (const segment of chunk.segments) {
                const offset = time => Math.round((start + Math.min(length, Math.max(0, time))) * 1000) / 1000;
                segments.push({ ...segment, id: segments.length, start: offset(segment.start), end: offset(segment.end) });
            }
            issues.push(...chunk.issues);
        }
    } finally {
        await fs.promises.rm(scratch, { recursive: true, force: true });
    }
    return buildResult(segments, languages, duration, options, resumeId, issues);
}

async function transcribeResumableFile(filePath, options, transcribe, checkpointRoot, decoderIdentity = null) {
    const { signal, ...recognitionOptions } = options;
    checkCanceled(signal);
    let info;
    try {
        const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=duration:format=duration', '-of', 'json', filePath],
        { signal, killSignal: 'SIGKILL' });
        info = JSON.parse(stdout);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        console.warn('ffprobe is unavailable; transcription cannot resume after interruption');
        const result = await transcribe(filePath, options);
        return withResultContract(result);
    }
    const streamDuration = Number(info.streams?.[0]?.duration);
    const duration = streamDuration > 0 ? streamDuration : Number(info.format?.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
        const result = await transcribe(filePath, options);
        return withResultContract(result);
    }

    const decodeOptions = { ...options, preserveDecoderOutput: true };
    if (duration <= chunkSeconds) {
        const result = await transcribe(filePath, decodeOptions);
        if (!validSegments(result) || !hasDecoderLoop(result.segments)) return withResultContract(result, duration);
        const scratch = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'whisper-retry-'));
        try {
            const recovered = await recoverRepeats(result, filePath, duration, 0, scratch, decodeOptions, transcribe);
            return { ...recovered, resumeId: null };
        } finally {
            await fs.promises.rm(scratch, { recursive: true, force: true });
        }
    }

    const boundaries = [0];
    for (let position = chunkSeconds; position < duration - 3; position += chunkSeconds) {
        boundaries.push(await boundaryNearPause(filePath, position, signal));
    }
    boundaries.push(duration);

    const hash = createHash('sha256');
    hash.update(JSON.stringify({ version: algorithmVersion, options: recognitionOptions,
        decoderIdentity, boundaries }));
    for await (const bytes of fs.createReadStream(filePath, { signal })) hash.update(bytes);
    checkCanceled(signal);
    const resumeId = hash.digest('hex');
    const directory = path.join(checkpointRoot, resumeId);

    if (activeJobs.has(directory)) return activeJobs.get(directory);
    const job = (async () => {
        await ensureManifest(directory, {
            schemaVersion: checkpointSchemaVersion,
            algorithmVersion,
            resumeId,
            boundaries,
            model: options.model,
            decoderIdentity
        });
        return transcribeChunks(filePath, decodeOptions, transcribe, directory, boundaries, resumeId);
    })();
    activeJobs.set(directory, job);
    try {
        return await job;
    } finally {
        activeJobs.delete(directory);
    }
}

async function finalizeResumableFile(resumeId, checkpointRoot) {
    if (typeof resumeId !== 'string' || !/^[a-f0-9]{64}$/.test(resumeId)) {
        throw new Error('Invalid transcription resume id');
    }
    await fs.promises.rm(path.join(checkpointRoot, resumeId), { recursive: true, force: true });
}

module.exports = { finalizeResumableFile, transcribeResumableFile };
