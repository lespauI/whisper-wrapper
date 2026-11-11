/**
 * Transcription Service - Handles local Whisper transcription
 */

const { LocalWhisperService } = require('./localWhisperService');
const TranscriptionFormatter = require('./transcriptionFormatter');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomBytes } = require('crypto');
const { finalizeResumableFile, transcribeResumableFile } = require('./resumableTranscription');

class TranscriptionService {
    constructor() {
        console.log('🎯 TranscriptionService: Initializing...');
        this.localWhisper = new LocalWhisperService();
        this.formatter = new TranscriptionFormatter();
        this.model = 'base'; // Default local model
        this.language = 'auto'; // Auto-detect by default
        this.initialPrompt = ''; // Default empty initial prompt
        this.checkpointRoot = path.join(process.cwd(), 'data', 'transcription-checkpoints');
        
        console.log('🎯 TranscriptionService: Configuration:');
        console.log(`   - Default model: ${this.model}`);
        console.log(`   - Default language: ${this.language}`);
        console.log(`   - Initial prompt: ${this.initialPrompt ? 'Set' : 'Not set'}`);
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
     * Set initial prompt for transcription
     * @param {string} prompt - Text to use as initial context for the decoder
     */
    setInitialPrompt(prompt) {
        this.initialPrompt = prompt;
        this.localWhisper.setInitialPrompt(prompt);
    }
    
    /**
     * Get current initial prompt
     * @returns {string} The current initial prompt
     */
    getInitialPrompt() {
        return this.initialPrompt;
    }
    
    /**
     * Clear initial prompt
     */
    clearInitialPrompt() {
        this.initialPrompt = '';
        this.localWhisper.clearInitialPrompt();
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
        console.log('⚙️ Options:', options);
        
        try {
            if (!this.isAvailable()) {
                console.log('❌ TranscriptionService: Local Whisper is not available');
                throw new Error('Local Whisper is not available. Please run the setup script first.');
            }

            const whisperOptions = {
                signal: options.signal,
                model: options.model || this.model,
                language: options.language || this.language,
                translate: options.translate || false,
                threads: options.threads || 4,
                useInitialPrompt: options.useInitialPrompt !== undefined ? options.useInitialPrompt : true,
                useGpu: options.useGpu !== undefined ? options.useGpu : this.localWhisper.useGpu,
                flashAttn: options.flashAttn !== undefined ? options.flashAttn : this.localWhisper.flashAttn,
                gpuDevice: options.gpuDevice !== undefined ? options.gpuDevice : this.localWhisper.gpuDevice,
                contextPrompt: options.contextPrompt
            };
            
            // Only add initialPrompt if useInitialPrompt is true
            if (whisperOptions.useInitialPrompt) {
                whisperOptions.initialPrompt = options.initialPrompt || this.initialPrompt;
            }

            console.log('🎯 TranscriptionService: Calling LocalWhisperService with options:', whisperOptions);
            
            // Log initial prompt status
            if (whisperOptions.initialPrompt && whisperOptions.useInitialPrompt) {
                console.log(`🔤 TranscriptionService: Using initial prompt (${whisperOptions.initialPrompt.length} chars)`);
            } else {
                console.log('🔤 TranscriptionService: Initial prompt is DISABLED');
            }
            const decoderIdentity = this.localWhisper.getDecoderIdentity?.(whisperOptions.model, whisperOptions.language) || null;
            const result = await transcribeResumableFile(filePath, whisperOptions,
                this.localWhisper.transcribeFile.bind(this.localWhisper),
                this.checkpointRoot, decoderIdentity);
            if (result.success === false) throw new Error(result.error || 'Decoder did not return a transcription');
            
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
                status: result.partial === true || result.status === 'partial' ? 'partial' : 'complete',
                partial: result.partial === true || result.status === 'partial',
                issues: Array.isArray(result.issues) ? result.issues : [],
                resumeId: result.resumeId || null,
                text: result.text,
                markdown: formattedResult.markdown,
                plainText: formattedResult.plainText,
                language: result.language,
                segments: result.segments,
                model: result.model,
                duration: result.duration,
                audioDurationSeconds: result.audioDurationSeconds ?? result.audioDuration ?? null,
                processingDurationMs: result.processingDurationMs ?? null,
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

    async finalizeTranscription(resumeId) {
        return finalizeResumableFile(resumeId, this.checkpointRoot);
    }

    /**
     * Transcribe audio buffer
     * @param {Buffer} audioBuffer - Audio data buffer
     * @param {Object} options - Transcription options
     * @returns {Promise<Object>} - Transcription result
     */
    async transcribeBuffer(audioBuffer, options = {}) {
        let tempDirectory;
        try {
            const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
            tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'whisper-recording-'));
            const tempFilePath = path.join(tempDirectory, `${randomBytes(8).toString('hex')}.webm`);
            await fs.promises.writeFile(tempFilePath, buffer, { mode: 0o600 });
            return await this.transcribeFile(tempFilePath, options);

        } catch (error) {
            console.error('Local transcription error:', error);
            throw new Error(`Transcription failed: ${error.message}`);
        } finally {
            if (tempDirectory) await fs.promises.rm(tempDirectory, { recursive: true, force: true });
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
            initialPrompt: this.initialPrompt,
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
        if (settings.initialPrompt !== undefined) {
            this.setInitialPrompt(settings.initialPrompt);
        }
        if (settings.useGpu !== undefined) {
            this.localWhisper.setUseGpu(settings.useGpu);
        }
        if (settings.flashAttn !== undefined) {
            this.localWhisper.setFlashAttn(settings.flashAttn);
        }
        if (settings.gpuDevice !== undefined) {
            this.localWhisper.setGpuDevice(settings.gpuDevice);
        }
    }

    /**
     * Download a Whisper model
     * @param {string} modelName - Name of the model to download
     * @param {Function} progressCallback - Callback for progress updates
     * @returns {Promise<Object>} - Download result
     */
    async downloadModel(modelName, progressCallback = null) {
        return await this.localWhisper.downloadModel(modelName, progressCallback);
    }

    /**
     * Get model download info
     * @param {string} modelName - Name of the model
     * @returns {Object} - Model info including download status
     */
    getModelInfo(modelName) {
        return this.localWhisper.getModelInfo(modelName);
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
