/**
 * Transcription Service - Handles local Whisper transcription
 */

const { LocalWhisperService } = require('./localWhisperService');
const TranscriptionFormatter = require('./transcriptionFormatter');
const RefinementService = require('./refinementService');

class TranscriptionService {
    constructor() {
        console.log('🎯 TranscriptionService: Initializing...');
        this.localWhisper = new LocalWhisperService();
        this.formatter = new TranscriptionFormatter();
        this.refinementService = new RefinementService();
        this.model = 'base'; // Default local model
        this.language = 'auto'; // Auto-detect by default
        this.initialPrompt = ''; // Default empty initial prompt
        this.selectedTemplateId = null; // No refinement template selected by default
        
        console.log('🎯 TranscriptionService: Configuration:');
        console.log(`   - Default model: ${this.model}`);
        console.log(`   - Default language: ${this.language}`);
        console.log(`   - Initial prompt: ${this.initialPrompt ? 'Set' : 'Not set'}`);
        console.log(`   - Local Whisper available: ${this.isAvailable()}`);
        console.log(`   - Refinement template: ${this.selectedTemplateId || 'None'}`);
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
                threads: options.threads || 4,
                useInitialPrompt: options.useInitialPrompt !== undefined ? options.useInitialPrompt : true
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
                console.log(`🔤 TranscriptionService: Initial prompt is DISABLED`);
            }
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
            
            // Create the result object
            let finalResult = {
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
            
            // Apply AI refinement if a template is selected
            const templateId = options.templateId || this.selectedTemplateId;
            if (templateId) {
                try {
                    // Check if refinement is available
                    const refinementAvailable = await this.refinementService.isAvailable();
                    if (!refinementAvailable) {
                        console.log('⚠️ TranscriptionService: Ollama is not available, skipping refinement');
                        finalResult.refinementStatus = {
                            success: false,
                            message: 'Ollama is not available. Please ensure Ollama is installed and running.'
                        };
                    } else {
                        console.log(`🔄 TranscriptionService: Applying refinement with template: ${templateId}`);
                        
                        // Get template details
                        const template = await this.refinementService.getTemplate(templateId);
                        if (!template) {
                            throw new Error(`Template with ID ${templateId} not found`);
                        }
                        
                        console.log(`🔄 TranscriptionService: Using template "${template.name}"`);
                        
                        // Apply refinement
                        const refinementResult = await this.refinementService.refineTranscription(
                            result.text,
                            templateId,
                            options.refinementOptions || {}
                        );
                        
                        // Update result with refined text
                        finalResult.originalText = result.text;
                        finalResult.text = refinementResult.refined;
                        
                        // Format the refined text
                        const refinedFormattedResult = this.formatter.formatTranscription({
                            text: refinementResult.refined,
                            segments: result.segments // Keep original segments
                        });
                        
                        finalResult.markdown = refinedFormattedResult.markdown;
                        finalResult.plainText = refinedFormattedResult.plainText;
                        
                        // Add refinement metadata
                        finalResult.refinementStatus = {
                            success: true,
                            templateId: templateId,
                            templateName: template.name,
                            model: refinementResult.model
                        };
                        
                        console.log('✅ TranscriptionService: Refinement applied successfully');
                    }
                } catch (refinementError) {
                    console.error('❌ TranscriptionService: Refinement error:', refinementError);
                    finalResult.refinementStatus = {
                        success: false,
                        message: `Refinement failed: ${refinementError.message}`
                    };
                }
            } else {
                console.log('📝 TranscriptionService: No refinement template selected, skipping refinement');
            }

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
                threads: options.threads || 4,
                useInitialPrompt: options.useInitialPrompt !== undefined ? options.useInitialPrompt : true
            };
            
            // Only add initialPrompt if useInitialPrompt is true
            if (whisperOptions.useInitialPrompt) {
                whisperOptions.initialPrompt = options.initialPrompt || this.initialPrompt;
            }
            
            // Log initial prompt status
            if (whisperOptions.initialPrompt && whisperOptions.useInitialPrompt) {
                console.log(`🔤 TranscriptionService: Using initial prompt (${whisperOptions.initialPrompt.length} chars)`);
            } else {
                console.log(`🔤 TranscriptionService: Initial prompt is DISABLED`);
            }

            const result = await this.localWhisper.transcribeBuffer(audioBuffer, whisperOptions);
            
            // Format the transcription
            const formattedResult = this.formatter.formatTranscription(result);
            
            // Create the result object
            let finalResult = {
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
            
            // Apply AI refinement if a template is selected
            const templateId = options.templateId || this.selectedTemplateId;
            if (templateId) {
                try {
                    // Check if refinement is available
                    const refinementAvailable = await this.refinementService.isAvailable();
                    if (!refinementAvailable) {
                        console.log('⚠️ TranscriptionService: Ollama is not available, skipping refinement');
                        finalResult.refinementStatus = {
                            success: false,
                            message: 'Ollama is not available. Please ensure Ollama is installed and running.'
                        };
                    } else {
                        console.log(`🔄 TranscriptionService: Applying refinement with template: ${templateId}`);
                        
                        // Get template details
                        const template = await this.refinementService.getTemplate(templateId);
                        if (!template) {
                            throw new Error(`Template with ID ${templateId} not found`);
                        }
                        
                        console.log(`🔄 TranscriptionService: Using template "${template.name}"`);
                        
                        // Apply refinement
                        const refinementResult = await this.refinementService.refineTranscription(
                            result.text,
                            templateId,
                            options.refinementOptions || {}
                        );
                        
                        // Update result with refined text
                        finalResult.originalText = result.text;
                        finalResult.text = refinementResult.refined;
                        
                        // Format the refined text
                        const refinedFormattedResult = this.formatter.formatTranscription({
                            text: refinementResult.refined,
                            segments: result.segments // Keep original segments
                        });
                        
                        finalResult.markdown = refinedFormattedResult.markdown;
                        finalResult.plainText = refinedFormattedResult.plainText;
                        
                        // Add refinement metadata
                        finalResult.refinementStatus = {
                            success: true,
                            templateId: templateId,
                            templateName: template.name,
                            model: refinementResult.model
                        };
                        
                        console.log('✅ TranscriptionService: Refinement applied successfully');
                    }
                } catch (refinementError) {
                    console.error('❌ TranscriptionService: Refinement error:', refinementError);
                    finalResult.refinementStatus = {
                        success: false,
                        message: `Refinement failed: ${refinementError.message}`
                    };
                }
            } else {
                console.log('📝 TranscriptionService: No refinement template selected, skipping refinement');
            }
            
            return finalResult;

        } catch (error) {
            console.error('❌ TranscriptionService: Local transcription error:', error);
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
    async getSettings() {
        const refinementSettings = await this.refinementService.getSettings();
        const availableTemplates = await this.refinementService.getAvailableTemplates();
        
        return {
            model: this.model,
            language: this.language,
            initialPrompt: this.initialPrompt,
            availableModels: this.getAvailableModels(),
            isAvailable: this.isAvailable(),
            selectedTemplateId: this.selectedTemplateId,
            refinement: {
                isAvailable: await this.refinementService.isAvailable(),
                availableTemplates,
                ...refinementSettings
            }
        };
    }

    /**
     * Update transcription settings
     * @param {Object} settings - New settings
     */
    async updateSettings(settings) {
        if (settings.model) {
            this.setModel(settings.model);
        }
        if (settings.language) {
            this.setLanguage(settings.language);
        }
        if (settings.initialPrompt !== undefined) {
            this.setInitialPrompt(settings.initialPrompt);
        }
        if (settings.selectedTemplateId !== undefined) {
            this.selectedTemplateId = settings.selectedTemplateId;
        }
        
        // Update refinement settings if provided
        if (settings.refinement) {
            await this.refinementService.updateSettings(settings.refinement);
        }
    }
    
    /**
     * Set refinement template
     * @param {string} templateId - Template ID
     */
    setRefinementTemplate(templateId) {
        this.selectedTemplateId = templateId;
        console.log(`🔄 TranscriptionService: Refinement template set to ${templateId || 'None'}`);
    }
    
    /**
     * Get available refinement templates
     * @returns {Promise<Array>} - List of available templates
     */
    async getAvailableTemplates() {
        return await this.refinementService.getAvailableTemplates();
    }
    
    /**
     * Check if refinement is available
     * @returns {Promise<boolean>} - Whether refinement is available
     */
    async isRefinementAvailable() {
        return await this.refinementService.isAvailable();
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