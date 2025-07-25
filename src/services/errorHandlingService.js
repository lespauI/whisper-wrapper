/**
 * Error Handling Service
 * 
 * Provides comprehensive error handling, recovery strategies, and user notifications
 * for the ongoing translation system. Implements circuit breaker pattern, 
 * fallback modes, and intelligent error recovery.
 */

const EventEmitter = require('events');

class ErrorHandlingService extends EventEmitter {
    constructor() {
        super();
        
        // Error tracking
        this.errorStats = {
            transcription: {
                total: 0,
                consecutive: 0,
                types: new Map(),
                lastError: null,
                lastErrorTime: null
            },
            translation: {
                total: 0,
                consecutive: 0,
                types: new Map(),
                lastError: null,
                lastErrorTime: null
            },
            audio: {
                total: 0,
                consecutive: 0,
                types: new Map(),
                lastError: null,
                lastErrorTime: null
            }
        };
        
        // Circuit breaker configuration
        this.circuitBreaker = {
            transcription: {
                threshold: 5,
                timeout: 30000, // 30 seconds
                state: 'closed', // 'closed', 'open', 'half-open'
                failures: 0,
                lastFailureTime: null,
                nextAttemptTime: null
            },
            translation: {
                threshold: 5,
                timeout: 30000,
                state: 'closed',
                failures: 0,
                lastFailureTime: null,
                nextAttemptTime: null
            }
        };
        
        // Fallback mode state
        this.fallbackMode = {
            enabled: false,
            reason: null,
            activatedAt: null,
            autoResetTimeout: 60000 // 1 minute
        };
        
        // Retry configuration
        this.retryConfig = {
            maxRetries: 3,
            backoffMultiplier: 2,
            initialDelay: 1000,
            maxDelay: 10000
        };
        
        console.log('🛡️ ErrorHandlingService: Initialized');
    }
    
    /**
     * Handle an error with appropriate recovery strategy
     * @param {Error} error - The error that occurred
     * @param {string} service - Service where error occurred ('transcription', 'translation', 'audio')
     * @param {Object} context - Additional context about the error
     * @returns {Object} Recovery strategy and actions
     */
    async handleError(error, service, context = {}) {
        console.log(`🛡️ ErrorHandlingService: Handling ${service} error:`, error.message);
        
        // Update error statistics
        this.updateErrorStats(service, error);
        
        // Check circuit breaker status
        const circuitState = this.checkCircuitBreaker(service);
        if (circuitState === 'open') {
            return this.handleCircuitBreakerOpen(service, context);
        }
        
        // Categorize error type
        const errorCategory = this.categorizeError(error, service);
        
        // Determine recovery strategy
        const recoveryStrategy = this.determineRecoveryStrategy(
            error, 
            service, 
            errorCategory, 
            context
        );
        
        // Execute recovery if possible
        const recoveryResult = await this.executeRecoveryStrategy(
            recoveryStrategy, 
            service, 
            context
        );
        
        // Send notification to UI if needed
        if (recoveryStrategy.notifyUser) {
            this.sendErrorNotification(error, service, recoveryStrategy, context);
        }
        
        // Update circuit breaker if recovery failed
        if (!recoveryResult.success) {
            this.updateCircuitBreaker(service, true);
        } else {
            this.updateCircuitBreaker(service, false);
        }
        
        return {
            success: recoveryResult.success,
            strategy: recoveryStrategy,
            result: recoveryResult,
            fallbackActivated: this.fallbackMode.enabled
        };
    }
    
    /**
     * Update error statistics for a service
     * @param {string} service - Service name
     * @param {Error} error - The error
     */
    updateErrorStats(service, error) {
        if (!this.errorStats[service]) {
            this.errorStats[service] = {
                total: 0,
                consecutive: 0,
                types: new Map(),
                lastError: null,
                lastErrorTime: null
            };
        }
        
        const stats = this.errorStats[service];
        stats.total++;
        stats.consecutive++;
        stats.lastError = error.message;
        stats.lastErrorTime = Date.now();
        
        // Track error types
        const errorType = this.getErrorType(error);
        stats.types.set(errorType, (stats.types.get(errorType) || 0) + 1);
        
        console.log(`📊 ErrorHandlingService: ${service} error stats - Total: ${stats.total}, Consecutive: ${stats.consecutive}`);
    }
    
    /**
     * Reset consecutive error count for a service (called on success)
     * @param {string} service - Service name
     */
    resetConsecutiveErrors(service) {
        if (this.errorStats[service]) {
            this.errorStats[service].consecutive = 0;
            console.log(`✅ ErrorHandlingService: Reset consecutive errors for ${service}`);
        }
    }
    
    /**
     * Categorize error type for better handling
     * @param {Error} error - The error
     * @param {string} service - Service name
     * @returns {string} Error category
     */
    categorizeError(error, service) {
        const errorMessage = error.message.toLowerCase();
        
        // Network/Connection errors
        if (errorMessage.includes('connection') || 
            errorMessage.includes('network') || 
            errorMessage.includes('timeout') ||
            errorMessage.includes('econnrefused')) {
            return 'connection';
        }
        
        // Service unavailable
        if (errorMessage.includes('unavailable') || 
            errorMessage.includes('not found') ||
            errorMessage.includes('service') ||
            errorMessage.includes('offline')) {
            return 'service_unavailable';
        }
        
        // Resource errors (memory, disk, etc.)
        if (errorMessage.includes('memory') || 
            errorMessage.includes('space') ||
            errorMessage.includes('resource')) {
            return 'resource';
        }
        
        // Permission/Auth errors
        if (errorMessage.includes('permission') || 
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('forbidden')) {
            return 'permission';
        }
        
        // Format/Input errors
        if (errorMessage.includes('format') || 
            errorMessage.includes('invalid') ||
            errorMessage.includes('corrupt')) {
            return 'format';
        }
        
        // Configuration errors
        if (errorMessage.includes('config') || 
            errorMessage.includes('setting') ||
            errorMessage.includes('model')) {
            return 'configuration';
        }
        
        return 'unknown';
    }
    
    /**
     * Determine appropriate recovery strategy
     * @param {Error} error - The error
     * @param {string} service - Service name
     * @param {string} category - Error category
     * @param {Object} context - Error context
     * @returns {Object} Recovery strategy
     */
    determineRecoveryStrategy(error, service, category, context) {
        const consecutive = this.errorStats[service].consecutive;
        const attempt = context.attempt || 1;
        
        const baseStrategy = {
            type: 'retry',
            maxRetries: this.retryConfig.maxRetries,
            delay: this.calculateBackoffDelay(attempt),
            fallbackOnFailure: false,
            notifyUser: false,
            userMessage: null,
            technicalDetails: error.message
        };
        
        switch (category) {
            case 'connection':
                return {
                    ...baseStrategy,
                    type: consecutive < 3 ? 'retry' : 'fallback',
                    fallbackOnFailure: true,
                    notifyUser: consecutive >= 2,
                    userMessage: 'Connection issues detected. Retrying with fallback options.',
                    context: 'connection'
                };
                
            case 'service_unavailable':
                return {
                    ...baseStrategy,
                    type: 'fallback',
                    fallbackOnFailure: true,
                    notifyUser: true,
                    userMessage: `${service} service is temporarily unavailable.`,
                    context: service
                };
                
            case 'resource':
                return {
                    ...baseStrategy,
                    type: 'reduce_quality',
                    fallbackOnFailure: true,
                    notifyUser: consecutive >= 2,
                    userMessage: 'System resources are limited. Reducing processing quality.',
                    context: 'resource'
                };
                
            case 'format':
                return {
                    ...baseStrategy,
                    type: 'skip',
                    notifyUser: true,
                    userMessage: 'Input format error. Skipping problematic segment.',
                    context: 'format'
                };
                
            case 'configuration':
                return {
                    ...baseStrategy,
                    type: 'reconfigure',
                    fallbackOnFailure: true,
                    notifyUser: true,
                    userMessage: 'Configuration issue detected. Attempting automatic correction.',
                    context: 'configuration'
                };
                
            default:
                return {
                    ...baseStrategy,
                    type: consecutive < 2 ? 'retry' : 'fallback',
                    fallbackOnFailure: true,
                    notifyUser: consecutive >= 2,
                    userMessage: `${service} encountered an error. Attempting recovery.`,
                    context: service
                };
        }
    }
    
    /**
     * Execute recovery strategy
     * @param {Object} strategy - Recovery strategy
     * @param {string} service - Service name
     * @param {Object} context - Context information
     * @returns {Object} Recovery result
     */
    async executeRecoveryStrategy(strategy, service, context) {
        console.log(`🔧 ErrorHandlingService: Executing ${strategy.type} strategy for ${service}`);
        
        try {
            switch (strategy.type) {
                case 'retry':
                    return await this.executeRetry(strategy, service, context);
                    
                case 'fallback':
                    return this.executeFallback(strategy, service, context);
                    
                case 'reduce_quality':
                    return this.executeQualityReduction(strategy, service, context);
                    
                case 'skip':
                    return this.executeSkip(strategy, service, context);
                    
                case 'reconfigure':
                    return this.executeReconfiguration(strategy, service, context);
                    
                default:
                    return { success: false, message: `Unknown recovery strategy: ${strategy.type}` };
            }
        } catch (recoveryError) {
            console.error(`❌ ErrorHandlingService: Recovery strategy failed:`, recoveryError);
            return { success: false, message: recoveryError.message };
        }
    }
    
    /**
     * Execute retry strategy with delay
     * @param {Object} strategy - Strategy details
     * @param {string} service - Service name
     * @param {Object} context - Context
     * @returns {Object} Result
     */
    async executeRetry(strategy, service, context) {
        if (strategy.delay > 0) {
            console.log(`⏳ ErrorHandlingService: Waiting ${strategy.delay}ms before retry`);
            await this.delay(strategy.delay);
        }
        
        return {
            success: true,
            action: 'retry',
            message: 'Retry scheduled',
            delay: strategy.delay
        };
    }
    
    /**
     * Execute fallback strategy
     * @param {Object} strategy - Strategy details
     * @param {string} service - Service name
     * @param {Object} context - Context
     * @returns {Object} Result
     */
    executeFallback(strategy, service, context) {
        this.activateFallbackMode(service);
        
        return {
            success: true,
            action: 'fallback',
            message: `Activated fallback mode for ${service}`,
            fallbackActive: true
        };
    }
    
    /**
     * Execute quality reduction strategy
     * @param {Object} strategy - Strategy details
     * @param {string} service - Service name
     * @param {Object} context - Context
     * @returns {Object} Result
     */
    executeQualityReduction(strategy, service, context) {
        // Quality reduction suggestions
        const suggestions = {
            transcription: {
                model: 'tiny',
                chunkSize: 2000,
                threads: 2
            },
            translation: {
                model: 'phi3:mini',
                temperature: 0.1,
                maxTokens: 500
            },
            audio: {
                sampleRate: 16000,
                bufferSize: 4096,
                quality: 'low'
            }
        };
        
        return {
            success: true,
            action: 'reduce_quality',
            message: `Quality reduction applied for ${service}`,
            suggestions: suggestions[service] || {}
        };
    }
    
    /**
     * Execute skip strategy
     * @param {Object} strategy - Strategy details
     * @param {string} service - Service name
     * @param {Object} context - Context
     * @returns {Object} Result
     */
    executeSkip(strategy, service, context) {
        return {
            success: true,
            action: 'skip',
            message: `Skipped problematic ${service} operation`,
            skipped: true
        };
    }
    
    /**
     * Execute reconfiguration strategy
     * @param {Object} strategy - Strategy details
     * @param {string} service - Service name
     * @param {Object} context - Context
     * @returns {Object} Result
     */
    executeReconfiguration(strategy, service, context) {
        // Basic reconfiguration - reset to defaults
        return {
            success: true,
            action: 'reconfigure',
            message: `Reconfiguration attempted for ${service}`,
            resetToDefaults: true
        };
    }
    
    /**
     * Check circuit breaker status
     * @param {string} service - Service name
     * @returns {string} Circuit state ('closed', 'open', 'half-open')
     */
    checkCircuitBreaker(service) {
        const breaker = this.circuitBreaker[service];
        if (!breaker) return 'closed';
        
        if (breaker.state === 'open') {
            if (Date.now() > breaker.nextAttemptTime) {
                breaker.state = 'half-open';
                console.log(`🔄 ErrorHandlingService: Circuit breaker half-open for ${service}`);
            }
        }
        
        return breaker.state;
    }
    
    /**
     * Update circuit breaker state
     * @param {string} service - Service name
     * @param {boolean} failed - Whether operation failed
     */
    updateCircuitBreaker(service, failed) {
        const breaker = this.circuitBreaker[service];
        if (!breaker) return;
        
        if (failed) {
            breaker.failures++;
            breaker.lastFailureTime = Date.now();
            
            if (breaker.failures >= breaker.threshold) {
                breaker.state = 'open';
                breaker.nextAttemptTime = Date.now() + breaker.timeout;
                
                console.log(`⚡ ErrorHandlingService: Circuit breaker opened for ${service}`);
                
                this.emit('circuit-breaker-activated', {
                    service,
                    failureCount: breaker.failures,
                    timeout: breaker.timeout
                });
            }
        } else {
            // Success - reset circuit breaker
            if (breaker.state === 'half-open' || breaker.failures > 0) {
                breaker.failures = 0;
                breaker.state = 'closed';
                
                console.log(`✅ ErrorHandlingService: Circuit breaker reset for ${service}`);
                
                this.emit('circuit-breaker-reset', { service });
            }
        }
    }
    
    /**
     * Handle circuit breaker open state
     * @param {string} service - Service name
     * @param {Object} context - Context
     * @returns {Object} Fallback result
     */
    handleCircuitBreakerOpen(service, context) {
        console.log(`⚡ ErrorHandlingService: Circuit breaker open, activating fallback for ${service}`);
        
        this.activateFallbackMode('circuit_breaker');
        
        return {
            success: false,
            strategy: { type: 'circuit_breaker', notifyUser: true },
            result: { action: 'circuit_breaker', fallbackActive: true },
            fallbackActivated: true
        };
    }
    
    /**
     * Activate fallback mode
     * @param {string} reason - Reason for fallback
     */
    activateFallbackMode(reason) {
        if (!this.fallbackMode.enabled) {
            this.fallbackMode.enabled = true;
            this.fallbackMode.reason = reason;
            this.fallbackMode.activatedAt = Date.now();
            
            console.log(`🔄 ErrorHandlingService: Fallback mode activated - ${reason}`);
            
            this.emit('fallback-mode-activated', { reason });
            
            // Auto-reset after timeout
            setTimeout(() => {
                if (this.fallbackMode.enabled) {
                    this.deactivateFallbackMode();
                }
            }, this.fallbackMode.autoResetTimeout);
        }
    }
    
    /**
     * Deactivate fallback mode
     */
    deactivateFallbackMode() {
        if (this.fallbackMode.enabled) {
            this.fallbackMode.enabled = false;
            this.fallbackMode.reason = null;
            this.fallbackMode.activatedAt = null;
            
            console.log(`✅ ErrorHandlingService: Fallback mode deactivated`);
            
            this.emit('fallback-mode-deactivated');
        }
    }
    
    /**
     * Send error notification to UI
     * @param {Error} error - The error
     * @param {string} service - Service name
     * @param {Object} strategy - Recovery strategy
     * @param {Object} context - Error context
     */
    sendErrorNotification(error, service, strategy, context) {
        const notification = {
            id: `error_${service}_${Date.now()}`,
            type: this.getNotificationType(strategy.type),
            message: strategy.userMessage || `${service} error occurred`,
            context: strategy.context || service,
            technicalDetails: strategy.technicalDetails,
            actionRequired: strategy.type === 'fallback',
            autoHide: strategy.type !== 'fallback',
            duration: 5000,
            timestamp: Date.now()
        };
        
        console.log(`📢 ErrorHandlingService: Sending notification:`, notification.message);
        
        this.emit('error-notification', notification);
    }
    
    /**
     * Get notification type based on strategy
     * @param {string} strategyType - Strategy type
     * @returns {string} Notification type
     */
    getNotificationType(strategyType) {
        const typeMap = {
            retry: 'warning',
            fallback: 'warning',
            skip: 'info',
            circuit_breaker: 'error',
            reduce_quality: 'warning',
            reconfigure: 'info'
        };
        
        return typeMap[strategyType] || 'error';
    }
    
    /**
     * Get error type from error message
     * @param {Error} error - The error
     * @returns {string} Error type
     */
    getErrorType(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('timeout')) return 'timeout';
        if (message.includes('connection')) return 'connection';
        if (message.includes('memory')) return 'memory';
        if (message.includes('not found')) return 'not_found';
        if (message.includes('permission')) return 'permission';
        if (message.includes('format')) return 'format';
        
        return 'unknown';
    }
    
    /**
     * Calculate backoff delay for retries
     * @param {number} attempt - Attempt number
     * @returns {number} Delay in milliseconds
     */
    calculateBackoffDelay(attempt) {
        const delay = this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
        return Math.min(delay, this.retryConfig.maxDelay);
    }
    
    /**
     * Utility delay function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get current error statistics
     * @returns {Object} Error statistics
     */
    getErrorStats() {
        return {
            stats: JSON.parse(JSON.stringify(this.errorStats)),
            circuitBreaker: JSON.parse(JSON.stringify(this.circuitBreaker)),
            fallbackMode: JSON.parse(JSON.stringify(this.fallbackMode))
        };
    }
    
    /**
     * Clear error statistics
     */
    clearErrorStats() {
        Object.keys(this.errorStats).forEach(service => {
            this.errorStats[service] = {
                total: 0,
                consecutive: 0,
                types: new Map(),
                lastError: null,
                lastErrorTime: null
            };
        });
        
        Object.keys(this.circuitBreaker).forEach(service => {
            this.circuitBreaker[service].failures = 0;
            this.circuitBreaker[service].state = 'closed';
        });
        
        console.log('🧹 ErrorHandlingService: Error statistics cleared');
    }
    
    /**
     * Check if service is in fallback mode
     * @returns {boolean} Whether fallback mode is active
     */
    isInFallbackMode() {
        return this.fallbackMode.enabled;
    }
    
    /**
     * Manual fallback mode control
     */
    enableFallbackMode() {
        this.activateFallbackMode('manual');
    }
    
    disableFallbackMode() {
        this.deactivateFallbackMode();
    }
}

module.exports = ErrorHandlingService;