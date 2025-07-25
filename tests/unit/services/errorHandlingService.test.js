/**
 * ErrorHandlingService Unit Tests
 * 
 * Tests for comprehensive error handling, recovery strategies, circuit breaker pattern,
 * fallback modes, and error statistics tracking for the ongoing translation system.
 */

const ErrorHandlingService = require('../../../src/services/errorHandlingService');
const EventEmitter = require('events');

// Mock console to reduce test output noise
const originalConsoleLog = console.log;
beforeAll(() => {
    console.log = jest.fn();
});

afterAll(() => {
    console.log = originalConsoleLog;
});

describe('ErrorHandlingService', () => {
    let errorHandlingService;

    beforeEach(() => {
        errorHandlingService = new ErrorHandlingService();
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with correct default values', () => {
            const service = new ErrorHandlingService();
            
            // Check error stats initialization
            expect(service.errorStats.transcription.total).toBe(0);
            expect(service.errorStats.transcription.consecutive).toBe(0);
            expect(service.errorStats.transcription.types).toBeInstanceOf(Map);
            expect(service.errorStats.translation.total).toBe(0);
            expect(service.errorStats.audio.total).toBe(0);
            
            // Check circuit breaker initialization
            expect(service.circuitBreaker.transcription.state).toBe('closed');
            expect(service.circuitBreaker.transcription.threshold).toBe(5);
            expect(service.circuitBreaker.transcription.timeout).toBe(30000);
            expect(service.circuitBreaker.translation.state).toBe('closed');
            
            // Check fallback mode initialization
            expect(service.fallbackMode.enabled).toBe(false);
            expect(service.fallbackMode.reason).toBeNull();
            expect(service.fallbackMode.autoResetTimeout).toBe(60000);
            
            // Check retry config
            expect(service.retryConfig.maxRetries).toBe(3);
            expect(service.retryConfig.backoffMultiplier).toBe(2);
            expect(service.retryConfig.initialDelay).toBe(1000);
        });

        test('should extend EventEmitter', () => {
            expect(errorHandlingService).toBeInstanceOf(EventEmitter);
        });
    });

    describe('updateErrorStats', () => {
        test('should update error statistics correctly', () => {
            const error = new Error('Test error');
            const service = 'transcription';
            
            errorHandlingService.updateErrorStats(service, error);
            
            expect(errorHandlingService.errorStats.transcription.total).toBe(1);
            expect(errorHandlingService.errorStats.transcription.consecutive).toBe(1);
            expect(errorHandlingService.errorStats.transcription.lastError).toBe(error.message);
            expect(errorHandlingService.errorStats.transcription.lastErrorTime).toBeDefined();
        });

        test('should increment consecutive errors for same service', () => {
            const error1 = new Error('First error');
            const error2 = new Error('Second error');
            
            errorHandlingService.updateErrorStats('translation', error1);
            errorHandlingService.updateErrorStats('translation', error2);
            
            expect(errorHandlingService.errorStats.translation.total).toBe(2);
            expect(errorHandlingService.errorStats.translation.consecutive).toBe(2);
        });

        test('should track error types using getErrorType', () => {
            const connectionError = new Error('Connection failed');
            const timeoutError = new Error('Request timeout');
            
            errorHandlingService.updateErrorStats('transcription', connectionError);
            errorHandlingService.updateErrorStats('transcription', timeoutError);
            
            const types = errorHandlingService.errorStats.transcription.types;
            expect(types.get('connection')).toBe(1);
            expect(types.get('timeout')).toBe(1);
        });

        test('should create service stats if not exists', () => {
            const error = new Error('Test error');
            const newService = 'newService';
            
            errorHandlingService.updateErrorStats(newService, error);
            
            expect(errorHandlingService.errorStats[newService]).toBeDefined();
            expect(errorHandlingService.errorStats[newService].total).toBe(1);
        });
    });

    describe('categorizeError', () => {
        test('should categorize connection errors', () => {
            const connectionError = new Error('Connection refused');
            const category = errorHandlingService.categorizeError(connectionError, 'transcription');
            expect(category).toBe('connection');
        });

        test('should categorize service unavailable errors', () => {
            const serviceError = new Error('Service temporarily unavailable');
            const category = errorHandlingService.categorizeError(serviceError, 'translation');
            expect(category).toBe('service_unavailable');
        });

        test('should categorize timeout errors', () => {
            const timeoutError = new Error('Request timeout exceeded');
            const category = errorHandlingService.categorizeError(timeoutError, 'transcription');
            expect(category).toBe('connection');
        });

        test('should categorize resource errors', () => {
            const resourceError = new Error('Insufficient memory available');
            const category = errorHandlingService.categorizeError(resourceError, 'audio');
            expect(category).toBe('resource');
        });

        test('should categorize permission errors', () => {
            const permissionError = new Error('Access denied permission required');
            const category = errorHandlingService.categorizeError(permissionError, 'audio');
            expect(category).toBe('permission');
        });

        test('should categorize format errors', () => {
            const formatError = new Error('Invalid audio format provided');
            const category = errorHandlingService.categorizeError(formatError, 'audio');
            expect(category).toBe('format');
        });

        test('should categorize configuration errors', () => {
            const configError = new Error('Invalid configuration setting');
            const category = errorHandlingService.categorizeError(configError, 'transcription');
            expect(category).toBe('configuration');
        });

        test('should return unknown for unrecognized errors', () => {
            const unknownError = new Error('Some random error message');
            const category = errorHandlingService.categorizeError(unknownError, 'transcription');
            expect(category).toBe('unknown');
        });
    });

    describe('checkCircuitBreaker', () => {
        test('should return closed for normal operation', () => {
            const state = errorHandlingService.checkCircuitBreaker('transcription');
            expect(state).toBe('closed');
        });

        test('should return closed for non-existent service', () => {
            const state = errorHandlingService.checkCircuitBreaker('nonexistent');
            expect(state).toBe('closed');
        });

        test('should transition to half-open after timeout', () => {
            // Set circuit to open in the past
            errorHandlingService.circuitBreaker.transcription.state = 'open';
            errorHandlingService.circuitBreaker.transcription.nextAttemptTime = Date.now() - 5000; // 5 seconds ago
            
            const state = errorHandlingService.checkCircuitBreaker('transcription');
            
            expect(state).toBe('half-open');
            expect(errorHandlingService.circuitBreaker.transcription.state).toBe('half-open');
        });

        test('should remain open if timeout not reached', () => {
            errorHandlingService.circuitBreaker.transcription.state = 'open';
            errorHandlingService.circuitBreaker.transcription.nextAttemptTime = Date.now() + 15000; // 15 seconds from now
            
            const state = errorHandlingService.checkCircuitBreaker('transcription');
            
            expect(state).toBe('open');
        });

        test('should return current state for closed breaker', () => {
            errorHandlingService.circuitBreaker.transcription.state = 'closed';
            
            const state = errorHandlingService.checkCircuitBreaker('transcription');
            
            expect(state).toBe('closed');
        });
    });

    describe('updateCircuitBreaker', () => {
        test('should record failure and update state', () => {
            errorHandlingService.updateCircuitBreaker('translation', true);
            
            expect(errorHandlingService.circuitBreaker.translation.failures).toBe(1);
            expect(errorHandlingService.circuitBreaker.translation.lastFailureTime).toBeDefined();
        });

        test('should open circuit breaker when threshold reached', () => {
            // Set failures just below threshold
            errorHandlingService.circuitBreaker.translation.failures = 4;
            
            errorHandlingService.updateCircuitBreaker('translation', true);
            
            expect(errorHandlingService.circuitBreaker.translation.state).toBe('open');
            expect(errorHandlingService.circuitBreaker.translation.nextAttemptTime).toBeDefined();
        });

        test('should reset on success', () => {
            // Set some failures first
            errorHandlingService.circuitBreaker.translation.failures = 3;
            
            errorHandlingService.updateCircuitBreaker('translation', false);
            
            expect(errorHandlingService.circuitBreaker.translation.failures).toBe(0);
            expect(errorHandlingService.circuitBreaker.translation.state).toBe('closed');
        });

        test('should handle non-existent service gracefully', () => {
            expect(() => {
                errorHandlingService.updateCircuitBreaker('nonexistent', true);
            }).not.toThrow();
        });
    });

    describe('resetConsecutiveErrors', () => {
        test('should reset consecutive error count', () => {
            // Set some consecutive errors first
            errorHandlingService.errorStats.transcription.consecutive = 5;
            
            errorHandlingService.resetConsecutiveErrors('transcription');
            
            expect(errorHandlingService.errorStats.transcription.consecutive).toBe(0);
        });

        test('should handle non-existent service gracefully', () => {
            expect(() => {
                errorHandlingService.resetConsecutiveErrors('nonexistent');
            }).not.toThrow();
        });
    });

    describe('activateFallbackMode', () => {
        test('should activate fallback mode with reason', () => {
            const reason = 'Translation service unavailable';
            
            errorHandlingService.activateFallbackMode(reason);
            
            expect(errorHandlingService.fallbackMode.enabled).toBe(true);
            expect(errorHandlingService.fallbackMode.reason).toBe(reason);
            expect(errorHandlingService.fallbackMode.activatedAt).toBeDefined();
        });

        test('should emit fallback mode activated event', () => {
            const eventSpy = jest.fn();
            errorHandlingService.on('fallback-mode-activated', eventSpy);
            
            const reason = 'Circuit breaker open';
            errorHandlingService.activateFallbackMode(reason);
            
            expect(eventSpy).toHaveBeenCalledWith({
                reason,
                activatedAt: expect.any(Number)
            });
        });

        test('should not reactivate if already active', () => {
            const eventSpy = jest.fn();
            errorHandlingService.on('fallback-mode-activated', eventSpy);
            
            errorHandlingService.activateFallbackMode('First reason');
            errorHandlingService.activateFallbackMode('Second reason');
            
            expect(eventSpy).toHaveBeenCalledTimes(1);
            expect(errorHandlingService.fallbackMode.reason).toBe('First reason');
        });

        test('should set auto-reset timeout', () => {
            jest.useFakeTimers();
            const deactivateSpy = jest.spyOn(errorHandlingService, 'deactivateFallbackMode');
            
            errorHandlingService.activateFallbackMode('Test reason');
            
            // Fast-forward time
            jest.advanceTimersByTime(60000);
            
            expect(deactivateSpy).toHaveBeenCalled();
            
            jest.useRealTimers();
        });
    });

    describe('deactivateFallbackMode', () => {
        test('should deactivate fallback mode', () => {
            // First activate fallback mode
            errorHandlingService.activateFallbackMode('Test reason');
            
            errorHandlingService.deactivateFallbackMode();
            
            expect(errorHandlingService.fallbackMode.enabled).toBe(false);
            expect(errorHandlingService.fallbackMode.reason).toBeNull();
            expect(errorHandlingService.fallbackMode.activatedAt).toBeNull();
        });

        test('should emit fallback mode deactivated event', () => {
            const eventSpy = jest.fn();
            errorHandlingService.on('fallback-mode-deactivated', eventSpy);
            
            errorHandlingService.activateFallbackMode('Test reason');
            errorHandlingService.deactivateFallbackMode();
            
            expect(eventSpy).toHaveBeenCalled();
        });

        test('should do nothing if fallback mode not active', () => {
            const eventSpy = jest.fn();
            errorHandlingService.on('fallback-mode-deactivated', eventSpy);
            
            errorHandlingService.deactivateFallbackMode();
            
            expect(eventSpy).not.toHaveBeenCalled();
        });
    });

    describe('calculateBackoffDelay', () => {
        test('should calculate exponential backoff delay', () => {
            const delay1 = errorHandlingService.calculateBackoffDelay(1);
            const delay2 = errorHandlingService.calculateBackoffDelay(2);
            const delay3 = errorHandlingService.calculateBackoffDelay(3);
            
            expect(delay1).toBe(1000); // Initial delay
            expect(delay2).toBe(2000); // 1000 * 2^1
            expect(delay3).toBe(4000); // 1000 * 2^2
        });

        test('should respect maximum delay limit', () => {
            const delay = errorHandlingService.calculateBackoffDelay(10);
            expect(delay).toBeLessThanOrEqual(10000); // Max delay
        });

        test('should add random jitter', () => {
            const delay1 = errorHandlingService.calculateBackoffDelay(2);
            const delay2 = errorHandlingService.calculateBackoffDelay(2);
            
            // Due to jitter, delays might be slightly different
            expect(Math.abs(delay1 - delay2)).toBeLessThanOrEqual(200);
        });
    });

    describe('getErrorStats', () => {
        test('should return current error statistics', () => {
            // Generate some test errors
            errorHandlingService.updateErrorStats('transcription', new Error('Test error 1'));
            errorHandlingService.updateErrorStats('translation', new Error('Test error 2'));
            
            const stats = errorHandlingService.getErrorStats();
            
            expect(stats.transcription.total).toBe(1);
            expect(stats.translation.total).toBe(1);
            expect(stats.audio.total).toBe(0);
        });

        test('should return copy of stats to prevent modification', () => {
            const stats = errorHandlingService.getErrorStats();
            stats.transcription.total = 999;
            
            const freshStats = errorHandlingService.getErrorStats();
            expect(freshStats.transcription.total).toBe(0);
        });
    });

    describe('clearErrorStats', () => {
        test('should reset all error statistics', () => {
            // Generate some test errors
            errorHandlingService.updateErrorStats('transcription', new Error('Test error 1'));
            errorHandlingService.updateErrorStats('translation', new Error('Test error 2'));
            errorHandlingService.updateErrorStats('audio', new Error('Test error 3'));
            
            errorHandlingService.clearErrorStats();
            
            const stats = errorHandlingService.getErrorStats();
            expect(stats.transcription.total).toBe(0);
            expect(stats.translation.total).toBe(0);
            expect(stats.audio.total).toBe(0);
            expect(stats.transcription.consecutive).toBe(0);
        });

        test('should reset circuit breakers when clearing stats', () => {
            // Set circuit breaker to failure state
            errorHandlingService.circuitBreaker.transcription.failures = 3;
            errorHandlingService.circuitBreaker.transcription.state = 'open';
            
            errorHandlingService.clearErrorStats();
            
            expect(errorHandlingService.circuitBreaker.transcription.failures).toBe(0);
            expect(errorHandlingService.circuitBreaker.transcription.state).toBe('closed');
        });

        test('should emit error stats cleared event', () => {
            const eventSpy = jest.fn();
            errorHandlingService.on('error-stats-cleared', eventSpy);
            
            errorHandlingService.clearErrorStats();
            
            expect(eventSpy).toHaveBeenCalled();
        });
    });

    describe('handleError integration', () => {
        test('should handle error with appropriate recovery strategy', async () => {
            const error = new Error('Connection failed');
            const context = { chunkId: 'chunk_001' };
            
            const result = await errorHandlingService.handleError(error, 'transcription', context);
            
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('strategy');
            expect(result).toHaveProperty('result');
            expect(result).toHaveProperty('fallbackActivated');
            expect(result.strategy.type).toBeDefined();
        });

        test('should update error statistics', async () => {
            const error = new Error('Test error');
            
            await errorHandlingService.handleError(error, 'transcription');
            
            expect(errorHandlingService.errorStats.transcription.total).toBe(1);
            expect(errorHandlingService.errorStats.transcription.consecutive).toBe(1);
        });

        test('should determine appropriate recovery strategy', async () => {
            const error = new Error('Service temporarily unavailable');
            
            const result = await errorHandlingService.handleError(error, 'translation');
            
            expect(result.strategy.type).toBe('fallback');
            expect(result.strategy.notifyUser).toBe(true);
        });

        test('should return success and strategy information', async () => {
            const error = new Error('Connection timeout');
            
            const result = await errorHandlingService.handleError(error, 'transcription');
            
            expect(typeof result.success).toBe('boolean');
            expect(result.strategy).toHaveProperty('type');
            expect(result.strategy).toHaveProperty('delay');
            expect(result.strategy).toHaveProperty('maxRetries');
        });
    });

    describe('Error recovery strategies', () => {
        test('should determine retry strategy for connection errors', async () => {
            const error = new Error('Connection failed');
            const result = await errorHandlingService.handleError(error, 'transcription');
            
            expect(result.strategy.type).toBe('retry');
            expect(result.strategy.delay).toBeGreaterThan(0);
            expect(result.strategy.context).toBe('connection');
        });

        test('should determine fallback strategy for service unavailable', async () => {
            const error = new Error('Service temporarily unavailable');
            const result = await errorHandlingService.handleError(error, 'translation');
            
            expect(result.strategy.type).toBe('fallback');
            expect(result.strategy.fallbackOnFailure).toBe(true);
        });

        test('should determine reduce quality strategy for resource errors', async () => {
            const error = new Error('Insufficient memory');
            const result = await errorHandlingService.handleError(error, 'audio');
            
            expect(result.strategy.type).toBe('reduce_quality');
            expect(result.strategy.context).toBe('resource');
        });

        test('should determine skip strategy for format errors', async () => {
            const error = new Error('Invalid format');
            const result = await errorHandlingService.handleError(error, 'audio');
            
            expect(result.strategy.type).toBe('skip');
            expect(result.strategy.context).toBe('format');
        });

        test('should determine reconfigure strategy for configuration errors', async () => {
            const error = new Error('Invalid configuration setting');
            const result = await errorHandlingService.handleError(error, 'transcription');
            
            expect(result.strategy.type).toBe('reconfigure');
        });
    });
});