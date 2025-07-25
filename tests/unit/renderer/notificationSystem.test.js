/**
 * NotificationSystem Unit Tests
 * 
 * Tests for user-friendly error notifications, fallback mode indicators,
 * circuit breaker status displays, and accessibility features for the
 * ongoing translation system.
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');

// Create DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <div id="live-translation-display"></div>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;

// Mock console to reduce test noise
const originalConsoleLog = console.log;
beforeAll(() => {
    console.log = jest.fn();
});

afterAll(() => {
    console.log = originalConsoleLog;
});

// Mock window.electronAPI
global.window.electronAPI = {
    on: jest.fn(),
    emit: jest.fn(),
    retryTranslation: jest.fn(),
    clearErrorStats: jest.fn()
};

// Import NotificationSystem after setting up mocks
const NotificationSystem = require('../../../src/renderer/notificationSystem');

describe('NotificationSystem', () => {
    let notificationSystem;
    let mockContainer;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '<div id="live-translation-display"></div>';
        
        // Clear all mocks
        jest.clearAllMocks();
        
        // Create new instance
        notificationSystem = new NotificationSystem();
        mockContainer = document.getElementById('notification-container');
    });

    afterEach(() => {
        // Clean up any existing notifications
        if (notificationSystem) {
            notificationSystem.clearAllNotifications();
        }
        
        // Clear timers
        jest.clearAllTimers();
    });

    describe('Constructor and Initialization', () => {
        test('should initialize with correct default values', () => {
            expect(notificationSystem.notifications).toBeInstanceOf(Map);
            expect(notificationSystem.notificationQueue).toEqual([]);
            expect(notificationSystem.maxNotifications).toBe(5);
            expect(notificationSystem.notificationContainer).toBeDefined();
            expect(notificationSystem.fallbackModeIndicator).toBeDefined();
        });

        test('should create notification container', () => {
            const container = document.getElementById('notification-container');
            expect(container).toBeTruthy();
            expect(container.className).toBe('notification-container');
        });

        test('should create fallback mode indicator', () => {
            const indicator = document.getElementById('fallback-mode-indicator');
            expect(indicator).toBeTruthy();
            expect(indicator.className).toContain('fallback-mode-indicator');
            expect(indicator.className).toContain('hidden');
        });

        test('should setup event listeners', () => {
            expect(window.electronAPI.on).toHaveBeenCalledWith('error-notification', expect.any(Function));
            expect(window.electronAPI.on).toHaveBeenCalledWith('fallback-mode-activated', expect.any(Function));
            expect(window.electronAPI.on).toHaveBeenCalledWith('fallback-mode-deactivated', expect.any(Function));
            expect(window.electronAPI.on).toHaveBeenCalledWith('circuit-breaker-activated', expect.any(Function));
            expect(window.electronAPI.on).toHaveBeenCalledWith('circuit-breaker-reset', expect.any(Function));
        });
    });

    describe('showNotification', () => {
        test('should display a notification', () => {
            const notification = {
                id: 'test-notification-1',
                type: 'error',
                title: 'Test Error',
                message: 'This is a test error message',
                service: 'transcription'
            };

            notificationSystem.showNotification(notification);

            expect(notificationSystem.notifications.has(notification.id)).toBe(true);
            
            const notificationElement = document.querySelector(`[data-notification-id="${notification.id}"]`);
            expect(notificationElement).toBeTruthy();
            expect(notificationElement.textContent).toContain(notification.title);
            expect(notificationElement.textContent).toContain(notification.message);
        });

        test('should replace existing notification with same ID', () => {
            const notification1 = {
                id: 'duplicate-id',
                type: 'error',
                title: 'First Error',
                message: 'First message'
            };

            const notification2 = {
                id: 'duplicate-id',
                type: 'warning',
                title: 'Updated Error',
                message: 'Updated message'
            };

            notificationSystem.showNotification(notification1);
            notificationSystem.showNotification(notification2);

            expect(notificationSystem.notifications.size).toBe(1);
            const notificationElement = document.querySelector(`[data-notification-id="duplicate-id"]`);
            expect(notificationElement.textContent).toContain('Updated Error');
        });

        test('should respect maximum notification limit', () => {
            // Create more notifications than the limit
            for (let i = 1; i <= 7; i++) {
                notificationSystem.showNotification({
                    id: `notification-${i}`,
                    type: 'info',
                    title: `Notification ${i}`,
                    message: `Message ${i}`
                });
            }

            expect(notificationSystem.notifications.size).toBeLessThanOrEqual(5);
        });

        test('should add notification to queue when at limit', () => {
            // Fill up to the limit
            for (let i = 1; i <= 5; i++) {
                notificationSystem.showNotification({
                    id: `notification-${i}`,
                    type: 'info',
                    title: `Notification ${i}`,
                    message: `Message ${i}`
                });
            }

            const queuedNotification = {
                id: 'queued-notification',
                type: 'info',
                title: 'Queued',
                message: 'This should be queued'
            };

            notificationSystem.showNotification(queuedNotification);

            expect(notificationSystem.notificationQueue.length).toBeGreaterThan(0);
        });

        test('should auto-hide notifications with duration', () => {
            jest.useFakeTimers();
            
            const notification = {
                id: 'auto-hide-test',
                type: 'info',
                title: 'Auto Hide Test',
                message: 'This should auto-hide',
                duration: 3000
            };

            notificationSystem.showNotification(notification);
            expect(notificationSystem.notifications.has(notification.id)).toBe(true);

            // Fast-forward time
            jest.advanceTimersByTime(3000);

            expect(notificationSystem.notifications.has(notification.id)).toBe(false);
            
            jest.useRealTimers();
        });
    });

    describe('hideNotification', () => {
        test('should hide and remove notification', () => {
            const notification = {
                id: 'hide-test',
                type: 'info',
                title: 'Hide Test',
                message: 'Test message'
            };

            notificationSystem.showNotification(notification);
            expect(notificationSystem.notifications.has(notification.id)).toBe(true);

            notificationSystem.hideNotification(notification.id);
            expect(notificationSystem.notifications.has(notification.id)).toBe(false);
            
            const notificationElement = document.querySelector(`[data-notification-id="${notification.id}"]`);
            expect(notificationElement).toBeFalsy();
        });

        test('should process queued notifications when hiding', () => {
            // Fill to capacity
            for (let i = 1; i <= 5; i++) {
                notificationSystem.showNotification({
                    id: `notification-${i}`,
                    type: 'info',
                    title: `Notification ${i}`,
                    message: `Message ${i}`
                });
            }

            // Add one to queue
            const queuedNotification = {
                id: 'queued',
                type: 'info',
                title: 'Queued',
                message: 'From queue'
            };
            notificationSystem.showNotification(queuedNotification);

            // Hide one notification
            notificationSystem.hideNotification('notification-1');

            // Queued notification should now be displayed
            expect(notificationSystem.notifications.has('queued')).toBe(true);
        });

        test('should handle hiding non-existent notification gracefully', () => {
            expect(() => {
                notificationSystem.hideNotification('non-existent');
            }).not.toThrow();
        });
    });

    describe('showFallbackModeIndicator', () => {
        test('should show fallback mode indicator', () => {
            const reason = 'Translation service unavailable';
            
            notificationSystem.showFallbackModeIndicator(reason);
            
            const indicator = document.getElementById('fallback-mode-indicator');
            expect(indicator.className).not.toContain('hidden');
            expect(indicator.textContent).toContain('Translation temporarily disabled');
        });

        test('should update reason in indicator', () => {
            const reason = 'Circuit breaker activated';
            
            notificationSystem.showFallbackModeIndicator(reason);
            
            const indicator = document.getElementById('fallback-mode-indicator');
            const messageElement = indicator.querySelector('.fallback-message');
            expect(messageElement.textContent).toContain('Translation temporarily disabled');
        });
    });

    describe('hideFallbackModeIndicator', () => {
        test('should hide fallback mode indicator', () => {
            // First show it
            notificationSystem.showFallbackModeIndicator('Test reason');
            
            // Then hide it
            notificationSystem.hideFallbackModeIndicator();
            
            const indicator = document.getElementById('fallback-mode-indicator');
            expect(indicator.className).toContain('hidden');
        });
    });

    describe('showCircuitBreakerNotification', () => {
        test('should show circuit breaker notification', () => {
            const data = {
                service: 'translation',
                failures: 5,
                timeout: 30000
            };

            notificationSystem.showCircuitBreakerNotification(data);

            const notifications = Array.from(notificationSystem.notifications.values());
            const circuitBreakerNotification = notifications.find(n => 
                n.title && n.title.includes('Circuit Breaker Activated')
            );
            
            expect(circuitBreakerNotification).toBeDefined();
        });

        test('should include service name in notification', () => {
            const data = {
                service: 'transcription',
                failures: 5,
                timeout: 30000
            };

            notificationSystem.showCircuitBreakerNotification(data);

            const notificationElements = document.querySelectorAll('.notification');
            const circuitBreakerElement = Array.from(notificationElements).find(el =>
                el.textContent.includes('transcription')
            );
            
            expect(circuitBreakerElement).toBeTruthy();
        });
    });

    describe('showCircuitBreakerResetNotification', () => {
        test('should show circuit breaker reset notification', () => {
            notificationSystem.showCircuitBreakerResetNotification();

            const notifications = Array.from(notificationSystem.notifications.values());
            const resetNotification = notifications.find(n => 
                n.title && n.title.includes('Service Restored')
            );
            
            expect(resetNotification).toBeDefined();
        });
    });

    describe('retryTranslation', () => {
        test('should call electronAPI retryTranslation', () => {
            notificationSystem.retryTranslation();
            expect(window.electronAPI.retryTranslation).toHaveBeenCalled();
        });

        test('should hide fallback mode indicator', () => {
            // Show fallback mode first
            notificationSystem.showFallbackModeIndicator('Test reason');
            
            notificationSystem.retryTranslation();
            
            const indicator = document.getElementById('fallback-mode-indicator');
            expect(indicator.className).toContain('hidden');
        });
    });

    describe('clearAllNotifications', () => {
        test('should remove all notifications', () => {
            // Add multiple notifications
            for (let i = 1; i <= 3; i++) {
                notificationSystem.showNotification({
                    id: `notification-${i}`,
                    type: 'info',
                    title: `Notification ${i}`,
                    message: `Message ${i}`
                });
            }

            notificationSystem.clearAllNotifications();

            expect(notificationSystem.notifications.size).toBe(0);
            expect(notificationSystem.notificationQueue.length).toBe(0);
            
            const notificationElements = document.querySelectorAll('.notification');
            expect(notificationElements.length).toBe(0);
        });
    });

    describe('getNotificationElement', () => {
        test('should create notification element with correct structure', () => {
            const notification = {
                id: 'test-element',
                type: 'error',
                title: 'Test Title',
                message: 'Test message',
                actions: [
                    { text: 'Retry', action: 'retry' },
                    { text: 'Dismiss', action: 'dismiss' }
                ]
            };

            const element = notificationSystem.getNotificationElement(notification);

            expect(element.getAttribute('data-notification-id')).toBe('test-element');
            expect(element.className).toContain('notification');
            expect(element.className).toContain('notification-error');
            expect(element.textContent).toContain('Test Title');
            expect(element.textContent).toContain('Test message');
            
            const actionButtons = element.querySelectorAll('.notification-action');
            expect(actionButtons.length).toBe(2);
        });

        test('should handle notifications without actions', () => {
            const notification = {
                id: 'no-actions',
                type: 'info',
                title: 'Info',
                message: 'No actions'
            };

            const element = notificationSystem.getNotificationElement(notification);
            const actionButtons = element.querySelectorAll('.notification-action');
            expect(actionButtons.length).toBe(0);
        });

        test('should add technical details toggle if present', () => {
            const notification = {
                id: 'with-details',
                type: 'error',
                title: 'Error with Details',
                message: 'Error message',
                technicalDetails: 'Stack trace information'
            };

            const element = notificationSystem.getNotificationElement(notification);
            const detailsToggle = element.querySelector('.technical-details-toggle');
            expect(detailsToggle).toBeTruthy();
        });
    });

    describe('addNotificationStyles', () => {
        test('should add CSS styles to document', () => {
            // This is called in constructor, so styles should be present
            const styleElement = document.querySelector('style[data-notification-styles]');
            expect(styleElement).toBeTruthy();
        });

        test('should include all necessary CSS classes', () => {
            const styleElement = document.querySelector('style[data-notification-styles]');
            const cssText = styleElement.textContent;
            
            expect(cssText).toContain('.notification-container');
            expect(cssText).toContain('.notification');
            expect(cssText).toContain('.notification-error');
            expect(cssText).toContain('.notification-warning');
            expect(cssText).toContain('.notification-info');
            expect(cssText).toContain('.fallback-mode-indicator');
        });
    });

    describe('Accessibility Features', () => {
        test('should include ARIA labels in notifications', () => {
            const notification = {
                id: 'aria-test',
                type: 'error',
                title: 'Accessibility Test',
                message: 'Test message'
            };

            notificationSystem.showNotification(notification);
            
            const element = document.querySelector(`[data-notification-id="${notification.id}"]`);
            expect(element.getAttribute('role')).toBe('alert');
            expect(element.getAttribute('aria-live')).toBe('assertive');
        });

        test('should include screen reader text for notification types', () => {
            const notification = {
                id: 'sr-test',
                type: 'error',
                title: 'Screen Reader Test',
                message: 'Test message'
            };

            notificationSystem.showNotification(notification);
            
            const element = document.querySelector(`[data-notification-id="${notification.id}"]`);
            const srText = element.querySelector('.sr-only');
            expect(srText).toBeTruthy();
            expect(srText.textContent).toContain('Error');
        });

        test('should make action buttons keyboard accessible', () => {
            const notification = {
                id: 'keyboard-test',
                type: 'warning',
                title: 'Keyboard Test',
                message: 'Test message',
                actions: [
                    { text: 'Retry', action: 'retry' }
                ]
            };

            notificationSystem.showNotification(notification);
            
            const button = document.querySelector('.notification-action');
            expect(button.getAttribute('tabindex')).toBe('0');
            expect(button.getAttribute('role')).toBe('button');
        });
    });

    describe('Event Handling', () => {
        test('should handle notification action clicks', () => {
            const notification = {
                id: 'action-test',
                type: 'error',
                title: 'Action Test',
                message: 'Test message',
                actions: [
                    { text: 'Retry', action: 'retry' }
                ]
            };

            notificationSystem.showNotification(notification);
            
            const actionButton = document.querySelector('.notification-action');
            
            // Mock the click event
            const clickEvent = new window.Event('click');
            actionButton.dispatchEvent(clickEvent);
            
            // Should call the appropriate action handler
            expect(window.electronAPI.retryTranslation).toHaveBeenCalled();
        });

        test('should handle technical details toggle', () => {
            const notification = {
                id: 'details-test',
                type: 'error',
                title: 'Details Test',
                message: 'Test message',
                technicalDetails: 'Technical information'
            };

            notificationSystem.showNotification(notification);
            
            const toggle = document.querySelector('.technical-details-toggle');
            const details = document.querySelector('.technical-details');
            
            expect(details.className).toContain('hidden');
            
            // Click toggle
            const clickEvent = new window.Event('click');
            toggle.dispatchEvent(clickEvent);
            
            expect(details.className).not.toContain('hidden');
        });
    });

    describe('Integration with ErrorHandlingService', () => {
        test('should handle error notification events', () => {
            const showNotificationSpy = jest.spyOn(notificationSystem, 'showNotification');
            
            // Get the event handler that was registered
            const errorNotificationHandler = window.electronAPI.on.mock.calls
                .find(call => call[0] === 'error-notification')[1];
            
            const notificationData = {
                id: 'integration-test',
                type: 'error',
                title: 'Integration Test',
                message: 'Test error from service'
            };
            
            errorNotificationHandler(notificationData);
            
            expect(showNotificationSpy).toHaveBeenCalledWith(notificationData);
        });

        test('should handle fallback mode activation events', () => {
            const showFallbackSpy = jest.spyOn(notificationSystem, 'showFallbackModeIndicator');
            
            // Get the fallback mode handler
            const fallbackHandler = window.electronAPI.on.mock.calls
                .find(call => call[0] === 'fallback-mode-activated')[1];
            
            const fallbackData = {
                reason: 'Service unavailable'
            };
            
            fallbackHandler(fallbackData);
            
            expect(showFallbackSpy).toHaveBeenCalledWith(fallbackData.reason);
        });

        test('should handle circuit breaker events', () => {
            const circuitBreakerSpy = jest.spyOn(notificationSystem, 'showCircuitBreakerNotification');
            
            // Get the circuit breaker handler
            const circuitHandler = window.electronAPI.on.mock.calls
                .find(call => call[0] === 'circuit-breaker-activated')[1];
            
            const circuitData = {
                service: 'translation',
                failures: 5,
                timeout: 30000
            };
            
            circuitHandler(circuitData);
            
            expect(circuitBreakerSpy).toHaveBeenCalledWith(circuitData);
        });
    });
});