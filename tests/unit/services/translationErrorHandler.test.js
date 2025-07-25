/**
 * TranslationErrorHandler Unit Tests
 * 
 * Tests for comprehensive error handling, recovery strategies, circuit breaker pattern,
 * and graceful degradation for the ongoing translation system.
 */

const TranslationErrorHandler = require('../../../src/services/translationErrorHandler');
const EventEmitter = require('events');

// Mock console to reduce test output noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
});

afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
});

describe('TranslationErrorHandler', () => {
    let translationErrorHandler;

    beforeEach(() => {
        translationErrorHandler = new TranslationErrorHandler();
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with correct default values', () => {
            const handler = new TranslationErrorHandler();
            
            // Check error stats initialization
            expect(handler.errorStats.transcriptionErrors).toBe(0);
            expect(handler.errorStats.translationErrors).toBe(0);
            expect(handler.errorStats.recoveryAttempts).toBe(0);
            expect(handler.errorStats.successfulRecoveries).toBe(0);
            expect(handler.errorStats.circuitBreakerActivations).toBe(0);
            
            // Check circuit breaker initialization
            expect(handler.circuitBreaker.translationFailureCount).toBe(0);
            expect(handler.circuitBreaker.maxFailures).toBe(5);
            expect(handler.circuitBreaker.timeout).toBe(30000);
            expect(handler.circuitBreaker.isOpen).toBe(false);
            expect(handler.circuitBreaker.lastOpenTime).toBeNull();
            
            // Check retry config
            expect(handler.retryConfig.maxRetries).toBe(3);
            expect(handler.retryConfig.baseDelay).toBe(1000);
            expect(handler.retryConfig.maxDelay).toBe(8000);
            expect(handler.retryConfig.backoffMultiplier).toBe(2);
            
            // Check fallback mode
            expect(handler.fallbackMode.isActive).toBe(false);
            expect(handler.fallbackMode.reason).toBeNull();
            expect(handler.fallbackMode.autoRecoveryEnabled).toBe(true);
            
            // Check notification queue
            expect(handler.notificationQueue).toEqual([]);
            expect(handler.maxNotifications).toBe(5);
        });

        test('should extend EventEmitter', () => {
            expect(translationErrorHandler).toBeInstanceOf(EventEmitter);
        });
    });

    describe('generateErrorId', () => {
        test('should generate unique error IDs', () => {
            const id1 = translationErrorHandler.generateErrorId();
            const id2 = translationErrorHandler.generateErrorId();
            
            expect(id1).toBeDefined();
            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
        });

        test('should generate IDs with consistent format', () => {
            const id = translationErrorHandler.generateErrorId();
            expect(id).toMatch(/^err_\d+_[a-f0-9]+$/);
        });
    });

    describe('logError', () => {
        test('should log error with all required information', () => {
            const error = new Error('Test error');
            const context = 'translation';
            const metadata = { chunkId: 'chunk_001' };
            const errorId = 'test-error-id';
            const timestamp = Date.now();
            
            translationErrorHandler.logError(error, context, metadata, errorId, timestamp);
            
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('TranslationErrorHandler'),
                expect.objectContaining({
                    errorId,
                    timestamp,
                    context,
                    message: error.message,
                    metadata
                })
            );
        });
    });

    describe('updateErrorStats', () => {
        test('should update transcription error stats', () => {
            translationErrorHandler.updateErrorStats('transcription');
            
            expect(translationErrorHandler.errorStats.transcriptionErrors).toBe(1);
            expect(translationErrorHandler.errorStats.translationErrors).toBe(0);
        });

        test('should update translation error stats', () => {
            translationErrorHandler.updateErrorStats('translation');
            
            expect(translationErrorHandler.errorStats.translationErrors).toBe(1);
            expect(translationErrorHandler.errorStats.transcriptionErrors).toBe(0);
        });

        test('should increment recovery attempts', () => {
            translationErrorHandler.updateErrorStats('recovery');
            
            expect(translationErrorHandler.errorStats.recoveryAttempts).toBe(1);
        });
    });

    describe('categorizeError', () => {
        test('should categorize connection errors', () => {
            const error = new Error('ECONNREFUSED: Connection refused');
            const category = translationErrorHandler.categorizeError(error, 'translation');
            expect(category).toBe('connection_error');
        });

        test('should categorize timeout errors', () => {
            const error = new Error('Request timeout after 30000ms');
            const category = translationErrorHandler.categorizeError(error, 'transcription');
            expect(category).toBe('timeout_error');
        });

        test('should categorize service unavailable errors', () => {
            const error = new Error('Service temporarily unavailable');
            const category = translationErrorHandler.categorizeError(error, 'translation');
            expect(category).toBe('service_unavailable');
        });

        test('should categorize rate limit errors', () => {
            const error = new Error('Rate limit exceeded');
            const category = translationErrorHandler.categorizeError(error, 'translation');
            expect(category).toBe('rate_limit');
        });

        test('should categorize resource errors', () => {
            const error = new Error('Out of memory');
            const category = translationErrorHandler.categorizeError(error, 'transcription');
            expect(category).toBe('resource_error');
        });

        test('should categorize format errors', () => {
            const error = new Error('Invalid audio format');
            const category = translationErrorHandler.categorizeError(error, 'transcription');
            expect(category).toBe('format_error');
        });

        test('should return unknown for unrecognized errors', () => {
            const error = new Error('Some unknown error');
            const category = translationErrorHandler.categorizeError(error, 'translation');
            expect(category).toBe('unknown_error');
        });
    });

    describe('assessErrorSeverity', () => {
        test('should assess high severity for critical errors', () => {
            const error = new Error('Service permanently unavailable');
            const severity = translationErrorHandler.assessErrorSeverity(error, 'translation', {});
            expect(severity).toBe('high');
        });

        test('should assess medium severity for recoverable errors', () => {
            const error = new Error('Connection timeout');
            const severity = translationErrorHandler.assessErrorSeverity(error, 'translation', {});
            expect(severity).toBe('medium');
        });

        test('should assess low severity for minor errors', () => {
            const error = new Error('Invalid format, retrying');
            const severity = translationErrorHandler.assessErrorSeverity(error, 'transcription', {});
            expect(severity).toBe('low');
        });

        test('should consider retry attempts in severity assessment', () => {
            const error = new Error('Connection failed');
            const metadata = { retryAttempt: 3 };
            const severity = translationErrorHandler.assessErrorSeverity(error, 'translation', metadata);
            expect(severity).toBe('high'); // High because of multiple retry attempts
        });
    });

    describe('updateCircuitBreaker', () => {
        test('should increment failure count on error', () => {
            const error = new Error('Translation failed');
            
            translationErrorHandler.updateCircuitBreaker(error);
            
            expect(translationErrorHandler.circuitBreaker.translationFailureCount).toBe(1);
        });

        test('should open circuit breaker after max failures', () => {
            const error = new Error('Translation failed');
            
            // Simulate reaching max failures
            for (let i = 0; i < 5; i++) {
                translationErrorHandler.updateCircuitBreaker(error);
            }
            
            expect(translationErrorHandler.circuitBreaker.isOpen).toBe(true);
            expect(translationErrorHandler.circuitBreaker.lastOpenTime).toBeDefined();
        });

        test('should emit circuit breaker opened event', () => {
            const eventSpy = jest.fn();
            translationErrorHandler.on('circuit-breaker-opened', eventSpy);
            
            const error = new Error('Translation failed');
            
            // Reach failure threshold
            for (let i = 0; i < 5; i++) {
                translationErrorHandler.updateCircuitBreaker(error);
            }
            
            expect(eventSpy).toHaveBeenCalledWith({
                service: 'translation',
                failureCount: 5,
                timeout: 30000
            });
        });

        test('should update error stats when circuit breaker opens', () => {
            const error = new Error('Translation failed');
            
            for (let i = 0; i < 5; i++) {
                translationErrorHandler.updateCircuitBreaker(error);
            }
            
            expect(translationErrorHandler.errorStats.circuitBreakerActivations).toBe(1);
        });
    });

    describe('isCircuitBreakerOpen', () => {
        test('should return false when circuit breaker is closed', () => {
            const isOpen = translationErrorHandler.isCircuitBreakerOpen();
            expect(isOpen).toBe(false);
        });

        test('should return true when circuit breaker is open and within timeout', () => {
            // Open circuit breaker
            translationErrorHandler.circuitBreaker.isOpen = true;
            translationErrorHandler.circuitBreaker.lastOpenTime = Date.now();
            
            const isOpen = translationErrorHandler.isCircuitBreakerOpen();
            expect(isOpen).toBe(true);
        });

        test('should reset circuit after timeout period', () => {
            // Open circuit breaker in the past
            translationErrorHandler.circuitBreaker.isOpen = true;
            translationErrorHandler.circuitBreaker.lastOpenTime = Date.now() - 35000; // 35 seconds ago
            
            const isOpen = translationErrorHandler.isCircuitBreakerOpen();
            
            expect(isOpen).toBe(false);
            expect(translationErrorHandler.circuitBreaker.isOpen).toBe(false);
            expect(translationErrorHandler.circuitBreaker.translationFailureCount).toBe(0);
        });

        test('should emit circuit breaker closed event on auto-reset', () => {
            const eventSpy = jest.fn();
            translationErrorHandler.on('circuit-breaker-closed', eventSpy);
            
            // Set circuit breaker to be expired
            translationErrorHandler.circuitBreaker.isOpen = true;
            translationErrorHandler.circuitBreaker.lastOpenTime = Date.now() - 35000;
            
            translationErrorHandler.isCircuitBreakerOpen();
            
            expect(eventSpy).toHaveBeenCalledWith({
                service: 'translation',
                resetReason: 'timeout'
            });
        });
    });

    describe('calculateRetryDelay', () => {
        test('should calculate exponential backoff correctly', () => {
            const delay0 = translationErrorHandler.calculateRetryDelay(0);
            const delay1 = translationErrorHandler.calculateRetryDelay(1);
            const delay2 = translationErrorHandler.calculateRetryDelay(2);
            
            expect(delay0).toBe(1000); // Base delay
            expect(delay1).toBe(2000); // 1000 * 2^1
            expect(delay2).toBe(4000); // 1000 * 2^2
        });

        test('should respect maximum delay limit', () => {
            const delay = translationErrorHandler.calculateRetryDelay(10);
            expect(delay).toBeLessThanOrEqual(8000); // Max delay
        });

        test('should include random jitter', () => {
            const delay1 = translationErrorHandler.calculateRetryDelay(1);
            const delay2 = translationErrorHandler.calculateRetryDelay(1);
            
            // Due to jitter, there might be small differences
            expect(Math.abs(delay1 - delay2)).toBeLessThanOrEqual(200);
        });
    });

    describe('activateFallbackMode', () => {
        test('should activate fallback mode with reason', () => {
            const reason = 'Translation service unavailable';
            
            translationErrorHandler.activateFallbackMode(reason);
            
            expect(translationErrorHandler.fallbackMode.isActive).toBe(true);
            expect(translationErrorHandler.fallbackMode.reason).toBe(reason);
            expect(translationErrorHandler.fallbackMode.activatedAt).toBeDefined();
        });

        test('should emit fallback mode activated event', () => {
            const eventSpy = jest.fn();
            translationErrorHandler.on('fallback-mode-activated', eventSpy);
            
            const reason = 'Circuit breaker open';
            translationErrorHandler.activateFallbackMode(reason);
            
            expect(eventSpy).toHaveBeenCalledWith({
                reason,
                activatedAt: expect.any(Number)
            });
        });

        test('should not reactivate if already active', () => {
            const eventSpy = jest.fn();
            translationErrorHandler.on('fallback-mode-activated', eventSpy);
            
            translationErrorHandler.activateFallbackMode('First reason');
            translationErrorHandler.activateFallbackMode('Second reason');
            
            expect(eventSpy).toHaveBeenCalledTimes(1);
            expect(translationErrorHandler.fallbackMode.reason).toBe('First reason');
        });
    });

    describe('deactivateFallbackMode', () => {
        test('should deactivate fallback mode', () => {
            translationErrorHandler.activateFallbackMode('Test reason');
            
            translationErrorHandler.deactivateFallbackMode();
            
            expect(translationErrorHandler.fallbackMode.isActive).toBe(false);
            expect(translationErrorHandler.fallbackMode.reason).toBeNull();
            expect(translationErrorHandler.fallbackMode.activatedAt).toBeNull();
        });

        test('should emit fallback mode deactivated event', () => {
            const eventSpy = jest.fn();
            translationErrorHandler.on('fallback-mode-deactivated', eventSpy);
            
            translationErrorHandler.activateFallbackMode('Test reason');
            translationErrorHandler.deactivateFallbackMode();
            
            expect(eventSpy).toHaveBeenCalled();
        });

        test('should do nothing if fallback mode not active', () => {
            const eventSpy = jest.fn();
            translationErrorHandler.on('fallback-mode-deactivated', eventSpy);
            
            translationErrorHandler.deactivateFallbackMode();
            
            expect(eventSpy).not.toHaveBeenCalled();
        });
    });

    describe('createUserNotification', () => {
        test('should create user notification for error', () => {
            const error = new Error('Connection failed');
            const context = 'translation';
            const recoveryStrategy = { strategy: 'retry', delay: 2000 };
            const severity = 'medium';
            
            const notification = translationErrorHandler.createUserNotification(
                error, context, recoveryStrategy, severity
            );
            
            expect(notification).toHaveProperty('id');
            expect(notification).toHaveProperty('type');
            expect(notification).toHaveProperty('title');
            expect(notification).toHaveProperty('message');
            expect(notification).toHaveProperty('severity');
            expect(notification.context).toBe(context);
            expect(notification.recoveryStrategy).toBe(recoveryStrategy);
        });

        test('should create appropriate notification for high severity errors', () => {
            const error = new Error('Critical failure');
            const notification = translationErrorHandler.createUserNotification(
                error, 'translation', { strategy: 'fallback' }, 'high'
            );
            
            expect(notification.type).toBe('error');
            expect(notification.severity).toBe('high');
        });

        test('should create appropriate notification for low severity errors', () => {
            const error = new Error('Minor issue');
            const notification = translationErrorHandler.createUserNotification(
                error, 'transcription', { strategy: 'retry' }, 'low'
            );
            
            expect(notification.type).toBe('warning');
            expect(notification.severity).toBe('low');
        });
    });

    describe('addNotificationToQueue', () => {
        test('should add notification to queue', () => {
            const notification = {
                id: 'test-notification',
                type: 'error',
                message: 'Test error'
            };
            
            translationErrorHandler.addNotificationToQueue(notification);
            
            expect(translationErrorHandler.notificationQueue.length).toBe(1);
            expect(translationErrorHandler.notificationQueue[0]).toBe(notification);
        });

        test('should respect maximum notification limit', () => {
            // Add notifications up to the limit
            for (let i = 0; i < 7; i++) {
                translationErrorHandler.addNotificationToQueue({
                    id: `notification-${i}`,
                    type: 'info',
                    message: `Message ${i}`
                });
            }
            
            expect(translationErrorHandler.notificationQueue.length).toBe(5);
        });

        test('should remove oldest notification when at limit', () => {
            // Fill up to limit
            for (let i = 0; i < 5; i++) {
                translationErrorHandler.addNotificationToQueue({
                    id: `notification-${i}`,
                    type: 'info',
                    message: `Message ${i}`
                });
            }
            
            // Add one more
            translationErrorHandler.addNotificationToQueue({
                id: 'newest',
                type: 'info',
                message: 'Newest message'
            });
            
            const queue = translationErrorHandler.notificationQueue;
            expect(queue.find(n => n.id === 'notification-0')).toBeUndefined();
            expect(queue.find(n => n.id === 'newest')).toBeDefined();
        });

        test('should emit notification queued event', () => {
            const eventSpy = jest.fn();
            translationErrorHandler.on('user-notification', eventSpy);
            
            const notification = {
                id: 'test-notification',
                type: 'error',
                message: 'Test error'
            };
            
            translationErrorHandler.addNotificationToQueue(notification);
            
            expect(eventSpy).toHaveBeenCalledWith(notification);
        });
    });

    describe('getErrorStats', () => {
        test('should return current error statistics', () => {
            // Generate some errors
            translationErrorHandler.updateErrorStats('transcription');
            translationErrorHandler.updateErrorStats('translation');
            translationErrorHandler.updateErrorStats('recovery');
            
            const stats = translationErrorHandler.getErrorStats();
            
            expect(stats.transcriptionErrors).toBe(1);
            expect(stats.translationErrors).toBe(1);
            expect(stats.recoveryAttempts).toBe(1);
        });

        test('should return deep copy to prevent modification', () => {
            const stats = translationErrorHandler.getErrorStats();
            stats.transcriptionErrors = 999;
            
            const freshStats = translationErrorHandler.getErrorStats();
            expect(freshStats.transcriptionErrors).toBe(0);
        });
    });

    describe('clearErrorStats', () => {
        test('should reset all error statistics', () => {
            // Generate some errors
            translationErrorHandler.updateErrorStats('transcription');
            translationErrorHandler.updateErrorStats('translation');
            translationErrorHandler.updateErrorStats('recovery');
            
            translationErrorHandler.clearErrorStats();
            
            const stats = translationErrorHandler.getErrorStats();
            expect(stats.transcriptionErrors).toBe(0);
            expect(stats.translationErrors).toBe(0);
            expect(stats.recoveryAttempts).toBe(0);
            expect(stats.successfulRecoveries).toBe(0);
            expect(stats.circuitBreakerActivations).toBe(0);
        });

        test('should reset circuit breaker state', () => {
            // Trigger circuit breaker
            for (let i = 0; i < 5; i++) {
                translationErrorHandler.updateCircuitBreaker(new Error('Test'));
            }
            
            translationErrorHandler.clearErrorStats();
            
            expect(translationErrorHandler.circuitBreaker.isOpen).toBe(false);
            expect(translationErrorHandler.circuitBreaker.translationFailureCount).toBe(0);
            expect(translationErrorHandler.circuitBreaker.lastOpenTime).toBeNull();
        });

        test('should clear notification queue', () => {
            // Add notifications
            translationErrorHandler.addNotificationToQueue({
                id: 'test', type: 'info', message: 'Test'
            });
            
            translationErrorHandler.clearErrorStats();
            
            expect(translationErrorHandler.notificationQueue.length).toBe(0);
        });

        test('should emit stats cleared event', () => {
            const eventSpy = jest.fn();
            translationErrorHandler.on('error-stats-cleared', eventSpy);
            
            translationErrorHandler.clearErrorStats();
            
            expect(eventSpy).toHaveBeenCalled();
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete error flow', async () => {
            const error = new Error('Connection timeout');
            const context = 'translation';
            const metadata = { chunkId: 'chunk_001' };
            
            const notificationSpy = jest.fn();
            translationErrorHandler.on('user-notification', notificationSpy);
            
            const result = await translationErrorHandler.handleError(error, context, metadata);
            
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('strategy');
            expect(result).toHaveProperty('userNotification');
            expect(translationErrorHandler.errorStats.translationErrors).toBe(1);
            expect(notificationSpy).toHaveBeenCalled();
        });

        test('should activate fallback mode for severe errors', async () => {
            const fallbackSpy = jest.fn();
            translationErrorHandler.on('fallback-mode-activated', fallbackSpy);
            
            // Simulate severe error scenario
            const error = new Error('Service permanently unavailable');
            await translationErrorHandler.handleError(error, 'translation', { severity: 'critical' });
            
            expect(fallbackSpy).toHaveBeenCalled();
            expect(translationErrorHandler.fallbackMode.isActive).toBe(true);
        });

        test('should handle circuit breaker opening during error handling', async () => {
            const circuitSpy = jest.fn();
            translationErrorHandler.on('circuit-breaker-opened', circuitSpy);
            
            // Trigger multiple translation errors
            for (let i = 0; i < 5; i++) {
                await translationErrorHandler.handleError(
                    new Error('Translation failed'), 
                    'translation'
                );
            }
            
            expect(circuitSpy).toHaveBeenCalled();
            expect(translationErrorHandler.circuitBreaker.isOpen).toBe(true);
        });
    });
});