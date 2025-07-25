/**
 * Notification System for Error Handling
 * 
 * Provides user-friendly error notifications and status updates for the ongoing translation system.
 * Integrates with the ErrorHandlingService to display notifications, fallback mode indicators,
 * and error recovery status.
 */

class NotificationSystem {
    constructor() {
        this.notifications = new Map();
        this.notificationContainer = null;
        this.fallbackModeIndicator = null;
        this.maxNotifications = 5;
        this.notificationQueue = [];
        
        this.initializeUI();
        this.setupEventListeners();
        
        console.log('🔔 NotificationSystem: Initialized');
    }
    
    /**
     * Initialize notification UI components
     */
    initializeUI() {
        // Create notification container if it doesn't exist
        this.notificationContainer = document.getElementById('notification-container');
        if (!this.notificationContainer) {
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.id = 'notification-container';
            this.notificationContainer.className = 'notification-container';
            document.body.appendChild(this.notificationContainer);
        }
        
        // Create fallback mode indicator
        this.createFallbackModeIndicator();
        
        // Add notification styles
        this.addNotificationStyles();
    }
    
    /**
     * Create fallback mode indicator
     */
    createFallbackModeIndicator() {
        // Add fallback mode indicator to translation display if it exists
        const translationDisplay = document.getElementById('live-translation-display');
        if (translationDisplay && !document.getElementById('fallback-mode-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'fallback-mode-indicator';
            indicator.className = 'fallback-mode-indicator hidden';
            indicator.innerHTML = `
                <div class="fallback-content">
                    <span class="fallback-icon">⚠️</span>
                    <span class="fallback-message">Translation temporarily disabled - showing transcription only</span>
                    <button class="fallback-retry-btn btn btn-sm btn-outline" onclick="notificationSystem.retryTranslation()">Retry Translation</button>
                </div>
            `;
            
            translationDisplay.insertBefore(indicator, translationDisplay.firstChild);
            this.fallbackModeIndicator = indicator;
        }
    }
    
    /**
     * Setup event listeners for error handling service
     */
    setupEventListeners() {
        // Listen for IPC events from main process (error handler events)
        if (window.electronAPI) {
            window.electronAPI.on('error-notification', (notification) => {
                this.showNotification(notification);
            });
            
            window.electronAPI.on('fallback-mode-activated', (data) => {
                this.showFallbackModeIndicator(data.reason);
            });
            
            window.electronAPI.on('fallback-mode-deactivated', () => {
                this.hideFallbackModeIndicator();
            });
            
            window.electronAPI.on('circuit-breaker-activated', (data) => {
                this.showCircuitBreakerNotification(data);
            });
            
            window.electronAPI.on('circuit-breaker-reset', () => {
                this.showCircuitBreakerResetNotification();
            });
        }
    }
    
    /**
     * Display a notification to the user
     * @param {Object} notification - Notification data
     */
    showNotification(notification) {
        // Remove existing notification with same ID if it exists
        if (this.notifications.has(notification.id)) {
            this.removeNotification(notification.id);
        }
        
        // Create notification element
        const notificationElement = this.createNotificationElement(notification);
        
        // Add to container with animation
        this.notificationContainer.appendChild(notificationElement);
        this.notifications.set(notification.id, {
            element: notificationElement,
            data: notification
        });
        
        // Trigger animation
        setTimeout(() => {
            notificationElement.classList.add('show');
        }, 10);
        
        // Auto-remove if configured
        if (notification.autoHide && notification.duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification.id);
            }, notification.duration);
        }
        
        // Limit total notifications
        this.limitNotifications();
        
        console.log(`🔔 NotificationSystem: Showed ${notification.type} notification:`, notification.message);
    }
    
    /**
     * Create notification DOM element
     * @param {Object} notification - Notification data
     * @returns {HTMLElement} Notification element
     */
    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type}`;
        element.setAttribute('data-notification-id', notification.id);
        
        const iconMap = {
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            success: '✅'
        };
        
        const icon = iconMap[notification.type] || 'ℹ️';
        
        element.innerHTML = `
            <div class="notification-content">
                <div class="notification-header">
                    <span class="notification-icon">${icon}</span>
                    <span class="notification-title">${this.getNotificationTitle(notification)}</span>
                    <button class="notification-close" onclick="notificationSystem.removeNotification('${notification.id}')">&times;</button>
                </div>
                <div class="notification-message">${notification.message}</div>
                ${notification.technicalDetails ? `<div class="notification-details hidden">
                    <small><strong>Technical Details:</strong> ${notification.technicalDetails}</small>
                </div>` : ''}
                ${notification.actionRequired ? `<div class="notification-actions">
                    <button class="btn btn-sm btn-primary" onclick="notificationSystem.handleNotificationAction('${notification.id}')">
                        Take Action
                    </button>
                    ${notification.technicalDetails ? `<button class="btn btn-sm btn-outline" onclick="notificationSystem.toggleTechnicalDetails('${notification.id}')">
                        Show Details
                    </button>` : ''}
                </div>` : ''}
            </div>
        `;
        
        return element;
    }
    
    /**
     * Get appropriate title for notification type
     * @param {Object} notification - Notification data
     * @returns {string} Notification title
     */
    getNotificationTitle(notification) {
        const titles = {
            error: 'Error',
            warning: 'Warning',
            info: 'Information',
            success: 'Success'
        };
        
        if (notification.context) {
            const contextTitles = {
                transcription: 'Transcription',
                translation: 'Translation',
                recording: 'Recording',
                audio: 'Audio'
            };
            
            const contextTitle = contextTitles[notification.context] || notification.context;
            return `${contextTitle} ${titles[notification.type] || 'Notification'}`;
        }
        
        return titles[notification.type] || 'Notification';
    }
    
    /**
     * Remove notification from display
     * @param {string} notificationId - ID of notification to remove
     */
    removeNotification(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (notification) {
            // Add fade-out animation
            notification.element.classList.add('fade-out');
            
            // Remove from DOM after animation
            setTimeout(() => {
                if (notification.element.parentNode) {
                    notification.element.parentNode.removeChild(notification.element);
                }
                this.notifications.delete(notificationId);
            }, 300);
        }
    }
    
    /**
     * Show fallback mode indicator
     * @param {string} reason - Reason for fallback mode
     */
    showFallbackModeIndicator(reason) {
        if (this.fallbackModeIndicator) {
            const messageElement = this.fallbackModeIndicator.querySelector('.fallback-message');
            messageElement.textContent = this.getFallbackModeMessage(reason);
            this.fallbackModeIndicator.classList.remove('hidden');
            
            console.log('🔔 NotificationSystem: Fallback mode indicator shown');
        }
    }
    
    /**
     * Hide fallback mode indicator
     */
    hideFallbackModeIndicator() {
        if (this.fallbackModeIndicator) {
            this.fallbackModeIndicator.classList.add('hidden');
            console.log('🔔 NotificationSystem: Fallback mode indicator hidden');
        }
    }
    
    /**
     * Get user-friendly fallback mode message
     * @param {string} reason - Fallback mode reason
     * @returns {string} User-friendly message
     */
    getFallbackModeMessage(reason) {
        const messages = {
            'translation_service_failure': 'Translation temporarily disabled due to service issues - showing transcription only',
            'translation_service_critical_failure': 'Translation service encountered critical errors - showing transcription only',
            'translation_unavailable': 'Translation service is unavailable - showing transcription only',
            'circuit_breaker': 'Translation temporarily disabled due to multiple failures - showing transcription only'
        };
        
        return messages[reason] || 'Translation temporarily disabled - showing transcription only';
    }
    
    /**
     * Show circuit breaker notification
     * @param {Object} data - Circuit breaker data
     */
    showCircuitBreakerNotification(data) {
        const notification = {
            id: `circuit_breaker_${Date.now()}`,
            type: 'warning',
            message: `Translation service temporarily disabled due to ${data.failureCount} consecutive failures. Will retry in ${Math.round(data.timeout / 1000)} seconds.`,
            autoHide: true,
            duration: 8000,
            context: 'translation'
        };
        
        this.showNotification(notification);
    }
    
    /**
     * Show circuit breaker reset notification
     */
    showCircuitBreakerResetNotification() {
        const notification = {
            id: `circuit_breaker_reset_${Date.now()}`,
            type: 'success',
            message: 'Translation service restored and ready for use.',
            autoHide: true,
            duration: 5000,
            context: 'translation'
        };
        
        this.showNotification(notification);
    }
    
    /**
     * Retry translation when in fallback mode
     */
    retryTranslation() {
        if (window.electronAPI) {
            window.electronAPI.invoke('retry-translation-service');
            
            // Show immediate feedback
            const notification = {
                id: `retry_translation_${Date.now()}`,
                type: 'info',
                message: 'Attempting to restore translation service...',
                autoHide: true,
                duration: 3000,
                context: 'translation'
            };
            
            this.showNotification(notification);
        }
    }
    
    /**
     * Handle notification action button click
     * @param {string} notificationId - Notification ID
     */
    handleNotificationAction(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (notification) {
            // Handle based on notification context
            switch (notification.data.context) {
                case 'translation':
                    this.retryTranslation();
                    break;
                case 'transcription':
                    // Could trigger transcription retry
                    break;
                default:
                    console.log('No specific action defined for notification:', notificationId);
            }
            
            // Remove notification after action
            this.removeNotification(notificationId);
        }
    }
    
    /**
     * Toggle technical details visibility
     * @param {string} notificationId - Notification ID
     */
    toggleTechnicalDetails(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (notification) {
            const details = notification.element.querySelector('.notification-details');
            const button = notification.element.querySelector('.btn-outline');
            
            if (details) {
                if (details.classList.contains('hidden')) {
                    details.classList.remove('hidden');
                    button.textContent = 'Hide Details';
                } else {
                    details.classList.add('hidden');
                    button.textContent = 'Show Details';
                }
            }
        }
    }
    
    /**
     * Limit total number of notifications
     */
    limitNotifications() {
        const notificationElements = this.notificationContainer.children;
        while (notificationElements.length > this.maxNotifications) {
            const oldestElement = notificationElements[0];
            const notificationId = oldestElement.getAttribute('data-notification-id');
            this.removeNotification(notificationId);
        }
    }
    
    /**
     * Clear all notifications
     */
    clearAllNotifications() {
        const notificationIds = Array.from(this.notifications.keys());
        notificationIds.forEach(id => this.removeNotification(id));
    }
    
    /**
     * Add notification styles to the page
     */
    addNotificationStyles() {
        if (document.getElementById('notification-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                pointer-events: none;
            }
            
            .notification {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                margin-bottom: 10px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                pointer-events: auto;
            }
            
            .notification.show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .notification.fade-out {
                opacity: 0;
                transform: translateX(100%);
            }
            
            .notification-error {
                border-left: 4px solid #dc3545;
            }
            
            .notification-warning {
                border-left: 4px solid #ffc107;
            }
            
            .notification-info {
                border-left: 4px solid #17a2b8;
            }
            
            .notification-success {
                border-left: 4px solid #28a745;
            }
            
            .notification-content {
                padding: 16px;
            }
            
            .notification-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .notification-icon {
                margin-right: 8px;
                font-size: 16px;
            }
            
            .notification-title {
                font-weight: 600;
                flex: 1;
                color: #333;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .notification-close:hover {
                color: #333;
            }
            
            .notification-message {
                color: #555;
                font-size: 14px;
                line-height: 1.4;
                margin-bottom: 8px;
            }
            
            .notification-details {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #eee;
                color: #666;
                font-size: 12px;
            }
            
            .notification-actions {
                margin-top: 12px;
                display: flex;
                gap: 8px;
            }
            
            .notification-actions .btn {
                font-size: 12px;
                padding: 4px 12px;
            }
            
            .fallback-mode-indicator {
                background: #fff3cd;
                border: 1px solid #ffc107;
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .fallback-mode-indicator.hidden {
                display: none;
            }
            
            .fallback-content {
                display: flex;
                align-items: center;
                width: 100%;
            }
            
            .fallback-icon {
                font-size: 16px;
                margin-right: 8px;
            }
            
            .fallback-message {
                flex: 1;
                color: #856404;
                font-size: 14px;
            }
            
            .fallback-retry-btn {
                margin-left: 12px;
                background: #ffc107;
                color: #212529;
                border-color: #ffc107;
            }
            
            .fallback-retry-btn:hover {
                background: #e0a800;
                border-color: #d39e00;
                color: #212529;
            }
            
            @media (max-width: 768px) {
                .notification-container {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
                
                .notification {
                    margin-bottom: 8px;
                }
                
                .fallback-content {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                
                .fallback-retry-btn {
                    margin-left: 0;
                    align-self: flex-end;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
}

// Initialize global notification system
let notificationSystem;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        notificationSystem = new NotificationSystem();
    });
} else {
    notificationSystem = new NotificationSystem();
}