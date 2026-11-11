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

    test('keeps prior recording fragments out of a new session with auto-save disabled', async () => {
        await controller.initializeAutoSaveSession();
        controller.recordingAutoSave.savedChunks.push({ filePath: '/tmp/old-chunk' });
        controller.appState.getRecordingState = () => ({ enableAutoSave: false });

        await controller.initializeAutoSaveSession();

        const newAudio = new Blob(['new recording']);
        expect(await controller.combineRecordingChunks(newAudio)).toBe(newAudio);
        expect(controller.recordingAutoSave.sessionId).toBeNull();
        expect(startRecordingChunkSession).toHaveBeenCalledTimes(1);
    });

    test('detaches prior fragments when the new session cannot be registered', async () => {
        await controller.initializeAutoSaveSession();
        controller.recordingAutoSave.savedChunks.push({ filePath: '/tmp/old-chunk' });
        startRecordingChunkSession.mockRejectedValueOnce(new Error('IPC unavailable'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        await controller.initializeAutoSaveSession();

        const newAudio = new Blob(['new recording']);
        expect(await controller.combineRecordingChunks(newAudio)).toBe(newAudio);
        expect(controller.recordingAutoSave.sessionId).toBeNull();
        expect(controller.appState.setRecordingState).toHaveBeenCalledWith({ enableAutoSave: false });
    });
});
