const { afterEach, beforeEach, expect, it, jest: jestApi } = require('@jest/globals');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { finalizeResumableFile, getResumableJob, transcribeResumableFile } = require('../../src/services/resumableTranscription');

jest.mock('child_process', () => ({ execFile: jest.fn() }));

let directory;
let source;
let checkpoints;
const options = { model: 'large', language: 'ru' };
const chunk = text => ({ success: true, language: 'ru', segments: [{ start: 0, end: 1, text }] });

beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'whisper-resume-test-'));
    source = path.join(directory, 'first.mp4');
    checkpoints = path.join(directory, 'checkpoints');
    await fs.writeFile(source, 'identical input');
    execFile.mockImplementation((command, args, _settings, callback) => {
        const stdout = command === 'ffprobe' ? '{"streams":[{"duration":"720"}]}' : '';
        callback(null, { stdout, stderr: '' });
    });
});

afterEach(async () => {
    execFile.mockReset();
    await fs.rm(directory, { recursive: true, force: true });
});

it('resumes after a late failure with a new temporary copy and keeps absolute timestamps', async () => {
    const first = jestApi.fn().mockResolvedValueOnce(chunk('first')).mockResolvedValueOnce(chunk('second'))
        .mockRejectedValueOnce(new Error('decoder exited'));
    const partial = await transcribeResumableFile(source, options, first, checkpoints);
    expect(partial).toMatchObject({ partial: true, status: 'partial', resumeId: expect.any(String) });
    expect(await fs.readdir(path.join(checkpoints, partial.resumeId))).toContain('0.json');
    expect(await fs.readdir(path.join(checkpoints, partial.resumeId))).toContain('1.json');
    const savedJob = await getResumableJob(partial.resumeId, checkpoints);
    expect(await fs.readFile(savedJob.sourcePath)).toEqual(await fs.readFile(source));
    expect(savedJob.options).toEqual(options);
    const copy = path.join(directory, 'second.mp4');
    await fs.copyFile(source, copy);

    const retry = jestApi.fn().mockResolvedValue(chunk('third'));
    const result = await transcribeResumableFile(copy, options, retry, checkpoints);

    expect(retry).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('first second third');
    expect(result.partial).toBe(false);
    expect(result.segments.map(({ id, start, end }) => [id, start, end]))
        .toEqual([[0, 0, 1], [1, 240, 241], [2, 480, 481]]);
    expect(await fs.readdir(path.join(checkpoints, result.resumeId))).toContain('manifest.json');
    await finalizeResumableFile(result.resumeId, checkpoints);
    expect(await fs.readdir(checkpoints)).toEqual([]);
});

it('does not persist source audio for background chunk jobs', async () => {
    const transcribe = jestApi.fn().mockResolvedValue(chunk('background'));
    const result = await transcribeResumableFile(source, options, transcribe, checkpoints, null, false);
    const directoryPath = path.join(checkpoints, result.resumeId);

    expect(await fs.readdir(directoryPath)).not.toContain('source.audio');
    await expect(getResumableJob(result.resumeId, checkpoints)).rejects.toThrow('Resumable transcription job is incomplete');
});

it('does not reuse chunks after recognition settings change', async () => {
    const first = jestApi.fn().mockResolvedValueOnce(chunk('old')).mockRejectedValueOnce(new Error('decoder exited'))
        .mockResolvedValue(chunk('old'));
    const partial = await transcribeResumableFile(source, options, first, checkpoints);
    expect(partial.partial).toBe(true);

    const retry = jestApi.fn().mockResolvedValue(chunk('new'));
    const result = await transcribeResumableFile(source, { ...options, model: 'tiny' }, retry, checkpoints);
    expect(retry).toHaveBeenCalledTimes(3);
    expect(result.text).toBe('new new new');
});

it('uses model and decoder fingerprints in the resume identity', async () => {
    const first = jestApi.fn().mockResolvedValueOnce(chunk('old')).mockRejectedValueOnce(new Error('decoder exited'));
    const modelA = { model: { path: '/models/large.bin', size: 100, mtimeMs: 1 }, decoder: { path: '/bin/whisper', size: 20, mtimeMs: 1 } };
    const modelB = { model: { ...modelA.model, mtimeMs: 2 }, decoder: modelA.decoder };
    const partial = await transcribeResumableFile(source, options, first, checkpoints, modelA);

    const retry = jestApi.fn().mockResolvedValue(chunk('new'));
    const result = await transcribeResumableFile(source, options, retry, checkpoints, modelB);
    expect(result.resumeId).not.toBe(partial.resumeId);
    expect(retry).toHaveBeenCalledTimes(3);
});

it('retranscribes a checkpoint whose segment array contains null', async () => {
    const first = jestApi.fn().mockResolvedValueOnce(chunk('first')).mockResolvedValueOnce(chunk('second'))
        .mockRejectedValueOnce(new Error('decoder exited'));
    const partial = await transcribeResumableFile(source, options, first, checkpoints);
    const damaged = path.join(checkpoints, partial.resumeId, '1.json');
    await fs.writeFile(damaged, JSON.stringify({
        schemaVersion: 1,
        algorithmVersion: 4,
        resumeId: partial.resumeId,
        start: 240,
        end: 480,
        segments: [null],
        languages: ['ru'],
        partial: false,
        issues: []
    }));

    const retry = jestApi.fn().mockResolvedValue(chunk('recalculated'));
    const result = await transcribeResumableFile(source, options, retry, checkpoints);
    expect(retry).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('first recalculated recalculated');
});

it('retranscribes a syntactically corrupted checkpoint without losing its neighbors', async () => {
    const first = jestApi.fn().mockResolvedValueOnce(chunk('first')).mockResolvedValueOnce(chunk('second'))
        .mockRejectedValueOnce(new Error('decoder exited'));
    const partial = await transcribeResumableFile(source, options, first, checkpoints);
    await fs.writeFile(path.join(checkpoints, partial.resumeId, '1.json'), '{');

    const retry = jestApi.fn().mockResolvedValue(chunk('recalculated'));
    const result = await transcribeResumableFile(source, options, retry, checkpoints);

    expect(retry).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('first recalculated recalculated');
});

it('returns decoded text and a partial issue when a checkpoint write fails', async () => {
    const rename = fs.rename;
    let renameCalls = 0;
    const renameSpy = jestApi.spyOn(fs, 'rename').mockImplementation(async (...args) => {
        renameCalls++;
        if (renameCalls === 3) throw new Error('checkpoint disk failure');
        return rename(...args);
    });
    try {
        const transcribe = jestApi.fn().mockResolvedValue(chunk('saved text'));
        const result = await transcribeResumableFile(source, options, transcribe, checkpoints);

        expect(result).toMatchObject({ partial: true, status: 'partial' });
        expect(result.text).toBe('saved text saved text saved text');
        expect(result.issues[0]).toMatchObject({ code: 'checkpoint_write_failed', start: 0, end: 240 });
    } finally {
        renameSpy.mockRestore();
    }
});

it('uses the regular transcription for short recordings', async () => {
    execFile.mockImplementationOnce((command, args, _settings, callback) => callback(null, {
        stdout: '{"streams":[{"duration":"110"}]}'
    }));
    const transcribe = jestApi.fn().mockResolvedValue(chunk('short'));
    const result = await transcribeResumableFile(source, options, transcribe, checkpoints);
    expect(transcribe).toHaveBeenCalledWith(source, { ...options, preserveDecoderOutput: true });
    expect(result.audioDurationSeconds).toBe(110);
    expect(result.processingDurationMs).toEqual(expect.any(Number));
});

it('saves resumable audio for malformed short transcription output', async () => {
    execFile.mockImplementationOnce((command, args, _settings, callback) => callback(null, {
        stdout: '{"streams":[{"duration":"240"}]}'
    }));
    const transcribe = jestApi.fn().mockResolvedValue({
        success: true,
        text: 'Unverified text',
        segments: [{ start: null, end: 1, text: 'Unverified text' }]
    });

    const result = await transcribeResumableFile(source, options, transcribe, checkpoints);

    expect(result).toMatchObject({
        status: 'partial',
        partial: true,
        issues: [{ code: 'invalid_segments', start: 0, end: 240 }],
        resumeId: expect.any(String)
    });
    const job = await getResumableJob(result.resumeId, checkpoints);
    expect(await fs.readFile(job.sourcePath)).toEqual(await fs.readFile(source));
    expect(job.options).toEqual(options);

    execFile.mockImplementationOnce((command, args, _settings, callback) => callback(null, {
        stdout: '{"streams":[{"duration":"240"}]}'
    }));
    const retry = jestApi.fn().mockResolvedValue({ ...chunk('Recovered short audio'), text: 'Recovered short audio' });
    const resumed = await transcribeResumableFile(job.sourcePath, job.options, retry, checkpoints);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(resumed).toMatchObject({ partial: false, status: 'complete', text: 'Recovered short audio' });
});

it('moves a chunk boundary to a nearby pause and offsets the next segments', async () => {
    execFile.mockImplementation((command, args, _settings, callback) => callback(null, {
        stdout: command === 'ffprobe' ? '{"streams":[{"duration":"300"}]}' : '',
        stderr: args.includes('-af') ? 'silence_end: 2.5 | silence_duration: 0.4' : ''
    }));
    const transcribe = jestApi.fn().mockResolvedValue(chunk('speech'));
    const result = await transcribeResumableFile(source, options, transcribe, checkpoints);
    expect(result.segments[1].start).toBe(239.3);
    expect(execFile.mock.calls.some(([, args]) => args.includes('239.3'))).toBe(true);
});

it('redecodes a whole short clip when the timestamps stall', async () => {
    execFile.mockImplementationOnce((command, args, _settings, callback) => callback(null, {
        stdout: '{"streams":[{"duration":"7"}]}'
    }));
    const repeated = 'И чтобы оно было гранулярным.';
    const raw = { ...chunk(''), segments: [
        { start: 0, end: 1, text: 'До сбоя.' },
        { start: 1, end: 3, text: repeated },
        { start: 3, end: 3, text: repeated },
        { start: 3, end: 4, text: repeated },
        { start: 4, end: 6, text: repeated },
        { start: 6, end: 7, text: 'После сбоя.' }
    ] };
    const transcribe = jestApi.fn().mockResolvedValueOnce(raw).mockResolvedValueOnce({
        ...chunk(''), segments: [raw.segments[0],
            { start: 1, end: 2, text: 'Восстановленная речь.' }, raw.segments[5]]
    });
    const result = await transcribeResumableFile(source, options, transcribe, checkpoints);

    expect(transcribe.mock.calls[1][1]).toMatchObject({ resetDecoderContext: true, useInitialPrompt: false });
    expect(result.segments.slice(0, 3)).toEqual([
        { id: 0, start: 0, end: 1, text: 'До сбоя.' },
        { id: 1, start: 1, end: 2, text: 'Восстановленная речь.' },
        { id: 2, start: 6, end: 7, text: 'После сбоя.' }
    ]);
});

it('detects short repeated phrases inside one segment and continues after a failed window', async () => {
    const repeated = 'что мы занимаемся тем что хотят';
    const raw = { ...chunk(''), segments: [
        { start: 4, end: 6, text: `${repeated} ${repeated} ${repeated}` }
    ] };
    const transcribe = jestApi.fn().mockResolvedValueOnce(chunk('Начало.')).mockResolvedValueOnce(raw)
        .mockRejectedValueOnce(new Error('decoder exited'))
        .mockResolvedValueOnce(chunk('Второе окно.'))
        .mockResolvedValueOnce(chunk('Третье окно.'))
        .mockResolvedValueOnce(chunk('Четвёртое окно.'))
        .mockResolvedValueOnce(chunk('Конец.'));
    const result = await transcribeResumableFile(source, options, transcribe, checkpoints);

    expect(result.text).toBe('Начало. [Требуется проверка аудио 00:04:00.000–00:05:00.000] Второе окно. Третье окно. Четвёртое окно. Конец.');
    expect(result.segments[1]).toMatchObject({ start: 240, end: 300 });
});

it('keeps ordinary repetitions with advancing timestamps', async () => {
    execFile.mockImplementationOnce((command, args, _settings, callback) => callback(null, {
        stdout: '{"streams":[{"duration":"30"}]}'
    }));
    const raw = { ...chunk(''), segments: [0, 1, 2, 3].map(start => ({
        start, end: start + 1, text: 'И чтобы оно было гранулярным.'
    })) };
    const transcribe = jestApi.fn().mockResolvedValue(raw);

    const result = await transcribeResumableFile(source, options, transcribe, checkpoints);
    expect(result).toMatchObject({
        ...raw,
        status: 'complete',
        partial: false,
        issues: [],
        resumeId: null,
        audioDurationSeconds: 30
    });
    expect(result.processingDurationMs).toEqual(expect.any(Number));
    expect(transcribe).toHaveBeenCalledTimes(1);
});

it('returns a partial result on cancellation during recovery and resumes from saved chunks', async () => {
    const controller = new AbortController();
    const phrase = 'что мы занимаемся тем что хотят';
    const repeated = chunk(`${phrase} ${phrase} ${phrase}`);
    const transcribe = jestApi.fn().mockResolvedValueOnce(chunk('saved')).mockResolvedValueOnce(repeated)
        .mockImplementationOnce(async () => {
            controller.abort();
            throw new Error('decoder canceled');
        });

    const canceled = await transcribeResumableFile(source, { ...options, signal: controller.signal }, transcribe, checkpoints);
    expect(canceled).toMatchObject({ partial: true, status: 'partial', text: expect.stringContaining('saved') });
    expect(canceled.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'canceled', start: 240, end: 480 }),
        expect.objectContaining({ code: 'canceled', start: 480, end: 720 })
    ]));
    expect(transcribe).toHaveBeenCalledTimes(3);

    const retry = jestApi.fn().mockResolvedValue(chunk('resumed'));
    const result = await transcribeResumableFile(source, options, retry, checkpoints);
    expect(retry).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('saved resumed resumed');
});
