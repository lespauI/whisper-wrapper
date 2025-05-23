/**
 * Recording Integration Tests
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const IPCHandlers = require('../../src/main/ipcHandlers');

// Mock Electron modules
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => '/tmp'),
        getVersion: jest.fn(() => '1.0.0'),
        whenReady: jest.fn(() => Promise.resolve()),
        on: jest.fn(),
        quit: jest.fn()
    },
    BrowserWindow: jest.fn(() => ({
        loadFile: jest.fn(),
        on: jest.fn(),
        webContents: {
            openDevTools: jest.fn()
        }
    })),
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    },
    dialog: {
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn()
    },
    shell: {
        openPath: jest.fn()
    }
}));

// Mock electron-store
jest.mock('electron-store', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn((key, defaultValue) => defaultValue),
        set: jest.fn(),
        has: jest.fn(() => false),
        delete: jest.fn(),
        clear: jest.fn(),
        size: 0,
        store: {}
    }));
});

// Mock file system
jest.mock('fs');
jest.mock('path');

describe('Recording Integration Tests', () => {
    let ipcHandlers;
    let mockEvent;

    beforeEach(() => {
        jest.clearAllMocks();
        ipcHandlers = new IPCHandlers();
        mockEvent = {
            sender: {
                send: jest.fn()
            }
        };
    });

    describe('Recording Workflow', () => {
        test('should handle complete recording workflow', async () => {
            // Start recording
            const startResult = await ipcHandlers.handleStartRecording(mockEvent, { quality: 'medium' });
            expect(startResult.success).toBe(true);
            expect(startResult.recordingId).toBeDefined();
            expect(startResult.settings.quality).toBe('medium');

            // Check status
            const status = await ipcHandlers.handleGetRecordingStatus();
            expect(status.isRecording).toBe(true);
            expect(status.isPaused).toBe(false);
            expect(status.recordingId).toBe(startResult.recordingId);

            // Pause recording
            const pauseResult = await ipcHandlers.handlePauseRecording();
            expect(pauseResult.success).toBe(true);
            expect(pauseResult.recordingId).toBe(startResult.recordingId);

            // Check paused status
            const pausedStatus = await ipcHandlers.handleGetRecordingStatus();
            expect(pausedStatus.isRecording).toBe(true);
            expect(pausedStatus.isPaused).toBe(true);

            // Resume recording
            const resumeResult = await ipcHandlers.handleResumeRecording();
            expect(resumeResult.success).toBe(true);
            expect(resumeResult.recordingId).toBe(startResult.recordingId);

            // Check resumed status
            const resumedStatus = await ipcHandlers.handleGetRecordingStatus();
            expect(resumedStatus.isRecording).toBe(true);
            expect(resumedStatus.isPaused).toBe(false);

            // Stop recording
            const audioData = Buffer.from('test audio data');
            const stopResult = await ipcHandlers.handleStopRecording(mockEvent, audioData);
            expect(stopResult.success).toBe(true);
            expect(stopResult.recording.id).toBe(startResult.recordingId);
            expect(stopResult.hasAudioData).toBe(true);

            // Check final status
            const finalStatus = await ipcHandlers.handleGetRecordingStatus();
            expect(finalStatus.isRecording).toBe(false);
            expect(finalStatus.isPaused).toBe(false);
        });

        test('should handle recording with auto-transcription', async () => {
            // Mock transcription service
            const mockTranscriptionResult = {
                success: true,
                text: 'Test transcription',
                language: 'en',
                duration: 5000
            };
            
            // Start recording with auto-transcribe enabled
            const startResult = await ipcHandlers.handleStartRecording(mockEvent, { 
                quality: 'medium',
                autoTranscribe: true 
            });
            expect(startResult.success).toBe(true);

            // Stop recording with audio data
            const audioData = Buffer.from('test audio data');
            const stopResult = await ipcHandlers.handleStopRecording(mockEvent, audioData);
            expect(stopResult.success).toBe(true);

            // Verify recording was stored
            const history = await ipcHandlers.handleGetRecordingHistory();
            expect(history).toHaveLength(1);
            expect(history[0].id).toBe(startResult.recordingId);
        });
    });

    describe('Recording Settings Management', () => {
        test('should get and update recording settings', async () => {
            // Get default settings
            const defaultSettings = await ipcHandlers.handleGetRecordingSettings();
            expect(defaultSettings.quality).toBe('medium');
            expect(defaultSettings.format).toBe('wav');
            expect(defaultSettings.autoTranscribe).toBe(true);

            // Update settings
            const newSettings = {
                quality: 'high',
                format: 'webm',
                autoTranscribe: false
            };
            const updateResult = await ipcHandlers.handleUpdateRecordingSettings(mockEvent, newSettings);
            expect(updateResult.success).toBe(true);
            expect(updateResult.settings.quality).toBe('high');
            expect(updateResult.settings.format).toBe('webm');
            expect(updateResult.settings.autoTranscribe).toBe(false);

            // Verify settings were updated
            const updatedSettings = await ipcHandlers.handleGetRecordingSettings();
            expect(updatedSettings.quality).toBe('high');
            expect(updatedSettings.format).toBe('webm');
            expect(updatedSettings.autoTranscribe).toBe(false);
        });

        test('should reject invalid settings', async () => {
            const invalidSettings = { quality: 'invalid' };
            
            await expect(ipcHandlers.handleUpdateRecordingSettings(mockEvent, invalidSettings))
                .rejects.toThrow('Invalid quality setting');
        });

        test('should prevent settings update during recording', async () => {
            // Start recording
            await ipcHandlers.handleStartRecording(mockEvent);

            // Try to update settings
            const newSettings = { quality: 'high' };
            await expect(ipcHandlers.handleUpdateRecordingSettings(mockEvent, newSettings))
                .rejects.toThrow('Cannot update settings during recording');
        });
    });

    describe('Recording Constraints', () => {
        test('should provide recording constraints', async () => {
            const constraints = await ipcHandlers.handleGetRecordingConstraints();
            
            expect(constraints.audio).toBeDefined();
            expect(constraints.audio.sampleRate).toBeDefined();
            expect(constraints.audio.channelCount).toBeDefined();
            expect(constraints.audio.echoCancellation).toBe(true);
            expect(constraints.audio.noiseSuppression).toBe(true);
            expect(constraints.audio.autoGainControl).toBe(true);
        });

        test('should update constraints based on quality settings', async () => {
            // Set high quality
            await ipcHandlers.handleUpdateRecordingSettings(mockEvent, { quality: 'high' });
            const highConstraints = await ipcHandlers.handleGetRecordingConstraints();
            expect(highConstraints.audio.sampleRate).toBe(44100);
            expect(highConstraints.audio.channelCount).toBe(2);

            // Set low quality
            await ipcHandlers.handleUpdateRecordingSettings(mockEvent, { quality: 'low' });
            const lowConstraints = await ipcHandlers.handleGetRecordingConstraints();
            expect(lowConstraints.audio.sampleRate).toBe(16000);
            expect(lowConstraints.audio.channelCount).toBe(1);
        });
    });

    describe('Recording History', () => {
        test('should track recording history', async () => {
            // Initially empty
            let history = await ipcHandlers.handleGetRecordingHistory();
            expect(history).toHaveLength(0);

            // Record first session
            const start1 = await ipcHandlers.handleStartRecording(mockEvent);
            await ipcHandlers.handleStopRecording(mockEvent, Buffer.from('audio1'));

            history = await ipcHandlers.handleGetRecordingHistory();
            expect(history).toHaveLength(1);
            expect(history[0].id).toBe(start1.recordingId);

            // Record second session
            const start2 = await ipcHandlers.handleStartRecording(mockEvent);
            await ipcHandlers.handleStopRecording(mockEvent, Buffer.from('audio2'));

            history = await ipcHandlers.handleGetRecordingHistory();
            expect(history).toHaveLength(2);
            expect(history[1].id).toBe(start2.recordingId);
        });
    });

    describe('Error Handling', () => {
        test('should handle start recording errors', async () => {
            // Start first recording
            await ipcHandlers.handleStartRecording(mockEvent);

            // Try to start another recording
            await expect(ipcHandlers.handleStartRecording(mockEvent))
                .rejects.toThrow('Recording already in progress');
        });

        test('should handle pause recording errors', async () => {
            // Try to pause without recording
            await expect(ipcHandlers.handlePauseRecording())
                .rejects.toThrow('No active recording to pause');
        });

        test('should handle resume recording errors', async () => {
            // Try to resume without paused recording
            await expect(ipcHandlers.handleResumeRecording())
                .rejects.toThrow('No paused recording to resume');

            // Start recording and try to resume without pausing
            await ipcHandlers.handleStartRecording(mockEvent);
            await expect(ipcHandlers.handleResumeRecording())
                .rejects.toThrow('No paused recording to resume');
        });

        test('should handle stop recording errors', async () => {
            // Try to stop without recording
            await expect(ipcHandlers.handleStopRecording(mockEvent))
                .rejects.toThrow('No active recording to stop');
        });
    });

    describe('IPC Handler Registration', () => {
        test('should register all recording handlers', () => {
            const expectedHandlers = [
                'recording:start',
                'recording:pause',
                'recording:resume',
                'recording:stop',
                'recording:status',
                'recording:settings',
                'recording:updateSettings',
                'recording:history',
                'recording:constraints'
            ];

            expectedHandlers.forEach(handler => {
                expect(ipcMain.handle).toHaveBeenCalledWith(
                    handler,
                    expect.any(Function)
                );
            });
        });
    });

    describe('Recording State Consistency', () => {
        test('should maintain consistent state across operations', async () => {
            // Start recording
            const startResult = await ipcHandlers.handleStartRecording(mockEvent);
            let status = await ipcHandlers.handleGetRecordingStatus();
            expect(status.isRecording).toBe(true);
            expect(status.recordingId).toBe(startResult.recordingId);

            // Pause and check state
            await ipcHandlers.handlePauseRecording();
            status = await ipcHandlers.handleGetRecordingStatus();
            expect(status.isRecording).toBe(true);
            expect(status.isPaused).toBe(true);
            expect(status.recordingId).toBe(startResult.recordingId);

            // Resume and check state
            await ipcHandlers.handleResumeRecording();
            status = await ipcHandlers.handleGetRecordingStatus();
            expect(status.isRecording).toBe(true);
            expect(status.isPaused).toBe(false);
            expect(status.recordingId).toBe(startResult.recordingId);

            // Stop and check state
            await ipcHandlers.handleStopRecording(mockEvent);
            status = await ipcHandlers.handleGetRecordingStatus();
            expect(status.isRecording).toBe(false);
            expect(status.isPaused).toBe(false);
            expect(status.recordingId).toBeNull();
        });
    });
});