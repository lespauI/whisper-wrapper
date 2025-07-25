/**
 * Translation Error Handler Service
 * 
 * Provides comprehensive error handling, recovery strategies, and graceful degradation
 * for the ongoing translation system.
 */

const EventEmitter = require('events');

class TranslationErrorHandler extends EventEmitter {
    constructor() {
        super();
        
        // Error tracking and statistics
        this.errorStats = {
            transcriptionErrors: 0,
            translationErrors: 0,
            recoveryAttempts: 0,
            successfulRecoveries: 0,
            circuitBreakerActivations: 0
        };
        
        // Circuit breaker configuration
        this.circuitBreaker = {
            translationFailureCount: 0,
            maxFailures: 5,
            timeout: 30000, // 30 seconds
            isOpen: false,
            lastOpenTime: null
        };
        
        // Error retry configuration
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000, // 1 second
            maxDelay: 8000, // 8 seconds
            backoffMultiplier: 2
        };
        
        // Fallback mode state
        this.fallbackMode = {
            isActive: false,
            reason: null,
            activatedAt: null,
            autoRecoveryEnabled: true
        };
        
        // User notification queue
        this.notificationQueue = [];
        this.maxNotifications = 5;
        
        console.log('🛡️ TranslationErrorHandler: Service initialized');
    }
    
    /**
     * Handle errors with comprehensive recovery strategies
     * @param {Error} error - The error to handle
     * @param {string} context - Error context (transcription, translation, etc.)
     * @param {Object} metadata - Additional error metadata
     * @returns {Promise<Object>} Recovery result
     */
    async handleError(error, context, metadata = {}) {
        const errorId = this.generateErrorId();
        const timestamp = Date.now();
        
        console.error(`🛡️ TranslationErrorHandler: Handling ${context} error - ${errorId}:`, error.message);
        
        // Log error with context
        this.logError(error, context, metadata, errorId, timestamp);
        
        // Update error statistics
        this.updateErrorStats(context);
        
        // Determine error category and severity
        const errorCategory = this.categorizeError(error, context);
        const severity = this.assessErrorSeverity(error, context, metadata);
        
        // Check circuit breaker status
        if (context === 'translation') {
            this.updateCircuitBreaker(error);
        }
        
        // Generate recovery strategy
        const recoveryStrategy = await this.generateRecoveryStrategy(
            error, 
            context, 
            errorCategory, 
            severity, 
            metadata
        );
        
        // Create user notification
        const userNotification = this.createUserNotification(
            error, 
            context, 
            recoveryStrategy, 
            severity
        );
        
        // Execute recovery strategy
        const recoveryResult = await this.executeRecoveryStrategy(
            recoveryStrategy, 
            error, 
            context, 
            metadata
        );
        
        // Emit error event for UI updates
        this.emit('error-handled', {
            errorId,
            timestamp,
            context,
            category: errorCategory,
            severity,
            recovery: recoveryResult,
            notification: userNotification
        });
        
        return recoveryResult;
    }
    
    /**
     * Categorize errors by type and cause
     * @param {Error} error - The error to categorize
     * @param {string} context - Error context
     * @returns {string} Error category
     */
    categorizeError(error, context) {
        const message = error.message.toLowerCase();
        
        // Network and connection errors
        if (message.includes('connection') || 
            message.includes('network') || 
            message.includes('timeout') ||
            message.includes('fetch failed')) {
            return 'connection_error';
        }
        
        // Service availability errors
        if (message.includes('service unavailable') ||
            message.includes('not available') ||
            message.includes('server error') ||
            message.includes('internal server error')) {
            return 'service_unavailable';
        }
        
        // Resource/capacity errors
        if (message.includes('memory') ||
            message.includes('cpu') ||
            message.includes('resource') ||
            message.includes('capacity')) {
            return 'resource_error';
        }
        
        // Configuration errors
        if (message.includes('model not found') ||
            message.includes('configuration') ||
            message.includes('invalid') ||
            message.includes('not supported')) {
            return 'configuration_error';
        }
        
        // Rate limiting errors
        if (message.includes('rate limit') ||
            message.includes('too many requests') ||
            message.includes('quota exceeded')) {
            return 'rate_limit_error';
        }
        
        // Audio processing errors
        if (context === 'transcription' && (
            message.includes('audio') ||
            message.includes('format') ||
            message.includes('codec'))) {
            return 'audio_processing_error';
        }
        
        return 'unknown_error';
    }
    
    /**
     * Assess error severity level
     * @param {Error} error - The error to assess
     * @param {string} context - Error context
     * @param {Object} metadata - Error metadata
     * @returns {string} Severity level
     */
    assessErrorSeverity(error, context, metadata) {
        const category = this.categorizeError(error, context);
        
        // Critical errors that require immediate attention
        if (category === 'configuration_error' || 
            category === 'audio_processing_error') {
            return 'critical';
        }
        
        // High severity errors that impact functionality significantly
        if (category === 'service_unavailable' || 
            category === 'resource_error') {
            return 'high';
        }
        
        // Medium severity errors that can be worked around
        if (category === 'connection_error' || 
            category === 'rate_limit_error') {
            return 'medium';
        }
        
        // Low severity errors that have minimal impact
        return 'low';
    }
    
    /**
     * Generate appropriate recovery strategy
     * @param {Error} error - The error
     * @param {string} context - Error context
     * @param {string} category - Error category
     * @param {string} severity - Error severity
     * @param {Object} metadata - Error metadata
     * @returns {Object} Recovery strategy
     */
    async generateRecoveryStrategy(error, context, category, severity, metadata) {
        const strategy = {
            action: 'unknown',
            shouldRetry: false,
            retryDelay: 0,
            fallbackAction: null,
            userMessage: null,
            techDetails: error.message
        };
        
        // Handle by category
        switch (category) {
            case 'connection_error':
                strategy.action = 'retry_with_backoff';
                strategy.shouldRetry = true;
                strategy.retryDelay = this.calculateRetryDelay(metadata.attempt || 1);
                strategy.fallbackAction = 'enable_fallback_mode';
                strategy.userMessage = 'Connection issue detected. Retrying...';
                break;
                
            case 'service_unavailable':
                if (context === 'translation') {
                    strategy.action = 'enable_transcription_only';
                    strategy.fallbackAction = 'show_original_text';
                    strategy.userMessage = 'Translation service temporarily unavailable. Showing transcription only.';
                } else {
                    strategy.action = 'retry_with_delay';
                    strategy.shouldRetry = true;
                    strategy.retryDelay = 5000;
                    strategy.userMessage = 'Service temporarily unavailable. Retrying...';
                }
                break;
                
            case 'resource_error':
                strategy.action = 'reduce_quality';
                strategy.fallbackAction = 'use_fallback_model';
                strategy.userMessage = 'Processing quality reduced due to system constraints.';
                break;
                
            case 'rate_limit_error':
                strategy.action = 'delay_and_retry';
                strategy.shouldRetry = true;
                strategy.retryDelay = 10000; // 10 seconds
                strategy.userMessage = 'Rate limit reached. Please wait...';
                break;
                
            case 'configuration_error':
                strategy.action = 'use_fallback_config';
                strategy.fallbackAction = 'notify_user_action_required';
                strategy.userMessage = 'Configuration issue detected. Using default settings.';
                break;
                
            case 'audio_processing_error':
                strategy.action = 'skip_chunk';
                strategy.fallbackAction = 'continue_processing';
                strategy.userMessage = 'Audio processing issue. Continuing with next segment.';
                break;
                
            default:
                strategy.action = 'log_and_continue';
                strategy.fallbackAction = 'show_error_state';
                strategy.userMessage = 'An unexpected error occurred. Continuing...';
        }
        
        // Apply circuit breaker logic for translation errors
        if (context === 'translation' && this.circuitBreaker.isOpen) {
            strategy.action = 'circuit_breaker_bypass';
            strategy.shouldRetry = false;
            strategy.fallbackAction = 'show_original_text';
            strategy.userMessage = 'Translation temporarily disabled due to multiple failures.';
        }
        
        return strategy;
    }
    
    /**
     * Execute recovery strategy
     * @param {Object} strategy - Recovery strategy to execute
     * @param {Error} error - Original error
     * @param {string} context - Error context
     * @param {Object} metadata - Error metadata
     * @returns {Promise<Object>} Execution result
     */
    async executeRecoveryStrategy(strategy, error, context, metadata) {
        const result = {
            success: false,
            action: strategy.action,
            message: strategy.userMessage,
            shouldRetry: strategy.shouldRetry,
            retryDelay: strategy.retryDelay,
            newConfiguration: null
        };
        
        try {
            switch (strategy.action) {
                case 'retry_with_backoff':
                case 'delay_and_retry':
                    result.success = true;
                    result.shouldRetry = true;
                    this.errorStats.recoveryAttempts++;
                    break;
                    
                case 'enable_transcription_only':
                    await this.enableTranscriptionOnlyMode();
                    result.success = true;
                    result.message = 'Switched to transcription-only mode';
                    break;
                    
                case 'reduce_quality':
                    const newConfig = await this.getReducedQualityConfig();
                    result.success = true;
                    result.newConfiguration = newConfig;
                    result.message = 'Reduced processing quality to improve stability';
                    break;
                    
                case 'use_fallback_config':
                    const fallbackConfig = await this.getFallbackConfiguration(context);
                    result.success = true;
                    result.newConfiguration = fallbackConfig;
                    result.message = 'Applied fallback configuration';
                    break;
                    
                case 'skip_chunk':
                    result.success = true;
                    result.shouldBypass = true;
                    result.message = 'Skipped problematic audio segment';
                    break;
                    
                case 'circuit_breaker_bypass':
                    result.success = true;
                    result.showOriginalOnly = true;
                    result.message = 'Translation bypassed - showing original text only';
                    break;
                    
                case 'enable_fallback_mode':
                    await this.enableFallbackMode(strategy.userMessage);
                    result.success = true;
                    break;
                    
                default:
                    result.success = false;
                    result.message = 'No recovery action available';
            }
            
            if (result.success) {
                this.errorStats.successfulRecoveries++;
            }
            
        } catch (recoveryError) {
            console.error('🛡️ TranslationErrorHandler: Recovery strategy failed:', recoveryError);
            result.success = false;
            result.message = 'Recovery attempt failed';
        }
        
        return result;
    }
    
    /**
     * Update circuit breaker state for translation errors
     * @param {Error} error - Translation error
     */
    updateCircuitBreaker(error) {
        this.circuitBreaker.translationFailureCount++;
        
        if (this.circuitBreaker.translationFailureCount >= this.circuitBreaker.maxFailures) {
            if (!this.circuitBreaker.isOpen) {
                console.warn('🛡️ TranslationErrorHandler: Circuit breaker activated');
                this.circuitBreaker.isOpen = true;
                this.circuitBreaker.lastOpenTime = Date.now();
                this.errorStats.circuitBreakerActivations++;
                
                // Schedule automatic reset
                setTimeout(() => {
                    this.resetCircuitBreaker();
                }, this.circuitBreaker.timeout);
                
                // Emit circuit breaker event
                this.emit('circuit-breaker-activated', {
                    failureCount: this.circuitBreaker.translationFailureCount,
                    timeout: this.circuitBreaker.timeout
                });
            }
        }
    }
    
    /**
     * Reset circuit breaker to closed state
     */
    resetCircuitBreaker() {
        console.log('🛡️ TranslationErrorHandler: Circuit breaker reset');
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.translationFailureCount = 0;
        this.circuitBreaker.lastOpenTime = null;
        
        this.emit('circuit-breaker-reset');
    }
    
    /**
     * Enable transcription-only mode
     */
    async enableTranscriptionOnlyMode() {
        this.fallbackMode.isActive = true;
        this.fallbackMode.reason = 'translation_service_failure';
        this.fallbackMode.activatedAt = Date.now();
        
        console.log('🛡️ TranslationErrorHandler: Enabled transcription-only mode');
        
        this.emit('fallback-mode-activated', {
            mode: 'transcription_only',
            reason: this.fallbackMode.reason
        });
    }
    
    /**
     * Get reduced quality configuration
     * @returns {Object} Reduced quality configuration
     */
    async getReducedQualityConfig() {
        return {
            chunkSize: 5000, // Larger chunks
            model: 'tiny', // Smaller model
            threads: 2, // Fewer threads
            quality: 'low',
            timeout: 15000 // Longer timeout
        };
    }
    
    /**
     * Get fallback configuration for context
     * @param {string} context - Error context
     * @returns {Object} Fallback configuration
     */
    async getFallbackConfiguration(context) {
        const configs = {
            transcription: {
                model: 'tiny',
                language: 'en',
                threads: 1,
                timeout: 30000
            },
            translation: {
                model: 'phi3:mini',
                temperature: 0.1,
                timeout: 10000,
                maxTokens: 500
            }
        };
        
        return configs[context] || {};
    }
    
    /**
     * Enable general fallback mode
     * @param {string} reason - Reason for enabling fallback mode
     */
    async enableFallbackMode(reason) {
        this.fallbackMode.isActive = true;
        this.fallbackMode.reason = reason;
        this.fallbackMode.activatedAt = Date.now();
        
        console.log(`🛡️ TranslationErrorHandler: Enabled fallback mode - ${reason}`);
        
        this.emit('fallback-mode-activated', {
            reason: reason,
            timestamp: this.fallbackMode.activatedAt
        });
    }
    
    /**
     * Calculate retry delay with exponential backoff
     * @param {number} attempt - Attempt number (1-based)
     * @returns {number} Delay in milliseconds
     */
    calculateRetryDelay(attempt) {
        const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
            this.retryConfig.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.1 * delay;
        return Math.floor(delay + jitter);
    }
    
    /**
     * Create user-friendly notification
     * @param {Error} error - The error
     * @param {string} context - Error context
     * @param {Object} strategy - Recovery strategy
     * @param {string} severity - Error severity
     * @returns {Object} User notification
     */
    createUserNotification(error, context, strategy, severity) {
        const notification = {
            id: this.generateErrorId(),
            timestamp: Date.now(),
            type: severity,
            context: context,
            message: strategy.userMessage,
            actionRequired: false,
            autoHide: true,
            duration: 5000
        };
        
        // Customize based on severity
        switch (severity) {
            case 'critical':
                notification.autoHide = false;
                notification.actionRequired = true;
                notification.duration = 0;
                break;
            case 'high':
                notification.duration = 10000;
                break;
            case 'medium':
                notification.duration = 7000;
                break;
            default:
                notification.duration = 5000;
        }
        
        // Add to notification queue
        this.addNotification(notification);
        
        return notification;
    }
    
    /**
     * Add notification to queue
     * @param {Object} notification - Notification to add
     */
    addNotification(notification) {
        this.notificationQueue.push(notification);
        
        // Limit queue size
        if (this.notificationQueue.length > this.maxNotifications) {
            this.notificationQueue.shift();
        }
        
        this.emit('notification-added', notification);
    }
    
    /**
     * Update error statistics
     * @param {string} context - Error context
     */
    updateErrorStats(context) {
        switch (context) {
            case 'transcription':
                this.errorStats.transcriptionErrors++;
                break;
            case 'translation':
                this.errorStats.translationErrors++;
                break;
        }
    }
    
    /**
     * Log error with full context
     * @param {Error} error - The error
     * @param {string} context - Error context
     * @param {Object} metadata - Error metadata
     * @param {string} errorId - Error ID
     * @param {number} timestamp - Error timestamp
     */
    logError(error, context, metadata, errorId, timestamp) {
        const logEntry = {
            errorId,
            timestamp,
            context,
            message: error.message,
            stack: error.stack,
            metadata,
            stats: { ...this.errorStats }
        };
        
        console.error('🛡️ TranslationErrorHandler: Error logged:', JSON.stringify(logEntry, null, 2));
    }
    
    /**
     * Generate unique error ID
     * @returns {string} Error ID
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get current error statistics
     * @returns {Object} Error statistics
     */
    getErrorStats() {
        return {
            ...this.errorStats,
            circuitBreakerStatus: {
                isOpen: this.circuitBreaker.isOpen,
                failureCount: this.circuitBreaker.translationFailureCount,
                lastOpenTime: this.circuitBreaker.lastOpenTime
            },
            fallbackModeStatus: {
                isActive: this.fallbackMode.isActive,
                reason: this.fallbackMode.reason,
                activatedAt: this.fallbackMode.activatedAt
            }
        };
    }
    
    /**
     * Reset error statistics
     */
    resetErrorStats() {
        this.errorStats = {
            transcriptionErrors: 0,
            translationErrors: 0,
            recoveryAttempts: 0,
            successfulRecoveries: 0,
            circuitBreakerActivations: 0
        };
        
        console.log('🛡️ TranslationErrorHandler: Error statistics reset');
    }
    
    /**
     * Check if system is in fallback mode
     * @returns {boolean} True if in fallback mode
     */
    isInFallbackMode() {
        return this.fallbackMode.isActive;
    }
    
    /**
     * Get fallback mode reason
     * @returns {string|null} Fallback mode reason
     */
    getFallbackModeReason() {
        return this.fallbackMode.reason;
    }
    
    /**
     * Disable fallback mode (manual recovery)
     */
    disableFallbackMode() {
        this.fallbackMode.isActive = false;
        this.fallbackMode.reason = null;
        this.fallbackMode.activatedAt = null;
        
        console.log('🛡️ TranslationErrorHandler: Fallback mode disabled');
        
        this.emit('fallback-mode-deactivated');
    }
}

module.exports = new TranslationErrorHandler();