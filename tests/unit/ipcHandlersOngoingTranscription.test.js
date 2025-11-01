const IPCHandlers = require('../../src/main/ipcHandlers');
const TranscriptionService = require('../../src/services/transcriptionService');
const FileService = require('../../src/services/fileService');
const config = require('../../src/config');

// Mocks mirroring existing ipcHandlers.test.js setup
jest.mock('electron', () => ({
    dialog: {
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn()
    },
    shell: {
        openPath: jest.fn()
    },
    ipcMain: {
        handle: jest.fn()
    }
}));

jest.mock('../../src/services/transcriptionService');
jest.mock('../../src/services/fileService');
jest.mock('../../src/config');
jest.mock('fs', () => ({
    writeFileSync: jest.fn(),
    promises: {
        writeFile: jest.fn()
    }
}));

jest.mock('electron-store', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        store: {}
    }));
});

describe('IPCHandlers - Ongoing Transcription context prompt', () => {
    let handlers;
    let mockTranscriptionService;

    beforeEach(() => {
        mockTranscriptionService = {
            isAvailable: jest.fn().mockReturnValue(true),
            setModel: jest.fn(),
            setLanguage: jest.fn(),
            transcribeBuffer: jest.fn(),
            testConnection: jest.fn(),
            getAvailableModels: jest.fn(),
            updateSettings: jest.fn()
        };

        TranscriptionService.mockImplementation(() => mockTranscriptionService);
        FileService.mockImplementation(() => ({
            validateFile: jest.fn(),
            copyToTemp: jest.fn(),
            getFileInfo: jest.fn(),
            cleanup: jest.fn()
        }));

        config.getSimplified.mockReturnValue({
            model: 'base',
            language: 'auto',
            threads: 4,
            translate: false,
            useInitialPrompt: false
        });

        handlers = new IPCHandlers();
        jest.clearAllMocks();
    });

    it('passes contextPrompt to transcribeBuffer when provided', async () => {
        const mockEvent = { sender: { send: jest.fn() } };
        const audio = Buffer.from('chunk');
        const prompt = '  last few words of previous chunk  ';
        mockTranscriptionService.transcribeBuffer.mockResolvedValue({ success: true, text: 'ok' });

        await handlers.handleTranscribeAudio(mockEvent, audio, prompt);

        expect(mockTranscriptionService.transcribeBuffer).toHaveBeenCalledTimes(1);
        const [, options] = mockTranscriptionService.transcribeBuffer.mock.calls[0];
        expect(options).toEqual(expect.objectContaining({ threads: 4, translate: false, contextPrompt: 'last few words of previous chunk' }));
    });

    it('does not include contextPrompt when prompt is empty or whitespace', async () => {
        const mockEvent = { sender: { send: jest.fn() } };
        const audio = Buffer.from('chunk');
        mockTranscriptionService.transcribeBuffer.mockResolvedValue({ success: true, text: 'ok' });

        await handlers.handleTranscribeAudio(mockEvent, audio, '   ');

        expect(mockTranscriptionService.transcribeBuffer).toHaveBeenCalledTimes(1);
        const [, options] = mockTranscriptionService.transcribeBuffer.mock.calls[0];
        expect(options).toEqual({ threads: 4, translate: false, useInitialPrompt: false });
        expect(options.contextPrompt).toBeUndefined();
    });
});
