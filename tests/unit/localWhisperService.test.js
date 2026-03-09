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

    describe('setGpuBackend', () => {
        it('should set valid GPU backend', () => {
            service.setGpuBackend('metal');
            expect(service.gpuBackend).toBe('metal');
        });

        it('should accept all valid backends', () => {
            const validBackends = ['auto', 'metal', 'coreml', 'cuda', 'vulkan', 'cpu'];
            validBackends.forEach(backend => {
                service.setGpuBackend(backend);
                expect(service.gpuBackend).toBe(backend);
            });
        });

        it('should throw error for invalid backend', () => {
            expect(() => service.setGpuBackend('invalid')).toThrow('Invalid GPU backend');
            expect(() => service.setGpuBackend('directx')).toThrow('Invalid GPU backend');
        });
    });

    describe('setHardwareAcceleration', () => {
        it('should enable hardware acceleration', () => {
            service.setHardwareAcceleration(true);
            expect(service.hardwareAcceleration).toBe(true);
        });

        it('should disable hardware acceleration', () => {
            service.setHardwareAcceleration(false);
            expect(service.hardwareAcceleration).toBe(false);
        });

        it('should coerce to boolean', () => {
            service.setHardwareAcceleration(1);
            expect(service.hardwareAcceleration).toBe(true);
            service.setHardwareAcceleration(0);
            expect(service.hardwareAcceleration).toBe(false);
        });
    });

    describe('buildGpuArgs', () => {
        it('should return --no-gpu when hardware acceleration is disabled', () => {
            expect(service.buildGpuArgs('metal', false)).toEqual(['--no-gpu']);
            expect(service.buildGpuArgs('cuda', false)).toEqual(['--no-gpu']);
            expect(service.buildGpuArgs('auto', false)).toEqual(['--no-gpu']);
        });

        it('should return empty array for metal backend (binary uses GPU by default)', () => {
            expect(service.buildGpuArgs('metal', true)).toEqual([]);
        });

        it('should return --coreml flag for coreml backend', () => {
            expect(service.buildGpuArgs('coreml', true)).toEqual(['--coreml']);
        });

        it('should return --cuda flag for cuda backend', () => {
            expect(service.buildGpuArgs('cuda', true)).toEqual(['--cuda']);
        });

        it('should return --vulkan flag for vulkan backend', () => {
            expect(service.buildGpuArgs('vulkan', true)).toEqual(['--vulkan']);
        });

        it('should return --no-gpu for cpu backend', () => {
            expect(service.buildGpuArgs('cpu', true)).toEqual(['--no-gpu']);
        });

        it('should detect system backend when set to auto', () => {
            const args = service.buildGpuArgs('auto', true);
            expect(Array.isArray(args)).toBe(true);
        });
    });

    describe('detectSuggestedBackend', () => {
        it('should return a valid backend string', () => {
            const { LocalWhisperService } = require('../../src/services/localWhisperService');
            const backend = LocalWhisperService.detectSuggestedBackend();
            const validBackends = ['auto', 'metal', 'coreml', 'cuda', 'vulkan', 'cpu'];
            expect(validBackends).toContain(backend);
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

    describe('setTranslate', () => {
        it('should set translate flag to true', () => {
            service.setTranslate(true);
            expect(service.translate).toBe(true);
        });

        it('should set translate flag to false', () => {
            service.setTranslate(true);
            service.setTranslate(false);
            expect(service.translate).toBe(false);
        });
    });

    describe('getFileSize', () => {
        it('should return human-readable size', () => {
            fs.statSync.mockReturnValue({ size: 1024 * 1024 });
            const result = service.getFileSize('/some/file.bin');
            expect(result).toMatch(/MB|KB|Bytes/);
        });

        it('should return Unknown when statSync throws', () => {
            fs.statSync.mockImplementation(() => { throw new Error('no access'); });
            const result = service.getFileSize('/bad/path.bin');
            expect(result).toBe('Unknown');
        });

        it('should return 0 Bytes for zero-size file', () => {
            fs.statSync.mockReturnValue({ size: 0 });
            const result = service.getFileSize('/empty/file.bin');
            expect(result).toBe('0 Bytes');
        });
    });

    describe('normalizeSegments', () => {
        it('should return empty array for non-array input', () => {
            expect(service.normalizeSegments(null)).toEqual([]);
            expect(service.normalizeSegments('string')).toEqual([]);
            expect(service.normalizeSegments({})).toEqual([]);
        });

        it('should normalize segments with offsets format', () => {
            const raw = [{ offsets: { from: 1000, to: 5000 }, text: 'Hello' }];
            const result = service.normalizeSegments(raw);
            expect(result[0].start).toBe(1);
            expect(result[0].end).toBe(5);
            expect(result[0].text).toBe('Hello');
        });

        it('should normalize segments with timestamps format', () => {
            const raw = [{ timestamps: { from: '00:00:01,000', to: '00:00:05,500' }, text: 'World' }];
            const result = service.normalizeSegments(raw);
            expect(result[0].start).toBeCloseTo(1, 1);
            expect(result[0].end).toBeCloseTo(5.5, 1);
            expect(result[0].text).toBe('World');
        });

        it('should normalize segments already in start/end format', () => {
            const raw = [{ start: 2.5, end: 8.0, text: 'Test' }];
            const result = service.normalizeSegments(raw);
            expect(result[0].start).toBe(2.5);
            expect(result[0].end).toBe(8.0);
            expect(result[0].text).toBe('Test');
        });

        it('should handle unknown segment format with fallback', () => {
            const raw = [{ unknownField: 'x', text: 'Fallback text' }];
            const result = service.normalizeSegments(raw);
            expect(result[0].text).toBe('Fallback text');
        });
    });

    describe('parseTimestampString', () => {
        it('should return 0 for null/undefined/non-string input', () => {
            expect(service.parseTimestampString(null)).toBe(0);
            expect(service.parseTimestampString(undefined)).toBe(0);
            expect(service.parseTimestampString(123)).toBe(0);
        });

        it('should parse valid timestamp string', () => {
            expect(service.parseTimestampString('00:00:07,560')).toBeCloseTo(7.56, 2);
            expect(service.parseTimestampString('01:02:03,000')).toBeCloseTo(3723, 0);
        });

        it('should return 0 for malformed timestamp', () => {
            expect(service.parseTimestampString('bad:format')).toBe(0);
            expect(service.parseTimestampString('')).toBe(0);
        });
    });

    describe('isVideoFile / isSupportedAudioFile', () => {
        it('should detect video files correctly', () => {
            expect(service.isVideoFile('/path/video.mp4')).toBe(true);
            expect(service.isVideoFile('/path/video.mov')).toBe(true);
            expect(service.isVideoFile('/path/video.avi')).toBe(true);
            expect(service.isVideoFile('/path/audio.wav')).toBe(false);
        });

        it('should detect supported audio files correctly', () => {
            expect(service.isSupportedAudioFile('/path/audio.wav')).toBe(true);
            expect(service.isSupportedAudioFile('/path/audio.mp3')).toBe(true);
            expect(service.isSupportedAudioFile('/path/audio.flac')).toBe(true);
            expect(service.isSupportedAudioFile('/path/video.mp4')).toBe(false);
        });
    });

    describe('extractTextFromOutput / detectLanguageFromOutput / extractDuration', () => {
        it('should extract text from whisper stdout', () => {
            const output = '[00:00:00.000 --> 00:00:05.000]  Hello world\n[00:00:05.000 --> 00:00:10.000]  Goodbye';
            const result = service.extractTextFromOutput(output);
            expect(result).toContain('Hello world');
        });

        it('should detect language from output', () => {
            const output = 'auto-detected language: en with probability 0.98';
            expect(service.detectLanguageFromOutput(output)).toBe('en');
        });

        it('should return null if no language detected', () => {
            expect(service.detectLanguageFromOutput('no language here')).toBeNull();
        });

        it('should extract duration from output', () => {
            const output = 'total time = 1234.56 ms';
            expect(service.extractDuration(output)).toBeCloseTo(1234.56, 1);
        });

        it('should return null if no duration found', () => {
            expect(service.extractDuration('no duration here')).toBeNull();
        });
    });

    describe('GPU acceleration - detectSuggestedBackend platform branches', () => {
        const originalPlatform = process.platform;

        afterEach(() => {
            Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
            jest.restoreAllMocks();
        });

        it('should suggest metal for darwin + Apple Silicon', () => {
            Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
            const os = require('os');
            jest.spyOn(os, 'cpus').mockReturnValue([{ model: 'Apple M1' }]);

            const { LocalWhisperService: LWS } = require('../../src/services/localWhisperService');
            expect(LWS.detectSuggestedBackend()).toBe('metal');
        });

        it('should suggest cpu for darwin + Intel', () => {
            Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
            const os = require('os');
            jest.spyOn(os, 'cpus').mockReturnValue([{ model: 'Intel Core i7' }]);

            const { LocalWhisperService: LWS } = require('../../src/services/localWhisperService');
            expect(LWS.detectSuggestedBackend()).toBe('cpu');
        });

        it('should suggest cuda for win32', () => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
            const { LocalWhisperService: LWS } = require('../../src/services/localWhisperService');
            expect(LWS.detectSuggestedBackend()).toBe('cuda');
        });

        it('should suggest cuda for linux', () => {
            Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
            const { LocalWhisperService: LWS } = require('../../src/services/localWhisperService');
            expect(LWS.detectSuggestedBackend()).toBe('cuda');
        });

        it('should suggest cpu for unknown platforms', () => {
            Object.defineProperty(process, 'platform', { value: 'freebsd', writable: true });
            const { LocalWhisperService: LWS } = require('../../src/services/localWhisperService');
            expect(LWS.detectSuggestedBackend()).toBe('cpu');
        });

        it('should suggest cpu for darwin with empty cpus list', () => {
            Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
            const os = require('os');
            jest.spyOn(os, 'cpus').mockReturnValue([]);

            const { LocalWhisperService: LWS } = require('../../src/services/localWhisperService');
            expect(LWS.detectSuggestedBackend()).toBe('cpu');
        });
    });

    describe('GPU acceleration - buildGpuArgs auto resolution', () => {
        it('should resolve auto to metal on Apple Silicon darwin (no flag — GPU is binary default)', () => {
            const os = require('os');
            Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
            jest.spyOn(os, 'cpus').mockReturnValue([{ model: 'Apple M2' }]);

            const args = service.buildGpuArgs('auto', true);
            expect(args).toEqual([]);

            Object.defineProperty(process, 'platform', { value: process.platform, writable: true });
            jest.restoreAllMocks();
        });

        it('should resolve auto to cpu on Intel darwin (passes --no-gpu to explicitly disable)', () => {
            const os = require('os');
            Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
            jest.spyOn(os, 'cpus').mockReturnValue([{ model: 'Intel Core i9' }]);

            const args = service.buildGpuArgs('auto', true);
            expect(args).toEqual(['--no-gpu']);

            Object.defineProperty(process, 'platform', { value: process.platform, writable: true });
            jest.restoreAllMocks();
        });
    });

    describe('GPU acceleration - flags passed in transcribeFile', () => {
        const makeProcess = (closeCode = 0, stderrData = '') => {
            const proc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn()
            };
            proc.stderr.on.mockImplementation((event, cb) => {
                if (event === 'data' && stderrData) {
                    setTimeout(() => cb(Buffer.from(stderrData)), 1);
                }
            });
            proc.on.mockImplementation((event, cb) => {
                if (event === 'close') setTimeout(() => cb(closeCode), 10);
            });
            return proc;
        };

        const jsonOutput = JSON.stringify({
            transcription: [{
                timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
                offsets: { from: 0, to: 5000 },
                text: 'GPU test'
            }]
        });

        beforeEach(() => {
            service.whisperPath = '/path/to/whisper-cli';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['ggml-base.bin']);
            fs.statSync.mockReturnValue({ size: 1000000 });
            fs.readFileSync = jest.fn().mockReturnValue(jsonOutput);
        });

        it('should pass no GPU flag when metal backend is selected (binary uses GPU by default)', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0));

            await service.transcribeFile('/path/to/audio.wav', {
                gpuBackend: 'metal',
                hardwareAcceleration: true
            });

            const whisperArgs = spawn.mock.calls[1][1];
            expect(whisperArgs).not.toContain('--metal');
            expect(whisperArgs).not.toContain('--no-gpu');
        });

        it('should pass --cuda flag when cuda backend is selected', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0));

            await service.transcribeFile('/path/to/audio.wav', {
                gpuBackend: 'cuda',
                hardwareAcceleration: true
            });

            const whisperArgs = spawn.mock.calls[1][1];
            expect(whisperArgs).toContain('--cuda');
        });

        it('should pass --vulkan flag when vulkan backend is selected', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0));

            await service.transcribeFile('/path/to/audio.wav', {
                gpuBackend: 'vulkan',
                hardwareAcceleration: true
            });

            const whisperArgs = spawn.mock.calls[1][1];
            expect(whisperArgs).toContain('--vulkan');
        });

        it('should pass --coreml flag when coreml backend is selected', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0));

            await service.transcribeFile('/path/to/audio.wav', {
                gpuBackend: 'coreml',
                hardwareAcceleration: true
            });

            const whisperArgs = spawn.mock.calls[1][1];
            expect(whisperArgs).toContain('--coreml');
        });

        it('should pass --no-gpu when hardwareAcceleration is false', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0));

            await service.transcribeFile('/path/to/audio.wav', {
                gpuBackend: 'metal',
                hardwareAcceleration: false
            });

            const whisperArgs = spawn.mock.calls[1][1];
            expect(whisperArgs).toContain('--no-gpu');
            expect(whisperArgs).not.toContain('--metal');
            expect(whisperArgs).not.toContain('--cuda');
            expect(whisperArgs).not.toContain('--vulkan');
        });

        it('should not pass GPU flags when cpu backend is selected', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0));

            await service.transcribeFile('/path/to/audio.wav', {
                gpuBackend: 'cpu',
                hardwareAcceleration: true
            });

            const whisperArgs = spawn.mock.calls[1][1];
            expect(whisperArgs).not.toContain('--metal');
            expect(whisperArgs).not.toContain('--cuda');
            expect(whisperArgs).not.toContain('--vulkan');
            expect(whisperArgs).not.toContain('--coreml');
        });

        it('should pass -tr flag when translate is true', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0));

            await service.transcribeFile('/path/to/audio.wav', {
                translate: true,
                hardwareAcceleration: false
            });

            const whisperArgs = spawn.mock.calls[1][1];
            expect(whisperArgs).toContain('-tr');
        });

        it('should pass -l flag when language is not auto', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0));

            await service.transcribeFile('/path/to/audio.wav', {
                language: 'en',
                hardwareAcceleration: false
            });

            const whisperArgs = spawn.mock.calls[1][1];
            expect(whisperArgs).toContain('-l');
            expect(whisperArgs).toContain('en');
        });
    });

    describe('GPU acceleration - fallback behavior', () => {
        const jsonOutput = JSON.stringify({
            transcription: [{
                timestamps: { from: '00:00:00,000', to: '00:00:05,000' },
                offsets: { from: 0, to: 5000 },
                text: 'Fallback result'
            }]
        });

        const makeProcess = (closeCode = 0, stderrData = '') => {
            const proc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn()
            };
            proc.stderr.on.mockImplementation((event, cb) => {
                if (event === 'data' && stderrData) {
                    setTimeout(() => cb(Buffer.from(stderrData)), 1);
                }
            });
            proc.on.mockImplementation((event, cb) => {
                if (event === 'close') setTimeout(() => cb(closeCode), 15);
            });
            return proc;
        };

        beforeEach(() => {
            service.whisperPath = '/path/to/whisper-cli';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['ggml-base.bin']);
            fs.statSync.mockReturnValue({ size: 1000000 });
            fs.readFileSync = jest.fn().mockReturnValue(jsonOutput);
        });

        it('should fallback to CPU when CUDA GPU acceleration fails', async () => {
            const originalImpl = service.transcribeFile.bind(service);
            const transcribeSpy = jest.spyOn(service, 'transcribeFile');
            let callCount = 0;

            transcribeSpy.mockImplementation((fp, opts) => {
                callCount++;
                if (callCount === 1) {
                    return originalImpl(fp, opts);
                }
                return Promise.resolve({ success: true, text: 'CPU fallback result' });
            });

            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(1, 'CUDA not compiled'));

            const result = await service.transcribeFile('/path/to/audio.wav', {
                gpuBackend: 'cuda',
                hardwareAcceleration: true
            });

            expect(result.text).toBe('CPU fallback result');
            expect(transcribeSpy).toHaveBeenCalledTimes(2);
        });

        it('should fallback to Vulkan when CUDA fails on linux', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux', writable: true });

            const originalImpl = service.transcribeFile.bind(service);
            const transcribeSpy = jest.spyOn(service, 'transcribeFile');
            let callCount = 0;

            transcribeSpy.mockImplementation((fp, opts) => {
                callCount++;
                if (callCount === 1) {
                    return originalImpl(fp, opts);
                }
                return Promise.resolve({ success: true, text: 'Vulkan fallback result' });
            });

            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(1, 'CUDA failed to init'));

            const result = await service.transcribeFile('/path/to/audio.wav', {
                gpuBackend: 'cuda',
                hardwareAcceleration: true
            });

            expect(result.text).toBe('Vulkan fallback result');
            expect(transcribeSpy).toHaveBeenCalledTimes(2);
            expect(transcribeSpy).toHaveBeenNthCalledWith(2,
                '/path/to/audio.wav',
                expect.objectContaining({ gpuBackend: 'vulkan' })
            );

            Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
        });

        it('should not retry when non-GPU error occurs (hardwareAcceleration off)', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(1, 'some unrelated error'));

            await expect(
                service.transcribeFile('/path/to/audio.wav', {
                    gpuBackend: 'metal',
                    hardwareAcceleration: false
                })
            ).rejects.toThrow();

            expect(spawn).toHaveBeenCalledTimes(2);
        });
    });

    describe('transcribeFile edge cases', () => {
        it('should throw when whisper.cpp is not available', async () => {
            service.whisperPath = null;
            await expect(
                service.transcribeFile('/path/to/audio.wav', {})
            ).rejects.toThrow('whisper.cpp is not available');
        });

        it('should throw when input file does not exist', async () => {
            service.whisperPath = '/path/to/whisper';
            fs.existsSync.mockImplementation((p) => p === '/path/to/whisper');

            await expect(
                service.transcribeFile('/nonexistent/audio.wav', {})
            ).rejects.toThrow('Input file does not exist');
        });

        it('should throw for unsupported file format', async () => {
            service.whisperPath = '/path/to/whisper';
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ size: 1000 });

            await expect(
                service.transcribeFile('/path/to/file.xyz', {})
            ).rejects.toThrow('Unsupported file format');
        });

        it('should throw when model is not found', async () => {
            service.whisperPath = '/path/to/whisper';
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('/models/')) return false;
                return true;
            });
            fs.statSync.mockReturnValue({ size: 1000 });
            fs.readdirSync.mockReturnValue([]);

            const makeProcess = (closeCode = 0) => {
                const proc = {
                    stdout: { on: jest.fn() },
                    stderr: { on: jest.fn() },
                    on: jest.fn(),
                    kill: jest.fn()
                };
                proc.on.mockImplementation((event, cb) => {
                    if (event === 'close') setTimeout(() => cb(closeCode), 5);
                });
                return proc;
            };

            spawn.mockImplementationOnce(() => makeProcess(0));

            await expect(
                service.transcribeFile('/path/to/audio.wav', { model: 'nonexistent-model' })
            ).rejects.toThrow('Model \'nonexistent-model\' not found');
        });
    });

    describe('testInstallation edge cases', () => {
        it('should return error when no models found', async () => {
            service.whisperPath = '/path/to/whisper';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue([]);

            const result = await service.testInstallation();
            expect(result.success).toBe(false);
            expect(result.error).toBe('No Whisper models found');
        });
    });

    describe('validateAudioFile', () => {
        const makeFFprobeProcess = (closeCode, stdoutData = '', stderrData = '') => {
            const proc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn()
            };
            proc.stdout.on.mockImplementation((event, cb) => {
                if (event === 'data' && stdoutData) setTimeout(() => cb(Buffer.from(stdoutData)), 1);
            });
            proc.stderr.on.mockImplementation((event, cb) => {
                if (event === 'data' && stderrData) setTimeout(() => cb(Buffer.from(stderrData)), 1);
            });
            proc.on.mockImplementation((event, cb) => {
                if (event === 'close') setTimeout(() => cb(closeCode), 10);
            });
            return proc;
        };

        it('should return valid for file with audio stream', async () => {
            const ffprobeOutput = JSON.stringify({
                streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le' }]
            });
            spawn.mockReturnValueOnce(makeFFprobeProcess(0, ffprobeOutput));

            const result = await service.validateAudioFile('/path/to/audio.wav');
            expect(result.valid).toBe(true);
        });

        it('should return invalid for file with no audio stream', async () => {
            const ffprobeOutput = JSON.stringify({ streams: [] });
            spawn.mockReturnValueOnce(makeFFprobeProcess(0, ffprobeOutput));

            const result = await service.validateAudioFile('/path/to/video-only.mp4');
            expect(result.valid).toBe(false);
            expect(result.message).toContain('No audio stream');
        });

        it('should return invalid when ffprobe exits with error code', async () => {
            spawn.mockReturnValueOnce(makeFFprobeProcess(1, '', 'file not found'));

            const result = await service.validateAudioFile('/path/to/nonexistent.wav');
            expect(result.valid).toBe(false);
        });

        it('should return valid when ffprobe not installed (ENOENT)', async () => {
            const proc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn()
            };
            proc.on.mockImplementation((event, cb) => {
                if (event === 'error') setTimeout(() => cb({ message: 'spawn ffprobe ENOENT' }), 5);
            });
            spawn.mockReturnValueOnce(proc);

            const result = await service.validateAudioFile('/path/to/audio.wav');
            expect(result.valid).toBe(true);
            expect(result.message).toContain('ffprobe not available');
        });

        it('should return invalid for other ffprobe spawn errors', async () => {
            const proc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn()
            };
            proc.on.mockImplementation((event, cb) => {
                if (event === 'error') setTimeout(() => cb({ message: 'permission denied' }), 5);
            });
            spawn.mockReturnValueOnce(proc);

            const result = await service.validateAudioFile('/path/to/audio.wav');
            expect(result.valid).toBe(false);
        });

        it('should return invalid when ffprobe output is invalid JSON', async () => {
            spawn.mockReturnValueOnce(makeFFprobeProcess(0, 'not valid json'));

            const result = await service.validateAudioFile('/path/to/audio.wav');
            expect(result.valid).toBe(false);
        });
    });

    describe('transcribeFile - whisper stdout/stderr coverage', () => {
        const makeProcess = (closeCode = 0, stderrData = '', stdoutData = '') => {
            const proc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn()
            };
            proc.stdout.on.mockImplementation((event, cb) => {
                if (event === 'data' && stdoutData) setTimeout(() => cb(Buffer.from(stdoutData)), 1);
            });
            proc.stderr.on.mockImplementation((event, cb) => {
                if (event === 'data' && stderrData) setTimeout(() => cb(Buffer.from(stderrData)), 1);
            });
            proc.on.mockImplementation((event, cb) => {
                if (event === 'close') setTimeout(() => cb(closeCode), 15);
            });
            return proc;
        };

        const jsonOutput = JSON.stringify({
            transcription: [{
                offsets: { from: 0, to: 5000 },
                text: 'Test output'
            }]
        });

        beforeEach(() => {
            service.whisperPath = '/path/to/whisper-cli';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['ggml-base.bin']);
            fs.statSync.mockReturnValue({ size: 1000000 });
            fs.readFileSync = jest.fn().mockReturnValue(jsonOutput);
        });

        it('should handle whisper stdout data during transcription', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0, '', '[00:00:00.000] Hello world'));

            const result = await service.transcribeFile('/path/to/audio.wav', {
                hardwareAcceleration: false
            });

            expect(result.success).toBe(true);
        });

        it('should handle whisper stderr data during transcription', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0, 'whisper_print_timings: total time = 1234.56 ms', ''));

            const result = await service.transcribeFile('/path/to/audio.wav', {
                hardwareAcceleration: false
            });

            expect(result.success).toBe(true);
        });

        it('should reject when whisper exits 0 but stderr has error messages', async () => {
            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0, 'error: something failed to process'));

            await expect(
                service.transcribeFile('/path/to/audio.wav', { hardwareAcceleration: false })
            ).rejects.toThrow();
        });

        it('should use fallback text when JSON output file not found', async () => {
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('.json')) return false;
                return true;
            });

            spawn.mockImplementationOnce(() => makeProcess(0))
                .mockImplementationOnce(() => makeProcess(0, '', '[00:00:01.000 --> 00:00:05.000] Fallback text'));

            const result = await service.transcribeFile('/path/to/audio.wav', {
                hardwareAcceleration: false
            });

            expect(result.success).toBe(true);
        });
    });

    describe('findModelPath', () => {
        it('should find model with ggml- prefix', () => {
            fs.existsSync.mockImplementation((p) => p.includes('ggml-base.bin'));
            const result = service.findModelPath('base');
            expect(result).toContain('ggml-base.bin');
        });

        it('should find model without prefix', () => {
            fs.existsSync.mockImplementation((p) => p.endsWith('base.bin') && !p.includes('ggml-'));
            const result = service.findModelPath('base');
            expect(result).toContain('base.bin');
        });

        it('should return null when model not found', () => {
            fs.existsSync.mockReturnValue(false);
            const result = service.findModelPath('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('getModelInfo', () => {
        it('should return info for existing model', () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ size: 75000000 });
            const result = service.getModelInfo('base');
            expect(result.exists).toBe(true);
            expect(result.name).toBe('base');
        });

        it('should return info for non-existing model', () => {
            fs.existsSync.mockReturnValue(false);
            const result = service.getModelInfo('large');
            expect(result.exists).toBe(false);
            expect(result.size).toBeNull();
        });
    });

    describe('video file transcription (extractAudioFromVideo)', () => {
        const jsonOutput = JSON.stringify({
            transcription: [{ offsets: { from: 0, to: 5000 }, text: 'Video transcript' }]
        });

        const makeProc = (code = 0, stderrData = '', stdoutData = '') => {
            const proc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn()
            };
            proc.stdout.on.mockImplementation((event, cb) => {
                if (event === 'data' && stdoutData) setTimeout(() => cb(Buffer.from(stdoutData)), 1);
            });
            proc.stderr.on.mockImplementation((event, cb) => {
                if (event === 'data' && stderrData) setTimeout(() => cb(Buffer.from(stderrData)), 1);
            });
            proc.on.mockImplementation((event, cb) => {
                if (event === 'close') setTimeout(() => cb(code), 12);
            });
            return proc;
        };

        beforeEach(() => {
            service.whisperPath = '/path/to/whisper-cli';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['ggml-base.bin']);
            fs.statSync.mockReturnValue({ size: 1000000 });
            fs.readFileSync = jest.fn().mockReturnValue(jsonOutput);
            fs.unlinkSync = jest.fn();
        });

        it('should extract audio from video and transcribe with GPU enabled (no --no-gpu flag)', async () => {
            spawn.mockImplementationOnce(() => makeProc(0, 'time=00:00:05'))
                .mockImplementationOnce(() => makeProc(0, 'time=00:00:05'))
                .mockImplementationOnce(() => makeProc(0));

            const result = await service.transcribeFile('/path/to/video.mp4', {
                gpuBackend: 'metal',
                hardwareAcceleration: true
            });

            expect(result.success).toBe(true);
            const whisperArgs = spawn.mock.calls[2][1];
            expect(whisperArgs).not.toContain('--no-gpu');
            expect(whisperArgs).not.toContain('--metal');
        });

        it('should extract audio from video without GPU', async () => {
            spawn.mockImplementationOnce(() => makeProc(0, 'size=1234kB'))
                .mockImplementationOnce(() => makeProc(0, 'size=1234kB'))
                .mockImplementationOnce(() => makeProc(0));

            const result = await service.transcribeFile('/path/to/video.avi', {
                hardwareAcceleration: false
            });

            expect(result.success).toBe(true);
            expect(spawn).toHaveBeenCalledTimes(3);
        });

        it('should throw when video audio extraction fails', async () => {
            spawn.mockImplementationOnce(() => makeProc(1, 'ffmpeg error'));

            await expect(
                service.transcribeFile('/path/to/video.mp4', { hardwareAcceleration: false })
            ).rejects.toThrow('Audio processing failed');
        });

        it('should throw when audio conversion fails after extraction', async () => {
            const extractProc = makeProc(0);
            const convertProc = makeProc(1, 'conversion error');

            spawn.mockImplementationOnce(() => extractProc)
                .mockImplementationOnce(() => convertProc);

            await expect(
                service.transcribeFile('/path/to/video.mp4', { hardwareAcceleration: false })
            ).rejects.toThrow('Audio processing failed');
        });
    });

    describe('transcribeBuffer', () => {
        const jsonOutput = JSON.stringify({
            transcription: [{ offsets: { from: 0, to: 3000 }, text: 'Buffer transcript' }]
        });

        const makeProc = (code = 0, stderrData = '') => {
            const proc = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn(),
                kill: jest.fn()
            };
            proc.stderr.on.mockImplementation((event, cb) => {
                if (event === 'data' && stderrData) setTimeout(() => cb(Buffer.from(stderrData)), 1);
            });
            proc.on.mockImplementation((event, cb) => {
                if (event === 'close') setTimeout(() => cb(code), 12);
            });
            return proc;
        };

        beforeEach(() => {
            service.whisperPath = '/path/to/whisper-cli';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['ggml-base.bin']);
            fs.statSync.mockReturnValue({ size: 100000 });
            fs.readFileSync = jest.fn().mockReturnValue(jsonOutput);
            fs.writeFileSync = jest.fn();
            fs.unlinkSync = jest.fn();
        });

        it('should transcribe audio buffer with GPU acceleration (no --no-gpu flag)', async () => {
            spawn.mockImplementationOnce(() => makeProc(0))
                .mockImplementationOnce(() => makeProc(0))
                .mockImplementationOnce(() => makeProc(0));

            const audioBuffer = Buffer.from('fake audio data');
            const result = await service.transcribeBuffer(audioBuffer, {
                gpuBackend: 'metal',
                hardwareAcceleration: true
            });

            expect(result.success).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.webm'),
                audioBuffer
            );
            const whisperArgs = spawn.mock.calls[2][1];
            expect(whisperArgs).not.toContain('--no-gpu');
            expect(whisperArgs).not.toContain('--metal');
        });

        it('should transcribe audio buffer in CPU mode', async () => {
            spawn.mockImplementationOnce(() => makeProc(0))
                .mockImplementationOnce(() => makeProc(0))
                .mockImplementationOnce(() => makeProc(0));

            const result = await service.transcribeBuffer(Buffer.from('audio data'), {
                hardwareAcceleration: false
            });

            expect(result.success).toBe(true);
        });

        it('should throw when WAV conversion fails', async () => {
            spawn.mockImplementationOnce(() => makeProc(1, 'ffmpeg failed'));

            await expect(
                service.transcribeBuffer(Buffer.from('audio'), {})
            ).rejects.toThrow();
        });

        it('should throw when converted WAV is zero bytes', async () => {
            fs.statSync.mockReturnValue({ size: 0 });

            spawn.mockImplementationOnce(() => makeProc(0));

            await expect(
                service.transcribeBuffer(Buffer.from('audio'), {})
            ).rejects.toThrow('empty');
        });

        it('should clean up temp files even when transcription fails', async () => {
            spawn.mockImplementationOnce(() => makeProc(0))
                .mockImplementationOnce(() => makeProc(1));

            try {
                await service.transcribeBuffer(Buffer.from('audio'), {
                    hardwareAcceleration: false
                });
            } catch (e) {
                // Expected to fail
            }

            expect(fs.unlinkSync).toHaveBeenCalled();
        });
    });
});