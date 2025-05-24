const TranscriptionService = require('../../src/services/transcriptionService');

// Mock LocalWhisperService
jest.mock('../../src/services/localWhisperService', () => {
    return jest.fn().mockImplementation(() => ({
        isAvailable: jest.fn(),
        getAvailableModels: jest.fn(),
        transcribeFile: jest.fn(),
        testInstallation: jest.fn(),
        setModel: jest.fn(),
        setLanguage: jest.fn(),
        setThreads: jest.fn()
    }));
});

const LocalWhisperService = require('../../src/services/localWhisperService');

describe('TranscriptionService', () => {
    let service;
    let mockLocalWhisper;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Get the mock instance
        service = new TranscriptionService();
        mockLocalWhisper = service.localWhisper;
    });

    describe('constructor', () => {
        it('should initialize with default settings', () => {
            expect(service.model).toBe('base');
            expect(service.language).toBe('auto');
            expect(service.localWhisper).toBeDefined();
        });
    });

    describe('isAvailable', () => {
        it('should delegate to local whisper service', () => {
            mockLocalWhisper.isAvailable.mockReturnValue(true);
            
            const result = service.isAvailable();
            
            expect(result).toBe(true);
            expect(mockLocalWhisper.isAvailable).toHaveBeenCalled();
        });
    });

    describe('getAvailableModels', () => {
        it('should delegate to local whisper service', () => {
            const mockModels = [
                { name: 'base', size: '141 MB' },
                { name: 'small', size: '465 MB' }
            ];
            mockLocalWhisper.getAvailableModels.mockReturnValue(mockModels);
            
            const result = service.getAvailableModels();
            
            expect(result).toBe(mockModels);
            expect(mockLocalWhisper.getAvailableModels).toHaveBeenCalled();
        });
    });

    describe('setModel', () => {
        it('should set model on service and delegate to local whisper', () => {
            service.setModel('small');
            expect(service.model).toBe('small');
            expect(mockLocalWhisper.setModel).toHaveBeenCalledWith('small');
        });
    });

    describe('setLanguage', () => {
        it('should set language on service and delegate to local whisper', () => {
            service.setLanguage('en');
            expect(service.language).toBe('en');
            expect(mockLocalWhisper.setLanguage).toHaveBeenCalledWith('en');
        });
    });

    describe('setThreads', () => {
        it('should delegate to local whisper service', () => {
            service.setThreads(8);
            expect(mockLocalWhisper.setThreads).toHaveBeenCalledWith(8);
        });
    });

    describe('transcribeFile', () => {
        it('should transcribe file using local whisper', async () => {
            // Mock isAvailable to return true
            mockLocalWhisper.isAvailable.mockReturnValue(true);
            
            const mockResult = {
                text: 'Hello world',
                language: 'en',
                segments: [],
                model: 'base',
                duration: 10.5
            };
            mockLocalWhisper.transcribeFile.mockResolvedValue(mockResult);

            const result = await service.transcribeFile('/path/to/file.wav');

            expect(result).toEqual({
                success: true,
                text: 'Hello world',
                markdown: expect.any(String),
                plainText: expect.any(String),
                language: 'en',
                segments: [],
                model: 'base',
                duration: 10.5,
                metadata: expect.any(Object),
                srt: expect.any(String),
                vtt: expect.any(String)
            });
            expect(mockLocalWhisper.transcribeFile).toHaveBeenCalledWith('/path/to/file.wav', {
                model: 'base',
                language: 'auto',
                translate: false,
                threads: 4
            });
        });

        it('should handle transcription errors', async () => {
            // Mock isAvailable to return true so we get to the transcription part
            mockLocalWhisper.isAvailable.mockReturnValue(true);
            
            const mockError = new Error('Transcription failed');
            mockLocalWhisper.transcribeFile.mockRejectedValue(mockError);

            await expect(service.transcribeFile('/path/to/file.wav'))
                .rejects.toThrow('Transcription failed: Transcription failed');
        });
    });

    describe('testConnection', () => {
        it('should test local whisper connection successfully', async () => {
            const mockInstallationResult = {
                success: true,
                whisperPath: '/path/to/whisper',
                modelsPath: '/path/to/models',
                models: [
                    { name: 'base', size: '141 MB' }
                ]
            };
            mockLocalWhisper.testInstallation.mockResolvedValue(mockInstallationResult);

            const result = await service.testConnection();

            expect(result).toEqual({
                success: true,
                message: 'Local Whisper is working correctly',
                details: {
                    whisperPath: '/path/to/whisper',
                    modelsPath: '/path/to/models',
                    availableModels: mockInstallationResult.models
                }
            });
        });

        it('should handle installation failure', async () => {
            const mockInstallationResult = {
                success: false,
                error: 'Binary not found'
            };
            mockLocalWhisper.testInstallation.mockResolvedValue(mockInstallationResult);

            const result = await service.testConnection();

            expect(result).toEqual({
                success: false,
                message: 'Binary not found'
            });
        });

        it('should handle connection test errors', async () => {
            const mockError = new Error('Connection test failed');
            mockLocalWhisper.testInstallation.mockRejectedValue(mockError);

            const result = await service.testConnection();

            expect(result).toEqual({
                success: false,
                message: 'Test failed: Connection test failed'
            });
        });
    });
});