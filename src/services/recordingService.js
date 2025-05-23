/**
 * Recording Service - Handles audio recording functionality and coordination
 * This service manages recording state and provides utilities for recording operations
 */

const fs = require('fs');
const path = require('path');

class RecordingService {
    constructor() {
        this.isRecording = false;
        this.isPaused = false;
        this.recordingData = null;
        this.startTime = null;
        this.pausedTime = 0;
        this.duration = 0;
        this.recordingId = null;
        this.settings = {
            quality: 'medium',
            format: 'wav',
            autoTranscribe: true,
            sampleRate: 44100,
            channels: 1,
            bitDepth: 16
        };
        this.recordingHistory = [];
    }

    /**
     * Start audio recording session
     * @param {Object} options - Recording options
     * @returns {Promise<Object>} - Recording session info
     */
    async startRecording(options = {}) {
        try {
            if (this.isRecording) {
                throw new Error('Recording already in progress');
            }

            // Merge options with default settings
            const recordingSettings = { ...this.settings, ...options };
            
            // Generate unique recording ID
            this.recordingId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            this.isRecording = true;
            this.isPaused = false;
            this.startTime = Date.now();
            this.pausedTime = 0;
            this.recordingData = null;

            console.log(`Recording session started: ${this.recordingId}`);
            
            return {
                success: true,
                recordingId: this.recordingId,
                settings: recordingSettings,
                startTime: this.startTime
            };
        } catch (error) {
            throw new Error(`Failed to start recording: ${error.message}`);
        }
    }

    /**
     * Pause audio recording
     * @returns {Promise<Object>} - Pause status
     */
    async pauseRecording() {
        try {
            if (!this.isRecording || this.isPaused) {
                throw new Error('No active recording to pause');
            }

            this.isPaused = true;
            this.pausedTime = Date.now();
            
            console.log(`Recording paused: ${this.recordingId}`);
            
            return {
                success: true,
                recordingId: this.recordingId,
                pausedAt: this.pausedTime,
                duration: this.getCurrentDuration()
            };
        } catch (error) {
            throw new Error(`Failed to pause recording: ${error.message}`);
        }
    }

    /**
     * Resume audio recording
     * @returns {Promise<Object>} - Resume status
     */
    async resumeRecording() {
        try {
            if (!this.isRecording || !this.isPaused) {
                throw new Error('No paused recording to resume');
            }

            // Add paused duration to total paused time
            if (this.pausedTime) {
                this.pausedTime = Date.now() - this.pausedTime;
            }
            
            this.isPaused = false;
            
            console.log(`Recording resumed: ${this.recordingId}`);
            
            return {
                success: true,
                recordingId: this.recordingId,
                resumedAt: Date.now()
            };
        } catch (error) {
            throw new Error(`Failed to resume recording: ${error.message}`);
        }
    }

    /**
     * Stop audio recording
     * @param {Buffer|ArrayBuffer} audioData - Recorded audio data
     * @returns {Promise<Object>} - Recording result
     */
    async stopRecording(audioData = null) {
        try {
            if (!this.isRecording) {
                throw new Error('No active recording to stop');
            }

            const endTime = Date.now();
            this.duration = endTime - this.startTime - this.pausedTime;
            
            // Store recording ID before resetting
            const recordingId = this.recordingId;
            
            this.isRecording = false;
            this.isPaused = false;
            this.recordingId = null;

            // Store recording data if provided
            if (audioData) {
                this.recordingData = audioData;
            }

            // Create recording info
            const recordingInfo = {
                id: recordingId,
                startTime: this.startTime,
                endTime: endTime,
                duration: this.duration,
                settings: { ...this.settings },
                size: audioData ? (audioData.byteLength || audioData.length || 0) : 0,
                format: this.settings.format
            };

            // Add to recording history
            this.recordingHistory.push(recordingInfo);

            console.log(`Recording stopped: ${recordingId}, Duration: ${this.duration}ms`);
            
            return {
                success: true,
                recording: recordingInfo,
                hasAudioData: !!audioData
            };
        } catch (error) {
            throw new Error(`Failed to stop recording: ${error.message}`);
        }
    }

    /**
     * Save recording to file
     * @param {Buffer|ArrayBuffer} audioData - Audio data to save
     * @param {string} filePath - File path to save to
     * @returns {Promise<Object>} - Save result
     */
    async saveRecording(audioData, filePath) {
        try {
            if (!audioData) {
                throw new Error('No audio data to save');
            }

            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Convert ArrayBuffer to Buffer if needed
            let buffer;
            if (audioData instanceof ArrayBuffer) {
                buffer = Buffer.from(audioData);
            } else if (Buffer.isBuffer(audioData)) {
                buffer = audioData;
            } else {
                throw new Error('Invalid audio data format');
            }

            // Write file
            fs.writeFileSync(filePath, buffer);

            const stats = fs.statSync(filePath);
            
            return {
                success: true,
                filePath,
                size: stats.size,
                savedAt: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`Failed to save recording: ${error.message}`);
        }
    }

    /**
     * Get current recording status
     * @returns {Object} - Recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            recordingId: this.recordingId,
            duration: this.getCurrentDuration(),
            settings: { ...this.settings },
            hasData: !!this.recordingData
        };
    }

    /**
     * Get current recording duration
     * @returns {number} - Duration in milliseconds
     */
    getCurrentDuration() {
        if (!this.isRecording) {
            return this.duration;
        }
        
        const currentTime = Date.now();
        if (this.isPaused) {
            return this.pausedTime - this.startTime;
        }
        
        return currentTime - this.startTime - this.pausedTime;
    }

    /**
     * Get recording settings
     * @returns {Object} - Recording settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Update recording settings
     * @param {Object} newSettings - New settings
     * @returns {Object} - Updated settings
     */
    updateSettings(newSettings) {
        if (this.isRecording) {
            throw new Error('Cannot update settings during recording');
        }

        // Validate settings
        const validQualities = ['low', 'medium', 'high'];
        const validFormats = ['wav', 'webm', 'mp3'];

        if (newSettings.quality && !validQualities.includes(newSettings.quality)) {
            throw new Error(`Invalid quality setting. Must be one of: ${validQualities.join(', ')}`);
        }

        if (newSettings.format && !validFormats.includes(newSettings.format)) {
            throw new Error(`Invalid format setting. Must be one of: ${validFormats.join(', ')}`);
        }

        // Update settings
        this.settings = { ...this.settings, ...newSettings };

        // Update technical settings based on quality
        this.updateTechnicalSettings();

        console.log('Recording settings updated:', this.settings);
        return { ...this.settings };
    }

    /**
     * Update technical settings based on quality
     * @private
     */
    updateTechnicalSettings() {
        switch (this.settings.quality) {
        case 'high':
            this.settings.sampleRate = 44100;
            this.settings.channels = 2;
            this.settings.bitDepth = 16;
            break;
        case 'medium':
            this.settings.sampleRate = 22050;
            this.settings.channels = 1;
            this.settings.bitDepth = 16;
            break;
        case 'low':
            this.settings.sampleRate = 16000;
            this.settings.channels = 1;
            this.settings.bitDepth = 16;
            break;
        }
    }

    /**
     * Get recording history
     * @returns {Array} - Array of recording info objects
     */
    getRecordingHistory() {
        return [...this.recordingHistory];
    }

    /**
     * Clear recording history
     */
    clearRecordingHistory() {
        this.recordingHistory = [];
    }

    /**
     * Get recording constraints for Web Audio API
     * @returns {Object} - MediaRecorder constraints
     */
    getRecordingConstraints() {
        return {
            audio: {
                sampleRate: this.settings.sampleRate,
                channelCount: this.settings.channels,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
    }

    /**
     * Get MIME type for recording
     * @returns {string} - MIME type
     */
    getMimeType() {
        switch (this.settings.format) {
        case 'webm':
            return 'audio/webm;codecs=opus';
        case 'mp3':
            return 'audio/mpeg';
        case 'wav':
        default:
            return 'audio/wav';
        }
    }

    /**
     * Validate recording data
     * @param {Buffer|ArrayBuffer} audioData - Audio data to validate
     * @returns {Object} - Validation result
     */
    validateRecording(audioData) {
        if (!audioData) {
            return { valid: false, error: 'No audio data provided' };
        }

        const size = audioData.byteLength || audioData.length || 0;
        
        if (size === 0) {
            return { valid: false, error: 'Audio data is empty' };
        }

        // Check minimum size (1 second of audio at lowest quality)
        const minSize = 16000; // 16kHz * 1 channel * 1 byte * 1 second
        if (size < minSize) {
            return { valid: false, error: 'Recording too short' };
        }

        // Check maximum size (10 minutes at highest quality)
        const maxSize = 44100 * 2 * 2 * 600; // 44.1kHz * 2 channels * 2 bytes * 600 seconds
        if (size > maxSize) {
            return { valid: false, error: 'Recording too long' };
        }

        return { 
            valid: true, 
            size,
            estimatedDuration: this.estimateDuration(size)
        };
    }

    /**
     * Estimate recording duration from size
     * @param {number} size - Audio data size in bytes
     * @returns {number} - Estimated duration in milliseconds
     */
    estimateDuration(size) {
        const bytesPerSecond = this.settings.sampleRate * this.settings.channels * (this.settings.bitDepth / 8);
        return (size / bytesPerSecond) * 1000;
    }

    /**
     * Reset recording service state
     */
    reset() {
        this.isRecording = false;
        this.isPaused = false;
        this.recordingData = null;
        this.startTime = null;
        this.pausedTime = 0;
        this.duration = 0;
        this.recordingId = null;
    }
}

module.exports = RecordingService;