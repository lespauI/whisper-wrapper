/**
 * UI Helper Functions
 * Common UI manipulation and utility functions
 */

import { CSS_CLASSES } from './Constants.js';

export class UIHelpers {
    /**
     * Show an element by removing hidden class
     * @param {string|Element} element - Element or selector
     */
    static show(element) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.classList.remove(CSS_CLASSES.HIDDEN);
        }
    }

    /**
     * Hide an element by adding hidden class
     * @param {string|Element} element - Element or selector
     */
    static hide(element) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.classList.add(CSS_CLASSES.HIDDEN);
        }
    }

    /**
     * Toggle element visibility
     * @param {string|Element} element - Element or selector
     * @returns {boolean} True if now visible, false if hidden
     */
    static toggle(element) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.classList.toggle(CSS_CLASSES.HIDDEN);
            return !el.classList.contains(CSS_CLASSES.HIDDEN);
        }
        return false;
    }

    /**
     * Check if element is visible
     * @param {string|Element} element - Element or selector
     * @returns {boolean} True if visible
     */
    static isVisible(element) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        return el && !el.classList.contains(CSS_CLASSES.HIDDEN);
    }

    /**
     * Add CSS class to element
     * @param {string|Element} element - Element or selector
     * @param {string} className - CSS class to add
     */
    static addClass(element, className) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.classList.add(className);
        }
    }

    /**
     * Remove CSS class from element
     * @param {string|Element} element - Element or selector
     * @param {string} className - CSS class to remove
     */
    static removeClass(element, className) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.classList.remove(className);
        }
    }

    /**
     * Toggle CSS class on element
     * @param {string|Element} element - Element or selector
     * @param {string} className - CSS class to toggle
     * @returns {boolean} True if class was added, false if removed
     */
    static toggleClass(element, className) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.classList.toggle(className);
            return el.classList.contains(className);
        }
        return false;
    }

    /**
     * Set text content of element
     * @param {string|Element} element - Element or selector
     * @param {string} text - Text to set
     */
    static setText(element, text) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.textContent = text;
        }
    }

    /**
     * Set HTML content of element
     * @param {string|Element} element - Element or selector
     * @param {string} html - HTML to set
     */
    static setHTML(element, html) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.innerHTML = html;
        }
    }

    /**
     * Get element value (for inputs, selects, etc.)
     * @param {string|Element} element - Element or selector
     * @returns {string} Element value
     */
    static getValue(element) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        return el ? el.value : '';
    }

    /**
     * Set element value (for inputs, selects, etc.)
     * @param {string|Element} element - Element or selector
     * @param {string} value - Value to set
     */
    static setValue(element, value) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.value = value;
        }
    }

    /**
     * Create progress bar update function
     * @param {string|Element} progressBar - Progress bar element or selector
     * @returns {function} Function to update progress (0-100)
     */
    static createProgressUpdater(progressBar) {
        const el = typeof progressBar === 'string' ? document.querySelector(progressBar) : progressBar;
        const fill = el ? el.querySelector('.progress-fill') : null;
        
        return (percentage) => {
            if (fill) {
                fill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
            }
        };
    }

    /**
     * Show error message
     * @param {string} message - Error message
     * @param {string} [container='#error-container'] - Error container selector
     */
    static showError(message, container = '#error-container') {
        const errorEl = document.querySelector(container);
        if (errorEl) {
            this.setText(errorEl, message);
            this.show(errorEl);
            this.addClass(errorEl, 'error');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                this.hide(errorEl);
                this.removeClass(errorEl, 'error');
            }, 5000);
        } else {
            console.error('Error:', message);
            alert(`Error: ${message}`);
        }
    }

    /**
     * Show success message
     * @param {string} message - Success message
     * @param {string} [container='#success-container'] - Success container selector
     */
    static showSuccess(message, container = '#success-container') {
        const successEl = document.querySelector(container);
        if (successEl) {
            this.setText(successEl, message);
            this.show(successEl);
            this.addClass(successEl, 'success');
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                this.hide(successEl);
                this.removeClass(successEl, 'success');
            }, 3000);
        } else {
            console.log('Success:', message);
        }
    }

    /**
     * Format time duration from seconds
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration (e.g., "1:23")
     */
    static formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format file size
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size (e.g., "1.2 MB")
     */
    static formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Check if checkbox/radio is checked
     * @param {string|Element} element - Element or selector
     * @returns {boolean} - Whether element is checked
     */
    static isChecked(element) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        return el ? el.checked : false;
    }

    /**
     * Set checkbox/radio checked state
     * @param {string|Element} element - Element or selector
     * @param {boolean} checked - Whether to check the element
     */
    static setChecked(element, checked) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        if (el) {
            el.checked = checked;
        }
    }

    /**
     * Animate element with CSS class
     * @param {string|Element} element - Element or selector
     * @param {string} animationClass - CSS animation class
     * @param {number} [duration=1000] - Animation duration in ms
     * @returns {Promise} Promise that resolves when animation completes
     */
    static animate(element, animationClass, duration = 1000) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        
        return new Promise((resolve) => {
            if (!el) {
                resolve();
                return;
            }

            this.addClass(el, animationClass);
            
            setTimeout(() => {
                this.removeClass(el, animationClass);
                resolve();
            }, duration);
        });
    }

    /**
     * Safely get element by ID
     * @param {string} id - Element ID (without #)
     * @returns {Element|null} Element or null if not found
     */
    static getElementById(id) {
        return document.getElementById(id);
    }

    /**
     * Safely get element by selector
     * @param {string} selector - CSS selector
     * @returns {Element|null} Element or null if not found
     */
    static querySelector(selector) {
        return document.querySelector(selector);
    }

    /**
     * Safely get elements by selector
     * @param {string} selector - CSS selector
     * @returns {NodeList} NodeList of elements
     */
    static querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }
}