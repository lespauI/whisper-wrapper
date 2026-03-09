const IPCHandlers = require('../../src/main/ipcHandlers');
const { dialog, shell, desktopCapturer } = require('electron');
const TranscriptionService = require('../../src/services/transcriptionService');
const FileService = require('../../src/services/fileService');
const TranscriptionStoreService = require('../../src/services/transcriptionStoreService');
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
    },
    desktopCapturer: {
        getSources: jest.fn()
    },
    app: {
        getPath: jest.fn().mockImplementation(name => {
            if (name === 'userData') return '/home/testuser/.config/whisper-wrapper';
            return '/home/testuser/.config';
        })
    }
}));

jest.mock('os', () => ({
    homedir: jest.fn().mockReturnValue('/home/testuser'),
    tmpdir: jest.fn().mockReturnValue('/tmp'),
    cpus: jest.fn().mockReturnValue([{ model: 'Intel Core i7' }])
}));

jest.mock('../../src/services/transcriptionService');
jest.mock('../../src/services/fileService');
jest.mock('../../src/services/transcriptionStoreService');
jest.mock('../../src/config');
jest.mock('fs', () => ({
    writeFileSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue(JSON.stringify({ entries: [] })),
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    statSync: jest.fn().mockReturnValue({ isFile: () => true, size: 1024 }),
    unlinkSync: jest.fn(),
    promises: {
        writeFile: jest.fn(),
        readFile: jest.fn().mockResolvedValue(JSON.stringify({ entries: [] })),
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
    let mockTranscriptionStoreService;
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

        mockTranscriptionStoreService = {
            store: jest.fn().mockResolvedValue(null),
            list: jest.fn().mockReturnValue([]),
            get: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            reindex: jest.fn()
        };

        TranscriptionService.mockImplementation(() => mockTranscriptionService);
        FileService.mockImplementation(() => mockFileService);
        TranscriptionStoreService.mockImplementation(() => mockTranscriptionStoreService);

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
            expect(mockTranscriptionService.transcribeFile).toHaveBeenCalledWith('/temp/audio.wav', expect.objectContaining({ threads: 4, translate: false, useGpu: true, flashAttn: true, gpuDevice: 0 }));
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

            expect(mockTranscriptionService.transcribeBuffer).toHaveBeenCalledWith(audioData, expect.objectContaining({ threads: 4, translate: false, useGpu: true, flashAttn: true, gpuDevice: 0 }));
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

            expect(result).toMatchObject(mockConfig);
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

    describe('handleTranscriptionsUpdate', () => {
        it('returns success with updated entry when valid id and changes are provided', async () => {
            const mockEntry = { id: 'abc-123', title: 'New Title', labels: [] };
            mockTranscriptionStoreService.update.mockResolvedValue(mockEntry);

            const result = await handlers.handleTranscriptionsUpdate(null, { id: 'abc-123', changes: { title: 'New Title' } });

            expect(mockTranscriptionStoreService.update).toHaveBeenCalledWith('abc-123', { title: 'New Title' });
            expect(result).toEqual({ success: true, entry: mockEntry });
        });

        it('updates labels when provided', async () => {
            const mockEntry = { id: 'abc-123', title: 'T', labels: ['a', 'b'] };
            mockTranscriptionStoreService.update.mockResolvedValue(mockEntry);

            const result = await handlers.handleTranscriptionsUpdate(null, { id: 'abc-123', changes: { labels: ['a', 'b'] } });

            expect(mockTranscriptionStoreService.update).toHaveBeenCalledWith('abc-123', { labels: ['a', 'b'] });
            expect(result.success).toBe(true);
        });

        it('strips unknown keys from changes (whitelist enforcement)', async () => {
            const mockEntry = { id: 'abc-123', title: 'T', labels: [] };
            mockTranscriptionStoreService.update.mockResolvedValue(mockEntry);

            await handlers.handleTranscriptionsUpdate(null, {
                id: 'abc-123',
                changes: { title: 'Safe', malicious: 'payload', __proto__: 'bad' }
            });

            expect(mockTranscriptionStoreService.update).toHaveBeenCalledWith('abc-123', { title: 'Safe' });
        });

        it('returns error when id is missing', async () => {
            const result = await handlers.handleTranscriptionsUpdate(null, { changes: { title: 'X' } });

            expect(result).toEqual({ success: false, error: 'Invalid id' });
            expect(mockTranscriptionStoreService.update).not.toHaveBeenCalled();
        });

        it('returns error when id is not a string', async () => {
            const result = await handlers.handleTranscriptionsUpdate(null, { id: 42, changes: { title: 'X' } });

            expect(result).toEqual({ success: false, error: 'Invalid id' });
        });

        it('returns error when changes is missing', async () => {
            const result = await handlers.handleTranscriptionsUpdate(null, { id: 'abc-123' });

            expect(result).toEqual({ success: false, error: 'Invalid changes' });
        });

        it('returns not-found error when service returns null', async () => {
            mockTranscriptionStoreService.update.mockResolvedValue(null);

            const result = await handlers.handleTranscriptionsUpdate(null, { id: 'abc-123', changes: { title: 'X' } });

            expect(result).toEqual({ success: false, error: 'Not found' });
        });

        it('returns error when service throws', async () => {
            mockTranscriptionStoreService.update.mockRejectedValue(new Error('disk full'));

            const result = await handlers.handleTranscriptionsUpdate(null, { id: 'abc-123', changes: { title: 'X' } });

            expect(result).toEqual({ success: false, error: 'disk full' });
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

    describe('handleGetAudioSources', () => {
        const mockSources = [
            {
                id: 'screen:0',
                name: 'Entire Screen',
                thumbnail: { toDataURL: jest.fn().mockReturnValue('data:image/png;base64,abc') }
            },
            {
                id: 'window:1',
                name: 'My App',
                thumbnail: { toDataURL: jest.fn().mockReturnValue('data:image/png;base64,xyz') }
            }
        ];

        it('should return sources and platform info on success', async () => {
            desktopCapturer.getSources.mockResolvedValue(mockSources);

            const result = await handlers.handleGetAudioSources();

            expect(result.success).toBe(true);
            expect(result.platform).toBe(process.platform);
            expect(result.sources).toHaveLength(2);
            expect(result.sources[0]).toEqual({
                id: 'screen:0',
                name: 'Entire Screen'
            });
            expect(result.sources[1]).toEqual({
                id: 'window:1',
                name: 'My App'
            });
            expect(result.systemAudioSupported).toBeDefined();
        });

        it('should not include thumbnail data in serialized sources', async () => {
            desktopCapturer.getSources.mockResolvedValue(mockSources);

            const result = await handlers.handleGetAudioSources();

            expect(result.sources[0].thumbnail).toBeUndefined();
            expect(result.sources[1].thumbnail).toBeUndefined();
        });

        it('should indicate systemAudioSupported for darwin, win32, linux', async () => {
            desktopCapturer.getSources.mockResolvedValue([]);

            const result = await handlers.handleGetAudioSources();

            const supported = ['darwin', 'win32', 'linux'].includes(process.platform);
            expect(result.systemAudioSupported).toBe(supported);
        });

        it('should handle sources with extra fields gracefully — only id and name are returned', async () => {
            desktopCapturer.getSources.mockResolvedValue([
                { id: 'screen:0', name: 'Entire Screen', thumbnail: null, appIcon: null }
            ]);

            const result = await handlers.handleGetAudioSources();

            expect(result.success).toBe(true);
            expect(Object.keys(result.sources[0])).toEqual(['id', 'name']);
        });

        it('should return empty sources array when desktopCapturer returns empty list', async () => {
            desktopCapturer.getSources.mockResolvedValue([]);

            const result = await handlers.handleGetAudioSources();

            expect(result.success).toBe(true);
            expect(result.sources).toHaveLength(0);
        });

        it('should pass correct types filter to desktopCapturer', async () => {
            desktopCapturer.getSources.mockResolvedValue([]);

            await handlers.handleGetAudioSources();

            expect(desktopCapturer.getSources).toHaveBeenCalledWith({
                types: ['screen', 'window']
            });
        });

        it('should include platform in both success and error responses', async () => {
            desktopCapturer.getSources.mockResolvedValue(mockSources);
            const result = await handlers.handleGetAudioSources();
            expect(result.platform).toBe(process.platform);

            desktopCapturer.getSources.mockRejectedValue(new Error('fail'));
            const errorResult = await handlers.handleGetAudioSources();
            expect(errorResult.platform).toBe(process.platform);
        });

        it('should return failure result when desktopCapturer throws', async () => {
            desktopCapturer.getSources.mockRejectedValue(new Error('Permission denied'));

            const result = await handlers.handleGetAudioSources();

            expect(result.success).toBe(false);
            expect(result.sources).toEqual([]);
            expect(result.systemAudioSupported).toBe(false);
            expect(result.error).toBe('Permission denied');
        });
    });

    describe('handleDetectGpuBackend', () => {
        it('should return valid suggested backend on success', async () => {
            const result = await handlers.handleDetectGpuBackend();

            expect(result.success).toBe(true);
            expect(result).toHaveProperty('platform');
            expect(result).toHaveProperty('expectedBackend');
            expect(result).toHaveProperty('gpuLikely');
        });

        it('should return cpu fallback when detection throws', async () => {
            const localWhisperModule = require('../../src/services/localWhisperService');
            const originalDetect = localWhisperModule.LocalWhisperService.detectGpuInfo;
            localWhisperModule.LocalWhisperService.detectGpuInfo = () => {
                throw new Error('Detection error');
            };

            const result = await handlers.handleDetectGpuBackend();

            expect(result.success).toBe(false);
            expect(result.gpuLikely).toBe(false);
            expect(result.expectedBackend).toBe('cpu');
            expect(result.message).toContain('Detection error');

            localWhisperModule.LocalWhisperService.detectGpuInfo = originalDetect;
        });
    });

    describe('handleAudioReadFile', () => {
        const mockEvent = {};

        beforeEach(() => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ isFile: () => true, size: 1024 });
            fs.readFileSync.mockReturnValue(Buffer.from('fake audio data'));
        });

        it('returns error for null path', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, null);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid file path');
        });

        it('returns error for non-string path', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, 12345);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid file path');
        });

        it('returns error for path outside allowed directories', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, '/etc/passwd');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Access denied: file path is outside allowed directories');
        });

        it('returns error for path traversal attempt via home directory prefix', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testusermalicious/audio.wav');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Access denied: file path is outside allowed directories');
        });

        it('returns error for path traversal using ..', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/../etc/passwd');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Access denied: file path is outside allowed directories');
        });

        it('returns error for system path outside home or userData', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, '/var/secret.wav');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Access denied: file path is outside allowed directories');
        });

        it('returns error when file does not exist', async () => {
            fs.existsSync.mockReturnValue(false);
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/audio.wav');
            expect(result.success).toBe(false);
            expect(result.error).toBe('File not found');
        });

        it('returns error when path is not a file', async () => {
            fs.statSync.mockReturnValue({ isFile: () => false, size: 0 });
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/somedir');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Path is not a file');
        });

        it('returns error when file is too large', async () => {
            fs.statSync.mockReturnValue({ isFile: () => true, size: 400 * 1024 * 1024 });
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/huge.wav');
            expect(result.success).toBe(false);
            expect(result.error).toContain('File too large');
        });

        it('returns success with data URL for a wav file under home directory', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/audio.wav');
            expect(result.success).toBe(true);
            expect(result.dataUrl).toMatch(/^data:audio\/wav;base64,/);
        });

        it('returns success for a file under userData directory', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/.config/whisper-wrapper/recordings/audio.wav');
            expect(result.success).toBe(true);
            expect(result.dataUrl).toMatch(/^data:audio\/wav;base64,/);
        });

        it('returns success with correct mime type for mp3', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/audio.mp3');
            expect(result.success).toBe(true);
            expect(result.dataUrl).toMatch(/^data:audio\/mpeg;base64,/);
        });

        it('returns success with correct mime type for m4a', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/audio.m4a');
            expect(result.success).toBe(true);
            expect(result.dataUrl).toMatch(/^data:audio\/mp4;base64,/);
        });

        it('falls back to audio/mpeg for unknown extension', async () => {
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/audio.xyz');
            expect(result.success).toBe(true);
            expect(result.dataUrl).toMatch(/^data:audio\/mpeg;base64,/);
        });

        it('returns error when readFileSync throws', async () => {
            fs.readFileSync.mockImplementationOnce(() => { throw new Error('Permission denied'); });
            const result = await handlers.handleAudioReadFile(mockEvent, '/home/testuser/audio.wav');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission denied');
        });
    });
});