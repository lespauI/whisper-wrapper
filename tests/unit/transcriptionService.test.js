const TranscriptionService = require('../../src/services/transcriptionService');

// Mock LocalWhisperService
jest.mock('../../src/services/localWhisperService', () => {
    return {
        LocalWhisperService: jest.fn().mockImplementation(() => ({
            isAvailable: jest.fn(),
            getAvailableModels: jest.fn(),
            transcribeFile: jest.fn(),
            transcribeBuffer: jest.fn(),
            testInstallation: jest.fn(),
            setModel: jest.fn(),
            setLanguage: jest.fn(),
            setThreads: jest.fn(),
            setInitialPrompt: jest.fn(),
            getInitialPrompt: jest.fn(),
            clearInitialPrompt: jest.fn()
        }))
    };
});

const { LocalWhisperService } = require('../../src/services/localWhisperService');

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
            expect(service.initialPrompt).toBe('');
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
    
    describe('setInitialPrompt', () => {
        it('should set initial prompt on service and delegate to local whisper', () => {
            const prompt = 'Test prompt with technical terms';
            service.setInitialPrompt(prompt);
            expect(service.initialPrompt).toBe(prompt);
            expect(mockLocalWhisper.setInitialPrompt).toHaveBeenCalledWith(prompt);
        });
    });
    
    describe('getInitialPrompt', () => {
        it('should return the current initial prompt', () => {
            service.initialPrompt = 'Test prompt';
            expect(service.getInitialPrompt()).toBe('Test prompt');
        });
    });
    
    describe('clearInitialPrompt', () => {
        it('should clear initial prompt and delegate to local whisper', () => {
            service.initialPrompt = 'Test prompt';
            service.clearInitialPrompt();
            expect(service.initialPrompt).toBe('');
            expect(mockLocalWhisper.clearInitialPrompt).toHaveBeenCalled();
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
                threads: 4,
                initialPrompt: ''
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
        
        it('should transcribe file with custom initial prompt', async () => {
            // Mock isAvailable to return true
            mockLocalWhisper.isAvailable.mockReturnValue(true);
            
            const mockResult = {
                text: 'Hello world with technical terms',
                language: 'en',
                segments: [],
                model: 'base',
                duration: 10.5
            };
            mockLocalWhisper.transcribeFile.mockResolvedValue(mockResult);
            
            const customPrompt = 'Technical terms: JavaScript, Node.js, React';
            
            const result = await service.transcribeFile('/path/to/file.wav', {
                initialPrompt: customPrompt
            });
            
            expect(result.success).toBe(true);
            expect(mockLocalWhisper.transcribeFile).toHaveBeenCalledWith('/path/to/file.wav', {
                model: 'base',
                language: 'auto',
                translate: false,
                threads: 4,
                initialPrompt: customPrompt
            });
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

    describe('getSettings', () => {
        it('should return current settings including initialPrompt', () => {
            service.model = 'medium';
            service.language = 'fr';
            service.initialPrompt = 'Test prompt';
            
            mockLocalWhisper.getAvailableModels.mockReturnValue([
                { name: 'base', size: '141 MB' },
                { name: 'medium', size: '1.5 GB' }
            ]);
            mockLocalWhisper.isAvailable.mockReturnValue(true);
            
            const settings = service.getSettings();
            
            expect(settings).toEqual({
                model: 'medium',
                language: 'fr',
                initialPrompt: 'Test prompt',
                availableModels: [
                    { name: 'base', size: '141 MB' },
                    { name: 'medium', size: '1.5 GB' }
                ],
                isAvailable: true
            });
        });
    });
    
    describe('updateSettings', () => {
        it('should update model, language and initialPrompt settings', () => {
            const newSettings = {
                model: 'large',
                language: 'es',
                initialPrompt: 'Technical terms: JavaScript, Node.js',
                threads: 8,
                translate: true
            };

            service.updateSettings(newSettings);

            expect(service.model).toBe('large');
            expect(service.language).toBe('es');
            expect(service.initialPrompt).toBe('Technical terms: JavaScript, Node.js');
            expect(mockLocalWhisper.setModel).toHaveBeenCalledWith('large');
            expect(mockLocalWhisper.setLanguage).toHaveBeenCalledWith('es');
            expect(mockLocalWhisper.setInitialPrompt).toHaveBeenCalledWith('Technical terms: JavaScript, Node.js');
            // Note: threads are not handled by updateSettings, they're set directly on LocalWhisperService
        });

        it('should handle partial settings updates', () => {
            const newSettings = {
                model: 'tiny'
            };

            service.updateSettings(newSettings);

            expect(service.model).toBe('tiny');
            expect(service.language).toBe('auto'); // Should remain unchanged
            expect(service.initialPrompt).toBe(''); // Should remain unchanged
            expect(mockLocalWhisper.setModel).toHaveBeenCalledWith('tiny');
            expect(mockLocalWhisper.setLanguage).not.toHaveBeenCalled();
            expect(mockLocalWhisper.setInitialPrompt).not.toHaveBeenCalled();
            expect(mockLocalWhisper.setThreads).not.toHaveBeenCalled();
        });

        it('should handle empty settings object', () => {
            const originalModel = service.model;
            const originalLanguage = service.language;
            const originalPrompt = service.initialPrompt;

            service.updateSettings({});

            expect(service.model).toBe(originalModel);
            expect(service.language).toBe(originalLanguage);
            expect(service.initialPrompt).toBe(originalPrompt);
            expect(mockLocalWhisper.setModel).not.toHaveBeenCalled();
            expect(mockLocalWhisper.setLanguage).not.toHaveBeenCalled();
            expect(mockLocalWhisper.setInitialPrompt).not.toHaveBeenCalled();
            expect(mockLocalWhisper.setThreads).not.toHaveBeenCalled();
        });
        
        it('should update only initialPrompt', () => {
            const originalModel = service.model;
            const originalLanguage = service.language;
            const newPrompt = 'New technical terms: TypeScript, React, Redux';
            
            service.updateSettings({
                initialPrompt: newPrompt
            });
            
            expect(service.model).toBe(originalModel);
            expect(service.language).toBe(originalLanguage);
            expect(service.initialPrompt).toBe(newPrompt);
            expect(mockLocalWhisper.setModel).not.toHaveBeenCalled();
            expect(mockLocalWhisper.setLanguage).not.toHaveBeenCalled();
            expect(mockLocalWhisper.setInitialPrompt).toHaveBeenCalledWith(newPrompt);
        });
        
        it('should clear initialPrompt when empty string is provided', () => {
            service.initialPrompt = 'Some prompt';
            
            service.updateSettings({
                initialPrompt: ''
            });
            
            expect(service.initialPrompt).toBe('');
            expect(mockLocalWhisper.setInitialPrompt).toHaveBeenCalledWith('');
        });
    });
});