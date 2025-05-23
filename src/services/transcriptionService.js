/**
 * Transcription Service - Handles local Whisper transcription
 */

const LocalWhisperService = require('./localWhisperService');

class TranscriptionService {
    constructor() {
        this.localWhisper = new LocalWhisperService();
        this.model = 'base'; // Default local model
        this.language = 'auto'; // Auto-detect by default
    }

    /**
     * Get available models
     */
    getAvailableModels() {
        return this.localWhisper.getAvailableModels();
    }

    /**
     * Check if local Whisper is available
     */
    isAvailable() {
        return this.localWhisper.isAvailable();
    }

    /**
     * Set transcription model
     * @param {string} model - Model name
     */
    setModel(model) {
        this.model = model;
        this.localWhisper.setModel(model);
    }

    /**
     * Set language for transcription
     * @param {string} language - Language code (ISO 639-1)
     */
    setLanguage(language) {
        this.language = language;
        this.localWhisper.setLanguage(language);
    }

    /**
     * Set number of threads for transcription
     * @param {number} threads - Number of threads (1-16)
     */
    setThreads(threads) {
        this.localWhisper.setThreads(threads);
    }

    /**
     * Transcribe audio file
     * @param {string} filePath - Path to audio file
     * @param {Object} options - Transcription options
     * @returns {Promise<Object>} - Transcription result
     */
    async transcribeFile(filePath, options = {}) {
        try {
            if (!this.isAvailable()) {
                throw new Error('Local Whisper is not available. Please run the setup script first.');
            }

            const whisperOptions = {
                model: options.model || this.model,
                language: options.language || this.language,
                translate: options.translate || false,
                threads: options.threads || 4
            };

            const result = await this.localWhisper.transcribeFile(filePath, whisperOptions);
            
            return {
                success: true,
                text: result.text,
                language: result.language,
                segments: result.segments,
                model: result.model,
                duration: result.duration
            };

        } catch (error) {
            console.error('Local transcription error:', error);
            throw new Error(`Transcription failed: ${error.message}`);
        }
    }

    /**
     * Transcribe audio buffer
     * @param {Buffer} audioBuffer - Audio data buffer
     * @param {Object} options - Transcription options
     * @returns {Promise<Object>} - Transcription result
     */
    async transcribeBuffer(audioBuffer, options = {}) {
        try {
            if (!this.isAvailable()) {
                throw new Error('Local Whisper is not available. Please run the setup script first.');
            }

            const whisperOptions = {
                model: options.model || this.model,
                language: options.language || this.language,
                translate: options.translate || false,
                threads: options.threads || 4
            };

            const result = await this.localWhisper.transcribeBuffer(audioBuffer, whisperOptions);
            
            return {
                success: true,
                text: result.text,
                language: result.language,
                segments: result.segments,
                model: result.model,
                duration: result.duration
            };

        } catch (error) {
            console.error('Local transcription error:', error);
            throw new Error(`Transcription failed: ${error.message}`);
        }
    }

    /**
     * Test API connection (for local Whisper, test installation)
     * @returns {Promise<Object>} - Test result
     */
    async testConnection() {
        try {
            const result = await this.localWhisper.testInstallation();
            
            if (result.success) {
                return {
                    success: true,
                    message: 'Local Whisper is working correctly',
                    details: {
                        whisperPath: result.whisperPath,
                        modelsPath: result.modelsPath,
                        availableModels: result.models
                    }
                };
            } else {
                return {
                    success: false,
                    message: result.error
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Test failed: ${error.message}`
            };
        }
    }

    /**
     * Get transcription settings
     * @returns {Object} - Current settings
     */
    getSettings() {
        return {
            model: this.model,
            language: this.language,
            availableModels: this.getAvailableModels(),
            isAvailable: this.isAvailable()
        };
    }

    /**
     * Update transcription settings
     * @param {Object} settings - New settings
     */
    updateSettings(settings) {
        if (settings.model) {
            this.setModel(settings.model);
        }
        if (settings.language) {
            this.setLanguage(settings.language);
        }
    }

    /**
     * Clean up temporary files
     */
    cleanup() {
        this.localWhisper.cleanup();
    }
}

module.exports = TranscriptionService;