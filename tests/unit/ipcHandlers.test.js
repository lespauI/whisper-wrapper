const IPCHandlers = require('../../src/main/ipcHandlers');
const { dialog, shell } = require('electron');
const TranscriptionService = require('../../src/services/transcriptionService');
const FileService = require('../../src/services/fileService');
const config = require('../../src/config');
const fs = require('fs');

// Mock dependencies
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

describe('IPCHandlers', () => {
    let handlers;
    let mockTranscriptionService;
    let mockFileService;
    let originalConsoleError;

    beforeEach(() => {
        // Suppress console.error during tests
        originalConsoleError = console.error;
        console.error = jest.fn();
        mockTranscriptionService = {
            isAvailable: jest.fn(),
            setModel: jest.fn(),
            setLanguage: jest.fn(),
            transcribeFile: jest.fn(),
            transcribeAudio: jest.fn(),
            transcribeBuffer: jest.fn(),
            testConnection: jest.fn(),
            getAvailableModels: jest.fn(),
            updateSettings: jest.fn()
        };

        mockFileService = {
            validateFile: jest.fn(),
            copyToTemp: jest.fn(),
            getFileInfo: jest.fn(),
            cleanup: jest.fn()
        };

        TranscriptionService.mockImplementation(() => mockTranscriptionService);
        FileService.mockImplementation(() => mockFileService);

        config.getSimplified.mockReturnValue({
            model: 'base',
            language: 'auto',
            threads: 4,
            translate: false
        });
        config.setSimplified.mockImplementation(() => {});

        // Mock fs operations
        fs.writeFileSync.mockImplementation(() => {});
        fs.promises.writeFile.mockResolvedValue();

        handlers = new IPCHandlers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Restore console.error
        console.error = originalConsoleError;
    });

    describe('constructor', () => {
        it('should initialize services and setup handlers', () => {
            // Test that the handlers object was created successfully
            expect(handlers).toBeDefined();
            expect(handlers.transcriptionService).toBeDefined();
            expect(handlers.fileService).toBeDefined();
        });
    });

    describe('handleOpenFile', () => {
        it('should open file dialog and return file info', async () => {
            const mockResult = {
                canceled: false,
                filePaths: ['/path/to/audio.wav']
            };
            const mockFileInfo = {
                name: 'audio.wav',
                size: 1000000,
                type: 'audio/wav'
            };

            dialog.showOpenDialog.mockResolvedValue(mockResult);
            mockFileService.getFileInfo.mockReturnValue(mockFileInfo);

            const result = await handlers.handleOpenFile();

            expect(result).toEqual({
                canceled: false,
                filePath: '/path/to/audio.wav',
                fileInfo: mockFileInfo
            });
        });

        it('should handle canceled dialog', async () => {
            dialog.showOpenDialog.mockResolvedValue({ canceled: true });

            const result = await handlers.handleOpenFile();

            expect(result).toEqual({ canceled: true });
        });

        it('should handle dialog errors', async () => {
            dialog.showOpenDialog.mockRejectedValue(new Error('Dialog error'));

            await expect(handlers.handleOpenFile()).rejects.toThrow('Failed to open file dialog');
        });
    });

    describe('handleTranscribeFile', () => {
        let mockEvent;

        beforeEach(() => {
            mockEvent = {
                sender: {
                    send: jest.fn()
                }
            };
            mockTranscriptionService.isAvailable.mockReturnValue(true);
            mockFileService.validateFile.mockResolvedValue(true);
            mockFileService.copyToTemp.mockResolvedValue('/temp/audio.wav');
        });

        it('should transcribe file successfully', async () => {
            const mockResult = {
                success: true,
                text: 'Hello world',
                language: 'en'
            };
            mockTranscriptionService.transcribeFile.mockResolvedValue(mockResult);

            const result = await handlers.handleTranscribeFile(mockEvent, '/path/to/audio.wav');

            expect(mockFileService.validateFile).toHaveBeenCalledWith('/path/to/audio.wav');
            expect(mockTranscriptionService.setModel).toHaveBeenCalledWith('base');
            expect(mockTranscriptionService.transcribeFile).toHaveBeenCalledWith('/temp/audio.wav', { threads: 4, translate: false });
            expect(result).toEqual(expect.objectContaining(mockResult));
        });

        it('should throw error when whisper not available', async () => {
            mockTranscriptionService.isAvailable.mockReturnValue(false);

            await expect(handlers.handleTranscribeFile(mockEvent, '/path/to/audio.wav'))
                .rejects.toThrow('Local Whisper is not available');
        });

        it('should handle file validation errors', async () => {
            mockFileService.validateFile.mockRejectedValue(new Error('Invalid file'));

            await expect(handlers.handleTranscribeFile(mockEvent, '/path/to/audio.wav'))
                .rejects.toThrow('Invalid file');
        });

        it('should handle transcription errors', async () => {
            mockTranscriptionService.transcribeFile.mockRejectedValue(new Error('Transcription failed'));

            await expect(handlers.handleTranscribeFile(mockEvent, '/path/to/audio.wav'))
                .rejects.toThrow('Transcription failed');
        });

        it('should configure transcription service with current settings', async () => {
            config.getSimplified.mockReturnValue({
                model: 'small',
                language: 'es',
                threads: 8,
                translate: true
            });

            mockTranscriptionService.transcribeFile.mockResolvedValue({
                success: true,
                text: 'Hola mundo'
            });

            await handlers.handleTranscribeFile(mockEvent, '/path/to/audio.wav');

            expect(mockTranscriptionService.setModel).toHaveBeenCalledWith('small');
            expect(mockTranscriptionService.setLanguage).toHaveBeenCalledWith('es');
        });
    });

    describe('handleTranscribeAudio', () => {
        let mockEvent;

        beforeEach(() => {
            mockEvent = {
                sender: {
                    send: jest.fn()
                }
            };
            mockTranscriptionService.isAvailable.mockReturnValue(true);
        });

        it('should transcribe audio data successfully', async () => {
            const audioData = Buffer.from('audio data');
            const mockResult = {
                success: true,
                text: 'Hello world',
                language: 'en'
            };
            mockTranscriptionService.transcribeBuffer.mockResolvedValue(mockResult);

            const result = await handlers.handleTranscribeAudio(mockEvent, audioData);

            expect(mockTranscriptionService.transcribeBuffer).toHaveBeenCalledWith(audioData, { threads: 4, translate: false });
            expect(result).toEqual(expect.objectContaining(mockResult));
        });

        it('should throw error when whisper not available', async () => {
            mockTranscriptionService.isAvailable.mockReturnValue(false);
            const audioData = Buffer.from('audio data');

            await expect(handlers.handleTranscribeAudio(mockEvent, audioData))
                .rejects.toThrow('Local Whisper is not available');
        });
    });

    describe('handleGetConfig', () => {
        it('should return simplified configuration', async () => {
            const mockConfig = {
                model: 'base',
                language: 'auto',
                threads: 4,
                translate: false
            };
            config.getSimplified.mockReturnValue(mockConfig);

            const result = await handlers.handleGetConfig();

            expect(result).toBe(mockConfig);
        });
    });

    describe('handleSetConfig', () => {
        it('should set simplified configuration when model exists locally', async () => {
            const newConfig = {
                model: 'small',
                language: 'en',
                threads: 8,
                translate: true
            };

            // Mock the test connection and available models
            mockTranscriptionService.testConnection.mockResolvedValue({ success: true });
            mockTranscriptionService.getAvailableModels.mockReturnValue([
                { name: 'small' },
                { name: 'base' }
            ]);

            const result = await handlers.handleSetConfig(null, newConfig);

            expect(config.setSimplified).toHaveBeenCalledWith(newConfig);
            expect(mockTranscriptionService.updateSettings).toHaveBeenCalledWith(newConfig);
            expect(result).toEqual({ success: true });
        });

        it('should return needsDownload when model is valid but not available locally', async () => {
            const newConfig = {
                model: 'tiny',
                language: 'en',
                threads: 4,
                translate: false
            };

            // Mock test connection success but model not available locally
            mockTranscriptionService.testConnection.mockResolvedValue({ success: true });
            mockTranscriptionService.getAvailableModels.mockReturnValue([
                { name: 'base' },
                { name: 'small' }
            ]);

            const result = await handlers.handleSetConfig(null, newConfig);

            expect(result).toEqual({
                success: false,
                needsDownload: true,
                modelName: 'tiny',
                message: "Model 'tiny' needs to be downloaded before use."
            });
            expect(config.setSimplified).not.toHaveBeenCalled();
            expect(mockTranscriptionService.updateSettings).not.toHaveBeenCalled();
        });

        it('should throw error for invalid model name', async () => {
            const newConfig = {
                model: 'invalid-model',
                language: 'en',
                threads: 4,
                translate: false
            };

            // Mock test connection success but model not available locally
            mockTranscriptionService.testConnection.mockResolvedValue({ success: true });
            mockTranscriptionService.getAvailableModels.mockReturnValue([
                { name: 'base' },
                { name: 'small' }
            ]);

            await expect(handlers.handleSetConfig(null, newConfig))
                .rejects.toThrow('Unknown model \'invalid-model\'. Valid models: tiny, tiny.en, base, base.en, small, small.en, medium, medium.en, large, turbo');
        });

        it('should handle configuration errors', async () => {
            const newConfig = {
                model: 'base',
                language: 'en',
                threads: 4,
                translate: false
            };

            mockTranscriptionService.testConnection.mockResolvedValue({ success: true });
            mockTranscriptionService.getAvailableModels.mockReturnValue([
                { name: 'base' }
            ]);

            config.setSimplified.mockImplementation(() => {
                throw new Error('Config error');
            });

            await expect(handlers.handleSetConfig(null, newConfig))
                .rejects.toThrow('Failed to save configuration');
        });

        it('should handle transcription service test failure', async () => {
            const newConfig = {
                model: 'base',
                language: 'en',
                threads: 4,
                translate: false
            };

            mockTranscriptionService.testConnection.mockResolvedValue({ 
                success: false, 
                error: 'Service unavailable' 
            });

            await expect(handlers.handleSetConfig(null, newConfig))
                .rejects.toThrow('Failed to save configuration');
        });
    });

    describe('handleTestWhisper', () => {
        it('should test whisper connection successfully', async () => {
            const mockResult = {
                success: true,
                details: {
                    availableModels: [
                        { name: 'base', size: '141 MB' }
                    ]
                }
            };
            mockTranscriptionService.testConnection.mockResolvedValue(mockResult);

            const result = await handlers.handleTestWhisper();

            expect(result).toBe(mockResult);
        });

        it('should handle test errors', async () => {
            mockTranscriptionService.testConnection.mockRejectedValue(new Error('Test failed'));

            const result = await handlers.handleTestWhisper();

            expect(result).toEqual({
                success: false,
                message: 'Test failed: Test failed'
            });
        });
    });

    describe('handleOpenProjectDirectory', () => {
        it('should open project directory successfully', async () => {
            shell.openPath.mockResolvedValue('');

            const result = await handlers.handleOpenProjectDirectory();

            expect(shell.openPath).toHaveBeenCalledWith(process.cwd());
            expect(result).toEqual({ success: true });
        });

        it('should handle open directory errors', async () => {
            shell.openPath.mockRejectedValue(new Error('Open failed'));

            await expect(handlers.handleOpenProjectDirectory())
                .rejects.toThrow('Failed to open project directory');
        });
    });

    describe('handleSaveFile', () => {
        it('should save text file successfully', async () => {
            const mockResult = {
                canceled: false,
                filePath: '/path/to/save.txt'
            };
            dialog.showSaveDialog.mockResolvedValue(mockResult);

            const result = await handlers.handleSaveFile(null, 'Hello world', 'transcription.txt');

            expect(dialog.showSaveDialog).toHaveBeenCalledWith({
                title: 'Save Transcription',
                defaultPath: 'transcription.txt',
                filters: expect.arrayContaining([
                    { name: 'Text Files', extensions: ['txt'] }
                ])
            });
            expect(result).toEqual(mockResult);
        });

        it('should save audio file successfully', async () => {
            const mockResult = {
                canceled: false,
                filePath: '/path/to/save.wav'
            };
            dialog.showSaveDialog.mockResolvedValue(mockResult);
            const audioData = Buffer.from('audio data');

            const result = await handlers.handleSaveFile(null, audioData, 'recording.wav');

            expect(dialog.showSaveDialog).toHaveBeenCalledWith({
                title: 'Save Recording',
                defaultPath: 'recording.wav',
                filters: expect.arrayContaining([
                    { name: 'Audio Files', extensions: ['wav', 'webm', 'mp3', 'm4a'] }
                ])
            });
        });

        it('should handle canceled save dialog', async () => {
            dialog.showSaveDialog.mockResolvedValue({ canceled: true });

            const result = await handlers.handleSaveFile(null, 'content', 'file.txt');

            expect(result).toEqual({ canceled: true });
        });
    });

    describe('error handling', () => {
        let mockEvent;

        beforeEach(() => {
            mockEvent = {
                sender: {
                    send: jest.fn()
                }
            };
        });

        it('should wrap transcription errors with descriptive messages', async () => {
            mockTranscriptionService.isAvailable.mockReturnValue(true);
            mockFileService.validateFile.mockResolvedValue(true);
            mockFileService.copyToTemp.mockResolvedValue('/temp/audio.wav');
            mockTranscriptionService.transcribeFile.mockRejectedValue(new Error('Original error'));

            await expect(handlers.handleTranscribeFile(mockEvent, '/path/to/audio.wav'))
                .rejects.toThrow('Transcription failed: Original error');
        });

        it('should handle missing file paths', async () => {
            await expect(handlers.handleTranscribeFile(mockEvent, null))
                .rejects.toThrow();
        });
    });
});