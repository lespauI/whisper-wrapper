/**
 * Recording Service Streaming Enhancement Unit Tests
 * Tests for the new streaming functionality added to RecordingService
 */

const RecordingService = require('../../../src/services/recordingService');
const EventEmitter = require('events');

describe('RecordingService - Streaming Enhancement', () => {
    let recordingService;

    beforeEach(() => {
        recordingService = new RecordingService();
        jest.clearAllMocks();
    });

    afterEach(() => {
        recordingService.reset();
    });

    describe('Constructor - Streaming Properties', () => {
        test('should initialize streaming properties', () => {
            expect(recordingService.isStreamingMode).toBe(false);
            expect(recordingService.chunkSize).toBe(3000);
            expect(recordingService.overlapSize).toBe(500);
            expect(recordingService.audioChunks).toEqual([]);
            expect(recordingService.lastChunkTime).toBe(0);
            expect(recordingService.streamingOptions).toBeNull();
        });

        test('should extend EventEmitter', () => {
            expect(recordingService).toBeInstanceOf(EventEmitter);
        });
    });

    describe('enableStreamingMode', () => {
        test('should enable streaming mode with default options', () => {
            recordingService.enableStreamingMode();

            expect(recordingService.isStreamingMode).toBe(true);
            expect(recordingService.chunkSize).toBe(3000);
            expect(recordingService.overlapSize).toBe(500);
            expect(recordingService.audioChunks).toEqual([]);
            expect(recordingService.lastChunkTime).toBe(0);
        });

        test('should enable streaming mode with custom options', () => {
            const options = {
                chunkSize: 5000,
                overlapSize: 750,
                quality: 'high'
            };

            recordingService.enableStreamingMode(options);

            expect(recordingService.isStreamingMode).toBe(true);
            expect(recordingService.chunkSize).toBe(5000);
            expect(recordingService.overlapSize).toBe(750);
            expect(recordingService.streamingOptions).toBe(options);
        });

        test('should reset audio chunks when enabled', () => {
            recordingService.audioChunks = [{ test: 'data' }];
            recordingService.lastChunkTime = 1000;

            recordingService.enableStreamingMode();

            expect(recordingService.audioChunks).toEqual([]);
            expect(recordingService.lastChunkTime).toBe(0);
        });
    });

    describe('disableStreamingMode', () => {
        test('should disable streaming mode', () => {
            recordingService.enableStreamingMode();
            recordingService.audioChunks = [{ test: 'data' }];
            recordingService.lastChunkTime = 1000;

            recordingService.disableStreamingMode();

            expect(recordingService.isStreamingMode).toBe(false);
            expect(recordingService.streamingOptions).toBeNull();
            expect(recordingService.audioChunks).toEqual([]);
            expect(recordingService.lastChunkTime).toBe(0);
        });
    });

    describe('startStreamingRecording', () => {
        test('should start streaming recording successfully', async () => {
            const options = {
                chunkSize: 4000,
                overlapSize: 600
            };

            const result = await recordingService.startStreamingRecording(options);

            expect(result.success).toBe(true);
            expect(result.recordingId).toBeDefined();
            expect(recordingService.isStreamingMode).toBe(true);
            expect(recordingService.isRecording).toBe(true);
            expect(recordingService.chunkSize).toBe(4000);
            expect(recordingService.overlapSize).toBe(600);
        });

        test('should merge streaming options with recording options', async () => {
            const options = {
                chunkSize: 2000,
                quality: 'high',
                format: 'webm'
            };

            await recordingService.startStreamingRecording(options);

            const status = recordingService.getStatus();
            expect(status.settings.quality).toBe('high');
            expect(status.settings.format).toBe('webm');
        });

        test('should handle errors gracefully', async () => {
            // Mock startRecording to throw error
            recordingService.startRecording = jest.fn().mockRejectedValueOnce(
                new Error('Recording start failed')
            );

            await expect(recordingService.startStreamingRecording())
                .rejects
                .toThrow('Recording start failed');
        });
    });

    describe('processAudioChunk', () => {
        beforeEach(() => {
            recordingService.enableStreamingMode();
            recordingService.isRecording = true;
        });

        test('should process audio chunk successfully', () => {
            const audioData = Buffer.from('mock audio data');
            const timestamp = 1000;

            const eventSpy = jest.fn();
            recordingService.on('audio-chunk', eventSpy);

            recordingService.processAudioChunk(audioData, timestamp);

            expect(recordingService.audioChunks).toHaveLength(1);
            expect(recordingService.audioChunks[0]).toMatchObject({
                id: expect.stringContaining('chunk_'),
                data: audioData,
                timestamp: timestamp,
                size: audioData.length,
                receivedAt: expect.any(Number)
            });

            expect(recordingService.lastChunkTime).toBe(timestamp);
            expect(eventSpy).toHaveBeenCalledWith({
                audioData: audioData,
                timestamp: timestamp,
                chunkId: expect.stringContaining('chunk_')
            });
        });

        test('should handle ArrayBuffer input', () => {
            const arrayBuffer = new ArrayBuffer(16);
            const uint8Array = new Uint8Array(arrayBuffer);
            uint8Array.set([72, 101, 108, 108, 111]); // "Hello"

            recordingService.processAudioChunk(arrayBuffer, 1000);

            expect(recordingService.audioChunks).toHaveLength(1);
            expect(recordingService.audioChunks[0].data).toBe(arrayBuffer);
            expect(recordingService.audioChunks[0].size).toBe(16);
        });

        test('should ignore chunk if not in streaming mode', () => {
            recordingService.disableStreamingMode();
            recordingService.isRecording = true;

            const eventSpy = jest.fn();
            recordingService.on('audio-chunk', eventSpy);

            recordingService.processAudioChunk(Buffer.from('test'), 1000);

            expect(recordingService.audioChunks).toHaveLength(0);
            expect(eventSpy).not.toHaveBeenCalled();
        });

        test('should ignore chunk if not recording', () => {
            recordingService.isRecording = false;

            const eventSpy = jest.fn();
            recordingService.on('audio-chunk', eventSpy);

            recordingService.processAudioChunk(Buffer.from('test'), 1000);

            expect(recordingService.audioChunks).toHaveLength(0);
            expect(eventSpy).not.toHaveBeenCalled();
        });

        test('should emit error on processing failure', () => {
            const errorSpy = jest.fn();
            recordingService.on('chunk-error', errorSpy);

            // Pass invalid data to trigger error
            recordingService.processAudioChunk(null, 1000);

            expect(errorSpy).toHaveBeenCalledWith({
                error: expect.any(String),
                timestamp: 1000
            });
        });
    });

    describe('emitAudioChunk', () => {
        test('should call processAudioChunk', () => {
            const spy = jest.spyOn(recordingService, 'processAudioChunk');
            const audioData = Buffer.from('test');
            const timestamp = 1500;

            recordingService.emitAudioChunk(audioData, timestamp);

            expect(spy).toHaveBeenCalledWith(audioData, timestamp);
        });
    });

    describe('getStreamingStatus', () => {
        test('should return correct streaming status', () => {
            const options = { chunkSize: 4000, overlapSize: 750 };
            recordingService.enableStreamingMode(options);
            recordingService.isRecording = true; // Enable recording so chunks are processed
            recordingService.processAudioChunk(Buffer.from('test1'), 1000);
            recordingService.processAudioChunk(Buffer.from('test2'), 2000);

            const status = recordingService.getStreamingStatus();

            expect(status).toEqual({
                isStreamingMode: true,
                chunkSize: 4000,
                overlapSize: 750,
                chunksProcessed: 2,
                lastChunkTime: 2000,
                streamingOptions: options
            });
        });

        test('should return correct status when streaming disabled', () => {
            const status = recordingService.getStreamingStatus();

            expect(status).toEqual({
                isStreamingMode: false,
                chunkSize: 3000,
                overlapSize: 500,
                chunksProcessed: 0,
                lastChunkTime: 0,
                streamingOptions: null
            });
        });
    });

    describe('getAudioChunks', () => {
        test('should return copy of audio chunks', () => {
            recordingService.enableStreamingMode();
            recordingService.isRecording = true;

            recordingService.processAudioChunk(Buffer.from('test1'), 1000);
            recordingService.processAudioChunk(Buffer.from('test2'), 2000);

            const chunks = recordingService.getAudioChunks();

            expect(chunks).toHaveLength(2);
            expect(chunks).not.toBe(recordingService.audioChunks); // Should be a copy
        });
    });

    describe('clearAudioChunks', () => {
        beforeEach(() => {
            recordingService.enableStreamingMode();
            recordingService.isRecording = true;

            // Add test chunks
            for (let i = 0; i < 15; i++) {
                recordingService.processAudioChunk(Buffer.from(`test${i}`), i * 1000);
            }
        });

        test('should clear old chunks keeping specified number', () => {
            expect(recordingService.audioChunks).toHaveLength(15);

            recordingService.clearAudioChunks(5);

            expect(recordingService.audioChunks).toHaveLength(5);
            // Should keep the last 5 chunks
            expect(recordingService.audioChunks[0].data.toString()).toContain('test10');
            expect(recordingService.audioChunks[4].data.toString()).toContain('test14');
        });

        test('should not clear if below threshold', () => {
            recordingService.clearAudioChunks(20);
            expect(recordingService.audioChunks).toHaveLength(15);
        });

        test('should use default keepLast value', () => {
            recordingService.clearAudioChunks();
            expect(recordingService.audioChunks).toHaveLength(10);
        });
    });

    describe('getChunkTiming', () => {
        test('should return correct chunk timing configuration', () => {
            recordingService.enableStreamingMode({
                chunkSize: 4000,
                overlapSize: 600
            });

            const timing = recordingService.getChunkTiming();

            expect(timing).toEqual({
                chunkSize: 4000,
                overlapSize: 600,
                intervalMs: 3400, // chunkSize - overlapSize
                bufferSize: expect.any(Number)
            });
        });

        test('should calculate buffer size correctly', () => {
            recordingService.settings.sampleRate = 22050;
            recordingService.enableStreamingMode({ chunkSize: 2000 });

            const timing = recordingService.getChunkTiming();

            expect(timing.bufferSize).toBeGreaterThan(0);
            expect(timing.bufferSize).toBeLessThanOrEqual(8192);
        });
    });

    describe('calculateBufferSize', () => {
        test('should calculate optimal buffer size', () => {
            recordingService.settings.sampleRate = 44100;
            recordingService.chunkSize = 3000;

            const bufferSize = recordingService.calculateBufferSize();

            expect(bufferSize).toBeGreaterThan(0);
            expect(bufferSize).toBeLessThanOrEqual(8192);
            // Should be power of 2
            expect(Math.log2(bufferSize) % 1).toBe(0);
        });

        test('should cap buffer size at 8192', () => {
            recordingService.settings.sampleRate = 96000;
            recordingService.chunkSize = 10000;

            const bufferSize = recordingService.calculateBufferSize();

            expect(bufferSize).toBe(8192);
        });
    });

    describe('updateStreamingConfig', () => {
        test('should update streaming configuration', () => {
            recordingService.updateStreamingConfig({
                chunkSize: 4500,
                overlapSize: 800
            });

            expect(recordingService.chunkSize).toBe(4500);
            expect(recordingService.overlapSize).toBe(800);
        });

        test('should enforce minimum and maximum values', () => {
            recordingService.updateStreamingConfig({
                chunkSize: 500, // Below minimum
                overlapSize: 6000 // Above half of chunkSize
            });

            expect(recordingService.chunkSize).toBe(1000); // Minimum enforced
            expect(recordingService.overlapSize).toBe(500); // Capped at half of chunkSize
        });

        test('should not update during recording', () => {
            recordingService.isRecording = true;
            const originalChunkSize = recordingService.chunkSize;

            recordingService.updateStreamingConfig({ chunkSize: 5000 });

            expect(recordingService.chunkSize).toBe(originalChunkSize);
        });
    });

    describe('reset', () => {
        test('should reset streaming properties', () => {
            recordingService.enableStreamingMode();
            recordingService.processAudioChunk(Buffer.from('test'), 1000);

            recordingService.reset();

            expect(recordingService.isStreamingMode).toBe(false);
            expect(recordingService.audioChunks).toEqual([]);
            expect(recordingService.lastChunkTime).toBe(0);
            expect(recordingService.streamingOptions).toBeNull();
        });

        test('should reset original recording properties', () => {
            recordingService.isRecording = true;
            recordingService.isPaused = true;
            recordingService.recordingId = 'test_id';
            recordingService.startTime = 12345;

            recordingService.reset();

            expect(recordingService.isRecording).toBe(false);
            expect(recordingService.isPaused).toBe(false);
            expect(recordingService.recordingId).toBeNull();
            expect(recordingService.startTime).toBeNull();
        });
    });

    describe('Integration with Existing Recording Methods', () => {
        test('should maintain existing startRecording functionality', async () => {
            const result = await recordingService.startRecording();

            expect(result.success).toBe(true);
            expect(result.recordingId).toBeDefined();
            expect(recordingService.isRecording).toBe(true);
            expect(recordingService.isStreamingMode).toBe(false); // Should not enable streaming by default
        });

        test('should maintain existing stopRecording functionality', async () => {
            const audioData = Buffer.from('mock audio data');
            
            await recordingService.startRecording();
            const result = await recordingService.stopRecording(audioData);

            expect(result.success).toBe(true);
            expect(result.recording).toBeDefined();
            expect(recordingService.isRecording).toBe(false);
        });

        test('should include streaming data in status', async () => {
            recordingService.enableStreamingMode();
            await recordingService.startRecording();

            const status = recordingService.getStatus();

            expect(status.isRecording).toBe(true);
            expect(status.settings).toBeDefined();
            // Streaming status should be available separately
            const streamingStatus = recordingService.getStreamingStatus();
            expect(streamingStatus.isStreamingMode).toBe(true);
        });
    });

    describe('Event Emission', () => {
        test('should emit audio-chunk events with correct data structure', () => {
            const eventSpy = jest.fn();
            recordingService.on('audio-chunk', eventSpy);

            recordingService.enableStreamingMode();
            recordingService.isRecording = true;

            const audioData = Buffer.from('test audio');
            const timestamp = 2500;

            recordingService.processAudioChunk(audioData, timestamp);

            expect(eventSpy).toHaveBeenCalledWith({
                audioData: audioData,
                timestamp: timestamp,
                chunkId: expect.stringMatching(/^chunk_\d+_\d+$/)
            });
        });

        test('should emit chunk-error events on processing errors', () => {
            const errorSpy = jest.fn();
            recordingService.on('chunk-error', errorSpy);

            recordingService.enableStreamingMode();
            recordingService.isRecording = true;

            // Simulate error by making audioData.byteLength undefined
            const invalidAudioData = { invalid: 'data' };
            recordingService.processAudioChunk(invalidAudioData, 1000);

            expect(errorSpy).toHaveBeenCalledWith({
                error: expect.any(String),
                timestamp: 1000
            });
        });
    });

    describe('Memory Management', () => {
        test('should handle large numbers of chunks efficiently', () => {
            recordingService.enableStreamingMode();
            recordingService.isRecording = true;

            // Process many chunks
            for (let i = 0; i < 100; i++) {
                recordingService.processAudioChunk(Buffer.from(`chunk${i}`), i * 100);
            }

            expect(recordingService.audioChunks).toHaveLength(100);

            // Clear old chunks
            recordingService.clearAudioChunks(10);
            expect(recordingService.audioChunks).toHaveLength(10);

            // Verify memory usage is reasonable
            const totalSize = recordingService.audioChunks.reduce(
                (sum, chunk) => sum + chunk.size, 0
            );
            expect(totalSize).toBeLessThan(1000); // Should be small test chunks
        });
    });

    describe('Performance Characteristics', () => {
        test('should process chunks with minimal latency', () => {
            recordingService.enableStreamingMode();
            recordingService.isRecording = true;

            const start = Date.now();
            
            // Process multiple chunks quickly
            for (let i = 0; i < 10; i++) {
                recordingService.processAudioChunk(Buffer.from(`chunk${i}`), i * 100);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100); // Should be very fast
        });

        test('should maintain timing accuracy', () => {
            recordingService.enableStreamingMode();
            recordingService.isRecording = true;

            const timestamps = [1000, 2000, 3000, 4000, 5000];
            
            timestamps.forEach(timestamp => {
                recordingService.processAudioChunk(Buffer.from('test'), timestamp);
            });

            recordingService.audioChunks.forEach((chunk, index) => {
                expect(chunk.timestamp).toBe(timestamps[index]);
            });

            expect(recordingService.lastChunkTime).toBe(5000);
        });
    });
});