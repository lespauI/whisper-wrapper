const { LocalWhisperService } = require('../../src/services/localWhisperService');

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn()
}));

// Mock child_process
jest.mock('child_process', () => ({
    spawn: jest.fn()
}));

const fs = require('fs');
const { spawn } = require('child_process');

describe('LocalWhisperService', () => {
    let service;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Default fs mocks
        fs.existsSync.mockReturnValue(false);
        fs.mkdirSync.mockReturnValue(undefined);
        // Default empty models directory
        fs.readdirSync.mockReturnValue([]);
        fs.statSync.mockReturnValue({ size: 1000000 });
        
        service = new LocalWhisperService();
    });

    describe('constructor', () => {
        it('should initialize with default settings', () => {
            // With our current setup, the default model will be 'base'
            // We'll test the real implementation separately
            expect(service.model).toBe('base');
            expect(service.language).toBe('auto');
            expect(service.threads).toBe(4);
            expect(service.translate).toBe(false);
            expect(service.initialPrompt).toBe('');
        });

        it('should prefer tiny model when available', () => {
            // Reset and setup mocks specifically for this test
            jest.clearAllMocks();
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['ggml-tiny.bin', 'ggml-base.bin']);
            fs.statSync.mockReturnValue({ size: 1000000 });
            
            // Create a new service instance with our mocks
            const tinyService = new LocalWhisperService();
            expect(tinyService.model).toBe('tiny');
        });
    });

    describe('findWhisperBinary', () => {
        it('should return null when no binary found', () => {
            fs.existsSync.mockReturnValue(false);
            
            const result = service.findWhisperBinary();
            expect(result).toBeNull();
        });

        it('should find whisper-cli binary', () => {
            fs.existsSync.mockImplementation((path) => 
                path.includes('whisper-cli')
            );

            const result = service.findWhisperBinary();
            expect(result).toContain('whisper-cli');
        });
    });

    describe('isAvailable', () => {
        it('should return false when no binary path', () => {
            service.whisperPath = null;
            expect(service.isAvailable()).toBe(false);
        });

        it('should return true when binary exists', () => {
            service.whisperPath = '/path/to/whisper';
            fs.existsSync.mockReturnValue(true);
            
            expect(service.isAvailable()).toBe(true);
        });
    });

    describe('setModel', () => {
        it('should set valid model', () => {
            service.setModel('small');
            expect(service.model).toBe('small');
        });

        it('should throw error for invalid model', () => {
            expect(() => service.setModel('invalid')).toThrow('Invalid model');
        });
    });

    describe('setLanguage', () => {
        it('should set language', () => {
            service.setLanguage('en');
            expect(service.language).toBe('en');
        });
    });

    describe('setThreads', () => {
        it('should set valid thread count', () => {
            service.setThreads(8);
            expect(service.threads).toBe(8);
        });

        it('should throw error for invalid thread count', () => {
            expect(() => service.setThreads(0)).toThrow('Thread count must be between 1 and 16');
        });
    });
    
    describe('setInitialPrompt', () => {
        it('should set initial prompt', () => {
            const prompt = 'Technical terms: JavaScript, Node.js, React';
            service.setInitialPrompt(prompt);
            expect(service.initialPrompt).toBe(prompt);
        });
        
        it('should throw error for non-string prompt', () => {
            expect(() => service.setInitialPrompt(123)).toThrow('Initial prompt must be a string');
            expect(() => service.setInitialPrompt(null)).toThrow('Initial prompt must be a string');
            expect(() => service.setInitialPrompt(undefined)).toThrow('Initial prompt must be a string');
            expect(() => service.setInitialPrompt({})).toThrow('Initial prompt must be a string');
        });
    });
    
    describe('getInitialPrompt', () => {
        it('should return the current initial prompt', () => {
            const prompt = 'Test prompt';
            service.initialPrompt = prompt;
            expect(service.getInitialPrompt()).toBe(prompt);
        });
    });
    
    describe('clearInitialPrompt', () => {
        it('should clear the initial prompt', () => {
            service.initialPrompt = 'Test prompt';
            service.clearInitialPrompt();
            expect(service.initialPrompt).toBe('');
        });
    });

    describe('getAvailableModels', () => {
        it('should return empty array when models directory does not exist', () => {
            // Override the default mock for this specific test
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue([]);
            
            const models = service.getAvailableModels();
            expect(models).toEqual([]);
        });

        it('should return available models', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['ggml-base.bin', 'ggml-small.bin']);
            fs.statSync.mockReturnValue({ size: 1000000 });
            
            const models = service.getAvailableModels();
            expect(models).toHaveLength(2);
            expect(models[0].name).toBe('base');
            expect(models[1].name).toBe('small');
        });
    });

    describe('testInstallation', () => {
        it('should return error when binary not available', async () => {
            service.whisperPath = null;
            
            const result = await service.testInstallation();
            
            expect(result).toEqual({
                success: false,
                error: 'whisper.cpp binary not found'
            });
        });

        it('should return success when binary and models available', async () => {
            service.whisperPath = '/path/to/whisper';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['ggml-base.bin']);
            fs.statSync.mockReturnValue({ size: 1000000 });
            
            const result = await service.testInstallation();
            
            expect(result.success).toBe(true);
            expect(result.whisperPath).toBe('/path/to/whisper');
            expect(result.models).toHaveLength(1);
        });
    });
});