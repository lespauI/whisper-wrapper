/**
 * Status Controller
 * Manages application status, progress indicators, and error/success messages
 */

import { STATUS_MESSAGES, CSS_CLASSES } from '../utils/Constants.js';
import { UIHelpers } from '../utils/UIHelpers.js';

export class StatusController {
    constructor(appState) {
        this.appState = appState;
        this.init();
    }

    init() {
        this.setupStatusSubscriptions();
        this.setInitialStatus();
    }

    setupStatusSubscriptions() {
        // Listen to app state changes
        this.appState.subscribe('status', (statusData) => {
            this.updateStatusDisplay(statusData);
        });
    }

    setInitialStatus() {
        this.updateStatus(STATUS_MESSAGES.READY);
    }

    /**
     * Update the main status message
     * @param {string} message - Status message to display
     * @param {boolean} [isLoading=false] - Whether to show loading state
     * @param {string} [error=null] - Error message if any
     */
    updateStatus(message, isLoading = false, error = null) {
        // Update app state
        this.appState.setStatus(message, isLoading, error);
        
        // Update UI directly for immediate feedback
        this.updateStatusDisplay({ message, isLoading, error });
    }

    /**
     * Update status UI elements
     * @param {Object} statusData - Status data object
     */
    updateStatusDisplay(statusData) {
        const { message, isLoading, error } = statusData;
        
        // Update main status text
        const statusElement = UIHelpers.getElementById('status-text');
        if (statusElement) {
            UIHelpers.setText(statusElement, message);
            
            // Add appropriate CSS classes
            UIHelpers.removeClass(statusElement, 'loading');
            UIHelpers.removeClass(statusElement, 'error');
            
            if (isLoading) {
                UIHelpers.addClass(statusElement, 'loading');
            }
            if (error) {
                UIHelpers.addClass(statusElement, 'error');
            }
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        console.error(message);
        this.updateStatus(`Error: ${message}`, false, message);
        
        // Show error notification if available
        if (typeof this.showNotification === 'function') {
            this.showNotification({
                type: 'error',
                message: message
            });
        } else {
            // Fallback: could implement a custom error display or use alert
            this.displayErrorNotification(message);
        }
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        console.log('Success:', message);
        this.updateStatus(message);
        
        // Show success notification if available
        if (typeof this.showNotification === 'function') {
            this.showNotification({
                type: 'success',
                message: message
            });
        } else {
            this.displaySuccessNotification(message);
        }
    }

    /**
     * Show warning message
     * @param {string} message - Warning message
     */
    showWarning(message) {
        console.warn(message);
        this.updateStatus(`Warning: ${message}`);
        
        if (typeof this.showNotification === 'function') {
            this.showNotification({
                type: 'warning',
                message: message
            });
        } else {
            this.displayWarningNotification(message);
        }
    }

    /**
     * Show upload/file processing progress
     * @param {boolean} show - Whether to show progress
     */
    showProgress(show) {
        const uploadArea = UIHelpers.getElementById('file-upload');
        const progressArea = UIHelpers.getElementById('upload-progress');
        
        if (show) {
            UIHelpers.addClass(uploadArea, CSS_CLASSES.HIDDEN);
            UIHelpers.removeClass(progressArea, CSS_CLASSES.HIDDEN);
        } else {
            UIHelpers.removeClass(uploadArea, CSS_CLASSES.HIDDEN);
            UIHelpers.addClass(progressArea, CSS_CLASSES.HIDDEN);
        }
    }

    /**
     * Show transcription loading state
     * @param {boolean} show - Whether to show loading
     */
    showTranscriptionLoading(show) {
        const loadingState = UIHelpers.getElementById('transcription-loading');
        const emptyState = UIHelpers.getElementById('transcription-empty');
        const editor = UIHelpers.getElementById('transcription-editor');
        
        if (show) {
            UIHelpers.removeClass(loadingState, CSS_CLASSES.HIDDEN);
            UIHelpers.addClass(emptyState, CSS_CLASSES.HIDDEN);
            UIHelpers.addClass(editor, CSS_CLASSES.HIDDEN);
        } else {
            UIHelpers.addClass(loadingState, CSS_CLASSES.HIDDEN);
            UIHelpers.removeClass(editor, CSS_CLASSES.HIDDEN);
        }
    }

    /**
     * Update transcription progress
     * @param {Object} progress - Progress data object
     */
    updateTranscriptionProgress(progress) {
        const progressText = UIHelpers.querySelector('.progress-text');
        const loadingText = UIHelpers.querySelector('#transcription-loading p');
        
        if (progress.status === 'processing') {
            if (progressText) {
                UIHelpers.setText(progressText, progress.message);
            }
            if (loadingText) {
                UIHelpers.setText(loadingText, progress.message);
            }
        } else if (progress.status === 'error') {
            this.showError(progress.message);
        }
    }

    /**
     * Update progress bar
     * @param {string} selector - Progress bar selector
     * @param {number} percentage - Progress percentage (0-100)
     */
    updateProgressBar(selector, percentage) {
        const progressBar = UIHelpers.querySelector(selector);
        const progressFill = progressBar ? progressBar.querySelector('.progress-fill') : null;
        
        if (progressFill) {
            progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        }
    }

    /**
     * Display error notification (fallback implementation)
     * @param {string} message - Error message
     */
    displayErrorNotification(message) {
        // Create a simple error notification
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">❌</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">✕</button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Add close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
        }
    }

    /**
     * Display success notification (fallback implementation)
     * @param {string} message - Success message
     */
    displaySuccessNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">✅</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">✕</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
        
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
        }
    }

    /**
     * Display warning notification (fallback implementation)
     * @param {string} message - Warning message
     */
    displayWarningNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification warning';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">⚠️</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">✕</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
        
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
        }
    }

    /**
     * Clear all notifications
     */
    clearNotifications() {
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    /**
     * Set loading state for the entire application
     * @param {boolean} isLoading - Loading state
     * @param {string} [message='Loading...'] - Loading message
     */
    setAppLoading(isLoading, message = 'Loading...') {
        this.updateStatus(message, isLoading);
        
        // Add/remove loading class to body for global loading styles
        if (isLoading) {
            UIHelpers.addClass(document.body, 'app-loading');
        } else {
            UIHelpers.removeClass(document.body, 'app-loading');
        }
    }

    /**
     * Destroy the controller and clean up
     */
    destroy() {
        this.clearNotifications();
        console.log('StatusController destroyed');
    }
}