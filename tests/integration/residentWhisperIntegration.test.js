const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const binary = process.env.WHISPER_SERVER_BINARY;
const models = process.env.WHISPER_MODEL_DIRECTORY;
const audio = process.env.WHISPER_MULTILINGUAL_TEST_AUDIO;
const available = binary && models && audio && [binary, audio,
    path.join(models, 'ggml-large.bin'), path.join(models, 'ggml-tiny.bin')].every(file => fs.existsSync(file));

(available ? describe : describe.skip)('native resident multilingual workers', () => {
    let service;
    let spawn;
    let first;

    beforeAll(() => {
        spawn = jest.spyOn(childProcess, 'spawn');
        const { LocalWhisperService } = require('../../src/services/localWhisperService');
        service = new LocalWhisperService();
        service.whisperServerPath = binary;
        service.whisperPath = path.join(path.dirname(binary), process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli');
        service.modelsPath = models;
    });

    afterAll(async () => {
        const processes = [...service.multilingualService.workers.values()]
            .map(worker => worker.process).filter(process => process && process.exitCode === null && process.signalCode === null);
        const exited = processes.map(process => new Promise(resolve => process.once('close', resolve)));
        service.cleanup();
        await Promise.all(exited);
        spawn.mockRestore();
    });

    it('preserves Russian and English speech and valid global timestamps', async () => {
        first = await service.transcribeFile(audio, {
            model: 'large', language: 'auto', threads: 8, useGpu: true,
            flashAttn: true, useInitialPrompt: false
        });
        expect(first.success).toBe(true);
        expect(first.languages).toEqual(expect.arrayContaining(['ru', 'en']));
        expect(first.text).toMatch(/[А-Яа-я]/);
        expect(first.text).toMatch(/agent/i);
        expect(first.segments.length).toBeGreaterThan(1);
        first.segments.forEach((segment, index) => {
            expect(segment.id).toBe(index);
            expect(segment.start).toBeGreaterThanOrEqual(0);
            expect(segment.end).toBeGreaterThanOrEqual(segment.start);
            expect(segment.end).toBeLessThanOrEqual(first.audioDuration);
        });
    }, 120000);

    it('reuses both native processes on the next transcription and converts once per file', async () => {
        const second = await service.transcribeFile(audio, {
            model: 'large', language: 'auto', threads: 8, useGpu: true,
            flashAttn: true, useInitialPrompt: false
        });
        expect(second.text).toBe(first.text);
        const servers = spawn.mock.calls.filter(([command]) => command === binary);
        const conversions = spawn.mock.calls.filter(([command]) => command === 'ffmpeg');
        expect(servers).toHaveLength(2);
        expect(conversions).toHaveLength(2);
        expect(servers.map(([, args]) => args[args.indexOf('-m') + 1]).sort()).toEqual([
            path.join(models, 'ggml-large.bin'), path.join(models, 'ggml-tiny.bin')
        ].sort());
    }, 120000);
});
