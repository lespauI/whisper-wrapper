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
            saveRecordingChunk: jest.fn().mockResolvedValue({ success: true, filePath: '/tmp/chunk' }),
            loadRecordingChunk: jest.fn().mockResolvedValue(Buffer.from('saved')),
            deleteRecordingChunk: jest.fn().mockResolvedValue({ success: true }),
            saveFile: jest.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/final.webm' })
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
        finishSave({ success: true, filePath: '/tmp/chunk' });
        await Promise.all([first, second]);
        expect(window.electronAPI.saveRecordingChunk).toHaveBeenCalledTimes(1);
        expect(controller.audioChunks).toEqual([arriving]);
        expect(controller.recordingAutoSave.savedChunks[0].originalChunksCount).toBe(1);
        window.electronAPI.saveRecordingChunk.mockResolvedValue({ success: true, filePath: '/tmp/next' });
        await controller.saveCurrentRecordingChunk();
        expect(controller.audioChunks).toEqual([]);
    });

    test('keeps chunks until the combined recording is saved successfully', async () => {
        controller.audioChunks = [new Blob(['saved'])];
        await controller.saveCurrentRecordingChunk();

        expect(controller.recordingAutoSave.savedChunks[0].filePath).toBe('/tmp/chunk');

        const combined = await controller.combineRecordingChunks(new Blob(['tail']));

        expect(window.electronAPI.loadRecordingChunk).toHaveBeenCalledWith('/tmp/chunk');
        expect(window.electronAPI.deleteRecordingChunk).not.toHaveBeenCalled();
        expect(controller.recordingAutoSave.savedChunks).toHaveLength(1);
        expect(await combined.text()).toBe('savedtail');

        controller.recordingBlob = combined;
        await controller.saveRecording();

        expect(window.electronAPI.saveFile).toHaveBeenCalledWith(expect.any(ArrayBuffer), expect.stringMatching(/\.webm$/));
        expect(window.electronAPI.deleteRecordingChunk).toHaveBeenCalledWith('/tmp/chunk');
        expect(controller.recordingAutoSave.savedChunks).toEqual([]);
    });

    test.each([
        ['canceled', () => ({ canceled: true })],
        ['failed', () => { throw new Error('disk full'); }],
        ['incomplete', () => ({ canceled: false })]
    ])('keeps chunks when final recording save is %s', async (outcome, makeSaveResult) => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const savedChunk = { filename: 'chunk.webm', filePath: '/tmp/chunk' };
        controller.recordingAutoSave.savedChunks = [savedChunk];
        controller.recordingBlob = new Blob(['combined'], { type: 'audio/webm' });
        window.electronAPI.saveFile.mockImplementation(async () => makeSaveResult());

        await controller.saveRecording();

        expect(controller.recordingAutoSave.savedChunks).toEqual([savedChunk]);
        expect(window.electronAPI.deleteRecordingChunk).not.toHaveBeenCalled();
        if (outcome !== 'canceled') {
            expect(controller.statusController.showError).toHaveBeenCalledWith('Failed to save recording');
        }
    });

    test('keeps saved chunks when assembly cannot load one', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const savedChunk = { filename: 'chunk.webm', filePath: '/tmp/chunk' };
        controller.recordingAutoSave.savedChunks = [savedChunk];
        window.electronAPI.loadRecordingChunk.mockRejectedValue(new Error('disk read failed'));

        await expect(controller.combineRecordingChunks(new Blob(['tail']))).rejects.toThrow('disk read failed');

        expect(controller.recordingAutoSave.savedChunks).toEqual([savedChunk]);
        expect(window.electronAPI.deleteRecordingChunk).not.toHaveBeenCalled();
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
