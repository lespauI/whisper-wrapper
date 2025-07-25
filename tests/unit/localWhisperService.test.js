const { LocalWhisperService } = require('../../src/services/localWhisperService');

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    readFileSync: jest.fn()
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

    describe('sanitizePrompt', () => {
        it('should return empty string for null/undefined input', () => {
            expect(service.sanitizePrompt(null)).toBe('');
            expect(service.sanitizePrompt(undefined)).toBe('');
            expect(service.sanitizePrompt('')).toBe('');
        });

        it('should return empty string for non-string input', () => {
            expect(service.sanitizePrompt(123)).toBe('');
            expect(service.sanitizePrompt({})).toBe('');
            expect(service.sanitizePrompt([])).toBe('');
        });

        it('should handle normal text correctly', () => {
            const input = 'Hello world this is a test';
            const result = service.sanitizePrompt(input);
            expect(result).toBe('Hello world this is a test');
        });

        it('should remove special characters that could cause shell parsing issues', () => {
            const input = 'Hello*world?test[bracket]{brace}|pipe&and;semi<less>greater()parens$dollar`backtick\\backslash!exclamation';
            const result = service.sanitizePrompt(input);
            expect(result).toBe('Helloworldtestbracketbracepipeandsemilessgreaterparensdollarbacktickbackslashexclamation');
        });

        it('should remove quotes that could break command parsing', () => {
            const input = 'Hello "quoted text" and \'single quotes\'';
            const result = service.sanitizePrompt(input);
            expect(result).toBe('Hello quoted text and single quotes');
        });

        it('should replace multiple spaces with single space', () => {
            const input = 'Hello     world    with   multiple spaces';
            const result = service.sanitizePrompt(input);
            expect(result).toBe('Hello world with multiple spaces');
        });

        it('should trim whitespace', () => {
            const input = '   Hello world   ';
            const result = service.sanitizePrompt(input);
            expect(result).toBe('Hello world');
        });

        it('should truncate prompts longer than 1000 characters from beginning', () => {
            // Create a string longer than 1000 characters where truncation will remove all A's  
            // 150 A's + 950 B's = 1100 total. Truncating to 1000 removes first 100, leaving 50 A's + 950 B's
            // So let's use 50 A's + 1050 B's = 1100 total. Truncating removes first 100 which removes all A's
            const longPrompt = 'A'.repeat(50) + 'B'.repeat(1050); // 1100 chars total
            const result = service.sanitizePrompt(longPrompt);
            
            // Should be truncated to 1000 characters, keeping the end
            expect(result.length).toBeLessThanOrEqual(1000);
            expect(result.startsWith('A')).toBe(false); // Should not start with 'A' from beginning
            expect(result.startsWith('B')).toBe(true); // Should start with 'B' after truncation
            expect(result.endsWith('B')).toBe(true); // Should end with 'B' (keeping the end)
            expect(result.includes('A')).toBe(false); // Should not contain 'A' after truncation
        });

        it('should handle complex real-world prompt text', () => {
            const input = 'Previous transcription: "Hello, how are you?" Next speaker said: Well, I\'m doing fine! [background noise] *music*';
            const result = service.sanitizePrompt(input);
            expect(result).toBe('Previous transcription: Hello, how are you Next speaker said: Well, Im doing fine background noise music');
        });

        it('should preserve regular punctuation', () => {
            const input = 'Hello, how are you? I am fine. Thanks!';
            const result = service.sanitizePrompt(input);
            expect(result).toBe('Hello, how are you I am fine. Thanks');
        });
    });

    describe('context prompt argument handling', () => {
        let mockSpawn;
        let mockProcess;

        beforeEach(() => {
            // Setup mock process
            mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn()
            };

            mockSpawn = jest.fn().mockReturnValue(mockProcess);
            spawn.mockImplementation(mockSpawn);

            // Setup service for transcription
            service.whisperPath = '/path/to/whisper-cli';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['ggml-base.bin']);
            fs.statSync.mockReturnValue({ size: 1000000 });
        });

        it('should include context prompt in arguments when provided', async () => {
            const contextPrompt = 'Hello world';
            
            // Mock the process to complete immediately
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 10);
                }
            });

            // Mock JSON output file
            const jsonOutput = {
                transcription: [{
                    timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
                    offsets: { from: 0, to: 5000 },
                    text: 'Test transcription'
                }]
            };
            fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(jsonOutput));

            // Call transcribeFile with context prompt
            const promise = service.transcribeFile('/path/to/audio.wav', {
                contextPrompt: contextPrompt
            });

            // Trigger the close event to resolve the promise
            const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1];
            closeCallback(0);

            await promise;

            // Check the actual arguments passed to whisper-cli
            const whisperArgs = mockSpawn.mock.calls[1][1]; // Second call (whisper-cli)
            expect(whisperArgs).toContain('--prompt');
            expect(whisperArgs).toContain('Hello world');
        });

        it('should sanitize context prompt before adding to arguments', async () => {
            const contextPrompt = 'Hello & world*';
            
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 10);
                }
            });

            const jsonOutput = {
                transcription: [{
                    timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
                    offsets: { from: 0, to: 5000 },
                    text: 'Test transcription'
                }]
            };
            fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(jsonOutput));

            const promise = service.transcribeFile('/path/to/audio.wav', {
                contextPrompt: contextPrompt
            });

            const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1];
            closeCallback(0);

            await promise;

            // Check that prompt was sanitized (special characters removed)
            const whisperArgs = mockSpawn.mock.calls[1][1]; // Second call (whisper-cli)
            expect(whisperArgs).toContain('--prompt');
            expect(whisperArgs).toContain('Hello world');
        });

        it('should prioritize context prompt over initial prompt', async () => {
            const initialPrompt = 'Initial setup prompt';
            const contextPrompt = 'Context prompt takes precedence';
            
            service.setInitialPrompt(initialPrompt);
            
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 10);
                }
            });

            const jsonOutput = {
                transcription: [{
                    timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
                    offsets: { from: 0, to: 5000 },
                    text: 'Test transcription'
                }]
            };
            fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(jsonOutput));

            const promise = service.transcribeFile('/path/to/audio.wav', {
                contextPrompt: contextPrompt
            });

            const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1];
            closeCallback(0);

            await promise;

            // Should use context prompt, not initial prompt (check whisper-cli call, not ffmpeg)
            const spawnArgs = mockSpawn.mock.calls[1][1]; // Second call (whisper-cli)
            expect(spawnArgs).toContain('--prompt');
            expect(spawnArgs).toContain('Context prompt takes precedence');
            expect(spawnArgs).not.toContain('Initial setup prompt');
        });

        it('should use initial prompt when no context prompt provided', async () => {
            const initialPrompt = 'Initial setup prompt';
            service.setInitialPrompt(initialPrompt);
            
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 10);
                }
            });

            const jsonOutput = {
                transcription: [{
                    timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
                    offsets: { from: 0, to: 5000 },
                    text: 'Test transcription'
                }]
            };
            fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(jsonOutput));

            const promise = service.transcribeFile('/path/to/audio.wav', {
                useInitialPrompt: true
            });

            const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1];
            closeCallback(0);

            await promise;

            // Check that initial prompt is used
            const whisperArgs = mockSpawn.mock.calls[1][1]; // Second call (whisper-cli)
            expect(whisperArgs).toContain('--prompt');
            expect(whisperArgs).toContain('Initial setup prompt');
        });

        it('should not include prompt arguments when no prompt provided', async () => {
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 10);
                }
            });

            const jsonOutput = {
                transcription: [{
                    timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
                    offsets: { from: 0, to: 5000 },
                    text: 'Test transcription'
                }]
            };
            fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(jsonOutput));

            const promise = service.transcribeFile('/path/to/audio.wav', {});

            const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1];
            closeCallback(0);

            await promise;

            // Should not include --prompt in arguments (check whisper-cli call)
            const spawnArgs = mockSpawn.mock.calls[1][1]; // Second call (whisper-cli)
            expect(spawnArgs).not.toContain('--prompt');
        });

        it('should handle empty context prompt gracefully', async () => {
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 10);
                }
            });

            const jsonOutput = {
                transcription: [{
                    timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
                    offsets: { from: 0, to: 5000 },
                    text: 'Test transcription'
                }]
            };
            fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(jsonOutput));

            const promise = service.transcribeFile('/path/to/audio.wav', {
                contextPrompt: '   '  // Just whitespace
            });

            const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1];
            closeCallback(0);

            await promise;

            // Should not include --prompt for empty context (check whisper-cli call)
            const spawnArgs = mockSpawn.mock.calls[1][1]; // Second call (whisper-cli)
            expect(spawnArgs).not.toContain('--prompt');
        });

        it('should create proper argument structure with context prompt', async () => {
            const contextPrompt = 'Test context';
            
            mockProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 10);
                }
            });

            const jsonOutput = {
                transcription: [{
                    timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
                    offsets: { from: 0, to: 5000 },
                    text: 'Test transcription'
                }]
            };
            fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(jsonOutput));

            const promise = service.transcribeFile('/path/to/audio.wav', {
                contextPrompt: contextPrompt
            });

            const closeCallback = mockProcess.on.mock.calls.find(call => call[0] === 'close')[1];
            closeCallback(0);

            await promise;

            const spawnArgs = mockSpawn.mock.calls[1][1]; // Second call (whisper-cli)
            const promptIndex = spawnArgs.indexOf('--prompt');
            
            // Verify proper argument structure
            expect(promptIndex).toBeGreaterThan(-1);
            expect(spawnArgs[promptIndex + 1]).toBe('Test context');
            
            // Verify next argument is a flag (starts with -)
            if (promptIndex + 2 < spawnArgs.length) {
                expect(spawnArgs[promptIndex + 2]).toMatch(/^-/);
            }
        });
    });
});