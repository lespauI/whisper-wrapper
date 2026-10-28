const { RecordingController } = require('../../../src/renderer/controllers/RecordingController.js');

describe('Recording integrity', () => {
    let controller;
    let settings;

    beforeEach(() => {
        settings = { quality: 'medium', format: 'wav', enableAutoSave: true };
        controller = Object.create(RecordingController.prototype);
        controller.appState = { getRecordingState: () => settings };
        controller.statusController = { updateStatus: jest.fn(), showError: jest.fn() };
        controller.recordingAutoSave = { sessionId: 'session', chunkIndex: 0, savedChunks: [] };
        controller.audioChunks = [new Blob(['before'])];
        global.MediaRecorder = { isTypeSupported: type => type === 'audio/webm;codecs=opus' };
        global.window = { electronAPI: {
            saveRecordingChunk: jest.fn().mockResolvedValue({ success: true, path: '/tmp/chunk' }),
            saveFile: jest.fn().mockResolvedValue({ canceled: false })
        } };
    });

    afterEach(() => {
        delete global.window;
        delete global.MediaRecorder;
        jest.restoreAllMocks();
    });

    test.each(['low', 'medium', 'high'])('preserves speaker audio at %s quality', quality => {
        settings.quality = quality;
        expect(controller.getRecordingConstraints().audio).toMatchObject({
            echoCancellation: false, noiseSuppression: false, autoGainControl: false
        });
    });

    test('preserves arriving audio and serializes concurrent saves', async () => {
        let finishSave;
        window.electronAPI.saveRecordingChunk.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
        const first = controller.saveCurrentRecordingChunk();
        while (!finishSave) await Promise.resolve();
        const arriving = new Blob(['during']);
        controller.audioChunks.push(arriving);
        const second = controller.saveCurrentRecordingChunk();
        finishSave({ success: true, path: '/tmp/chunk' });
        await Promise.all([first, second]);
        expect(window.electronAPI.saveRecordingChunk).toHaveBeenCalledTimes(1);
        expect(controller.audioChunks).toEqual([arriving]);
        expect(controller.recordingAutoSave.savedChunks[0].originalChunksCount).toBe(1);
        window.electronAPI.saveRecordingChunk.mockResolvedValue({ success: true, path: '/tmp/next' });
        await controller.saveCurrentRecordingChunk();
        expect(controller.audioChunks).toEqual([]);
    });

    test('retains audio for retry when saving fails', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        window.electronAPI.saveRecordingChunk.mockResolvedValue({ success: false, error: 'disk full' });
        await controller.saveCurrentRecordingChunk();
        expect(controller.audioChunks).toHaveLength(1);
        expect(controller.recordingAutoSave.savedChunks).toEqual([]);
        expect(console.error).toHaveBeenCalled();
    });

    test('uses Opus in WebM when WAV is unavailable', () => {
        expect(controller.getMimeType()).toBe('audio/webm;codecs=opus');
    });

    test.each([['audio/webm;codecs=opus', 'webm'], ['audio/mp4', 'm4a'], ['audio/wav', 'wav']])(
        'exports %s with the matching extension', async (type, extension) => {
            controller.recordingBlob = new Blob(['audio'], { type });
            await controller.saveRecording();
            expect(window.electronAPI.saveFile).toHaveBeenCalledWith(expect.any(ArrayBuffer), expect.stringMatching(new RegExp(`\\.${extension}$`)));
        }
    );
});
