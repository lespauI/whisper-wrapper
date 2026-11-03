const fs = require('fs');
const os = require('os');
const path = require('path');
const { once } = require('events');

jest.mock('child_process', () => {
    const actual = jest.requireActual('child_process');
    return { ...actual, spawn: jest.fn(actual.spawn) };
});
const { spawn } = require('child_process');
const { LocalWhisperService } = require('../../src/services/localWhisperService');

describe('Whisper process cancellation', () => {
    test('terminates a running process and permits another transcription', async () => {
        if (process.platform === 'win32') return;
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-cancel-test-'));
        const binary = path.join(directory, 'whisper');
        const input = path.join(directory, 'input.wav');
        fs.writeFileSync(binary, '#!/bin/sh\nexec sleep 60\n', { mode: 0o700 });
        fs.writeFileSync(input, 'audio');
        const service = Object.create(LocalWhisperService.prototype);
        Object.assign(service, {
            whisperPath: binary, tempDir: directory, useGpu: false,
            isAvailable: () => true, findModelPath: () => input,
            convertAudioToWav: async (source, destination) => fs.copyFileSync(source, destination)
        });
        const children = [];
        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                const controller = new AbortController();
                const task = service.transcribeFile(input, { language: 'en', signal: controller.signal });
                const outcome = task.catch(error => error);
                while (spawn.mock.results.length <= attempt) await Promise.resolve();
                const child = spawn.mock.results[attempt].value;
                children.push(child);
                await once(child, 'spawn');
                const closed = new Promise(resolve => child.once('close', resolve));
                controller.abort();
                expect(await outcome).toBeInstanceOf(Error);
                await closed;
                expect(child.signalCode).toBe('SIGKILL');
                expect(fs.readdirSync(directory).sort()).toEqual(['input.wav', 'whisper']);
            }
            expect(spawn).toHaveBeenCalledTimes(2);
        } finally {
            for (const child of children) {
                if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
            }
            for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, file));
            fs.rmdirSync(directory);
        }
    });
});
