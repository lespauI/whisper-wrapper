const { RecordingController } = require('../../../src/renderer/controllers/RecordingController.js');

describe('Recording chunk persistence', () => {
    let controller;

    beforeEach(() => {
        controller = Object.create(RecordingController.prototype);
        controller.appState = { getRecordingState: () => ({ enableAutoSave: true }) };
        controller.statusController = { updateStatus: jest.fn(), showError: jest.fn() };
        controller.recordingAutoSave = { sessionId: 'session', chunkIndex: 0, savedChunks: [] };
        controller.audioChunks = [];
        global.MediaRecorder = { isTypeSupported: type => type === 'audio/webm;codecs=opus' };
        global.window = { electronAPI: {
            saveRecordingChunk: jest.fn().mockResolvedValue({ success: true, filePath: '/tmp/chunk' }),
            loadRecordingChunk: jest.fn().mockResolvedValue(Buffer.from('saved')),
            deleteRecordingChunk: jest.fn().mockResolvedValue({ success: true })
        } };
    });

    afterEach(() => {
        delete global.window;
        delete global.MediaRecorder;
        jest.restoreAllMocks();
    });

    test('loads and deletes chunks through the IPC filePath contract', async () => {
        controller.audioChunks = [new Blob(['saved'])];
        await controller.saveCurrentRecordingChunk();

        expect(controller.recordingAutoSave.savedChunks[0].filePath).toBe('/tmp/chunk');
        const combined = await controller.combineRecordingChunks(new Blob(['tail']));
        await controller.cleanupAutoSaveFiles();

        expect(window.electronAPI.loadRecordingChunk).toHaveBeenCalledWith('/tmp/chunk');
        expect(window.electronAPI.deleteRecordingChunk).toHaveBeenCalledWith('/tmp/chunk');
        expect(await combined.text()).toBe('savedtail');
    });

    test('retains saved chunks when assembly cannot load one', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const savedChunk = { filename: 'chunk.webm', filePath: '/tmp/chunk' };
        controller.recordingAutoSave.savedChunks = [savedChunk];
        window.electronAPI.loadRecordingChunk.mockRejectedValue(new Error('disk read failed'));

        await expect(controller.combineRecordingChunks(new Blob(['tail'])))
            .rejects.toThrow('disk read failed');

        expect(controller.recordingAutoSave.savedChunks).toEqual([savedChunk]);
        expect(window.electronAPI.deleteRecordingChunk).not.toHaveBeenCalled();
    });

    test('persists the final recorder data before assembly and does not expose a broken recording', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        controller.audioChunks = [new Blob(['final recorder data'])];
        window.electronAPI.loadRecordingChunk.mockRejectedValue(new Error('disk read failed'));

        await controller.finishRecording('audio/webm');

        const [bytes] = window.electronAPI.saveRecordingChunk.mock.calls[0];
        expect(Buffer.from(bytes).toString()).toBe('final recorder data');
        expect(controller.recordingBlob).toBeUndefined();
        expect(controller.recordingAutoSave.savedChunks).toHaveLength(1);
        expect(window.electronAPI.deleteRecordingChunk).not.toHaveBeenCalled();
        expect(controller.statusController.showError).toHaveBeenCalled();
    });
});
