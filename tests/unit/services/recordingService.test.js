/**
 * Recording Service Unit Tests
 */

const RecordingService = require('../../../src/services/recordingService');
const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');
jest.mock('path');

describe('RecordingService', () => {
    let recordingService;

    beforeEach(() => {
        recordingService = new RecordingService();
        jest.clearAllMocks();
    });

    afterEach(() => {
        recordingService.reset();
    });

    describe('Constructor', () => {
        test('should initialize with default settings', () => {
            expect(recordingService.isRecording).toBe(false);
            expect(recordingService.isPaused).toBe(false);
            expect(recordingService.recordingData).toBeNull();
            expect(recordingService.startTime).toBeNull();
            expect(recordingService.duration).toBe(0);
            expect(recordingService.recordingId).toBeNull();
            
            const settings = recordingService.getSettings();
            expect(settings).toEqual({
                quality: 'medium',
                format: 'wav',
                autoTranscribe: true,
                sampleRate: 44100,
                channels: 1,
                bitDepth: 16
            });
        });
    });

    describe('startRecording', () => {
        test('should start recording successfully', async () => {
            const result = await recordingService.startRecording();
            
            expect(result.success).toBe(true);
            expect(result.recordingId).toBeDefined();
            expect(result.startTime).toBeDefined();
            expect(result.settings).toBeDefined();
            expect(recordingService.isRecording).toBe(true);
            expect(recordingService.isPaused).toBe(false);
        });

        test('should start recording with custom options', async () => {
            const options = { quality: 'high', format: 'webm' };
            const result = await recordingService.startRecording(options);
            
            expect(result.success).toBe(true);
            expect(result.settings.quality).toBe('high');
            expect(result.settings.format).toBe('webm');
        });

        test('should throw error if recording already in progress', async () => {
            await recordingService.startRecording();
            
            await expect(recordingService.startRecording())
                .rejects.toThrow('Failed to start recording: Recording already in progress');
        });

        test('should generate unique recording IDs', async () => {
            const result1 = await recordingService.startRecording();
            recordingService.reset();
            const result2 = await recordingService.startRecording();
            
            expect(result1.recordingId).not.toBe(result2.recordingId);
        });
    });

    describe('pauseRecording', () => {
        test('should pause recording successfully', async () => {
            await recordingService.startRecording();
            const result = await recordingService.pauseRecording();
            
            expect(result.success).toBe(true);
            expect(result.recordingId).toBeDefined();
            expect(result.pausedAt).toBeDefined();
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(recordingService.isPaused).toBe(true);
            expect(recordingService.isRecording).toBe(true);
        });

        test('should throw error if no active recording', async () => {
            await expect(recordingService.pauseRecording())
                .rejects.toThrow('Failed to pause recording: No active recording to pause');
        });

        test('should throw error if already paused', async () => {
            await recordingService.startRecording();
            await recordingService.pauseRecording();
            
            await expect(recordingService.pauseRecording())
                .rejects.toThrow('Failed to pause recording: No active recording to pause');
        });
    });

    describe('resumeRecording', () => {
        test('should resume recording successfully', async () => {
            await recordingService.startRecording();
            await recordingService.pauseRecording();
            const result = await recordingService.resumeRecording();
            
            expect(result.success).toBe(true);
            expect(result.recordingId).toBeDefined();
            expect(result.resumedAt).toBeDefined();
            expect(recordingService.isPaused).toBe(false);
            expect(recordingService.isRecording).toBe(true);
        });

        test('should throw error if no paused recording', async () => {
            await expect(recordingService.resumeRecording())
                .rejects.toThrow('Failed to resume recording: No paused recording to resume');
        });

        test('should throw error if not paused', async () => {
            await recordingService.startRecording();
            
            await expect(recordingService.resumeRecording())
                .rejects.toThrow('Failed to resume recording: No paused recording to resume');
        });
    });

    describe('stopRecording', () => {
        test('should stop recording successfully', async () => {
            await recordingService.startRecording();
            const audioData = Buffer.from('test audio data');
            const result = await recordingService.stopRecording(audioData);
            
            expect(result.success).toBe(true);
            expect(result.recording).toBeDefined();
            expect(result.recording.id).toBeDefined();
            expect(result.recording.duration).toBeGreaterThanOrEqual(0);
            expect(result.recording.size).toBe(audioData.length);
            expect(result.hasAudioData).toBe(true);
            expect(recordingService.isRecording).toBe(false);
            expect(recordingService.isPaused).toBe(false);
        });

        test('should stop recording without audio data', async () => {
            await recordingService.startRecording();
            const result = await recordingService.stopRecording();
            
            expect(result.success).toBe(true);
            expect(result.hasAudioData).toBe(false);
            expect(result.recording.size).toBe(0);
        });

        test('should throw error if no active recording', async () => {
            await expect(recordingService.stopRecording())
                .rejects.toThrow('Failed to stop recording: No active recording to stop');
        });

        test('should add recording to history', async () => {
            await recordingService.startRecording();
            await recordingService.stopRecording();
            
            const history = recordingService.getRecordingHistory();
            expect(history).toHaveLength(1);
            expect(history[0].id).toBeDefined();
        });
    });

    describe('saveRecording', () => {
        beforeEach(() => {
            fs.existsSync.mockReturnValue(true);
            fs.mkdirSync.mockImplementation(() => {});
            fs.writeFileSync.mockImplementation(() => {});
            fs.statSync.mockReturnValue({ size: 1024 });
            path.dirname.mockReturnValue('/test/dir');
        });

        test('should save recording successfully', async () => {
            const audioData = Buffer.from('test audio data');
            const filePath = '/test/recording.wav';
            
            const result = await recordingService.saveRecording(audioData, filePath);
            
            expect(result.success).toBe(true);
            expect(result.filePath).toBe(filePath);
            expect(result.size).toBe(1024);
            expect(result.savedAt).toBeDefined();
            expect(fs.writeFileSync).toHaveBeenCalledWith(filePath, audioData);
        });

        test('should save ArrayBuffer data', async () => {
            const arrayBuffer = new ArrayBuffer(16);
            const filePath = '/test/recording.wav';
            
            const result = await recordingService.saveRecording(arrayBuffer, filePath);
            
            expect(result.success).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith(filePath, Buffer.from(arrayBuffer));
        });

        test('should create directory if it does not exist', async () => {
            fs.existsSync.mockReturnValue(false);
            const audioData = Buffer.from('test audio data');
            const filePath = '/test/new/recording.wav';
            
            await recordingService.saveRecording(audioData, filePath);
            
            expect(fs.mkdirSync).toHaveBeenCalledWith('/test/dir', { recursive: true });
        });

        test('should throw error if no audio data', async () => {
            await expect(recordingService.saveRecording(null, '/test/recording.wav'))
                .rejects.toThrow('Failed to save recording: No audio data to save');
        });

        test('should throw error for invalid audio data format', async () => {
            await expect(recordingService.saveRecording('invalid', '/test/recording.wav'))
                .rejects.toThrow('Failed to save recording: Invalid audio data format');
        });
    });

    describe('getStatus', () => {
        test('should return correct status when not recording', () => {
            const status = recordingService.getStatus();
            
            expect(status.isRecording).toBe(false);
            expect(status.isPaused).toBe(false);
            expect(status.recordingId).toBeNull();
            expect(status.duration).toBe(0);
            expect(status.settings).toBeDefined();
            expect(status.hasData).toBe(false);
        });

        test('should return correct status when recording', async () => {
            await recordingService.startRecording();
            const status = recordingService.getStatus();
            
            expect(status.isRecording).toBe(true);
            expect(status.isPaused).toBe(false);
            expect(status.recordingId).toBeDefined();
            expect(status.duration).toBeGreaterThanOrEqual(0);
        });

        test('should return correct status when paused', async () => {
            await recordingService.startRecording();
            await recordingService.pauseRecording();
            const status = recordingService.getStatus();
            
            expect(status.isRecording).toBe(true);
            expect(status.isPaused).toBe(true);
        });
    });

    describe('updateSettings', () => {
        test('should update settings successfully', () => {
            const newSettings = { quality: 'high', format: 'webm', autoTranscribe: false };
            const result = recordingService.updateSettings(newSettings);
            
            expect(result.quality).toBe('high');
            expect(result.format).toBe('webm');
            expect(result.autoTranscribe).toBe(false);
            expect(result.sampleRate).toBe(44100); // Updated based on quality
            expect(result.channels).toBe(2); // Updated based on quality
        });

        test('should throw error if recording in progress', async () => {
            await recordingService.startRecording();
            
            expect(() => recordingService.updateSettings({ quality: 'high' }))
                .toThrow('Cannot update settings during recording');
        });

        test('should throw error for invalid quality', () => {
            expect(() => recordingService.updateSettings({ quality: 'invalid' }))
                .toThrow('Invalid quality setting. Must be one of: low, medium, high');
        });

        test('should throw error for invalid format', () => {
            expect(() => recordingService.updateSettings({ format: 'invalid' }))
                .toThrow('Invalid format setting. Must be one of: wav, webm, mp3');
        });

        test('should update technical settings based on quality', () => {
            recordingService.updateSettings({ quality: 'low' });
            let settings = recordingService.getSettings();
            expect(settings.sampleRate).toBe(16000);
            expect(settings.channels).toBe(1);

            recordingService.updateSettings({ quality: 'medium' });
            settings = recordingService.getSettings();
            expect(settings.sampleRate).toBe(22050);
            expect(settings.channels).toBe(1);

            recordingService.updateSettings({ quality: 'high' });
            settings = recordingService.getSettings();
            expect(settings.sampleRate).toBe(44100);
            expect(settings.channels).toBe(2);
        });
    });

    describe('getRecordingConstraints', () => {
        test('should return correct constraints', () => {
            const constraints = recordingService.getRecordingConstraints();
            
            expect(constraints.audio).toBeDefined();
            expect(constraints.audio.sampleRate).toBe(44100);
            expect(constraints.audio.channelCount).toBe(1);
            expect(constraints.audio.echoCancellation).toBe(true);
            expect(constraints.audio.noiseSuppression).toBe(true);
            expect(constraints.audio.autoGainControl).toBe(true);
        });

        test('should update constraints when settings change', () => {
            recordingService.updateSettings({ quality: 'high' });
            const constraints = recordingService.getRecordingConstraints();
            
            expect(constraints.audio.sampleRate).toBe(44100);
            expect(constraints.audio.channelCount).toBe(2);
        });
    });

    describe('getMimeType', () => {
        test('should return correct MIME type for wav', () => {
            recordingService.updateSettings({ format: 'wav' });
            expect(recordingService.getMimeType()).toBe('audio/wav');
        });

        test('should return correct MIME type for webm', () => {
            recordingService.updateSettings({ format: 'webm' });
            expect(recordingService.getMimeType()).toBe('audio/webm;codecs=opus');
        });

        test('should return correct MIME type for mp3', () => {
            recordingService.updateSettings({ format: 'mp3' });
            expect(recordingService.getMimeType()).toBe('audio/mpeg');
        });
    });

    describe('validateRecording', () => {
        test('should validate valid recording', () => {
            const audioData = Buffer.alloc(32000); // 2 seconds at 16kHz
            const result = recordingService.validateRecording(audioData);
            
            expect(result.valid).toBe(true);
            expect(result.size).toBe(32000);
            expect(result.estimatedDuration).toBeGreaterThan(0);
        });

        test('should reject null data', () => {
            const result = recordingService.validateRecording(null);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('No audio data provided');
        });

        test('should reject empty data', () => {
            const audioData = Buffer.alloc(0);
            const result = recordingService.validateRecording(audioData);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Audio data is empty');
        });

        test('should reject too short recording', () => {
            const audioData = Buffer.alloc(1000); // Too small
            const result = recordingService.validateRecording(audioData);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Recording too short');
        });

        test('should reject too long recording', () => {
            const audioData = Buffer.alloc(44100 * 2 * 2 * 700); // Too large (over 10 minutes)
            const result = recordingService.validateRecording(audioData);
            
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Recording too long');
        });
    });

    describe('estimateDuration', () => {
        test('should estimate duration correctly', () => {
            recordingService.updateSettings({ quality: 'medium' }); // 22050 Hz, 1 channel, 16-bit
            const size = 22050 * 1 * 2 * 5; // 5 seconds of audio
            const duration = recordingService.estimateDuration(size);
            
            expect(duration).toBe(5000); // 5 seconds in milliseconds
        });
    });

    describe('getCurrentDuration', () => {
        test('should return 0 when not recording', () => {
            expect(recordingService.getCurrentDuration()).toBe(0);
        });

        test('should return current duration when recording', async () => {
            await recordingService.startRecording();
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const duration = recordingService.getCurrentDuration();
            expect(duration).toBeGreaterThan(0);
        });

        test('should return paused duration when paused', async () => {
            await recordingService.startRecording();
            await new Promise(resolve => setTimeout(resolve, 10));
            await recordingService.pauseRecording();
            
            const duration = recordingService.getCurrentDuration();
            expect(duration).toBeGreaterThan(0);
        });
    });

    describe('getRecordingHistory', () => {
        test('should return empty history initially', () => {
            const history = recordingService.getRecordingHistory();
            expect(history).toEqual([]);
        });

        test('should track recording history', async () => {
            await recordingService.startRecording();
            await recordingService.stopRecording();
            
            await recordingService.startRecording();
            await recordingService.stopRecording();
            
            const history = recordingService.getRecordingHistory();
            expect(history).toHaveLength(2);
        });

        test('should clear recording history', async () => {
            await recordingService.startRecording();
            await recordingService.stopRecording();
            
            recordingService.clearRecordingHistory();
            const history = recordingService.getRecordingHistory();
            expect(history).toEqual([]);
        });
    });

    describe('reset', () => {
        test('should reset all state', async () => {
            await recordingService.startRecording();
            recordingService.recordingData = Buffer.from('test');
            
            recordingService.reset();
            
            expect(recordingService.isRecording).toBe(false);
            expect(recordingService.isPaused).toBe(false);
            expect(recordingService.recordingData).toBeNull();
            expect(recordingService.startTime).toBeNull();
            expect(recordingService.duration).toBe(0);
            expect(recordingService.recordingId).toBeNull();
        });
    });
});