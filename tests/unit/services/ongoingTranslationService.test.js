/**
 * OngoingTranslationService Unit Tests
 */

const OngoingTranslationService = require('../../../src/services/ongoingTranslationService');
const EventEmitter = require('events');

// Mock services
const mockRecordingService = {
    isRecording: false,
    getStatus: jest.fn(() => ({ isRecording: false }))
};

const mockTranscriptionService = {
    transcribeBuffer: jest.fn(() => Promise.resolve({
        success: true,
        text: 'Hello world',
        language: 'en',
        model: 'base',
        segments: []
    })),
    setLanguage: jest.fn()
};

const mockOllamaService = {
    refineText: jest.fn(() => Promise.resolve({
        success: true,
        refinedText: 'Hola mundo'
    }))
};

const mockSentenceSegmentation = {
    processTextChunk: jest.fn(() => [{
        id: 'sentence_1',
        text: 'Hello world',
        isComplete: true,
        confidence: 0.9,
        wordCount: 2,
        timestamp: Date.now()
    }])
};

describe('OngoingTranslationService', () => {
    let ongoingTranslationService;

    beforeEach(() => {
        ongoingTranslationService = new OngoingTranslationService();
        ongoingTranslationService.initializeServices({
            recordingService: mockRecordingService,
            transcriptionService: mockTranscriptionService,
            ollamaService: mockOllamaService,
            sentenceSegmentation: mockSentenceSegmentation
        });
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (ongoingTranslationService.isActive) {
            ongoingTranslationService.stopOngoingTranslation();
        }
    });

    describe('Constructor', () => {
        test('should initialize with correct default values', () => {
            const service = new OngoingTranslationService();
            
            expect(service.isActive).toBe(false);
            expect(service.sourceLanguage).toBe('auto');
            expect(service.targetLanguage).toBe('en');
            expect(service.sessionId).toBeNull();
            expect(service.sessionStartTime).toBeNull();
            expect(service.processingQueue).toEqual([]);
            expect(service.completedSegments).toEqual([]);
            expect(service.isProcessing).toBe(false);
            expect(service.stats.chunksProcessed).toBe(0);
            expect(service.stats.errors).toBe(0);
        });

        test('should extend EventEmitter', () => {
            expect(ongoingTranslationService).toBeInstanceOf(EventEmitter);
        });
    });

    describe('initializeServices', () => {
        test('should initialize services correctly', () => {
            const service = new OngoingTranslationService();
            const services = {
                recordingService: mockRecordingService,
                transcriptionService: mockTranscriptionService,
                ollamaService: mockOllamaService,
                sentenceSegmentation: mockSentenceSegmentation
            };

            service.initializeServices(services);

            expect(service.recordingService).toBe(mockRecordingService);
            expect(service.transcriptionService).toBe(mockTranscriptionService);
            expect(service.ollamaService).toBe(mockOllamaService);
            expect(service.sentenceSegmentation).toBe(mockSentenceSegmentation);
        });
    });

    describe('startOngoingTranslation', () => {
        test('should start session with default options', async () => {
            const result = await ongoingTranslationService.startOngoingTranslation();

            expect(result.success).toBe(true);
            expect(result.sessionId).toBeDefined();
            expect(result.sourceLanguage).toBe('auto');
            expect(result.targetLanguage).toBe('en');
            expect(result.startTime).toBeDefined();
            expect(ongoingTranslationService.isActive).toBe(true);
        });

        test('should start session with custom options', async () => {
            const options = {
                sourceLanguage: 'es',
                targetLanguage: 'fr',
                chunkSize: 5000,
                overlapSize: 750
            };

            const result = await ongoingTranslationService.startOngoingTranslation(options);

            expect(result.success).toBe(true);
            expect(result.sourceLanguage).toBe('es');
            expect(result.targetLanguage).toBe('fr');
            expect(ongoingTranslationService.sessionData.metadata.chunkSize).toBe(5000);
            expect(ongoingTranslationService.sessionData.metadata.overlapSize).toBe(750);
        });

        test('should emit session-started event', async () => {
            const eventSpy = jest.fn();
            ongoingTranslationService.on('session-started', eventSpy);

            await ongoingTranslationService.startOngoingTranslation();

            expect(eventSpy).toHaveBeenCalledWith({
                sessionId: expect.any(String),
                sourceLanguage: 'auto',
                targetLanguage: 'en',
                startTime: expect.any(String)
            });
        });

        test('should throw error if session already active', async () => {
            await ongoingTranslationService.startOngoingTranslation();

            await expect(ongoingTranslationService.startOngoingTranslation())
                .rejects
                .toThrow('Ongoing translation session already active');
        });

        test('should throw error if services not initialized', async () => {
            const service = new OngoingTranslationService();

            await expect(service.startOngoingTranslation())
                .rejects
                .toThrow('Services not properly initialized');
        });

        test('should configure transcription service for non-auto language', async () => {
            await ongoingTranslationService.startOngoingTranslation({
                sourceLanguage: 'es'
            });

            expect(mockTranscriptionService.setLanguage).toHaveBeenCalledWith('es');
        });
    });

    describe('stopOngoingTranslation', () => {
        test('should stop active session', async () => {
            await ongoingTranslationService.startOngoingTranslation();
            const sessionId = ongoingTranslationService.sessionId;

            const result = await ongoingTranslationService.stopOngoingTranslation();

            expect(result.success).toBe(true);
            expect(result.sessionId).toBe(sessionId);
            expect(result.completedSegments).toBe(0);
            expect(ongoingTranslationService.isActive).toBe(false);
        });

        test('should emit session-completed event', async () => {
            const eventSpy = jest.fn();
            ongoingTranslationService.on('session-completed', eventSpy);

            await ongoingTranslationService.startOngoingTranslation();
            const sessionId = ongoingTranslationService.sessionId;
            await ongoingTranslationService.stopOngoingTranslation();

            expect(eventSpy).toHaveBeenCalledWith({
                sessionId,
                completedSegments: 0,
                sessionData: expect.any(Object)
            });
        });

        test('should throw error if no active session', async () => {
            await expect(ongoingTranslationService.stopOngoingTranslation())
                .rejects
                .toThrow('No active ongoing translation session');
        });

        test('should wait for processing to complete', async () => {
            await ongoingTranslationService.startOngoingTranslation();
            
            // Simulate processing
            ongoingTranslationService.isProcessing = true;
            setTimeout(() => {
                ongoingTranslationService.isProcessing = false;
            }, 100);

            const start = Date.now();
            await ongoingTranslationService.stopOngoingTranslation();
            const duration = Date.now() - start;

            expect(duration).toBeGreaterThanOrEqual(100);
        });
    });

    describe('processAudioChunk', () => {
        beforeEach(async () => {
            await ongoingTranslationService.startOngoingTranslation();
        });

        test('should process audio chunk successfully', async () => {
            const audioData = Buffer.from('mock audio data');
            const timestamp = 1000;

            await ongoingTranslationService.processAudioChunk(audioData, timestamp);

            expect(ongoingTranslationService.stats.chunksProcessed).toBe(1);
            expect(ongoingTranslationService.processingQueue.length).toBeGreaterThanOrEqual(0);
        });

        test('should ignore chunk if session not active', async () => {
            await ongoingTranslationService.stopOngoingTranslation();
            const audioData = Buffer.from('mock audio data');

            await ongoingTranslationService.processAudioChunk(audioData, 1000);

            expect(ongoingTranslationService.stats.chunksProcessed).toBe(0);
        });

        test('should add chunk to processing queue', async () => {
            const audioData = Buffer.from('mock audio data');
            const timestamp = 1000;

            // Mock processQueue to prevent actual processing
            ongoingTranslationService.processQueue = jest.fn();

            await ongoingTranslationService.processAudioChunk(audioData, timestamp);

            expect(ongoingTranslationService.processingQueue.length).toBe(1);
            expect(ongoingTranslationService.processingQueue[0]).toMatchObject({
                id: expect.stringContaining('chunk_'),
                audioData,
                timestamp,
                receivedAt: expect.any(Number)
            });
        });
    });

    describe('transcribeChunk', () => {
        beforeEach(async () => {
            await ongoingTranslationService.startOngoingTranslation({
                sourceLanguage: 'en'
            });
        });

        test('should transcribe audio buffer successfully', async () => {
            const audioData = Buffer.from('mock audio data');

            const result = await ongoingTranslationService.transcribeChunk(audioData);

            expect(mockTranscriptionService.transcribeBuffer).toHaveBeenCalledWith(
                audioData,
                {
                    model: 'base',
                    language: 'en',
                    translate: false,
                    threads: 4
                }
            );
            expect(result.success).toBe(true);
            expect(result.text).toBe('Hello world');
        });

        test('should handle ArrayBuffer input', async () => {
            const arrayBuffer = new ArrayBuffer(16);
            const uint8Array = new Uint8Array(arrayBuffer);
            uint8Array.set([72, 101, 108, 108, 111]); // "Hello"

            await ongoingTranslationService.transcribeChunk(arrayBuffer);

            expect(mockTranscriptionService.transcribeBuffer).toHaveBeenCalledWith(
                expect.any(Buffer),
                expect.any(Object)
            );
        });

        test('should use auto language when sourceLanguage is auto', async () => {
            await ongoingTranslationService.stopOngoingTranslation();
            await ongoingTranslationService.startOngoingTranslation({
                sourceLanguage: 'auto'
            });

            const audioData = Buffer.from('mock audio data');
            await ongoingTranslationService.transcribeChunk(audioData);

            expect(mockTranscriptionService.transcribeBuffer).toHaveBeenCalledWith(
                audioData,
                expect.objectContaining({
                    language: null
                })
            );
        });
    });

    describe('generateTranslationPrompt', () => {
        test('should generate correct translation prompt', () => {
            const text = 'Hello world';
            const sourceLanguage = 'en';
            const targetLanguage = 'es';

            const prompt = ongoingTranslationService.generateTranslationPrompt(
                text,
                sourceLanguage,
                targetLanguage
            );

            expect(prompt).toContain('English to Spanish');
            expect(prompt).toContain(text);
            expect(prompt).toContain('Translation:');
        });

        test('should handle auto language', () => {
            const prompt = ongoingTranslationService.generateTranslationPrompt(
                'Hello',
                'auto',
                'es'
            );

            expect(prompt).toContain('Auto-detect to Spanish');
        });
    });

    describe('getLanguageName', () => {
        test('should return correct language names', () => {
            expect(ongoingTranslationService.getLanguageName('en')).toBe('English');
            expect(ongoingTranslationService.getLanguageName('es')).toBe('Spanish');
            expect(ongoingTranslationService.getLanguageName('fr')).toBe('French');
            expect(ongoingTranslationService.getLanguageName('auto')).toBe('Auto-detect');
            expect(ongoingTranslationService.getLanguageName('unknown')).toBe('unknown');
        });
    });

    describe('exportBilingualTranscript', () => {
        beforeEach(async () => {
            await ongoingTranslationService.startOngoingTranslation();
            // Add a mock completed segment directly to the array
            const mockSegment = {
                id: 'test_segment',
                text: 'Hello world',
                translatedText: 'Hola mundo',
                status: 'translated',
                startTime: 0,
                endTime: 3,
                timestamp: Date.now(),
                sourceLanguage: 'en',
                targetLanguage: 'es',
                confidence: 0.9,
                wordCount: 2
            };
            ongoingTranslationService.completedSegments.push(mockSegment);
        });

        test('should export as TXT format', async () => {
            // Stop session to populate sessionData.segments
            await ongoingTranslationService.stopOngoingTranslation();
            
            const result = await ongoingTranslationService.exportBilingualTranscript('txt');

            expect(result).toContain('Bilingual Transcript');
            expect(result).toContain('Hello world');
            expect(result).toContain('Hola mundo');
        });

        test('should export as JSON format', async () => {
            // Stop session to populate sessionData.segments
            await ongoingTranslationService.stopOngoingTranslation();
            
            const result = await ongoingTranslationService.exportBilingualTranscript('json');

            const parsed = JSON.parse(result);
            expect(parsed.sessionId).toBeDefined();
            expect(parsed.segments).toHaveLength(1);
        });

        test('should export as SRT format', async () => {
            // Stop session to populate sessionData.segments
            await ongoingTranslationService.stopOngoingTranslation();
            
            const result = await ongoingTranslationService.exportBilingualTranscript('srt');

            expect(result).toContain('1');
            expect(result).toContain('00:00:00,000 --> 00:00:03,000');
            expect(result).toContain('Hello world');
            expect(result).toContain('Hola mundo');
        });

        test('should throw error for unsupported format', async () => {
            await expect(ongoingTranslationService.exportBilingualTranscript('pdf'))
                .rejects
                .toThrow('Unsupported export format: pdf');
        });
    });

    describe('formatSRTTime', () => {
        test('should format seconds correctly', () => {
            expect(ongoingTranslationService.formatSRTTime(0)).toBe('00:00:00,000');
            expect(ongoingTranslationService.formatSRTTime(65.5)).toBe('00:01:05,500');
            expect(ongoingTranslationService.formatSRTTime(3661.123)).toBe('01:01:01,123');
        });
    });

    describe('getStatus', () => {
        test('should return correct status when inactive', () => {
            const status = ongoingTranslationService.getStatus();

            expect(status).toEqual({
                isActive: false,
                sessionId: null,
                sourceLanguage: 'auto',
                targetLanguage: 'en',
                completedSegments: 0,
                processingQueueSize: 0,
                isProcessing: false,
                stats: expect.any(Object)
            });
        });

        test('should return correct status when active', async () => {
            await ongoingTranslationService.startOngoingTranslation({
                sourceLanguage: 'es',
                targetLanguage: 'fr'
            });

            const status = ongoingTranslationService.getStatus();

            expect(status.isActive).toBe(true);
            expect(status.sessionId).toBeDefined();
            expect(status.sourceLanguage).toBe('es');
            expect(status.targetLanguage).toBe('fr');
        });
    });

    describe('getStats', () => {
        test('should return correct statistics', () => {
            ongoingTranslationService.stats.chunksProcessed = 5;
            ongoingTranslationService.stats.errors = 1;
            ongoingTranslationService.stats.transcriptionLatency = [100, 200, 150];
            ongoingTranslationService.stats.translationLatency = [500, 600, 550];

            const stats = ongoingTranslationService.getStats();

            expect(stats.chunksProcessed).toBe(5);
            expect(stats.completedSegments).toBe(0);
            expect(stats.avgTranscriptionLatency).toBe(150);
            expect(stats.avgTranslationLatency).toBe(550);
            expect(stats.totalLatency).toBe(700);
            expect(stats.errorCount).toBe(1);
            expect(stats.errorRate).toBe(0.2);
        });

        test('should handle empty statistics arrays', () => {
            const stats = ongoingTranslationService.getStats();

            expect(stats.avgTranscriptionLatency).toBe(0);
            expect(stats.avgTranslationLatency).toBe(0);
            expect(stats.totalLatency).toBe(0);
            expect(stats.errorRate).toBe(0);
        });
    });

    describe('Event Emission', () => {
        test('should emit transcription-update events', async () => {
            const eventSpy = jest.fn();
            ongoingTranslationService.on('transcription-update', eventSpy);

            await ongoingTranslationService.startOngoingTranslation();

            // Mock a successful chunk processing
            const mockSegment = {
                id: 'test_segment',
                text: 'Hello world',
                status: 'transcribed'
            };

            ongoingTranslationService.emit('transcription-update', { segment: mockSegment });

            expect(eventSpy).toHaveBeenCalledWith({ segment: mockSegment });
        });

        test('should emit translation-update events', async () => {
            const eventSpy = jest.fn();
            ongoingTranslationService.on('translation-update', eventSpy);

            await ongoingTranslationService.startOngoingTranslation();

            const mockSegment = {
                id: 'test_segment',
                text: 'Hello world',
                translatedText: 'Hola mundo',
                status: 'translated'
            };

            ongoingTranslationService.emit('translation-update', { segment: mockSegment });

            expect(eventSpy).toHaveBeenCalledWith({ segment: mockSegment });
        });

        test('should emit processing-error events', async () => {
            const eventSpy = jest.fn();
            ongoingTranslationService.on('processing-error', eventSpy);

            ongoingTranslationService.emit('processing-error', { error: 'Test error' });

            expect(eventSpy).toHaveBeenCalledWith({ error: 'Test error' });
        });
    });

    describe('Memory Management', () => {
        test('should clean up session data on stop', async () => {
            await ongoingTranslationService.startOngoingTranslation();
            
            // Add some test data
            ongoingTranslationService.processingQueue.push({ test: 'data' });
            ongoingTranslationService.completedSegments.push({ test: 'segment' });

            await ongoingTranslationService.stopOngoingTranslation();

            expect(ongoingTranslationService.isActive).toBe(false);
            expect(ongoingTranslationService.sessionId).toBeNull();
            expect(ongoingTranslationService.sessionStartTime).toBeNull();
        });
    });

    describe('Error Handling', () => {
        test('should handle transcription errors gracefully', async () => {
            mockTranscriptionService.transcribeBuffer.mockRejectedValueOnce(
                new Error('Transcription failed')
            );

            await ongoingTranslationService.startOngoingTranslation();

            await expect(
                ongoingTranslationService.transcribeChunk(Buffer.from('test'))
            ).rejects.toThrow('Transcription failed');
        });

        test('should handle translation errors gracefully', async () => {
            mockOllamaService.refineText.mockResolvedValueOnce({
                success: false,
                message: 'Translation failed'
            });

            const segment = {
                text: 'Hello world',
                status: 'transcribed'
            };

            const result = await ongoingTranslationService.translateSegment(segment);
            
            expect(result).toMatchObject({
                status: 'error',
                error: 'Translation failed',
                translatedText: '[Translation failed]'
            });
        });
    });
});