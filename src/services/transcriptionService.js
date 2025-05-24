/**
 * Transcription Service - Handles local Whisper transcription
 */

const LocalWhisperService = require('./localWhisperService');
const TranscriptionFormatter = require('./transcriptionFormatter');

class TranscriptionService {
    constructor() {
        console.log('🎯 TranscriptionService: Initializing...');
        this.localWhisper = new LocalWhisperService();
        this.formatter = new TranscriptionFormatter();
        this.model = 'base'; // Default local model
        this.language = 'auto'; // Auto-detect by default
        
        console.log('🎯 TranscriptionService: Configuration:');
        console.log(`   - Default model: ${this.model}`);
        console.log(`   - Default language: ${this.language}`);
        console.log(`   - Local Whisper available: ${this.isAvailable()}`);
        console.log('✅ TranscriptionService: Initialization complete');
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
        console.log('🎯 TranscriptionService: Starting file transcription...');
        console.log(`📁 File path: ${filePath}`);
        console.log(`⚙️ Options:`, options);
        
        try {
            if (!this.isAvailable()) {
                console.log('❌ TranscriptionService: Local Whisper is not available');
                throw new Error('Local Whisper is not available. Please run the setup script first.');
            }

            const whisperOptions = {
                model: options.model || this.model,
                language: options.language || this.language,
                translate: options.translate || false,
                threads: options.threads || 4
            };

            console.log('🎯 TranscriptionService: Calling LocalWhisperService with options:', whisperOptions);
            const result = await this.localWhisper.transcribeFile(filePath, whisperOptions);
            
            console.log('🎯 TranscriptionService: Received result from LocalWhisperService:', {
                success: result.success,
                textLength: result.text?.length || 0,
                language: result.language,
                model: result.model,
                segmentsCount: result.segments?.length || 0
            });

            // Format the transcription with timestamps and sections
            console.log('📝 TranscriptionService: Formatting transcription...');
            const formattedResult = this.formatter.formatTranscription(result);
            
            const finalResult = {
                success: true,
                text: result.text,
                markdown: formattedResult.markdown,
                plainText: formattedResult.plainText,
                language: result.language,
                segments: result.segments,
                model: result.model,
                duration: result.duration,
                metadata: formattedResult.metadata,
                // Additional formats
                srt: this.formatter.generateSRT(result.segments),
                vtt: this.formatter.generateVTT(result.segments)
            };

            console.log('🎉 TranscriptionService: File transcription completed successfully!');
            console.log('📊 TranscriptionService: Formatted result metadata:', finalResult.metadata);
            return finalResult;

        } catch (error) {
            console.error('❌ TranscriptionService: Local transcription error:', error);
            console.error('❌ Error stack:', error.stack);
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
     * Get formatter settings
     * @returns {Object} - Current formatter settings
     */
    getFormatterSettings() {
        return this.formatter.getSettings();
    }

    /**
     * Update formatter settings
     * @param {Object} settings - New formatter settings
     */
    updateFormatterSettings(settings) {
        this.formatter.updateSettings(settings);
    }

    /**
     * Format existing transcription result
     * @param {Object} transcriptionResult - Raw transcription result
     * @returns {Object} - Formatted result
     */
    formatTranscription(transcriptionResult) {
        return this.formatter.formatTranscription(transcriptionResult);
    }

    /**
     * Generate SRT subtitles from segments
     * @param {Array} segments - Transcription segments
     * @returns {string} - SRT formatted subtitles
     */
    generateSRT(segments) {
        return this.formatter.generateSRT(segments);
    }

    /**
     * Generate VTT subtitles from segments
     * @param {Array} segments - Transcription segments
     * @returns {string} - VTT formatted subtitles
     */
    generateVTT(segments) {
        return this.formatter.generateVTT(segments);
    }

    /**
     * Clean up temporary files
     */
    cleanup() {
        this.localWhisper.cleanup();
    }
}

module.exports = TranscriptionService;