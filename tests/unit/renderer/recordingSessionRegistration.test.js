const { RecordingController } = require('../../../src/renderer/controllers/RecordingController.js');

describe('Recording auto-save session registration', () => {
    let controller;
    let startRecordingChunkSession;

    beforeEach(() => {
        controller = Object.create(RecordingController.prototype);
        controller.appState = {
            getRecordingState: () => ({ enableAutoSave: true }),
            setRecordingState: jest.fn()
        };
        controller.recordingAutoSave = { sessionId: null, chunkIndex: 0, savedChunks: [] };
        startRecordingChunkSession = jest.fn().mockResolvedValue({
            success: true,
            sessionId: 'recording_1794414300000_0123456789abcdef'
        });
        global.window = {
            electronAPI: {
                getAppPaths: jest.fn().mockResolvedValue({ temp: '/tmp/whisper-wrapper' }),
                startRecordingChunkSession
            }
        };
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        delete global.window;
        jest.restoreAllMocks();
    });

    test('uses the main-issued session id before recording chunks', async () => {
        await controller.initializeAutoSaveSession();

        expect(startRecordingChunkSession).toHaveBeenCalledTimes(1);
        expect(controller.recordingAutoSave).toMatchObject({
            sessionId: 'recording_1794414300000_0123456789abcdef',
            chunkIndex: 0,
            savedChunks: [],
            tempDirectory: '/tmp/whisper-wrapper'
        });
    });
});
