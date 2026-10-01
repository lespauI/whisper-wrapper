jest.mock('../../src/services/whisperServerWorker', () => ({ WhisperServerWorker: jest.fn() }));
const { WhisperServerWorker } = require('../../src/services/whisperServerWorker');
const { MultilingualWhisperService, PcmAudio } = require('../../src/services/multilingualWhisperService');

function wav(seconds, silent = false) {
    const pcm = Buffer.alloc(Math.round(seconds * 32000));
    for (let i = 0; i < pcm.length; i += 2) pcm.writeInt16LE(silent ? 0 : 1000 + Math.floor(i / 32000), i);
    const dummy = Object.create(PcmAudio.prototype);
    dummy.pcm = pcm;
    return Buffer.concat(dummy.slice(0, seconds));
}

describe('resident multilingual transcription', () => {
    let service;
    let detection;
    let workers;
    const settings = { binary: '/whisper-server', modelPath: '/large', tinyModelPath: '/tiny',
        options: { model: 'large', threads: 8, useGpu: true, flashAttn: true, gpuDevice: 0 } };

    beforeEach(() => {
        jest.clearAllMocks();
        workers = [];
        detection = (model, start) => ({ [start >= 40 && start < 80 ? 'en' : 'ru']: 0.98, de: 0.01 });
        WhisperServerWorker.mockImplementation((binary, model, options) => {
            const worker = { binary, model, options, close: jest.fn(), infer: jest.fn(async (audio, fields) => {
                const start = audio[1].readInt16LE(0) - 1000;
                if (fields.detect_language) return { language_probabilities: detection(model, start) };
                return { segments: [{ start: 0, end: audio[1].length / 32000, text: ` ${fields.language} speech ` }] };
            }) };
            workers.push(worker);
            return worker;
        });
        service = new MultilingualWhisperService();
    });

    afterEach(() => service.close());

    it('refines both switches with large and transcribes contiguous sections with global timestamps', async () => {
        const result = await service.transcribe(wav(130), settings);
        expect(result.language).toBe('mixed');
        expect(result.languages).toEqual(['ru', 'en']);
        expect(result.segments).toEqual([
            { id: 0, start: 0, end: 40, text: 'ru speech', language: 'ru' },
            { id: 1, start: 40, end: 80, text: 'en speech', language: 'en' },
            { id: 2, start: 80, end: 130, text: 'ru speech', language: 'ru' }
        ]);
        const decoder = workers.find(worker => worker.model === '/large');
        const calls = decoder.infer.mock.calls.filter(([, fields]) => !fields.detect_language);
        expect(calls).toHaveLength(3);
        for (const [, fields] of calls) {
            expect(fields).toMatchObject({ max_context: 0, carry_initial_prompt: false,
                no_language_probabilities: true, token_timestamps: false, best_of: 5, beam_size: 5,
                temperature: 0, temperature_inc: 0 });
        }
    });

    it('reuses exactly two resident models across windows and repeated jobs', async () => {
        await service.transcribe(wav(130), settings);
        await service.transcribe(wav(130), settings);
        expect(WhisperServerWorker).toHaveBeenCalledTimes(2);
        expect(workers.every(worker => worker.close.mock.calls.length === 0)).toBe(true);
    });

    it('keeps both sides of a shifted language boundary at exactly the same sample', async () => {
        const input = wav(130);
        input.fill(0, 44 + 38.4 * 32000, 44 + 38.7 * 32000);
        const result = await service.transcribe(input, settings);
        expect(result.segments[0].end).toBeGreaterThanOrEqual(38.4);
        expect(result.segments[0].end).toBeLessThanOrEqual(38.7);
        expect(result.segments[1].start).toBe(result.segments[0].end);
    });

    it('confirms an isolated tiny language error using the selected model', async () => {
        detection = (model, start) => ({ [model === '/tiny' && start === 30 ? 'pl' : 'ru']: 0.99 });
        const result = await service.transcribe(wav(90), settings);
        expect(result.languages).toEqual(['ru']);
        expect(result.segments).toHaveLength(1);
        expect(workers.find(worker => worker.model === '/large').infer.mock.calls
            .filter(([, fields]) => fields.detect_language)).toHaveLength(1);
    });

    it('uses large when the tiny confidence or margin is low', async () => {
        detection = model => model === '/tiny' ? { en: 0.42, ru: 0.39 } : { ru: 0.99 };
        const result = await service.transcribe(wav(30), settings);
        expect(result.languages).toEqual(['ru']);
    });

    it('does not promote a weak detection on a short final fragment into a new language', async () => {
        detection = (model, start) => start === 30 ? { en: 0.6, ru: 0.3 } : { ru: 0.99 };
        const result = await service.transcribe(wav(32), settings);
        expect(result.languages).toEqual(['ru']);
        expect(result.segments[0].end).toBe(32);
    });

    it('keeps unsupported or uncertain boundary labels from becoming a third language', async () => {
        detection = (model, start) => {
            if (model === '/large' && start === 50) return { uk: 0.8, en: 0.1 };
            return { [start >= 40 && start < 80 ? 'en' : 'ru']: 0.98 };
        };
        const result = await service.transcribe(wav(130), settings);
        expect(result.languages).toEqual(['ru', 'en']);
    });

    it('skips silence and does not invent a transcript', async () => {
        const result = await service.transcribe(wav(60, true), settings);
        expect(result.text).toBe('');
        expect(result.segments).toEqual([]);
        expect(workers.every(worker => worker.infer.mock.calls.length === 0)).toBe(true);
    });

    it('supports missing tiny by using the same loaded selected model for detection', async () => {
        await service.transcribe(wav(30), { ...settings, tinyModelPath: null });
        expect(WhisperServerWorker).toHaveBeenCalledTimes(1);
    });

    it('bounds long requests without gaps or resetting global segment IDs', async () => {
        detection = () => ({ ru: 0.99 });
        const result = await service.transcribe(wav(1231), settings);
        expect(result.segments.map(segment => [segment.id, segment.start, segment.end])).toEqual([
            [0, 0, 600], [1, 600, 1200], [2, 1200, 1231]
        ]);
    });

    it('serializes concurrent jobs while sharing the same models', async () => {
        await Promise.all([service.transcribe(wav(30), settings), service.transcribe(wav(30), settings)]);
        expect(WhisperServerWorker).toHaveBeenCalledTimes(2);
    });

    it('releases old models when the GPU or thread configuration changes', async () => {
        await service.transcribe(wav(30), settings);
        const first = [...workers];
        await service.transcribe(wav(30), { ...settings, options: { ...settings.options, useGpu: false } });
        expect(first.every(worker => worker.close.mock.calls.length === 1)).toBe(true);
        expect(WhisperServerWorker).toHaveBeenCalledTimes(4);
    });

    it('propagates worker errors, disposes failed workers, and permits a later retry', async () => {
        detection = () => { throw new Error('worker crashed'); };
        await expect(service.transcribe(wav(30), settings)).rejects.toThrow('worker crashed');
        expect(workers.every(worker => worker.close.mock.calls.length === 1)).toBe(true);
        detection = () => ({ ru: 0.99 });
        await expect(service.transcribe(wav(30), settings)).resolves.toMatchObject({ success: true });
        expect(WhisperServerWorker).toHaveBeenCalledTimes(4);
    });

    it('rejects servers without language probabilities', async () => {
        detection = () => ({});
        await expect(service.transcribe(wav(30), settings)).rejects.toThrow('rebuild the server');
    });

    it('rejects malformed transcription responses', async () => {
        await service.transcribe(wav(30), settings);
        const decoder = service.worker(settings.binary, settings.modelPath, settings.options);
        decoder.infer.mockResolvedValue({ segments: [{ start: 'invalid', end: 1, text: 'bad' }] });
        await expect(service.transcribe(wav(30), settings)).rejects.toThrow('invalid segment');
    });

    it('forwards explicit prompt and translation without carrying decoded history', async () => {
        await service.transcribe(wav(30), { ...settings, options: { ...settings.options, prompt: 'Acme', translate: true } });
        const decoder = workers.find(worker => worker.model === '/large');
        expect(decoder.infer.mock.calls.at(-1)[1]).toMatchObject({ prompt: 'Acme', translate: true, max_context: 0 });
    });

    it('rejects work after cleanup', async () => {
        service.close();
        await expect(service.transcribe(wav(30), settings)).rejects.toThrow('closed');
    });

    describe('terminal progress', () => {
        let log;

        beforeEach(() => {
            log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
        });

        afterEach(() => {
            log.mockRestore();
            jest.useRealTimers();
        });

        it('reports stages, language, audio ranges, and completed progress without logging transcript text', async () => {
            await service.transcribe(wav(130), settings);
            const output = log.mock.calls.flat().join('\n');
            expect(output).toContain('Starting transcription: 2.2 minutes of audio, model large');
            expect(output).toContain('Language detection: 5/5 windows (100%)');
            expect(output).toContain('Refining');
            expect(output).toContain('Transcribing part 2/3 [en]: 0:40–1:20');
            expect(output).toContain('Completed part 3/3: 100% of audio processed');
            expect(output).toContain('Finished transcription: 3 segments, languages ru/en');
            expect(output).not.toContain('en speech');
        });

        it('reports elapsed time while inference waits and stops the heartbeat after success', async () => {
            jest.useFakeTimers();
            detection = () => ({ ru: 0.99 });
            const factory = WhisperServerWorker.getMockImplementation();
            let finish;
            WhisperServerWorker.mockImplementation((...args) => {
                const worker = factory(...args);
                const infer = worker.infer.getMockImplementation();
                worker.infer.mockImplementation((audio, fields) => fields.detect_language ? infer(audio, fields) :
                    new Promise(resolve => { finish = resolve; }));
                return worker;
            });
            const task = service.transcribe(wav(30), settings);
            for (let i = 0; i < 30 && !finish; i++) await Promise.resolve();
            expect(finish).toBeDefined();
            jest.advanceTimersByTime(20000);
            expect(log.mock.calls.filter(([message]) => message.includes('Waiting for processing'))).toHaveLength(2);
            expect(log).toHaveBeenCalledWith(expect.stringContaining('Transcribing part 1/1 [ru]: 0:00–0:30 (20s total elapsed)'));
            finish({ segments: [] });
            await task;
            expect(jest.getTimerCount()).toBe(0);
            const count = log.mock.calls.length;
            jest.advanceTimersByTime(20000);
            expect(log).toHaveBeenCalledTimes(count);
        });

        it('reports failure and stops the heartbeat when a worker rejects', async () => {
            jest.useFakeTimers();
            detection = () => { throw new Error('worker failed'); };
            await expect(service.transcribe(wav(30), settings)).rejects.toThrow('worker failed');
            expect(log).toHaveBeenCalledWith(expect.stringContaining('Failed during Detecting languages'));
            expect(jest.getTimerCount()).toBe(0);
            const count = log.mock.calls.length;
            jest.advanceTimersByTime(20000);
            expect(log).toHaveBeenCalledTimes(count);
        });
    });
});

describe('PCM windows', () => {
    it('handles extra RIFF chunks and shares the original sample memory', () => {
        const input = wav(1);
        const junk = Buffer.from('JUNK\x02\x00\x00\x00ab', 'binary');
        const audio = new PcmAudio(Buffer.concat([input.subarray(0, 36), junk, input.subarray(36)]));
        const parts = audio.slice(0.25, 0.75);
        expect(parts[1].length).toBe(16000);
        expect(parts[1].buffer).toBe(audio.pcm.buffer);
        expect(new PcmAudio(Buffer.concat(parts)).duration).toBe(0.5);
    });

    it.each([Buffer.alloc(10), Buffer.from('not a WAV')])('rejects invalid audio', input => {
        expect(() => new PcmAudio(input)).toThrow('PCM WAV');
    });

    it('rejects a truncated data chunk', () => {
        expect(() => new PcmAudio(wav(1).subarray(0, 100))).toThrow('Truncated');
    });

    it('rejects stereo, wrong sample rate, non-PCM, and empty PCM', () => {
        for (const [offset, value, bytes] of [[20, 3, 2], [22, 2, 2], [24, 44100, 4], [34, 32, 2]]) {
            const input = wav(1);
            if (bytes === 2) input.writeUInt16LE(value, offset);
            else input.writeUInt32LE(value, offset);
            expect(() => new PcmAudio(input)).toThrow('16 kHz mono PCM16');
        }
        expect(() => new PcmAudio(wav(0))).toThrow('nonempty');
    });

    it('moves a transition into a nearby pause and keeps the PCM ranges contiguous', () => {
        const input = wav(10);
        input.fill(0, 44 + 4.0 * 32000, 44 + 4.2 * 32000);
        const audio = new PcmAudio(input);
        const boundary = audio.nearestSilence(5, 0.1, 9.9);
        expect(boundary).toBeGreaterThanOrEqual(4.0);
        expect(boundary).toBeLessThanOrEqual(4.2);
        expect(Buffer.concat([audio.slice(0, boundary)[1], audio.slice(boundary, 10)[1]])).toEqual(audio.pcm);
    });

    it('keeps the original boundary when there is no nearby silence or the pause is outside its allowed range', () => {
        const input = wav(10);
        const audio = new PcmAudio(input);
        expect(audio.nearestSilence(5, 0.1, 9.9)).toBe(5);
        input.fill(0, 44 + 4.0 * 32000, 44 + 4.2 * 32000);
        expect(audio.nearestSilence(5, 4.5, 9.9)).toBe(5);
    });

    it('rejects gaps shorter than 100 ms', () => {
        const input = wav(10);
        input.fill(0, 44 + 4.0 * 32000, 44 + 4.04 * 32000);
        expect(new PcmAudio(input).nearestSilence(5, 0.1, 9.9)).toBe(5);
    });
});
