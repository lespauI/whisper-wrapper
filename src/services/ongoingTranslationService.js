/**
 * OngoingTranslationService - Orchestrates real-time transcription and translation during recording
 * This service coordinates between recording, transcription, and translation services
 * to provide real-time bilingual transcription capabilities.
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const ErrorHandlingService = require('./errorHandlingService');

class OngoingTranslationService extends EventEmitter {
    constructor() {
        super();
        
        // Core services - will be injected during initialization
        this.recordingService = null;
        this.transcriptionService = null;
        this.ollamaService = null;
        this.sentenceSegmentation = null;
        
        // Error handling service
        this.errorHandler = new ErrorHandlingService();
        this.setupErrorHandling();
        
        // State management
        this.isActive = false;
        this.sourceLanguage = 'auto';
        this.targetLanguage = 'en';
        this.sessionId = null;
        this.sessionStartTime = null;
        
        // Processing pipeline
        this.processingQueue = [];
        this.completedSegments = [];
        this.isProcessing = false;
        
        // Session data
        this.sessionData = {
            metadata: {},
            segments: [],
            audio: null
        };
        
        // Performance tracking
        this.stats = {
            chunksProcessed: 0,
            transcriptionLatency: [],
            translationLatency: [],
            errors: 0
        };
        
        // Error handling state
        this.isInFallbackMode = false;
        this.fallbackModeReason = null;
        
        console.log('🌐 OngoingTranslationService: Initialized with error handling');
    }
    
    /**
     * Setup error handling for the service
     * @private
     */
    setupErrorHandling() {
        // Listen to error handling events
        this.errorHandler.on('error-handled', (errorInfo) => {
            this.handleErrorEvent(errorInfo);
        });
        
        this.errorHandler.on('circuit-breaker-reset', (info) => {
            console.log(`🔄 OngoingTranslationService: Circuit breaker reset for ${info.service}`);
            if (this.isInFallbackMode && this.fallbackModeReason === 'circuit_breaker') {
                this.exitFallbackMode();
            }
        });
        
        console.log('🛡️ OngoingTranslationService: Error handling configured');
    }
    
    /**
     * Handle error events from the error handling service
     * @param {Object} errorInfo - Error information
     * @private
     */
    handleErrorEvent(errorInfo) {
        // Emit UI notification
        this.emit('error-notification', {
            type: errorInfo.errorType,
            service: errorInfo.service,
            message: errorInfo.message,
            severity: errorInfo.severity,
            recovered: errorInfo.recovered,
            userAction: errorInfo.userAction
        });
        
        // Handle fallback modes
        if (errorInfo.service === 'translation' && !errorInfo.recovered) {
            this.enterFallbackMode('translation_unavailable', 'Translation service unavailable, continuing with transcription only');
        }
        
        // Update statistics
        this.stats.errors++;
    }
    
    /**
     * Enter fallback mode
     * @param {string} reason - Reason for fallback
     * @param {string} message - User message
     * @private
     */
    enterFallbackMode(reason, message) {
        if (!this.isInFallbackMode) {
            this.isInFallbackMode = true;
            this.fallbackModeReason = reason;
            
            console.log(`⚠️ OngoingTranslationService: Entering fallback mode - ${reason}`);
            
            this.emit('fallback-mode-entered', {
                reason,
                message,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Exit fallback mode
     * @private
     */
    exitFallbackMode() {
        if (this.isInFallbackMode) {
            const previousReason = this.fallbackModeReason;
            this.isInFallbackMode = false;
            this.fallbackModeReason = null;
            
            console.log(`✅ OngoingTranslationService: Exiting fallback mode - ${previousReason}`);
            
            this.emit('fallback-mode-exited', {
                previousReason,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Initialize the service with required dependencies
     * @param {Object} services - Service dependencies
     */
    initializeServices(services) {
        this.recordingService = services.recordingService;
        this.transcriptionService = services.transcriptionService;
        this.ollamaService = services.ollamaService;
        this.sentenceSegmentation = services.sentenceSegmentation;
        
        console.log('🌐 OngoingTranslationService: Services initialized');
    }
    
    /**
     * Start ongoing translation session
     * @param {Object} options - Translation options
     * @returns {Promise<Object>} - Session info
     */
    async startOngoingTranslation(options = {}) {
        try {
            if (this.isActive) {
                throw new Error('Ongoing translation session already active');
            }
            
            // Validate services are initialized
            if (!this.recordingService || !this.transcriptionService || !this.ollamaService || !this.sentenceSegmentation) {
                throw new Error('Services not properly initialized. Call initializeServices() first.');
            }
            
            // Set configuration
            this.sourceLanguage = options.sourceLanguage || 'auto';
            this.targetLanguage = options.targetLanguage || 'en';
            
            // Generate session ID
            this.sessionId = `ot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.sessionStartTime = new Date().toISOString();
            
            // Initialize session data
            this.sessionData = {
                sessionId: this.sessionId,
                startTime: this.sessionStartTime,
                sourceLanguage: this.sourceLanguage,
                targetLanguage: this.targetLanguage,
                metadata: {
                    chunkSize: options.chunkSize || 3000,
                    overlapSize: options.overlapSize || 500,
                    processingMode: options.processingMode || 'realtime',
                    translationModel: options.translationModel || 'gemma3:8b'
                },
                segments: [],
                audio: null
            };
            
            // Reset state
            this.processingQueue = [];
            this.completedSegments = [];
            this.isProcessing = false;
            this.stats = {
                chunksProcessed: 0,
                transcriptionLatency: [],
                translationLatency: [],
                errors: 0
            };
            
            // Configure transcription service
            if (this.sourceLanguage !== 'auto') {
                this.transcriptionService.setLanguage(this.sourceLanguage);
            }
            
            this.isActive = true;
            
            console.log(`🌐 OngoingTranslationService: Session started - ${this.sessionId}`);
            console.log(`🌐 Configuration: ${this.sourceLanguage} → ${this.targetLanguage}`);
            
            // Emit session started event
            this.emit('session-started', {
                sessionId: this.sessionId,
                sourceLanguage: this.sourceLanguage,
                targetLanguage: this.targetLanguage,
                startTime: this.sessionStartTime
            });
            
            return {
                success: true,
                sessionId: this.sessionId,
                sourceLanguage: this.sourceLanguage,
                targetLanguage: this.targetLanguage,
                startTime: this.sessionStartTime
            };
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Failed to start session:', error);
            throw new Error(`Failed to start ongoing translation: ${error.message}`);
        }
    }
    
    /**
     * Stop ongoing translation session
     * @returns {Promise<Object>} - Session completion info
     */
    async stopOngoingTranslation() {
        try {
            if (!this.isActive) {
                throw new Error('No active ongoing translation session');
            }
            
            console.log(`🌐 OngoingTranslationService: Stopping session - ${this.sessionId}`);
            
            // Wait for current processing to complete
            while (this.isProcessing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Complete session data
            this.sessionData.endTime = new Date().toISOString();
            this.sessionData.segments = [...this.completedSegments];
            this.sessionData.stats = { ...this.stats };
            
            const sessionId = this.sessionId;
            const completedSegments = this.completedSegments.length;
            
            // Reset state
            this.isActive = false;
            this.sessionId = null;
            this.sessionStartTime = null;
            
            console.log(`🌐 OngoingTranslationService: Session completed - ${sessionId}, ${completedSegments} segments`);
            
            // Emit session completed event
            this.emit('session-completed', {
                sessionId,
                completedSegments,
                sessionData: this.sessionData
            });
            
            return {
                success: true,
                sessionId,
                completedSegments,
                sessionData: this.sessionData
            };
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Failed to stop session:', error);
            throw new Error(`Failed to stop ongoing translation: ${error.message}`);
        }
    }
    
    /**
     * Process audio chunk from recording
     * @param {ArrayBuffer|Buffer} audioData - Audio chunk data
     * @param {number} timestamp - Timestamp from recording start (ms)
     * @returns {Promise<void>}
     */
    async processAudioChunk(audioData, timestamp) {
        if (!this.isActive) {
            console.warn('🌐 OngoingTranslationService: Received audio chunk but session not active');
            return;
        }
        
        const chunkId = `chunk_${Date.now()}_${this.stats.chunksProcessed}`;
        
        console.log(`🌐 OngoingTranslationService: Processing audio chunk - ${chunkId}`);
        
        // Add to processing queue
        this.processingQueue.push({
            id: chunkId,
            audioData,
            timestamp,
            receivedAt: Date.now()
        });
        
        this.stats.chunksProcessed++;
        
        // Start processing if not already processing
        if (!this.isProcessing) {
            this.processQueue();
        }
    }
    
    /**
     * Process queued audio chunks
     * @private
     */
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        try {
            while (this.processingQueue.length > 0) {
                const chunk = this.processingQueue.shift();
                await this.processChunk(chunk);
            }
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Queue processing error:', error);
            this.emit('processing-error', { error: error.message });
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Process individual audio chunk
     * @param {Object} chunk - Chunk data
     * @private
     */
    async processChunk(chunk) {
        const startTime = Date.now();
        
        try {
            console.log(`🌐 OngoingTranslationService: Transcribing chunk - ${chunk.id}`);
            
            // Step 1: Transcribe chunk with error handling
            const transcription = await this.transcribeChunkWithErrorHandling(chunk);
            
            if (!transcription || !transcription.success || !transcription.text) {
                console.warn(`🌐 OngoingTranslationService: Empty transcription for chunk - ${chunk.id}`);
                return;
            }
            
            const transcriptionLatency = Date.now() - startTime;
            this.stats.transcriptionLatency.push(transcriptionLatency);
            
            console.log(`🌐 OngoingTranslationService: Transcribed "${transcription.text}" (${transcriptionLatency}ms)`);
            
            // Step 2: Process text with sentence segmentation
            try {
                const sentences = this.sentenceSegmentation.processTextChunk(transcription.text);
                
                // Step 3: Process each complete sentence
                for (const sentence of sentences) {
                    if (sentence.isComplete) {
                        await this.processSentenceWithErrorHandling(sentence, chunk.timestamp, transcription);
                    }
                }
            } catch (segmentationError) {
                // Handle segmentation errors
                const recoveryResult = await this.errorHandler.handleError(
                    segmentationError, 
                    'segmentation', 
                    { chunkId: chunk.id, text: transcription.text }
                );
                
                if (recoveryResult.success && recoveryResult.shouldRetry) {
                    // Retry with simpler segmentation
                    const fallbackSentences = this.createFallbackSentences(transcription.text, chunk.timestamp);
                    for (const sentence of fallbackSentences) {
                        await this.processSentenceWithErrorHandling(sentence, chunk.timestamp, transcription);
                    }
                }
            }
            
        } catch (error) {
            // Handle chunk processing errors with comprehensive error handling
            const recoveryResult = await this.errorHandler.handleError(
                error, 
                'chunk_processing', 
                { 
                    chunkId: chunk.id, 
                    chunkSize: chunk.audioData?.byteLength || 0,
                    timestamp: chunk.timestamp
                }
            );
            
            if (recoveryResult.success) {
                if (recoveryResult.shouldRetry && recoveryResult.newChunkSize) {
                    // Retry with smaller chunk size
                    console.log(`🔄 OngoingTranslationService: Retrying chunk ${chunk.id} with smaller size`);
                    // Implementation would split chunk and retry
                } else if (recoveryResult.shouldBypass) {
                    // Skip this chunk but continue processing
                    console.log(`⏭️ OngoingTranslationService: Skipping chunk ${chunk.id} due to error`);
                }
            }
            
            this.stats.errors++;
            this.emit('processing-error', { 
                chunkId: chunk.id, 
                error: error.message,
                recoveryResult
            });
        }
    }
    
    /**
     * Transcribe audio chunk with comprehensive error handling
     * @param {Object} chunk - Audio chunk data
     * @returns {Promise<Object>} Transcription result
     * @private
     */
    async transcribeChunkWithErrorHandling(chunk) {
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            try {
                return await this.transcribeChunk(chunk.audioData);
            } catch (error) {
                attempts++;
                
                const recoveryResult = await this.errorHandler.handleError(
                    error, 
                    'transcription', 
                    { 
                        service: 'transcription',
                        chunkId: chunk.id,
                        attempt: attempts,
                        audioDataSize: chunk.audioData?.byteLength || 0
                    }
                );
                
                if (recoveryResult.success) {
                    if (recoveryResult.shouldRetry && attempts < maxAttempts) {
                        if (recoveryResult.delay) {
                            await new Promise(resolve => setTimeout(resolve, recoveryResult.delay));
                        }
                        continue; // Retry
                    } else if (recoveryResult.fallbackModel) {
                        // Try with fallback model
                        try {
                            return await this.transcribeChunk(chunk.audioData, { model: recoveryResult.fallbackModel });
                        } catch (fallbackError) {
                            console.warn(`Fallback model ${recoveryResult.fallbackModel} also failed`);
                        }
                    } else if (recoveryResult.shouldBypass) {
                        // Return empty result to continue processing
                        return { success: false, text: '', bypassedDueToError: true };
                    }
                }
                
                // If last attempt, throw error
                if (attempts >= maxAttempts) {
                    throw error;
                }
            }
        }
    }
    
    /**
     * Process sentence with error handling
     * @param {Object} sentence - Sentence data
     * @param {number} timestamp - Timestamp
     * @param {Object} transcription - Original transcription
     * @private
     */
    async processSentenceWithErrorHandling(sentence, timestamp, transcription) {
        try {
            await this.processSentence(sentence, timestamp, transcription);
        } catch (error) {
            const recoveryResult = await this.errorHandler.handleError(
                error, 
                'sentence_processing', 
                { 
                    sentenceId: sentence.id,
                    text: sentence.text,
                    timestamp
                }
            );
            
            // Continue processing even if individual sentence fails
            console.warn(`Failed to process sentence ${sentence.id}: ${error.message}`);
        }
    }
    
    /**
     * Create fallback sentences when segmentation fails
     * @param {string} text - Text to segment
     * @param {number} timestamp - Timestamp
     * @returns {Array} Fallback sentences
     * @private
     */
    createFallbackSentences(text, timestamp) {
        // Simple fallback: split by common sentence endings
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        return sentences.map((sentenceText, index) => ({
            id: `fallback_${timestamp}_${index}`,
            text: sentenceText.trim(),
            isComplete: true,
            confidence: 0.7, // Lower confidence for fallback
            isFallback: true
        }));
    }
    
    /**
     * Transcribe audio chunk
     * @param {ArrayBuffer|Buffer} audioData - Audio data
     * @returns {Promise<Object>} - Transcription result
     * @private
     */
    async transcribeChunk(audioData) {
        try {
            // Convert audio data to buffer if needed
            const buffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);
            
            // Use transcription service to process chunk
            const result = await this.transcriptionService.transcribeBuffer(buffer, {
                model: 'base', // Use base model for real-time processing
                language: this.sourceLanguage === 'auto' ? null : this.sourceLanguage,
                translate: false, // We handle translation separately
                threads: 4
            });
            
            return result;
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Transcription error:', error);
            throw error;
        }
    }
    
    /**
     * Process completed sentence
     * @param {Object} sentence - Sentence segment
     * @param {number} timestamp - Original chunk timestamp
     * @param {Object} transcription - Full transcription data
     * @private
     */
    async processSentence(sentence, timestamp, transcription) {
        const startTime = Date.now();
        
        try {
            // Create sentence segment
            const segment = {
                id: `sentence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: sentence.text,
                translatedText: null,
                
                // Timing information
                startTime: timestamp / 1000, // Convert to seconds
                endTime: (timestamp / 1000) + 3, // Estimate 3 second duration
                duration: 3,
                
                // Language information
                sourceLanguage: this.sourceLanguage,
                targetLanguage: this.targetLanguage,
                detectedLanguage: transcription.language || this.sourceLanguage,
                
                // Quality metrics
                confidence: sentence.confidence || 0.9,
                wordCount: sentence.text.split(' ').length,
                
                // Processing state
                status: 'transcribed',
                
                // Metadata
                timestamp: Date.now(),
                model: {
                    transcription: transcription.model || 'base',
                    translation: null
                }
            };
            
            // Emit transcription update
            this.emit('transcription-update', { segment });
            
            console.log(`🌐 OngoingTranslationService: Sentence ready for translation: "${segment.text}"`);
            
            // Start translation asynchronously with error handling
            this.translateSegmentWithErrorHandling(segment).catch(error => {
                console.error('🌐 OngoingTranslationService: Unrecoverable translation error:', error);
            });
            
            // Add to completed segments
            this.completedSegments.push(segment);
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Sentence processing error:', error);
            throw error;
        }
    }
    
    /**
     * Translate sentence segment with comprehensive error handling
     * @param {Object} segment - Sentence segment
     * @returns {Promise<Object>} - Updated segment
     * @private
     */
    async translateSegmentWithErrorHandling(segment) {
        // Check if in fallback mode via error handler
        if (this.errorHandler.isInFallbackMode()) {
            segment.status = 'bypassed';
            segment.translatedText = segment.text; // Show original text
            segment.bypassReason = this.errorHandler.getFallbackModeReason() || 'Translation service unavailable';
            this.emit('translation-update', { segment });
            return segment;
        }
        
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            try {
                return await this.translateSegment(segment);
            } catch (error) {
                attempts++;
                
                const recoveryResult = await this.errorHandler.handleError(
                    error, 
                    'translation', 
                    { 
                        service: 'translation',
                        segmentId: segment.id,
                        text: segment.text,
                        sourceLanguage: segment.sourceLanguage,
                        targetLanguage: segment.targetLanguage,
                        attempt: attempts
                    }
                );
                
                if (recoveryResult.success) {
                    if (recoveryResult.shouldRetry && attempts < maxAttempts) {
                        if (recoveryResult.delay) {
                            await new Promise(resolve => setTimeout(resolve, recoveryResult.delay));
                        }
                        continue; // Retry
                    } else if (recoveryResult.fallbackModel) {
                        // Try with fallback model
                        try {
                            return await this.translateSegmentWithModel(segment, recoveryResult.fallbackModel);
                        } catch (fallbackError) {
                            console.warn(`Fallback model ${recoveryResult.fallbackModel} also failed for segment ${segment.id}`);
                            if (attempts < maxAttempts) continue;
                        }
                    } else if (recoveryResult.showOriginalOnly) {
                        // Graceful degradation: show original text
                        segment.status = 'bypassed';
                        segment.translatedText = segment.text;
                        segment.bypassReason = recoveryResult.message;
                        this.emit('translation-update', { segment });
                        return segment;
                    }
                }
                
                // If last attempt, handle final failure
                if (attempts >= maxAttempts) {
                    return this.handleFinalTranslationFailure(segment, error, recoveryResult);
                }
            }
        }
    }
    
    /**
     * Translate sentence segment
     * @param {Object} segment - Sentence segment
     * @returns {Promise<Object>} - Updated segment
     * @private
     */
    async translateSegment(segment) {
        return await this.translateSegmentWithModel(segment);
    }
    
    /**
     * Translate segment with specific model
     * @param {Object} segment - Sentence segment
     * @param {string} model - Translation model to use
     * @returns {Promise<Object>} - Updated segment
     * @private
     */
    async translateSegmentWithModel(segment, model = null) {
        const startTime = Date.now();
        
        // Update status
        segment.status = 'translating';
        this.emit('translation-update', { segment });
        
        console.log(`🌐 OngoingTranslationService: Translating: "${segment.text}"${model ? ` with model ${model}` : ''}`);
        
        // Call Ollama translation service (enhanced method with caching, context, and quality checking)
        const translationResult = await this.ollamaService.translateText(
            segment.text,
            segment.sourceLanguage,
            segment.targetLanguage,
            {
                template: this.determineTranslationTemplate(segment.text),
                context: this.getTranslationContext(),
                model: model,
                timeout: 10 // Shorter timeout for real-time use
            }
        );
        
        const translationLatency = Date.now() - startTime;
        this.stats.translationLatency.push(translationLatency);
        
        if (translationResult.success) {
            // Update segment with translation
            segment.translatedText = translationResult.translatedText;
            segment.status = 'translated';
            segment.model.translation = model || translationResult.method || 'llama3:8b';
            segment.translationTime = translationLatency;
            segment.fromCache = translationResult.fromCache || false;
            segment.confidence = translationResult.confidence || 0.9;
            
            console.log(`🌐 OngoingTranslationService: Translated: "${segment.translatedText}" (${translationLatency}ms)${translationResult.fromCache ? ' [cached]' : ''}`);
        } else {
            // Create error for proper handling
            throw new Error(translationResult.error || 'Translation service returned failure');
        }
        
        // Emit updated segment
        this.emit('translation-update', { segment });
        
        return segment;
    }
    
    /**
     * Handle final translation failure when all recovery attempts exhausted
     * @param {Object} segment - Sentence segment
     * @param {Error} error - Final error
     * @param {Object} recoveryResult - Last recovery result
     * @returns {Object} - Updated segment
     * @private
     */
    handleFinalTranslationFailure(segment, error, recoveryResult) {
        // Determine appropriate fallback behavior
        if (recoveryResult && recoveryResult.fallbackToGracefulDegradation) {
            // Show original text as fallback
            segment.status = 'fallback';
            segment.translatedText = segment.text;
            segment.fallbackReason = 'Translation service failed, showing original text';
        } else {
            // Show error state
            segment.status = 'error';
            segment.error = error.message;
            segment.translatedText = '[Translation unavailable]';
        }
        
        console.error(`🌐 OngoingTranslationService: Final translation failure for segment ${segment.id}:`, error.message);
        
        // Emit updated segment
        this.emit('translation-update', { segment });
        
        return segment;
    }
    
    /**
     * Determine appropriate translation template based on text content
     * @param {string} text - Text to analyze
     * @returns {string} Template type
     * @private
     */
    determineTranslationTemplate(text) {
        const textLower = text.toLowerCase();
        
        // Check for technical content
        const technicalIndicators = [
            'api', 'database', 'server', 'application', 'system', 'configuration',
            'algorithm', 'function', 'variable', 'object', 'method', 'class',
            'framework', 'library', 'component', 'service', 'endpoint'
        ];
        
        // Check for conversational content
        const conversationalIndicators = [
            'hello', 'hi', 'how are you', 'thanks', 'please', 'sorry', 'yes', 'no',
            'what do you think', 'i think', 'maybe', 'probably', 'actually',
            'by the way', 'anyway', 'well', 'you know'
        ];
        
        const technicalScore = technicalIndicators.reduce((score, term) => 
            score + (textLower.includes(term) ? 1 : 0), 0);
            
        const conversationalScore = conversationalIndicators.reduce((score, term) => 
            score + (textLower.includes(term) ? 1 : 0), 0);
        
        if (technicalScore > conversationalScore && technicalScore > 0) {
            return 'technical';
        } else if (conversationalScore > 0) {
            return 'conversational';
        } else {
            return 'standard';
        }
    }
    
    /**
     * Get translation context for better accuracy
     * @returns {Array} Recent translation context
     * @private
     */
    getTranslationContext() {
        // Return last 3 completed segments for context
        return this.completedSegments
            .filter(segment => segment.status === 'translated' && segment.translatedText)
            .slice(-3)
            .map(segment => ({
                original: segment.text,
                translated: segment.translatedText
            }));
    }
    
    /**
     * Clean translation output to ensure quality (legacy method, now handled by OllamaService)
     * @param {string} translatedText - Raw translation output
     * @returns {string} - Cleaned translation
     * @private
     */
    cleanTranslationOutput(translatedText) {
        if (!translatedText || typeof translatedText !== 'string') {
            return '';
        }
        
        // Basic cleaning - most cleaning is now handled by OllamaService.translateText()
        return translatedText.trim();
        
        // If cleaning resulted in empty string, return original
        if (!cleaned) {
            cleaned = translatedText.trim();
        }
        
        return cleaned;
    }
    
    /**
     * Generate translation prompt
     * @param {string} text - Text to translate
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @returns {string} - Translation prompt
     * @private
     */
    generateTranslationPrompt(text, sourceLanguage, targetLanguage) {
        const sourceLanguageName = this.getLanguageName(sourceLanguage);
        const targetLanguageName = this.getLanguageName(targetLanguage);
        
        return `You are a professional translator. Translate the following text from ${sourceLanguageName} to ${targetLanguageName}.

Requirements:
- Maintain the original meaning and tone
- Use natural ${targetLanguageName} expressions
- Keep the same level of formality
- Return only the translated text without explanations

Text to translate:
${text}

Translation:`;
    }
    
    /**
     * Get language name from language code
     * @param {string} languageCode - Language code
     * @returns {string} - Language name
     * @private
     */
    getLanguageName(languageCode) {
        const languageNames = {
            'auto': 'Auto-detect',
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese'
        };
        
        return languageNames[languageCode] || languageCode;
    }
    
    /**
     * Save complete session data to persistent storage
     * @param {string} audioFilePath - Path to the recorded audio file
     * @returns {Promise<Object>} - Save result with paths and metadata
     */
    async saveSessionData(audioFilePath = null) {
        try {
            if (!this.sessionData.sessionId) {
                throw new Error('No session data to save');
            }
            
            // Get data directory from config
            const config = require('../config');
            const dataDir = config.get('app.dataDirectory') || path.join(process.cwd(), 'data');
            const sessionsDir = path.join(dataDir, 'ongoing-translations');
            const sessionDir = path.join(sessionsDir, this.sessionData.sessionId);
            
            // Ensure session directory exists
            await fs.mkdir(sessionDir, { recursive: true });
            
            // Finalize session data
            this.sessionData.endTime = new Date().toISOString();
            this.sessionData.segments = this.completedSegments;
            this.sessionData.stats = this.getStats();
            this.sessionData.errorStats = this.getErrorStats();
            
            // Calculate session duration
            const sessionDuration = Date.now() - new Date(this.sessionData.startTime).getTime();
            this.sessionData.metadata.sessionDuration = sessionDuration;
            this.sessionData.metadata.totalSegments = this.completedSegments.length;
            this.sessionData.metadata.successfulTranslations = this.completedSegments.filter(s => s.status === 'translated').length;
            
            // Save audio file if provided
            let audioPath = null;
            if (audioFilePath && await this.fileExists(audioFilePath)) {
                audioPath = path.join(sessionDir, 'recording.wav');
                await fs.copyFile(audioFilePath, audioPath);
                this.sessionData.audio = {
                    filePath: audioPath,
                    originalPath: audioFilePath,
                    size: (await fs.stat(audioFilePath)).size,
                    duration: sessionDuration / 1000, // Convert to seconds
                    format: 'wav'
                };
                console.log(`🌐 OngoingTranslationService: Audio saved to ${audioPath}`);
            }
            
            // Save complete session data as JSON
            const sessionDataPath = path.join(sessionDir, 'session.json');
            await fs.writeFile(sessionDataPath, JSON.stringify(this.sessionData, null, 2), 'utf8');
            
            // Generate bilingual exports
            const exportPaths = await this.generateSessionExports(sessionDir);
            
            // Update session index
            await this.updateSessionIndex(this.sessionData, sessionDir);
            
            const result = {
                success: true,
                sessionId: this.sessionData.sessionId,
                sessionDir,
                audioPath,
                sessionDataPath,
                exports: exportPaths,
                segmentCount: this.completedSegments.length,
                duration: sessionDuration,
                stats: this.sessionData.stats
            };
            
            console.log(`🌐 OngoingTranslationService: Session data saved - ${this.sessionData.sessionId}`);
            console.log(`📁 Session directory: ${sessionDir}`);
            
            return result;
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Save error:', error);
            throw error;
        }
    }
    
    /**
     * Generate all export formats for the session
     * @param {string} sessionDir - Session directory path
     * @returns {Promise<Object>} - Export file paths
     * @private
     */
    async generateSessionExports(sessionDir) {
        const exportPaths = {};
        
        try {
            // Generate bilingual text export
            const bilingualTextPath = path.join(sessionDir, 'bilingual_transcript.txt');
            const bilingualContent = this.generateBilingualText(this.completedSegments);
            await fs.writeFile(bilingualTextPath, bilingualContent, 'utf8');
            exportPaths.bilingualText = bilingualTextPath;
            
            // Generate original-only transcript
            const originalTextPath = path.join(sessionDir, 'original_transcript.txt');
            const originalContent = this.generateOriginalOnlyText(this.completedSegments);
            await fs.writeFile(originalTextPath, originalContent, 'utf8');
            exportPaths.originalText = originalTextPath;
            
            // Generate translated-only transcript
            const translatedTextPath = path.join(sessionDir, 'translated_transcript.txt');
            const translatedContent = this.generateTranslatedOnlyText(this.completedSegments);
            await fs.writeFile(translatedTextPath, translatedContent, 'utf8');
            exportPaths.translatedText = translatedTextPath;
            
            // Generate bilingual SRT subtitles
            const bilingualSRTPath = path.join(sessionDir, 'bilingual_subtitles.srt');
            const bilingualSRT = this.generateBilingualSRT(this.completedSegments);
            await fs.writeFile(bilingualSRTPath, bilingualSRT, 'utf8');
            exportPaths.bilingualSRT = bilingualSRTPath;
            
            // Generate separate SRT files for original and translated
            const originalSRTPath = path.join(sessionDir, 'original_subtitles.srt');
            const translatedSRTPath = path.join(sessionDir, 'translated_subtitles.srt');
            const originalSRT = this.generateOriginalSRT(this.completedSegments);
            const translatedSRT = this.generateTranslatedSRT(this.completedSegments);
            await fs.writeFile(originalSRTPath, originalSRT, 'utf8');
            await fs.writeFile(translatedSRTPath, translatedSRT, 'utf8');
            exportPaths.originalSRT = originalSRTPath;
            exportPaths.translatedSRT = translatedSRTPath;
            
            console.log(`📄 OngoingTranslationService: Generated ${Object.keys(exportPaths).length} export files`);
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Export generation error:', error);
            // Continue even if some exports fail
        }
        
        return exportPaths;
    }
    
    /**
     * Update the session index file
     * @param {Object} sessionData - Session data
     * @param {string} sessionDir - Session directory path
     * @private
     */
    async updateSessionIndex(sessionData, sessionDir) {
        try {
            const config = require('../config');
            const dataDir = config.get('app.dataDirectory') || path.join(process.cwd(), 'data');
            const indexPath = path.join(dataDir, 'ongoing-translations', 'session-index.json');
            
            // Load existing index or create new one
            let index = { sessions: [] };
            if (await this.fileExists(indexPath)) {
                const indexContent = await fs.readFile(indexPath, 'utf8');
                index = JSON.parse(indexContent);
            }
            
            // Add or update session entry
            const sessionEntry = {
                sessionId: sessionData.sessionId,
                startTime: sessionData.startTime,
                endTime: sessionData.endTime,
                sourceLanguage: sessionData.sourceLanguage,
                targetLanguage: sessionData.targetLanguage,
                segmentCount: sessionData.segments.length,
                duration: sessionData.metadata.sessionDuration,
                hasAudio: !!sessionData.audio,
                directory: sessionDir,
                stats: sessionData.stats
            };
            
            // Remove existing entry if it exists (for updates)
            index.sessions = index.sessions.filter(s => s.sessionId !== sessionData.sessionId);
            
            // Add new entry at the beginning (most recent first)
            index.sessions.unshift(sessionEntry);
            
            // Keep only last 100 sessions to prevent index from growing too large
            index.sessions = index.sessions.slice(0, 100);
            
            // Save updated index
            await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
            
            console.log(`📇 OngoingTranslationService: Session index updated`);
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Index update error:', error);
            // Continue even if index update fails
        }
    }
    
    /**
     * Check if file exists
     * @param {string} filePath - File path to check
     * @returns {Promise<boolean>} - True if file exists
     * @private
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Export bilingual transcript
     * @param {string} format - Export format ('txt', 'json', 'srt')
     * @returns {Promise<string>} - Exported content
     */
    async exportBilingualTranscript(format = 'txt') {
        try {
            const segments = this.completedSegments;
            
            switch (format) {
                case 'txt':
                    return this.generateBilingualText(segments);
                case 'json':
                    return JSON.stringify(this.sessionData, null, 2);
                case 'srt':
                    return this.generateBilingualSRT(segments);
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Export error:', error);
            throw error;
        }
    }
    
    /**
     * Generate bilingual text export
     * @param {Array} segments - Sentence segments
     * @returns {string} - Bilingual text
     * @private
     */
    generateBilingualText(segments) {
        let content = `Bilingual Transcript - ${this.sessionData.startTime}\n`;
        content += `${this.getLanguageName(this.sourceLanguage)} → ${this.getLanguageName(this.targetLanguage)}\n`;
        content += '='.repeat(50) + '\n\n';
        
        segments.forEach((segment, index) => {
            const timestamp = this.formatTimestamp(segment.startTime);
            content += `[${index + 1}] ${timestamp}\n`;
            content += `Original: ${segment.text}\n`;
            if (segment.translatedText && segment.status === 'translated') {
                content += `Translation: ${segment.translatedText}\n`;
            } else {
                content += `Translation: [Not available]\n`;
            }
            content += '\n';
        });
        
        return content;
    }
    
    /**
     * Generate original-only text export
     * @param {Array} segments - Sentence segments
     * @returns {string} - Original text only
     * @private
     */
    generateOriginalOnlyText(segments) {
        let content = `Original Transcript - ${this.sessionData.startTime}\n`;
        content += `Language: ${this.getLanguageName(this.sourceLanguage)}\n`;
        content += '='.repeat(50) + '\n\n';
        
        segments.forEach((segment, index) => {
            const timestamp = this.formatTimestamp(segment.startTime);
            content += `[${index + 1}] ${timestamp}\n`;
            content += `${segment.text}\n\n`;
        });
        
        return content;
    }
    
    /**
     * Generate translated-only text export
     * @param {Array} segments - Sentence segments
     * @returns {string} - Translated text only
     * @private
     */
    generateTranslatedOnlyText(segments) {
        let content = `Translated Transcript - ${this.sessionData.startTime}\n`;
        content += `Language: ${this.getLanguageName(this.targetLanguage)}\n`;
        content += '='.repeat(50) + '\n\n';
        
        const translatedSegments = segments.filter(s => s.translatedText && s.status === 'translated');
        translatedSegments.forEach((segment, index) => {
            const timestamp = this.formatTimestamp(segment.startTime);
            content += `[${index + 1}] ${timestamp}\n`;
            content += `${segment.translatedText}\n\n`;
        });
        
        return content;
    }
    
    /**
     * Generate original-only SRT subtitles
     * @param {Array} segments - Sentence segments
     * @returns {string} - Original SRT content
     * @private
     */
    generateOriginalSRT(segments) {
        let srt = '';
        
        segments.forEach((segment, index) => {
            const startTime = this.formatSRTTime(segment.startTime);
            const endTime = this.formatSRTTime(segment.endTime);
            
            srt += `${index + 1}\n`;
            srt += `${startTime} --> ${endTime}\n`;
            srt += `${segment.text}\n\n`;
        });
        
        return srt;
    }
    
    /**
     * Generate translated-only SRT subtitles
     * @param {Array} segments - Sentence segments
     * @returns {string} - Translated SRT content
     * @private
     */
    generateTranslatedSRT(segments) {
        let srt = '';
        let subtitleIndex = 1;
        
        segments.forEach((segment) => {
            if (segment.translatedText && segment.status === 'translated') {
                const startTime = this.formatSRTTime(segment.startTime);
                const endTime = this.formatSRTTime(segment.endTime);
                
                srt += `${subtitleIndex}\n`;
                srt += `${startTime} --> ${endTime}\n`;
                srt += `${segment.translatedText}\n\n`;
                subtitleIndex++;
            }
        });
        
        return srt;
    }
    
    /**
     * Format timestamp for display (MM:SS)
     * @param {number} seconds - Time in seconds
     * @returns {string} - Formatted timestamp
     * @private
     */
    formatTimestamp(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Generate bilingual SRT subtitles
     * @param {Array} segments - Sentence segments
     * @returns {string} - SRT content
     * @private
     */
    generateBilingualSRT(segments) {
        let srt = '';
        
        segments.forEach((segment, index) => {
            if (segment.status === 'translated') {
                const startTime = this.formatSRTTime(segment.startTime);
                const endTime = this.formatSRTTime(segment.endTime);
                
                srt += `${index + 1}\n`;
                srt += `${startTime} --> ${endTime}\n`;
                srt += `${segment.text}\n`;
                srt += `${segment.translatedText}\n\n`;
            }
        });
        
        return srt;
    }
    
    /**
     * Format time for SRT
     * @param {number} seconds - Time in seconds
     * @returns {string} - Formatted time
     * @private
     */
    formatSRTTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
    }
    
    /**
     * Get current session status
     * @returns {Object} - Session status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            sessionId: this.sessionId,
            sourceLanguage: this.sourceLanguage,
            targetLanguage: this.targetLanguage,
            completedSegments: this.completedSegments.length,
            processingQueueSize: this.processingQueue.length,
            isProcessing: this.isProcessing,
            stats: { ...this.stats }
        };
    }
    
    /**
     * Get session statistics
     * @returns {Object} - Performance statistics
     */
    getStats() {
        const transcriptionAvg = this.stats.transcriptionLatency.length > 0 
            ? this.stats.transcriptionLatency.reduce((a, b) => a + b, 0) / this.stats.transcriptionLatency.length 
            : 0;
            
        const translationAvg = this.stats.translationLatency.length > 0 
            ? this.stats.translationLatency.reduce((a, b) => a + b, 0) / this.stats.translationLatency.length 
            : 0;
        
        return {
            chunksProcessed: this.stats.chunksProcessed,
            completedSegments: this.completedSegments.length,
            avgTranscriptionLatency: Math.round(transcriptionAvg),
            avgTranslationLatency: Math.round(translationAvg),
            totalLatency: Math.round(transcriptionAvg + translationAvg),
            errorCount: this.stats.errors,
            errorRate: this.stats.chunksProcessed > 0 ? (this.stats.errors / this.stats.chunksProcessed) : 0
        };
    }
    
    /**
     * Get error statistics from error handler
     * @returns {Object} - Error statistics
     */
    getErrorStats() {
        return this.errorHandler.getErrorStats();
    }
    
    /**
     * Clear error statistics
     */
    clearErrorStats() {
        this.errorHandler.clearErrorStats();
        this.stats.errors = 0;
        console.log('🧹 OngoingTranslationService: Error statistics cleared');
    }
    
    /**
     * Load a previous session from storage
     * @param {string} sessionId - Session ID to load
     * @returns {Promise<Object>} - Loaded session data
     */
    static async loadSession(sessionId) {
        try {
            const config = require('../config');
            const dataDir = config.get('app.dataDirectory') || path.join(process.cwd(), 'data');
            const sessionDir = path.join(dataDir, 'ongoing-translations', sessionId);
            const sessionDataPath = path.join(sessionDir, 'session.json');
            
            if (!await this.fileExists(sessionDataPath)) {
                throw new Error(`Session not found: ${sessionId}`);
            }
            
            const sessionContent = await fs.readFile(sessionDataPath, 'utf8');
            const sessionData = JSON.parse(sessionContent);
            
            console.log(`📂 OngoingTranslationService: Session loaded - ${sessionId}`);
            
            return {
                success: true,
                sessionData,
                sessionDir
            };
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Load error:', error);
            throw error;
        }
    }
    
    /**
     * Get list of all saved sessions
     * @param {Object} options - Query options (limit, offset, sortBy, etc.)
     * @returns {Promise<Object>} - Session list with metadata
     */
    static async getSessionList(options = {}) {
        try {
            const config = require('../config');
            const dataDir = config.get('app.dataDirectory') || path.join(process.cwd(), 'data');
            const indexPath = path.join(dataDir, 'ongoing-translations', 'session-index.json');
            
            // Load session index
            let index = { sessions: [] };
            if (await this.fileExists(indexPath)) {
                const indexContent = await fs.readFile(indexPath, 'utf8');
                index = JSON.parse(indexContent);
            }
            
            // Apply filtering and sorting
            let sessions = index.sessions;
            
            // Filter by language if specified
            if (options.sourceLanguage) {
                sessions = sessions.filter(s => s.sourceLanguage === options.sourceLanguage);
            }
            if (options.targetLanguage) {
                sessions = sessions.filter(s => s.targetLanguage === options.targetLanguage);
            }
            
            // Sort by specified field (default: startTime descending)
            const sortBy = options.sortBy || 'startTime';
            const sortOrder = options.sortOrder || 'desc';
            sessions.sort((a, b) => {
                if (sortOrder === 'desc') {
                    return new Date(b[sortBy]) - new Date(a[sortBy]);
                } else {
                    return new Date(a[sortBy]) - new Date(b[sortBy]);
                }
            });
            
            // Apply pagination
            const offset = options.offset || 0;
            const limit = options.limit || 50;
            const paginatedSessions = sessions.slice(offset, offset + limit);
            
            return {
                success: true,
                sessions: paginatedSessions,
                total: sessions.length,
                offset,
                limit
            };
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Session list error:', error);
            throw error;
        }
    }
    
    /**
     * Delete a session and its associated files
     * @param {string} sessionId - Session ID to delete
     * @returns {Promise<Object>} - Deletion result
     */
    static async deleteSession(sessionId) {
        try {
            const config = require('../config');
            const dataDir = config.get('app.dataDirectory') || path.join(process.cwd(), 'data');
            const sessionDir = path.join(dataDir, 'ongoing-translations', sessionId);
            
            // Remove session directory and all contents
            if (await this.fileExists(sessionDir)) {
                await fs.rmdir(sessionDir, { recursive: true });
            }
            
            // Update session index
            const indexPath = path.join(dataDir, 'ongoing-translations', 'session-index.json');
            if (await this.fileExists(indexPath)) {
                const indexContent = await fs.readFile(indexPath, 'utf8');
                const index = JSON.parse(indexContent);
                
                // Remove session from index
                index.sessions = index.sessions.filter(s => s.sessionId !== sessionId);
                
                // Save updated index
                await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
            }
            
            console.log(`🗑️ OngoingTranslationService: Session deleted - ${sessionId}`);
            
            return {
                success: true,
                sessionId,
                message: 'Session deleted successfully'
            };
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Delete error:', error);
            throw error;
        }
    }
    
    /**
     * Export a specific session in the requested format
     * @param {string} sessionId - Session ID to export
     * @param {string} format - Export format ('txt', 'srt', 'json')
     * @param {string} variant - Export variant ('bilingual', 'original', 'translated')
     * @returns {Promise<Object>} - Export result with file path
     */
    static async exportSession(sessionId, format = 'txt', variant = 'bilingual') {
        try {
            const sessionResult = await this.loadSession(sessionId);
            const sessionData = sessionResult.sessionData;
            const sessionDir = sessionResult.sessionDir;
            
            let exportPath;
            let content;
            
            // Determine export file path and generate content
            switch (format) {
                case 'txt':
                    switch (variant) {
                        case 'bilingual':
                            exportPath = path.join(sessionDir, 'bilingual_transcript.txt');
                            break;
                        case 'original':
                            exportPath = path.join(sessionDir, 'original_transcript.txt');
                            break;
                        case 'translated':
                            exportPath = path.join(sessionDir, 'translated_transcript.txt');
                            break;
                    }
                    break;
                    
                case 'srt':
                    switch (variant) {
                        case 'bilingual':
                            exportPath = path.join(sessionDir, 'bilingual_subtitles.srt');
                            break;
                        case 'original':
                            exportPath = path.join(sessionDir, 'original_subtitles.srt');
                            break;
                        case 'translated':
                            exportPath = path.join(sessionDir, 'translated_subtitles.srt');
                            break;
                    }
                    break;
                    
                case 'json':
                    exportPath = path.join(sessionDir, 'session.json');
                    break;
                    
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
            
            // Check if export file exists, if not create it
            if (!await this.fileExists(exportPath)) {
                throw new Error(`Export file not found: ${exportPath}. Session may need to be re-exported.`);
            }
            
            return {
                success: true,
                sessionId,
                format,
                variant,
                exportPath,
                sessionData: sessionData.metadata
            };
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Export error:', error);
            throw error;
        }
    }
    
    /**
     * Get storage statistics
     * @returns {Promise<Object>} - Storage statistics
     */
    static async getStorageStats() {
        try {
            const config = require('../config');
            const dataDir = config.get('app.dataDirectory') || path.join(process.cwd(), 'data');
            const sessionsDir = path.join(dataDir, 'ongoing-translations');
            
            if (!await this.fileExists(sessionsDir)) {
                return {
                    totalSessions: 0,
                    totalSize: 0,
                    oldestSession: null,
                    newestSession: null
                };
            }
            
            // Get session list
            const sessionList = await this.getSessionList({ limit: 1000 });
            const sessions = sessionList.sessions;
            
            // Calculate total size
            let totalSize = 0;
            for (const session of sessions) {
                try {
                    const sessionDir = session.directory;
                    const stats = await this.getDirectorySize(sessionDir);
                    totalSize += stats.size;
                } catch (error) {
                    console.warn(`Could not calculate size for session ${session.sessionId}:`, error.message);
                }
            }
            
            return {
                totalSessions: sessions.length,
                totalSize,
                totalSizeFormatted: this.formatBytes(totalSize),
                oldestSession: sessions.length > 0 ? sessions[sessions.length - 1] : null,
                newestSession: sessions.length > 0 ? sessions[0] : null
            };
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Storage stats error:', error);
            throw error;
        }
    }
    
    /**
     * Get total size of a directory
     * @param {string} dirPath - Directory path
     * @returns {Promise<Object>} - Size information
     * @private
     */
    static async getDirectorySize(dirPath) {
        let totalSize = 0;
        let fileCount = 0;
        
        const items = await fs.readdir(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory()) {
                const subDirStats = await this.getDirectorySize(itemPath);
                totalSize += subDirStats.size;
                fileCount += subDirStats.fileCount;
            } else {
                totalSize += stats.size;
                fileCount++;
            }
        }
        
        return { size: totalSize, fileCount };
    }
    
    /**
     * Format bytes into human readable format
     * @param {number} bytes - Bytes to format
     * @returns {string} - Formatted string
     * @private
     */
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Clean up old sessions based on age or count limits
     * @param {Object} options - Cleanup options
     * @returns {Promise<Object>} - Cleanup result
     */
    static async cleanupOldSessions(options = {}) {
        try {
            const maxAge = options.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 days default
            const maxCount = options.maxCount || 100; // Keep maximum 100 sessions
            
            const sessionList = await this.getSessionList({ limit: 1000 });
            let sessions = sessionList.sessions;
            
            const now = Date.now();
            let deletedCount = 0;
            
            // Delete sessions older than maxAge
            const expiredSessions = sessions.filter(session => {
                const sessionAge = now - new Date(session.startTime).getTime();
                return sessionAge > maxAge;
            });
            
            for (const session of expiredSessions) {
                await this.deleteSession(session.sessionId);
                deletedCount++;
            }
            
            // If still over maxCount, delete oldest sessions
            if (sessions.length - deletedCount > maxCount) {
                const remainingSessions = sessions.filter(session => 
                    !expiredSessions.find(expired => expired.sessionId === session.sessionId)
                );
                
                const sessionsToDelete = remainingSessions
                    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
                    .slice(0, remainingSessions.length - maxCount);
                
                for (const session of sessionsToDelete) {
                    await this.deleteSession(session.sessionId);
                    deletedCount++;
                }
            }
            
            console.log(`🧹 OngoingTranslationService: Cleaned up ${deletedCount} old sessions`);
            
            return {
                success: true,
                deletedCount,
                message: `Cleaned up ${deletedCount} old sessions`
            };
            
        } catch (error) {
            console.error('🌐 OngoingTranslationService: Cleanup error:', error);
            throw error;
        }
    }
    
    /**
     * Static helper method to check if file exists
     * @param {string} filePath - File path to check
     * @returns {Promise<boolean>} - True if file exists
     * @private
     */
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Retry failed translations
     * @returns {Promise<Object>} - Retry result
     */
    async retryFailedTranslations() {
        try {
            const failedSegments = this.completedSegments.filter(segment => 
                segment.status === 'error' || !segment.translatedText
            );
            
            if (failedSegments.length === 0) {
                return {
                    success: true,
                    message: 'No failed translations to retry',
                    retriedCount: 0
                };
            }
            
            console.log(`🔄 OngoingTranslationService: Retrying ${failedSegments.length} failed translations`);
            
            let successCount = 0;
            
            for (const segment of failedSegments) {
                try {
                    await this.translateSegment(segment);
                    if (segment.status === 'translated') {
                        successCount++;
                    }
                } catch (error) {
                    console.warn(`Failed to retry translation for segment ${segment.id}:`, error.message);
                }
            }
            
            return {
                success: true,
                message: `Retried ${failedSegments.length} translations, ${successCount} succeeded`,
                retriedCount: failedSegments.length,
                successCount
            };
            
        } catch (error) {
            console.error('🔄 OngoingTranslationService: Retry failed:', error);
            return {
                success: false,
                message: error.message,
                retriedCount: 0
            };
        }
    }
    
    /**
     * Enable fallback mode manually
     */
    enableFallbackMode() {
        this.errorHandler.enableFallbackMode();
        this.enterFallbackMode('manual', 'Fallback mode enabled manually');
    }
    
    /**
     * Disable fallback mode manually
     */
    disableFallbackMode() {
        this.errorHandler.disableFallbackMode();
        this.exitFallbackMode();
    }
    
    /**
     * Enter fallback mode
     * @param {string} reason - Reason for fallback
     * @param {string} message - User message
     * @private
     */
    enterFallbackMode(reason, message) {
        if (!this.isInFallbackMode) {
            this.isInFallbackMode = true;
            this.fallbackModeReason = reason;
            
            console.log(`🔄 OngoingTranslationService: Entered fallback mode - ${reason}`);
            
            this.emit('fallback-mode-activated', { reason, message });
        }
    }
    
    /**
     * Exit fallback mode
     * @private
     */
    exitFallbackMode() {
        if (this.isInFallbackMode) {
            this.isInFallbackMode = false;
            this.fallbackModeReason = null;
            
            console.log('✅ OngoingTranslationService: Exited fallback mode');
            
            this.emit('fallback-mode-deactivated');
        }
    }
}

module.exports = OngoingTranslationService;