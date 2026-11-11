const { afterEach, beforeEach, expect, it, jest: jestApi } = require('@jest/globals');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { transcribeResumableFile } = require('../../src/services/resumableTranscription');

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
    execFile.mockImplementation((command, args, callback) => {
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
    await expect(transcribeResumableFile(source, options, first, checkpoints)).rejects.toThrow('decoder exited');
    const copy = path.join(directory, 'second.mp4');
    await fs.copyFile(source, copy);

    const retry = jestApi.fn().mockResolvedValue(chunk('third'));
    const result = await transcribeResumableFile(copy, options, retry, checkpoints);

    expect(retry).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('first second third');
    expect(result.segments.map(({ id, start, end }) => [id, start, end]))
        .toEqual([[0, 0, 1], [1, 240, 241], [2, 480, 481]]);
    expect(await fs.readdir(checkpoints)).toEqual([]);
});

it('does not reuse chunks after recognition settings change', async () => {
    const first = jestApi.fn().mockResolvedValueOnce(chunk('old')).mockRejectedValueOnce(new Error('decoder exited'));
    await expect(transcribeResumableFile(source, options, first, checkpoints)).rejects.toThrow('decoder exited');

    const retry = jestApi.fn().mockResolvedValue(chunk('new'));
    const result = await transcribeResumableFile(source, { ...options, model: 'tiny' }, retry, checkpoints);
    expect(retry).toHaveBeenCalledTimes(3);
    expect(result.text).toBe('new new new');
});

it('uses the regular transcription for short recordings', async () => {
    execFile.mockImplementationOnce((command, args, callback) => callback(null, {
        stdout: '{"streams":[{"duration":"110"}]}'
    }));
    const transcribe = jestApi.fn().mockResolvedValue(chunk('short'));
    await transcribeResumableFile(source, options, transcribe, checkpoints);
    expect(transcribe).toHaveBeenCalledWith(source, { ...options, preserveDecoderOutput: true });
});

it('moves a chunk boundary to a nearby pause and offsets the next segments', async () => {
    execFile.mockImplementation((command, args, callback) => callback(null, {
        stdout: command === 'ffprobe' ? '{"streams":[{"duration":"300"}]}' : '',
        stderr: args.includes('-af') ? 'silence_end: 2.5 | silence_duration: 0.4' : ''
    }));
    const transcribe = jestApi.fn().mockResolvedValue(chunk('speech'));
    const result = await transcribeResumableFile(source, options, transcribe, checkpoints);
    expect(result.segments[1].start).toBe(239.3);
    expect(execFile.mock.calls.some(([, args]) => args.includes('239.3'))).toBe(true);
});

it('redecodes a whole short clip when the timestamps stall', async () => {
    execFile.mockImplementationOnce((command, args, callback) => callback(null, {
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
    execFile.mockImplementationOnce((command, args, callback) => callback(null, {
        stdout: '{"streams":[{"duration":"30"}]}'
    }));
    const raw = { ...chunk(''), segments: [0, 1, 2, 3].map(start => ({
        start, end: start + 1, text: 'И чтобы оно было гранулярным.'
    })) };
    const transcribe = jestApi.fn().mockResolvedValue(raw);

    expect(await transcribeResumableFile(source, options, transcribe, checkpoints)).toBe(raw);
    expect(transcribe).toHaveBeenCalledTimes(1);
});
