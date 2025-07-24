# Error Handling for Ongoing Translation

## Overview

The ongoing translation feature must handle various error scenarios gracefully while maintaining a smooth user experience. This document outlines comprehensive error handling strategies for all components of the system.

## Error Categories

### 1. Audio Processing Errors

**Microphone Access Issues**
```javascript
class MicrophoneErrorHandler {
    static async handleMicrophoneAccess(error) {
        const errorTypes = {
            'NotAllowedError': {
                message: 'Microphone access denied. Please allow microphone access in your browser settings.',
                action: 'show_permissions_guide',
                recoverable: true
            },
            'NotFoundError': {
                message: 'No microphone found. Please connect a microphone and try again.',
                action: 'check_hardware',
                recoverable: true
            },
            'NotReadableError': {
                message: 'Microphone is being used by another application. Please close other applications and try again.',
                action: 'check_conflicts',
                recoverable: true
            },
            'OverconstrainedError': {
                message: 'Microphone settings are not supported. Trying with default settings.',
                action: 'fallback_settings',
                recoverable: true
            }
        };
        
        const errorInfo = errorTypes[error.name] || {
            message: `Microphone error: ${error.message}`,
            action: 'generic_error',
            recoverable: false
        };
        
        return errorInfo;
    }
}
```

**Audio Chunk Processing Errors**
```javascript
class AudioChunkErrorHandler {
    constructor() {
        this.chunkErrorCount = 0;
        this.maxConsecutiveErrors = 3;
        this.errorThreshold = 0.2; // 20% error rate threshold
    }
    
    handleChunkError(error, chunkId, chunkIndex) {
        this.chunkErrorCount++;
        
        const errorResponse = {
            chunkId,
            chunkIndex,
            error: error.message,
            timestamp: Date.now(),
            action: null
        };
        
        // Determine response based on error pattern
        if (this.chunkErrorCount >= this.maxConsecutiveErrors) {
            errorResponse.action = 'suspend_processing';
            errorResponse.message = 'Multiple audio processing failures. Checking system resources...';
            
            // Reset processing with lower quality settings
            this.reconfigureForStability();
        } else {
            errorResponse.action = 'skip_chunk';
            errorResponse.message = `Audio chunk ${chunkIndex} failed, continuing with next chunk`;
        }
        
        return errorResponse;
    }
    
    reconfigureForStability() {
        return {
            chunkSize: 5000, // Larger chunks
            quality: 'low', // Lower quality for stability
            sampleRate: 16000, // Standard rate
            bufferSize: 8192 // Larger buffer
        };
    }
}
```

### 2. Transcription Errors

**Whisper Service Errors**
```javascript
class TranscriptionErrorHandler {
    static handleWhisperError(error, audioChunk) {
        const errorStrategies = {
            'ModelNotFound': {
                strategy: 'fallback_model',
                fallbackModel: 'tiny',
                message: 'Selected model not available, using Tiny model instead'
            },
            'InsufficientMemory': {
                strategy: 'reduce_quality',
                newSettings: { chunkSize: 2000, model: 'tiny' },
                message: 'Reducing processing quality due to memory constraints'
            },
            'ProcessTimeout': {
                strategy: 'retry_smaller_chunk',
                newChunkSize: audioChunk.duration / 2,
                message: 'Transcription timeout, trying with smaller chunk'
            },
            'AudioFormatError': {
                strategy: 'convert_format',
                targetFormat: 'wav_16khz_mono',
                message: 'Converting audio format for compatibility'
            },
            'WhisperNotAvailable': {
                strategy: 'service_unavailable',
                message: 'Whisper service is not available. Please check installation.',
                recoverable: false
            }
        };
        
        const strategy = errorStrategies[error.type] || {
            strategy: 'generic_retry',
            message: `Transcription error: ${error.message}`,
            recoverable: true
        };
        
        return strategy;
    }
    
    static async executeRecoveryStrategy(strategy, audioChunk, transcriptionService) {
        switch (strategy.strategy) {
            case 'fallback_model':
                return await transcriptionService.transcribeChunk(audioChunk, {
                    model: strategy.fallbackModel
                });
                
            case 'reduce_quality':
                return await transcriptionService.transcribeChunk(audioChunk, strategy.newSettings);
                
            case 'retry_smaller_chunk':
                const smallerChunk = this.splitAudioChunk(audioChunk, 2);
                const results = await Promise.all(
                    smallerChunk.map(chunk => 
                        transcriptionService.transcribeChunk(chunk)
                    )
                );
                return this.mergeTranscriptionResults(results);
                
            case 'convert_format':
                const convertedChunk = await this.convertAudioFormat(audioChunk, strategy.targetFormat);
                return await transcriptionService.transcribeChunk(convertedChunk);
                
            default:
                throw new Error(`Recovery strategy not implemented: ${strategy.strategy}`);
        }
    }
}
```

### 3. Translation Errors

**Ollama Service Errors**
```javascript
class TranslationErrorHandler {
    constructor() {
        this.translationFailures = new Map(); // sentence_id -> failure_count
        this.maxRetries = 3;
        this.circuitBreakerThreshold = 5;
        this.circuitBreakerTimeout = 30000; // 30 seconds
        this.isCircuitOpen = false;
        this.lastCircuitOpenTime = null;
    }
    
    async handleTranslationError(error, sentence, sourceLanguage, targetLanguage) {
        // Check circuit breaker
        if (this.isCircuitOpen) {
            if (Date.now() - this.lastCircuitOpenTime > this.circuitBreakerTimeout) {
                this.isCircuitOpen = false;
                console.log('Translation circuit breaker reset');
            } else {
                return this.bypassTranslation(sentence, 'circuit_breaker');
            }
        }
        
        const failureCount = this.translationFailures.get(sentence.id) || 0;
        this.translationFailures.set(sentence.id, failureCount + 1);
        
        const errorType = this.categorizeTranslationError(error);
        
        switch (errorType) {
            case 'connection_error':
                return await this.handleConnectionError(sentence, sourceLanguage, targetLanguage);
                
            case 'timeout_error':
                return await this.handleTimeoutError(sentence, sourceLanguage, targetLanguage);
                
            case 'model_error':
                return await this.handleModelError(sentence, sourceLanguage, targetLanguage);
                
            case 'rate_limit_error':
                return await this.handleRateLimitError(sentence, sourceLanguage, targetLanguage);
                
            case 'service_unavailable':
                this.triggerCircuitBreaker();
                return this.bypassTranslation(sentence, 'service_unavailable');
                
            default:
                if (failureCount < this.maxRetries) {
                    return await this.retryWithBackoff(sentence, sourceLanguage, targetLanguage, failureCount);
                } else {
                    return this.bypassTranslation(sentence, 'max_retries_exceeded');
                }
        }
    }
    
    categorizeTranslationError(error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('connection') || errorMessage.includes('network')) {
            return 'connection_error';
        } else if (errorMessage.includes('timeout')) {
            return 'timeout_error';
        } else if (errorMessage.includes('model') || errorMessage.includes('not found')) {
            return 'model_error';
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
            return 'rate_limit_error';
        } else if (errorMessage.includes('unavailable') || errorMessage.includes('service')) {
            return 'service_unavailable';
        } else {
            return 'unknown_error';
        }
    }
    
    async handleConnectionError(sentence, sourceLanguage, targetLanguage) {
        // Try to reconnect to Ollama
        try {
            await this.ollamaService.testConnection();
            // If connection is restored, retry translation
            return await this.translateWithFallbackPrompt(sentence, sourceLanguage, targetLanguage);
        } catch (connectionError) {
            return this.bypassTranslation(sentence, 'connection_failed');
        }
    }
    
    async handleTimeoutError(sentence, sourceLanguage, targetLanguage) {
        // Try with a simpler, faster prompt
        const simplePrompt = `Translate to ${this.getLanguageName(targetLanguage)}: ${sentence.text}`;
        
        try {
            const result = await this.ollamaService.refineText(sentence.text, simplePrompt, {
                timeout: 10000, // Shorter timeout
                temperature: 0.1
            });
            
            if (result.success) {
                return {
                    success: true,
                    translatedText: this.cleanTranslationOutput(result.refinedText),
                    method: 'simple_prompt_fallback'
                };
            }
        } catch (fallbackError) {
            console.warn('Simple prompt fallback also failed:', fallbackError.message);
        }
        
        return this.bypassTranslation(sentence, 'timeout_persistent');
    }
    
    async handleModelError(sentence, sourceLanguage, targetLanguage) {
        // Try with a different, more available model
        const fallbackModels = ['llama3:8b', 'gemma3:8b', 'phi3:mini'];
        
        for (const model of fallbackModels) {
            try {
                const result = await this.ollamaService.refineText(
                    sentence.text,
                    this.generateSimpleTranslationPrompt(sentence.text, sourceLanguage, targetLanguage),
                    { model }
                );
                
                if (result.success) {
                    return {
                        success: true,
                        translatedText: this.cleanTranslationOutput(result.refinedText),
                        method: `fallback_model_${model}`
                    };
                }
            } catch (modelError) {
                console.warn(`Fallback model ${model} also failed:`, modelError.message);
                continue;
            }
        }
        
        return this.bypassTranslation(sentence, 'all_models_failed');
    }
    
    triggerCircuitBreaker() {
        this.isCircuitOpen = true;
        this.lastCircuitOpenTime = Date.now();
        console.warn('Translation circuit breaker triggered - bypassing translations temporarily');
        
        // Notify UI about circuit breaker state
        window.electronAPI.emit('translation-circuit-breaker', {
            state: 'open',
            duration: this.circuitBreakerTimeout
        });
    }
    
    bypassTranslation(sentence, reason) {
        const bypassStrategies = {
            'circuit_breaker': {
                text: sentence.text,
                indicator: ' (Translation temporarily unavailable)',
                showOriginal: true
            },
            'service_unavailable': {
                text: sentence.text,
                indicator: ' (Translation service offline)',
                showOriginal: true
            },
            'connection_failed': {
                text: sentence.text,
                indicator: ' (Connection error)',
                showOriginal: true
            },
            'max_retries_exceeded': {
                text: sentence.text,
                indicator: ' (Translation failed)',
                showOriginal: true
            },
            'timeout_persistent': {
                text: sentence.text,
                indicator: ' (Translation timeout)',
                showOriginal: true
            }
        };
        
        const strategy = bypassStrategies[reason] || bypassStrategies['service_unavailable'];
        
        return {
            success: false,
            translatedText: strategy.text + strategy.indicator,
            showOriginal: strategy.showOriginal,
            bypassReason: reason,
            method: 'bypass'
        };
    }
}
```

### 4. UI/UX Error Handling

**User Interface Error States**
```javascript
class UIErrorHandler {
    static displayError(errorType, errorData, container) {
        const errorTemplates = {
            'microphone_access': {
                icon: '🎤',
                title: 'Microphone Access Required',
                message: errorData.message,
                actions: [
                    {
                        label: 'Show Help',
                        action: 'showPermissionsGuide'
                    },
                    {
                        label: 'Try Again',
                        action: 'retryMicrophoneAccess'
                    }
                ]
            },
            'transcription_failed': {
                icon: '⚠️',
                title: 'Transcription Error',
                message: 'Unable to transcribe audio. Recording will continue.',
                actions: [
                    {
                        label: 'Continue',
                        action: 'dismissError'
                    },
                    {
                        label: 'Settings',
                        action: 'openTranscriptionSettings'
                    }
                ]
            },
            'translation_degraded': {
                icon: '🔄',
                title: 'Translation Issues',
                message: 'Translation quality may be reduced. Some text may show in original language.',
                actions: [
                    {
                        label: 'Continue',
                        action: 'dismissError'
                    },
                    {
                        label: 'Check Settings',
                        action: 'openOllamaSettings'
                    }
                ]
            },
            'service_offline': {
                icon: '🔌',
                title: 'Service Unavailable',
                message: 'Translation service is offline. Only transcription is available.',
                actions: [
                    {
                        label: 'Continue with Transcription Only',
                        action: 'continueTranscriptionOnly'
                    },
                    {
                        label: 'Retry Connection',
                        action: 'retryConnection'
                    }
                ]
            }
        };
        
        const template = errorTemplates[errorType] || this.getGenericErrorTemplate(errorData);
        
        return this.renderErrorUI(template, container);
    }
    
    static renderErrorUI(template, container) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-notification';
        errorElement.innerHTML = `
            <div class="error-content">
                <div class="error-icon">${template.icon}</div>
                <div class="error-details">
                    <h4 class="error-title">${template.title}</h4>
                    <p class="error-message">${template.message}</p>
                </div>
                <div class="error-actions">
                    ${template.actions.map(action => 
                        `<button class="btn btn-sm error-action" data-action="${action.action}">
                            ${action.label}
                        </button>`
                    ).join('')}
                </div>
            </div>
        `;
        
        // Add event listeners for action buttons
        errorElement.querySelectorAll('.error-action').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleErrorAction(action, errorElement);
            });
        });
        
        container.appendChild(errorElement);
        
        // Auto-dismiss after timeout for non-critical errors
        if (template.autoDismiss) {
            setTimeout(() => {
                this.dismissError(errorElement);
            }, template.autoDismiss);
        }
        
        return errorElement;
    }
    
    static handleErrorAction(action, errorElement) {
        switch (action) {
            case 'dismissError':
                this.dismissError(errorElement);
                break;
                
            case 'showPermissionsGuide':
                this.showMicrophonePermissionsGuide();
                break;
                
            case 'retryMicrophoneAccess':
                window.ongoingTranslationApp.retryMicrophoneAccess();
                this.dismissError(errorElement);
                break;
                
            case 'openTranscriptionSettings':
                window.ongoingTranslationApp.openSettings('transcription');
                this.dismissError(errorElement);
                break;
                
            case 'openOllamaSettings':
                window.ongoingTranslationApp.openSettings('ollama');
                this.dismissError(errorElement);
                break;
                
            case 'continueTranscriptionOnly':
                window.ongoingTranslationApp.disableTranslation();
                this.dismissError(errorElement);
                break;
                
            case 'retryConnection':
                window.ongoingTranslationApp.retryOllamaConnection();
                this.dismissError(errorElement);
                break;
        }
    }
}
```

## Error Recovery Workflows

### Automatic Recovery Procedures

```javascript
class ErrorRecoveryManager {
    constructor() {
        this.recoveryQueue = [];
        this.isRecovering = false;
        this.recoveryStrategies = new Map();
        this.systemHealthMetrics = {
            audioErrors: 0,
            transcriptionErrors: 0,
            translationErrors: 0,
            lastHealthCheck: Date.now()
        };
    }
    
    async initiateRecovery(errorType, errorData) {
        const recoveryPlan = this.createRecoveryPlan(errorType, errorData);
        
        if (recoveryPlan.automatic) {
            return await this.executeAutomaticRecovery(recoveryPlan);
        } else {
            return await this.requestUserIntervention(recoveryPlan);
        }
    }
    
    createRecoveryPlan(errorType, errorData) {
        const recoveryPlans = {
            'audio_chunk_failure': {
                automatic: true,
                steps: [
                    'skip_failed_chunk',
                    'adjust_chunk_size',
                    'lower_audio_quality'
                ],
                timeout: 5000
            },
            'transcription_service_down': {
                automatic: true,
                steps: [
                    'check_whisper_process',
                    'restart_whisper_service',
                    'fallback_to_simple_model'
                ],
                timeout: 15000
            },
            'translation_service_down': {
                automatic: true,
                steps: [
                    'check_ollama_connection',
                    'restart_ollama_service',
                    'enable_transcription_only_mode'
                ],
                timeout: 30000
            },
            'microphone_access_denied': {
                automatic: false,
                steps: [
                    'show_permissions_guide',
                    'wait_for_user_action'
                ],
                requiresUser: true
            },
            'system_resource_exhaustion': {
                automatic: true,
                steps: [
                    'reduce_processing_quality',
                    'increase_chunk_intervals',
                    'free_memory_resources',
                    'warn_user_if_persistence'
                ],
                timeout: 10000
            }
        };
        
        return recoveryPlans[errorType] || this.getDefaultRecoveryPlan(errorType, errorData);
    }
    
    async executeAutomaticRecovery(recoveryPlan) {
        this.isRecovering = true;
        
        try {
            for (const step of recoveryPlan.steps) {
                const stepResult = await this.executeRecoveryStep(step);
                
                if (stepResult.success) {
                    console.log(`Recovery step successful: ${step}`);
                    if (stepResult.recoveryComplete) {
                        break;
                    }
                } else {
                    console.warn(`Recovery step failed: ${step} - ${stepResult.error}`);
                    if (stepResult.critical) {
                        throw new Error(`Critical recovery step failed: ${step}`);
                    }
                }
            }
            
            return { success: true, message: 'System recovered automatically' };
        } catch (error) {
            return { success: false, message: error.message, requiresManualIntervention: true };
        } finally {
            this.isRecovering = false;
        }
    }
    
    async executeRecoveryStep(step) {
        const stepHandlers = {
            'skip_failed_chunk': () => {
                // Skip the current problematic chunk
                return { success: true, recoveryComplete: false };
            },
            
            'adjust_chunk_size': () => {
                // Increase chunk size for more stable processing
                const newChunkSize = Math.min(this.currentChunkSize * 1.5, 10000);
                this.updateChunkSize(newChunkSize);
                return { success: true, recoveryComplete: false };
            },
            
            'check_whisper_process': async () => {
                try {
                    const status = await window.electronAPI.checkWhisperStatus();
                    return { success: status.running, recoveryComplete: status.running };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },
            
            'restart_whisper_service': async () => {
                try {
                    await window.electronAPI.restartWhisperService();
                    // Wait for service to be ready
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    return { success: true, recoveryComplete: true };
                } catch (error) {
                    return { success: false, error: error.message, critical: true };
                }
            },
            
            'check_ollama_connection': async () => {
                try {
                    const result = await this.ollamaService.testConnection();
                    return { success: result.success, recoveryComplete: result.success };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },
            
            'enable_transcription_only_mode': () => {
                this.disableTranslationFeatures();
                this.notifyUserTranscriptionOnly();
                return { success: true, recoveryComplete: true };
            }
        };
        
        const handler = stepHandlers[step];
        if (handler) {
            return await handler();
        } else {
            return { success: false, error: `Unknown recovery step: ${step}` };
        }
    }
}
```

## User Communication Strategy

### Error Messaging Guidelines

```javascript
const ErrorMessages = {
    // User-friendly error messages
    userFriendly: {
        'microphone_not_found': 'No microphone detected. Please connect a microphone and try again.',
        'microphone_busy': 'Your microphone is being used by another application. Please close other apps that might be using it.',
        'whisper_not_installed': 'The speech recognition system isn\'t set up yet. Would you like to install it now?',
        'ollama_disconnected': 'The translation service is offline. You can continue with transcription only, or check your Ollama installation.',
        'processing_slow': 'Processing is taking longer than usual. This might be due to high system load.',
        'translation_quality_low': 'Translation quality is reduced due to system constraints. Consider closing other applications.'
    },
    
    // Technical details for debugging (shown only in debug mode)
    technical: {
        'microphone_not_found': 'Navigator.mediaDevices.getUserMedia failed with NotFoundError',
        'microphone_busy': 'MediaRecorder initialization failed - device busy',
        'whisper_not_installed': 'Whisper binary not found at expected paths',
        'ollama_disconnected': 'Ollama API connection failed at http://localhost:11434',
        'processing_slow': 'Average processing time exceeded threshold (>10s per chunk)',
        'translation_quality_low': 'Translation confidence below 0.6 threshold'
    },
    
    getUserMessage(errorCode, includeDetails = false) {
        const userMsg = this.userFriendly[errorCode] || 'An unexpected error occurred.';
        const techMsg = this.technical[errorCode];
        
        if (includeDetails && techMsg) {
            return `${userMsg}\n\nTechnical details: ${techMsg}`;
        }
        
        return userMsg;
    }
};
```

## Monitoring and Diagnostics

### Error Tracking System

```javascript
class ErrorMonitor {
    constructor() {
        this.errorLog = [];
        this.errorStats = new Map();
        this.diagnosticsEnabled = true;
    }
    
    logError(errorType, errorData, context) {
        const errorEntry = {
            timestamp: Date.now(),
            type: errorType,
            data: errorData,
            context: context,
            sessionId: this.currentSessionId,
            userId: this.getUserId(),
            systemInfo: this.getSystemInfo()
        };
        
        this.errorLog.push(errorEntry);
        this.updateErrorStats(errorType);
        
        // Send to monitoring service if enabled
        if (this.diagnosticsEnabled) {
            this.sendDiagnostics(errorEntry);
        }
        
        // Trigger alerts for critical errors
        if (this.isCriticalError(errorType)) {
            this.triggerAlert(errorEntry);
        }
    }
    
    generateDiagnosticReport() {
        return {
            timestamp: Date.now(),
            sessionInfo: {
                id: this.currentSessionId,
                duration: this.getSessionDuration(),
                processingStats: this.getProcessingStats()
            },
            errorSummary: {
                totalErrors: this.errorLog.length,
                errorsByType: Object.fromEntries(this.errorStats),
                criticalErrors: this.errorLog.filter(e => this.isCriticalError(e.type)).length
            },
            systemHealth: this.getSystemHealthMetrics(),
            recentErrors: this.errorLog.slice(-10) // Last 10 errors
        };
    }
}
```

This comprehensive error handling system ensures that the ongoing translation feature remains functional and user-friendly even when encountering various technical issues.